/**
 * Escena de profundidad (Three.js puro, sin React Three Fiber). Toma cada
 * elemento del afiche SVG marcado con `data-amp` (PosterDecor), lo rasteriza a
 * una textura y lo pone en un plano a su profundidad (`data-z`). La interfaz
 * nunca vive aquí: esto es fondo.
 *
 * Movimiento:
 * - Entrada: inclinación del teléfono (beta/gamma), puntero en escritorio y un
 *   poco de scroll. Zona muerta de 0,8°, escala completa a 12°.
 * - La postura "neutra" se recentra MUY lento (vida media ~15 s) y solo cuando
 *   el teléfono está quieto: una inclinación sostenida se mantiene visible.
 * - Cada capa tiene su propio resorte con inercia: las del fondo responden más
 *   lento, como tinta bajo papel. La capa más honda además se desplaza con un
 *   shader mínimo que solo se mueve mientras hay movimiento.
 * - Render a pedido: cuando todo se asienta, no se dibuja más. Se pausa con la
 *   pestaña oculta o el hero fuera de pantalla.
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
  ShaderMaterial,
  WebGLRenderer,
  type Material,
  type Texture,
} from 'three';
import { RESOLUCION, UMBRAL, type Perfil } from './profile';

type Capa = { nodo: Element; svg: SVGSVGElement; amp: number; z: number; liquido: boolean };
type Opciones = { sensor: boolean; alEstado?: (e: EstadoEscena) => void };
export type EstadoEscena = {
  perfil: Perfil;
  sensor: 'apagado' | 'esperando' | 'activo';
  beta: number | null;
  gamma: number | null;
  fps: number;
  offsets: { amp: number; px: number }[];
};

const FOV = 30;
const DIST = 10;
const ZONA_MUERTA = 0.8; // grados
const ESCALA = 12; // grados de inclinación que equivalen al máximo desplazamiento
const RECENTRAR = 0.0008; // por evento (~60 Hz): vida media ~15 s, solo con el teléfono quieto
const GIRO = { FULL: 1.5, LITE: 1.0 }; // grados
const AMP_MAX = 32;

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

/** Tinta bajo papel: desplazamiento de UV de baja frecuencia, solo mientras hay movimiento. */
function materialLiquido(map: Texture) {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    uniforms: { map: { value: map }, uFlujo: { value: [0, 0] }, uFase: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map; uniform vec2 uFlujo; uniform float uFase; varying vec2 vUv;
      void main() {
        vec2 d = vec2(sin(vUv.y * 5.0 + uFase), cos(vUv.x * 4.0 - uFase * 0.7));
        gl_FragColor = texture2D(map, vUv + d * uFlujo);
        #include <colorspace_fragment>
      }`,
  });
}

export async function montar(decor: HTMLElement, host: HTMLElement, perfilInicial: Perfil, op: Opciones) {
  let perfil = perfilInicial;
  const estilo = getComputedStyle(decor);
  const capas: Capa[] = [];
  decor.querySelectorAll<SVGSVGElement>('svg.pd-layer').forEach((svg) => {
    if (svg.dataset.amp) {
      capas.push({ nodo: svg, svg, amp: Number(svg.dataset.amp), z: Number(svg.dataset.z ?? 0), liquido: svg.dataset.liquid === '1' });
      return;
    }
    svg.querySelectorAll<SVGElement>('[data-amp]').forEach((el) => {
      capas.push({ nodo: el, svg, amp: Number(el.dataset.amp), z: Number(el.dataset.z ?? 0), liquido: false });
    });
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
  type Plano = { malla: Mesh; capa: Capa; x0: number; y0: number; mundoPorPx: number; px: number; py: number; vx: number; vy: number };
  const planos: Plano[] = [];

  let ancho = 0;
  let alto = 0;
  const escala = () => {
    const r = RESOLUCION[perfil === 'FULL' ? 'FULL' : 'LITE'];
    const dpr = Math.min(window.devicePixelRatio || 1, r.dpr);
    return Math.min(dpr, Math.sqrt(r.pixeles / Math.max(1, ancho * alto)));
  };

  const limpiar = () => {
    for (const p of planos) {
      const mat = p.malla.material as Material & { map?: Texture; uniforms?: { map: { value: Texture } } };
      mat.map?.dispose();
      mat.uniforms?.map.value.dispose();
      mat.dispose();
      grupo.remove(p.malla);
    }
    planos.length = 0;
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

    const nuevos: Plano[] = [];
    for (const capa of capas) {
      let markup: string;
      if (capa.nodo === capa.svg) {
        markup = new XMLSerializer().serializeToString(capa.svg);
      } else {
        // Un elemento por textura: se clona su SVG y se quitan los demás planos.
        const indice = [...capa.svg.querySelectorAll('[data-amp]')].indexOf(capa.nodo);
        const copia = capa.svg.cloneNode(true) as SVGSVGElement;
        copia.querySelectorAll('[data-amp]').forEach((el, i) => {
          if (i !== indice) el.remove();
        });
        markup = new XMLSerializer().serializeToString(copia);
      }
      markup = resolverVariables(markup, estilo).replace(/<svg([^>]*?)>/, (_m, attrs: string) =>
        `<svg${attrs.replace(/\s(width|height)="[^"]*"/g, '')} width="${ancho}" height="${alto}">`,
      );
      if (!/xmlns=/.test(markup)) markup = markup.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');

      const r = capa.nodo.getBoundingClientRect();
      const pad = 40; // los filtros de imprenta salen un poco de la caja geométrica
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
      const mat =
        capa.liquido && perfil === 'FULL'
          ? materialLiquido(tex)
          : new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false });
      const malla = new Mesh(geo, mat);
      // En reposo, cada plano calza píxel a píxel con el SVG estático.
      const distancia = DIST - capa.z;
      const mundoPorPx = (2 * distancia * Math.tan((FOV * Math.PI) / 360)) / alto;
      malla.scale.set(w * mundoPorPx, h * mundoPorPx, 1);
      const x0 = (x + w / 2 - ancho / 2) * mundoPorPx;
      const y0 = -(y + h / 2 - alto / 2) * mundoPorPx;
      malla.position.set(x0, y0, capa.z);
      malla.renderOrder = capa.z;
      nuevos.push({ malla, capa, x0, y0, mundoPorPx, px: 0, py: 0, vx: 0, vy: 0 });
    }
    limpiar();
    for (const p of nuevos) {
      grupo.add(p.malla);
      planos.push(p);
    }
    sucio = true;
    pedir();
  };

  // ---- Entrada: inclinación (móvil), puntero (escritorio), scroll leve ----
  const objetivo = { x: 0, y: 0 };
  const sensor = { bx: NaN, by: NaN, beta: null as number | null, gamma: null as number | null, ultimo: 0 };
  let estadoSensor: EstadoEscena['sensor'] = 'apagado';
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
    return (Math.sign(v) * Math.min(a - ZONA_MUERTA, ESCALA)) / ESCALA;
  };
  /** beta/gamma en grados. También lo usa la simulación de QA. */
  const aplicarInclinacion = (beta: number, gamma: number) => {
    const angulo = screen.orientation?.angle ?? 0;
    const [b, g] = angulo === 90 ? [-gamma, beta] : angulo === 270 ? [gamma, -beta] : [beta, gamma];
    if (Number.isNaN(sensor.bx)) {
      sensor.bx = b;
      sensor.by = g;
    }
    const dx = g - sensor.by;
    const dy = b - sensor.bx;
    // Recentrar solo con el teléfono casi quieto: no se come la inclinación sostenida.
    const quieto = Math.abs((sensor.gamma ?? g) - g) < 0.3 && Math.abs((sensor.beta ?? b) - b) < 0.3;
    if (quieto) {
      sensor.bx += dy * RECENTRAR;
      sensor.by += dx * RECENTRAR;
    }
    sensor.beta = b;
    sensor.gamma = g;
    objetivo.x = conZona(dx);
    objetivo.y = conZona(dy);
    pedir();
  };
  const alInclinar = (e: DeviceOrientationEvent) => {
    if (e.beta == null || e.gamma == null) return;
    if (!usandoSensor) {
      usandoSensor = true;
      estadoSensor = 'activo';
      avisar();
    }
    sensor.ultimo = performance.now();
    aplicarInclinacion(e.beta, e.gamma);
  };
  const activarSensor = () => {
    if (estadoSensor === 'apagado') estadoSensor = 'esperando';
    window.addEventListener('deviceorientation', alInclinar);
    avisar();
  };
  let scrollY = 0;
  const alScroll = () => {
    const r = decor.getBoundingClientRect();
    scrollY = Math.max(-1, Math.min(1, -r.top / Math.max(1, r.height)));
    pedir();
  };

  // ---- Física por capa (resorte con inercia) y dibujo ----
  /** Más hondo = más lento: el fondo "llega tarde", como tinta bajo papel. */
  const rigidez = (amp: number) => 0.035 + (amp / AMP_MAX) * 0.07;
  const AMORTIGUA = 0.8;
  let fase = 0;

  const paso = () => {
    let movimiento = 0;
    const tx = objetivo.x;
    const ty = objetivo.y + scrollY * 0.5;
    for (const p of planos) {
      const kx = rigidez(p.capa.amp);
      p.vx = (p.vx + (tx - p.px) * kx) * AMORTIGUA;
      p.vy = (p.vy + (ty - p.py) * kx) * AMORTIGUA;
      p.px += p.vx;
      p.py += p.vy;
      movimiento = Math.max(movimiento, Math.abs(p.vx) + Math.abs(p.vy), Math.abs(tx - p.px) + Math.abs(ty - p.py));
    }
    return movimiento;
  };

  const dibujar = () => {
    const giro = (GIRO[perfil === 'FULL' ? 'FULL' : 'LITE'] * Math.PI) / 180;
    let gx = 0;
    let gy = 0;
    for (const p of planos) {
      const { malla, capa, x0, y0, mundoPorPx } = p;
      malla.position.x = x0 - p.px * capa.amp * mundoPorPx;
      malla.position.y = y0 + p.py * capa.amp * mundoPorPx;
      // Perspectiva: lo cercano crece apenas al inclinar.
      const s = 1 + Math.max(0, capa.z) * 0.012 * Math.min(1, Math.hypot(p.px, p.py));
      malla.scale.z = 1;
      malla.userData.base ??= { sx: malla.scale.x, sy: malla.scale.y };
      malla.scale.x = malla.userData.base.sx * s;
      malla.scale.y = malla.userData.base.sy * s;
      const mat = malla.material as ShaderMaterial;
      if (mat.uniforms?.uFlujo) {
        fase += (Math.abs(p.vx) + Math.abs(p.vy)) * 6;
        mat.uniforms.uFlujo.value = [Math.max(-0.008, Math.min(0.008, p.vx * 0.08)), Math.max(-0.008, Math.min(0.008, p.vy * 0.08))];
        mat.uniforms.uFase.value = fase;
      }
      if (capa.amp === AMP_MAX) {
        gx = p.px;
        gy = p.py;
      }
    }
    grupo.rotation.y = gx * giro;
    grupo.rotation.x = gy * giro * 0.6;
    renderer.render(scene, camera);
    if (sucio && planos.length) {
      sucio = false;
      decor.classList.add('pd-live');
    }
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
  let fps = 0;

  const pedir = () => {
    if (!raf && visible && enPantalla && !cerrado) raf = requestAnimationFrame(cuadro);
  };

  const cuadro = (t: number) => {
    raf = 0;
    if (ultimo) {
      const dt = t - ultimo;
      fps = fps ? fps * 0.9 + (1000 / dt) * 0.1 : 1000 / dt;
      if (calibrando) {
        muestras.push(dt);
        if (muestras.length >= 45) {
          calibrando = false;
          const orden = [...muestras].sort((a, b) => a - b);
          const mediana = orden[orden.length >> 1];
          if (perfil === 'FULL' && mediana > UMBRAL.FULL_A_LITE) {
            perfil = 'LITE';
            decor.dataset.perfil = perfil;
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
    }
    ultimo = t;
    const movimiento = paso();
    dibujar();
    if (calibrando || movimiento > 0.0006) pedir();
    else ultimo = 0; // asentado: no se dibuja más hasta que algo cambie
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

  const estado = (): EstadoEscena => ({
    perfil,
    sensor: estadoSensor,
    beta: sensor.beta == null ? null : Math.round(sensor.beta * 10) / 10,
    gamma: sensor.gamma == null ? null : Math.round(sensor.gamma * 10) / 10,
    fps: Math.round(fps),
    offsets: planos.map((p) => ({ amp: p.capa.amp, px: Math.round(Math.hypot(p.px, p.py) * p.capa.amp * 10) / 10 })),
  });
  let avisoPendiente = false;
  const avisar = () => {
    if (!op.alEstado || avisoPendiente) return;
    avisoPendiente = true;
    queueMicrotask(() => {
      avisoPendiente = false;
      op.alEstado?.(estado());
    });
  };

  /**
   * QA (?3ddebug=1): fija una inclinación sintética y deja las capas en su
   * posición de equilibrio, dibujando una vez aunque la pestaña esté oculta.
   */
  const simular = (beta: number, gamma: number, asentar = true) => {
    sensor.bx = 0;
    sensor.by = 0;
    sensor.beta = beta;
    sensor.gamma = gamma;
    objetivo.x = conZona(gamma);
    objetivo.y = conZona(beta);
    if (asentar) {
      for (const p of planos) {
        p.px = objetivo.x;
        p.py = objetivo.y;
        p.vx = 0;
        p.vy = 0;
      }
      dibujar();
    } else pedir();
    avisar();
    return estado();
  };

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
  return { cerrar, activarSensor, estado, simular };
}
