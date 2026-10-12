/**
 * Escena de profundidad (Three.js puro, sin React Three Fiber). Toma las capas
 * SVG ya dibujadas por PosterDecor, las rasteriza a texturas y las pone en
 * planos a distinta profundidad. La interfaz nunca vive aquí: esto es fondo.
 *
 * - Render a pedido: solo se dibuja cuando algo se movió (o en la calibración).
 * - Se pausa con la pestaña oculta o el hero fuera de pantalla.
 * - Se mide a sí misma y baja de FULL a LITE, o se apaga (STATIC).
 */
import {
  CanvasTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  SRGBColorSpace,
  Scene,
  WebGLRenderer,
} from 'three';
import { RESOLUCION, UMBRAL, type Perfil } from './profile';

type Capa = { nodo: SVGGraphicsElement; svg: SVGSVGElement; amp: number; z: number };
type Opciones = { sensor: boolean };

const FOV = 30;
const DIST = 10;
const ZONA_MUERTA = 1.5; // grados
const TOPE = 18; // grados de inclinación que equivalen al máximo desplazamiento
const AMP_Z0 = 3;
const AMP_Z1 = 7;
const AMP_ANILLOS = [14, 13, 12, 11, 10, 9]; // del "?" más cercano al más hondo
const GIRO = { FULL: 1.2, LITE: 0.8 }; // grados

/** El SVG suelto no ve las variables CSS de la página: se resuelven antes. */
function resolverVariables(markup: string, estilo: CSSStyleDeclaration) {
  return markup.replace(/var\((--[\w-]+)(?:,\s*([^)]+))?\)/g, (_, nombre: string, respaldo?: string) => {
    const v = estilo.getPropertyValue(nombre).trim();
    return v || (respaldo ?? '').trim() || '#000';
  });
}

function cargar(markup: string): Promise<HTMLImageElement> {
  return new Promise((ok, mal) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => ok(img);
    img.onerror = mal;
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  });
}

export async function montar(decor: HTMLElement, host: HTMLElement, perfilInicial: Perfil, op: Opciones) {
  let perfil = perfilInicial;
  const estilo = getComputedStyle(decor);
  const capas: Capa[] = [];
  decor.querySelectorAll<SVGSVGElement>('svg.pd-layer').forEach((svg) => {
    const d = svg.dataset.depth;
    if (d === '2') {
      svg.querySelectorAll<SVGGElement>('g[data-ring]').forEach((g) => {
        const i = Number(g.dataset.ring);
        capas.push({ nodo: g, svg, amp: AMP_ANILLOS[i] ?? 10, z: 0.5 - i * 0.22 });
      });
    } else {
      capas.push({ nodo: svg, svg, amp: d === '0' ? AMP_Z0 : AMP_Z1, z: d === '0' ? -2.2 : -1.4 });
    }
  });
  if (!capas.length) throw new Error('sin capas');

  const renderer = new WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.className = 'pd-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  host.prepend(canvas);

  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 50);
  camera.position.z = DIST;
  const grupo = new Group();
  scene.add(grupo);
  const geo = new PlaneGeometry(1, 1);
  const mallas: { malla: Mesh; capa: Capa; x0: number; y0: number; mundoPorPx: number }[] = [];

  let ancho = 0;
  let alto = 0;
  const escala = () => {
    const r = RESOLUCION[perfil === 'FULL' ? 'FULL' : 'LITE'];
    const dpr = Math.min(window.devicePixelRatio || 1, r.dpr);
    return Math.min(dpr, Math.sqrt(r.pixeles / Math.max(1, ancho * alto)));
  };

  const limpiar = () => {
    for (const m of mallas) {
      const mat = m.malla.material as MeshBasicMaterial;
      mat.map?.dispose();
      mat.dispose();
      grupo.remove(m.malla);
    }
    mallas.length = 0;
  };

  /** Rasteriza cada capa al tamaño real del hero, recortada a su caja. */
  const construir = async () => {
    const caja = decor.getBoundingClientRect();
    ancho = Math.round(caja.width);
    alto = Math.round(caja.height);
    if (ancho < 2 || alto < 2) return;
    const k = escala();
    renderer.setPixelRatio(k);
    renderer.setSize(ancho, alto, false);
    camera.aspect = ancho / alto;
    camera.updateProjectionMatrix();
    decor.classList.remove('pd-live');

    const nuevas: typeof mallas = [];
    for (const capa of capas) {
      let markup: string;
      if (capa.nodo === capa.svg) {
        markup = new XMLSerializer().serializeToString(capa.svg);
      } else {
        // Un anillo por textura: se clona el SVG y se deja solo ese anillo.
        const copia = capa.svg.cloneNode(true) as SVGSVGElement;
        copia.querySelectorAll('g[data-ring]').forEach((g) => {
          if (g.getAttribute('data-ring') !== (capa.nodo as SVGGElement).dataset.ring) g.remove();
        });
        markup = new XMLSerializer().serializeToString(copia);
      }
      markup = resolverVariables(markup, estilo)
        .replace(/<svg([^>]*?)>/, (m, attrs: string) =>
          `<svg${attrs.replace(/\s(width|height)="[^"]*"/g, '')} width="${ancho}" height="${alto}">`,
        );
      if (!/xmlns=/.test(markup)) markup = markup.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');

      const r = capa.nodo.getBoundingClientRect();
      const pad = 24;
      const x = Math.max(0, Math.floor(r.left - caja.left - pad));
      const y = Math.max(0, Math.floor(r.top - caja.top - pad));
      const w = Math.min(ancho - x, Math.ceil(r.width + pad * 2));
      const h = Math.min(alto - y, Math.ceil(r.height + pad * 2));
      if (w < 2 || h < 2) continue;
      const img = await cargar(markup);
      const lienzo = document.createElement('canvas');
      lienzo.width = Math.max(1, Math.round(w * k));
      lienzo.height = Math.max(1, Math.round(h * k));
      const ctx = lienzo.getContext('2d');
      if (!ctx) continue;
      ctx.drawImage(img, -x * k, -y * k, ancho * k, alto * k);
      const tex = new CanvasTexture(lienzo);
      tex.colorSpace = SRGBColorSpace;
      tex.generateMipmaps = false;
      const mat = new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false });
      const malla = new Mesh(geo, mat);
      // Tamaño en mundo para que, en reposo, el plano calce píxel a píxel con el SVG.
      const distancia = DIST - capa.z;
      const mundoPorPx = (2 * distancia * Math.tan((FOV * Math.PI) / 360)) / alto;
      malla.scale.set(w * mundoPorPx, h * mundoPorPx, 1);
      const x0 = (x + w / 2 - ancho / 2) * mundoPorPx;
      const y0 = -(y + h / 2 - alto / 2) * mundoPorPx;
      malla.position.set(x0, y0, capa.z);
      malla.renderOrder = capa.z;
      nuevas.push({ malla, capa, x0, y0, mundoPorPx });
    }
    limpiar();
    for (const m of nuevas) {
      grupo.add(m.malla);
      mallas.push(m);
    }
    sucio = true;
    pedir();
  };

  // ---- Entrada: puntero (escritorio), scroll leve, inclinación (móvil) ----
  const objetivo = { x: 0, y: 0 };
  const actual = { x: 0, y: 0 };
  const sensor = { x: 0, y: 0, bx: NaN, by: NaN };
  let usandoSensor = false;

  const alPuntero = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || usandoSensor) return;
    objetivo.x = (e.clientX / window.innerWidth) * 2 - 1;
    objetivo.y = (e.clientY / window.innerHeight) * 2 - 1;
    pedir();
  };
  const conZona = (v: number) => {
    const a = Math.abs(v);
    if (a < ZONA_MUERTA) return 0;
    return (Math.sign(v) * Math.min(a - ZONA_MUERTA, TOPE)) / TOPE;
  };
  const alInclinar = (e: DeviceOrientationEvent) => {
    if (e.beta == null || e.gamma == null) return;
    const angulo = screen.orientation?.angle ?? 0;
    const [b, g] = angulo === 90 ? [-e.gamma, e.beta] : angulo === 270 ? [e.gamma, -e.beta] : [e.beta, e.gamma];
    if (Number.isNaN(sensor.bx)) {
      sensor.bx = b;
      sensor.by = g;
    }
    // La postura "neutra" se desliza despacio: sostener el teléfono inclinado no deja el afiche corrido.
    sensor.bx += (b - sensor.bx) * 0.004;
    sensor.by += (g - sensor.by) * 0.004;
    // Pasa-bajos sobre la lectura cruda.
    sensor.x += (conZona(g - sensor.by) - sensor.x) * 0.18;
    sensor.y += (conZona(b - sensor.bx) - sensor.y) * 0.18;
    usandoSensor = true;
    objetivo.x = sensor.x;
    objetivo.y = sensor.y;
    pedir();
  };
  const activarSensor = () => {
    window.addEventListener('deviceorientation', alInclinar);
  };
  let scrollY = 0;
  const alScroll = () => {
    const r = decor.getBoundingClientRect();
    scrollY = Math.max(-1, Math.min(1, -r.top / Math.max(1, r.height)));
    pedir();
  };

  // ---- Ciclo a pedido ----
  let raf = 0;
  let visible = !document.hidden;
  let enPantalla = true;
  let sucio = true;
  let cerrado = false;
  const muestras: number[] = [];
  let calibrando = true;
  let ultimo = 0;

  const pedir = () => {
    if (!raf && visible && enPantalla && !cerrado) raf = requestAnimationFrame(cuadro);
  };

  const cuadro = (t: number) => {
    raf = 0;
    if (calibrando && ultimo) {
      muestras.push(t - ultimo);
      if (muestras.length >= 45) {
        calibrando = false;
        const orden = [...muestras].sort((a, b) => a - b);
        const mediana = orden[orden.length >> 1];
        if (perfil === 'FULL' && mediana > UMBRAL.FULL_A_LITE) {
          perfil = 'LITE';
          decor.dataset.perfil = perfil;
          // LITE se vuelve a medir: si tampoco alcanza, queda el afiche estático.
          muestras.length = 0;
          calibrando = true;
          ultimo = 0;
          construir().catch(cerrar);
          return;
        } else if (perfil === 'LITE' && mediana > UMBRAL.LITE_A_STATIC) {
          cerrar();
          return;
        }
      }
    }
    ultimo = t;
    const k = 0.085;
    const dx = objetivo.x - actual.x;
    const dy = objetivo.y + scrollY * 0.6 - actual.y;
    actual.x += dx * k;
    actual.y += dy * k;
    const quieto = Math.abs(dx) < 0.0015 && Math.abs(dy) < 0.0015;

    for (const { malla, capa, x0, y0, mundoPorPx } of mallas) {
      malla.position.x = x0 - actual.x * capa.amp * mundoPorPx;
      malla.position.y = y0 + actual.y * capa.amp * mundoPorPx;
    }
    const giro = ((GIRO[perfil === 'FULL' ? 'FULL' : 'LITE'] * Math.PI) / 180);
    grupo.rotation.y = actual.x * giro;
    grupo.rotation.x = actual.y * giro * 0.6;
    renderer.render(scene, camera);
    if (sucio && mallas.length) {
      sucio = false;
      decor.classList.add('pd-live');
    }
    if (calibrando || !quieto) pedir();
  };

  const io = new IntersectionObserver(([e]) => {
    enPantalla = e.isIntersecting;
    pedir();
  });
  io.observe(decor);
  const alVisibilidad = () => {
    visible = !document.hidden;
    pedir();
  };
  let espera = 0;
  let anchoPrevio = 0;
  const ro = new ResizeObserver(() => {
    const w = Math.round(decor.getBoundingClientRect().width);
    if (w === anchoPrevio) return; // la barra de direcciones móvil cambia el alto: no reconstruir
    anchoPrevio = w;
    clearTimeout(espera);
    espera = window.setTimeout(() => construir().catch(cerrar), 180);
  });

  const cerrar = () => {
    if (cerrado) return;
    cerrado = true;
    cancelAnimationFrame(raf);
    clearTimeout(espera);
    io.disconnect();
    ro.disconnect();
    window.removeEventListener('pointermove', alPuntero);
    window.removeEventListener('deviceorientation', alInclinar);
    window.removeEventListener('scroll', alScroll);
    document.removeEventListener('visibilitychange', alVisibilidad);
    limpiar();
    geo.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
    decor.classList.remove('pd-live');
    delete decor.dataset.perfil;
  };

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    cerrar();
  });

  decor.dataset.perfil = perfil;
  anchoPrevio = Math.round(decor.getBoundingClientRect().width);
  try {
    await construir();
  } catch (e) {
    cerrar();
    throw e;
  }
  ro.observe(decor);
  window.addEventListener('pointermove', alPuntero, { passive: true });
  window.addEventListener('scroll', alScroll, { passive: true });
  document.addEventListener('visibilitychange', alVisibilidad);
  if (op.sensor) activarSensor();
  alScroll();
  return { cerrar, activarSensor };
}
