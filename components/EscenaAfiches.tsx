'use client';
import { useEffect, useRef } from 'react';
import { arrastrar, avanzarVidrio, crearFiltroSensor, crearVidrio, empujar, FISICA, reiniciar, sentir, type Vidrio } from '../lib/vidrio-fisica';
import { conectarSensor } from './poster/sensor';
import { ACERCAR_MS, ALEJARSE_MS, ESCALON_MS, GIRO_MAX_AFICHE } from '../lib/vidrio-tiempos';

const PX = 100; // 1 unidad de mundo = 100 px en el plano de los afiches
const GROSOR = 0.12; // cartón grueso: lo que se ve de canto al girar

type Tarjeta = {
  el: HTMLElement;
  v: Vidrio;
  malla: import('three').Mesh;
  sombra: import('three').Mesh;
  material: import('three').MeshStandardMaterial;
  fase: number;
  /** Cuándo apareció en pantalla (para "acercar"); null mientras está oculta. */
  llego: number | null;
  indice: number;
  /** Cuándo empezó a alejarse (elegida o descartada). */
  seVa: number | null;
};

/**
 * Afiches con volumen real: cada botón `[data-fisica]` del asistente tiene su
 * propio cuerpo rígido (modelo de la calculadora de referencia, ver
 * lib/vidrio-fisica.ts) y Three.js dibuja su canto de cartón y su sombra en UN
 * canvas compartido. El afiche DOM (texto nítido, área táctil, lector de
 * pantalla) gira con el mismo cuerpo vía variables CSS, con un tope pequeño
 * para que el área táctil casi no se mueva.
 *
 * Nunca bloquea: si no hay WebGL, se pierde el contexto o hay movimiento
 * reducido, avisa `fallback` y los afiches quedan planos como siempre.
 */
export default function EscenaAfiches({
  raiz,
  onEstado,
}: {
  raiz: React.RefObject<HTMLElement | null>;
  onEstado: (e: 'listo' | 'fallback') => void;
}) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = lienzo.current;
    const contenedor = raiz.current;
    if (!canvas || !contenedor) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return onEstado('fallback');
    let vivo = true;
    let limpiar = () => {};
    (async () => {
      let THREE: typeof import('three');
      let C: typeof import('cannon-es');
      let RoundedBoxGeometry: typeof import('three/examples/jsm/geometries/RoundedBoxGeometry.js').RoundedBoxGeometry;
      try {
        [THREE, C, { RoundedBoxGeometry }] = await Promise.all([import('three'), import('cannon-es'), import('three/examples/jsm/geometries/RoundedBoxGeometry.js')]);
      } catch {
        return vivo && onEstado('fallback');
      }
      if (!vivo) return;
      let renderer: import('three').WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
      } catch {
        return onEstado('fallback');
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      const escena = new THREE.Scene();
      const camara = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
      const ajustar = () => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        renderer.setSize(w, h, false);
        camara.aspect = w / h;
        camara.position.set(0, 0, h / PX / 2 / Math.tan(THREE.MathUtils.degToRad(camara.fov / 2)));
        camara.updateProjectionMatrix();
        camara.updateMatrixWorld();
      };
      ajustar();
      // Luz de afiche nocturno: luz blanca alta, contraluz coral y un relleno frío.
      const llave = new THREE.DirectionalLight(0xfff3e2, 2.2);
      llave.position.set(-3, 5, 6);
      const contra = new THREE.PointLight(0xf0607a, 22, 0, 2);
      const relleno = new THREE.DirectionalLight(0x8c98d6, 0.7);
      relleno.position.set(4, -3, 3);
      escena.add(llave, contra, relleno, new THREE.AmbientLight(0x2b2c45, 1.1));

      // Sombra suave reutilizable (textura radial en un canvas 2D).
      const lona = document.createElement('canvas');
      lona.width = lona.height = 128;
      const g = lona.getContext('2d')!;
      const grad = g.createRadialGradient(64, 64, 8, 64, 64, 64);
      grad.addColorStop(0, 'rgba(0,0,0,.55)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 128, 128);
      const texSombra = new THREE.CanvasTexture(lona);

      const tarjetas = new Map<HTMLElement, Tarjeta>();
      const colorDe = (el: HTMLElement) => {
        const papel = el.querySelector<HTMLElement>('.bv-papel') ?? el;
        const c = getComputedStyle(papel).backgroundColor;
        try {
          return new THREE.Color(c && c !== 'rgba(0, 0, 0, 0)' ? c : '#EFE3D3');
        } catch {
          return new THREE.Color('#EFE3D3');
        }
      };
      const crear = (el: HTMLElement, r: DOMRect, indice: number): Tarjeta => {
        const w = r.width / PX;
        const h = r.height / PX;
        const geo = new RoundedBoxGeometry(w * 0.985, h * 0.985, GROSOR, 3, 0.025);
        const material = new THREE.MeshStandardMaterial({ color: colorDe(el).multiplyScalar(0.72), roughness: 0.85, metalness: 0, transparent: true });
        const malla = new THREE.Mesh(geo, material);
        const sombra = new THREE.Mesh(
          new THREE.PlaneGeometry(w * 1.35, h * 1.45),
          new THREE.MeshBasicMaterial({ map: texSombra, transparent: true, depthWrite: false }),
        );
        escena.add(sombra, malla);
        return { el, v: crearVidrio(C, w, h), malla, sombra, material, fase: Math.random() * 20, llego: null, indice, seVa: null };
      };
      const soltar = (t: Tarjeta) => {
        escena.remove(t.malla, t.sombra);
        t.malla.geometry.dispose();
        t.material.dispose();
        t.sombra.geometry.dispose();
        (t.sombra.material as import('three').Material).dispose();
        for (const k of ['--fx', '--fy', '--fz']) t.el.style.removeProperty(k);
      };

      // Sensor: sólo con activación explícita; neutro calibrado, tope, suavizado y reset.
      const filtro = crearFiltroSensor();
      let sensorPrevio = { x: 0, y: 0 };
      // Adaptador común: orientación o, sin giroscopio, acelerómetro; activar/desactivar sin recargar.
      let usarSensor = false;
      const desconectar = conectarSensor((tilt) => {
        if (!tilt) {
          if (usarSensor) for (const t of tarjetas.values()) reiniciar(t.v);
          usarSensor = false;
          filtro.reset();
          sensorPrevio = { x: 0, y: 0 };
          return;
        }
        usarSensor = true;
        filtro.muestra(tilt.x, tilt.y);
      });

      // Dedo o mouse: impulso en el punto tocado; arrastrar suma giro (como la demo).
      const ray = new THREE.Raycaster();
      let tomada: { t: Tarjeta; x: number; y: number } | null = null;
      const tocar = (e: PointerEvent) => {
        const el = (e.target as HTMLElement | null)?.closest?.('[data-fisica]') as HTMLElement | null;
        const t = el && tarjetas.get(el);
        if (!t) return;
        const ndc = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
        ray.setFromCamera(ndc, camara);
        const punto = new THREE.Vector3();
        if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -GROSOR / 2), punto)) return;
        const centro = t.malla.position.clone().setZ(0);
        empujar(C, t.v, punto.sub(centro), ray.ray.direction.clone().normalize(), FISICA.intensidadBoton);
        tomada = { t, x: e.clientX, y: e.clientY };
      };
      const mover = (e: PointerEvent) => {
        if (!tomada || !(e.buttons & 1)) return;
        arrastrar(tomada.t.v, e.clientX - tomada.x, e.clientY - tomada.y);
        tomada = { ...tomada, x: e.clientX, y: e.clientY };
      };
      const levantar = () => (tomada = null);
      contenedor.addEventListener('pointerdown', tocar);
      contenedor.addEventListener('pointermove', mover);
      window.addEventListener('pointerup', levantar);
      window.addEventListener('pointercancel', levantar);

      const suave = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
      let raf = 0;
      let antes = performance.now();
      const cuadro = (ahora: number) => {
        raf = 0;
        if (!vivo || document.hidden) return;
        const dt = Math.min(0.1, (ahora - antes) / 1000);
        antes = ahora;
        const s = usarSensor ? filtro.valor : null;
        const cambioSensor = s ? Math.abs(s.x - sensorPrevio.x) > FISICA.sensor.umbral || Math.abs(s.y - sensorPrevio.y) > FISICA.sensor.umbral : false;
        const presentes = new Set<HTMLElement>();
        let i = 0;
        for (const el of contenedor.querySelectorAll<HTMLElement>('[data-fisica]')) {
          presentes.add(el);
          const r = el.getBoundingClientRect();
          const visible = r.width > 0 && r.bottom > 0 && r.top < window.innerHeight && !el.closest('[inert]');
          let t = tarjetas.get(el);
          if (!t) {
            if (!visible) continue;
            t = crear(el, r, i);
            tarjetas.set(el, t);
          }
          if (!visible) {
            t.llego = null;
            t.seVa = null;
            t.malla.visible = t.sombra.visible = false;
            continue;
          }
          if (t.llego == null) {
            t.llego = ahora;
            t.indice = i;
            reiniciar(t.v);
          }
          i++;
          if (s && cambioSensor) sentir(t.v, sensorPrevio, s);
          const a = avanzarVidrio(C, t.v, dt, ahora / 1000 + t.fase, s, true, GIRO_MAX_AFICHE);
          // Llegar: desde el fondo, en cascada. Irse: hacia el fondo y desvanecerse.
          const llegada = suave((ahora - t.llego - t.indice * ESCALON_MS) / ACERCAR_MS);
          const sale = el.classList.contains('bv-elegido') || el.classList.contains('bv-se-va');
          if (sale && t.seVa == null) t.seVa = ahora;
          if (!sale) t.seVa = null;
          const ida = t.seVa == null ? 0 : suave((ahora - t.seVa) / ALEJARSE_MS);
          const z = -(1 - llegada) * 5 - ida * 6;
          const escala = (0.7 + 0.3 * llegada) * (1 - ida * 0.25);
          const x = (r.left + r.width / 2 - window.innerWidth / 2) / PX;
          const y = -(r.top + r.height / 2 - window.innerHeight / 2) / PX;
          t.malla.visible = t.sombra.visible = true;
          t.malla.position.set(x, y, z - GROSOR / 2 - 0.004);
          t.malla.rotation.set(a.x, a.y, a.z);
          t.malla.scale.setScalar(escala);
          t.material.opacity = llegada * (1 - ida);
          t.sombra.position.set(x + 0.08, y - 0.14, z - 0.35);
          t.sombra.rotation.set(a.x * 0.5, a.y * 0.5, 0);
          t.sombra.scale.setScalar(escala);
          (t.sombra.material as import('three').MeshBasicMaterial).opacity = llegada * (1 - ida) * 0.9;
          // El afiche DOM gira con el mismo cuerpo (ejes CSS: y hacia abajo).
          el.style.setProperty('--fx', `${(-a.x).toFixed(4)}rad`);
          el.style.setProperty('--fy', `${a.y.toFixed(4)}rad`);
          el.style.setProperty('--fz', `${(-a.z).toFixed(4)}rad`);
        }
        if (s && cambioSensor) sensorPrevio = { ...s };
        for (const [el, t] of tarjetas) {
          if (!presentes.has(el) || !el.isConnected) {
            soltar(t);
            tarjetas.delete(el);
          }
        }
        contra.position.set(-2.5 + Math.sin(ahora / 4000) * 0.8, 2.5, 3.5);
        renderer.render(escena, camara);
        raf = requestAnimationFrame(cuadro);
      };
      const reanudar = () => {
        if (!document.hidden && !raf && vivo) {
          antes = performance.now();
          raf = requestAnimationFrame(cuadro);
        }
      };
      const perdido = (ev: Event) => {
        ev.preventDefault();
        cancelAnimationFrame(raf);
        raf = 0;
        for (const t of tarjetas.values()) soltar(t);
        tarjetas.clear();
        onEstado('fallback');
      };
      canvas.addEventListener('webglcontextlost', perdido);
      document.addEventListener('visibilitychange', reanudar);
      window.addEventListener('resize', ajustar);
      raf = requestAnimationFrame(cuadro);
      // Diagnóstico sólo con ?vidriodebug=1 (QA): avanzar cuadros a mano donde no hay requestAnimationFrame.
      if (new URLSearchParams(location.search).has('vidriodebug'))
        (window as unknown as Record<string, unknown>).__vidrio = {
          renderer,
          tarjetas,
          cuadro: (t: number) => {
            cancelAnimationFrame(raf);
            cuadro(t);
          },
        };
      onEstado('listo');
      limpiar = () => {
        cancelAnimationFrame(raf);
        canvas.removeEventListener('webglcontextlost', perdido);
        document.removeEventListener('visibilitychange', reanudar);
        window.removeEventListener('resize', ajustar);
        desconectar();
        window.removeEventListener('pointerup', levantar);
        window.removeEventListener('pointercancel', levantar);
        contenedor.removeEventListener('pointerdown', tocar);
        contenedor.removeEventListener('pointermove', mover);
        for (const t of tarjetas.values()) soltar(t);
        tarjetas.clear();
        texSombra.dispose();
        renderer.dispose();
      };
    })();
    return () => {
      vivo = false;
      limpiar();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <canvas ref={lienzo} className="bv-escena-lienzo" aria-hidden="true" />;
}
