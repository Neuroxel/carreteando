'use client';
import { useEffect, useRef } from 'react';
import { arrastrar, avanzarVidrio, crearFiltroSensor, crearVidrio, empujar, FISICA, reiniciar, sentir } from '../lib/vidrio-fisica';
import { EVENTO_MOVIMIENTO, movimientoPermitido } from './poster/sensor';
import { ALEJARSE_MS } from '../lib/vidrio-tiempos';

const PX = 100; // 1 unidad de mundo = 100 px en el plano de la tarjeta

/**
 * Vidrio violeta real (Three.js/WebGL) detrás de UNA tarjeta DOM. Un solo canvas
 * compartido, cargado a demanda (three y cannon-es van en su propio chunk). El
 * texto y el área táctil siguen siendo el botón DOM: el canvas no recibe
 * eventos. Si no hay WebGL, se pierde el contexto o hay movimiento reducido,
 * avisa con `onEstado('fallback')` y la tarjeta queda con su vidrio CSS.
 */
export default function VidrioCanvas({
  objetivo,
  alejar,
  onEstado,
}: {
  objetivo: React.RefObject<HTMLElement | null>;
  /** true: la tarjeta se aleja hacia el fondo y se desvanece. */
  alejar: boolean;
  onEstado: (e: 'listo' | 'fallback') => void;
}) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const alejarRef = useRef(alejar);
  const inicioAlejar = useRef<number | null>(null);
  useEffect(() => {
    alejarRef.current = alejar;
    inicioAlejar.current = alejar ? performance.now() : null;
  }, [alejar]);

  useEffect(() => {
    const canvas = lienzo.current;
    const boton = objetivo.current;
    if (!canvas || !boton) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return onEstado('fallback');
    let vivo = true;
    let limpiar = () => {};
    (async () => {
      let THREE: typeof import('three');
      let C: typeof import('cannon-es');
      try {
        [THREE, C] = await Promise.all([import('three'), import('cannon-es')]);
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
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      renderer.setPixelRatio(dpr);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      const escena = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      // Entorno propio: estudio oscuro con paneles de luz (blanco, lavanda, magenta, azul).
      // Da el interior profundo y los reflejos en franjas de la referencia; una sala
      // blanca genérica lo dejaba lila pastel.
      const estudio = new THREE.Scene();
      estudio.background = new THREE.Color(0x07030f);
      const panel = (color: number, intensidad: number, w: number, h: number, x: number, y: number, z: number, ry: number, rz = 0) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensidad), side: THREE.DoubleSide }));
        m.position.set(x, y, z);
        m.lookAt(0, 0, 0);
        m.rotateZ(rz + ry * 0);
        estudio.add(m);
      };
      // Delante de la tarjeta (lo que refleja su cara): una franja diagonal blanca y un velo violeta.
      panel(0x4a22d6, 0.32, 14, 10, 0, 0, 6, 0);
      panel(0xffffff, 3, 9, 0.45, -0.5, 1.2, 5, 0, -0.5);
      panel(0xff3fd0, 1.6, 7, 0.9, 1.5, -1.6, 5, 0, -0.45);
      // A los lados (lo que reflejan los biseles).
      panel(0xd9ccff, 6, 1.2, 8, -5, 0.5, 1, 0);
      panel(0xff4fd8, 4, 1.2, 8, 5, -0.5, 1, 0);
      panel(0xffffff, 6, 10, 0.8, 0, 5, 1, 0);
      panel(0x5b6cff, 4, 10, 0.8, 0, -5, 1, 0);
      const entorno = pmrem.fromScene(estudio, 0.02).texture;
      escena.environment = entorno;
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
      // Luces de color que pasan por el vidrio: lavanda y magenta, como la referencia.
      const lavanda = new THREE.PointLight(0xc9b6ff, 30, 0, 2);
      const magenta = new THREE.PointLight(0xff4fd8, 18, 0, 2);
      const azul = new THREE.PointLight(0x5b6cff, 14, 0, 2);
      escena.add(lavanda, magenta, azul, new THREE.AmbientLight(0x2a1a70, 0.2));

      let r = boton.getBoundingClientRect();
      const w = r.width / PX;
      const h = r.height / PX;
      const radio = Math.min(w, h) * 0.3;
      const forma = new THREE.Shape();
      const x0 = -w / 2 + 0.06;
      const y0 = -h / 2 + 0.06;
      const ww = w - 0.12;
      const hh = h - 0.12;
      const rr = Math.min(radio, ww / 2, hh / 2);
      forma.moveTo(x0 + rr, y0);
      forma.lineTo(x0 + ww - rr, y0);
      forma.quadraticCurveTo(x0 + ww, y0, x0 + ww, y0 + rr);
      forma.lineTo(x0 + ww, y0 + hh - rr);
      forma.quadraticCurveTo(x0 + ww, y0 + hh, x0 + ww - rr, y0 + hh);
      forma.lineTo(x0 + rr, y0 + hh);
      forma.quadraticCurveTo(x0, y0 + hh, x0, y0 + hh - rr);
      forma.lineTo(x0, y0 + rr);
      forma.quadraticCurveTo(x0, y0, x0 + rr, y0);
      const geo = new THREE.ExtrudeGeometry(forma, { depth: FISICA.grosor - 0.1, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.09, bevelSegments: 10, curveSegments: 24 });
      geo.center();
      geo.computeVertexNormals();
      // Vidrio grueso: material físico con transmisión, iridiscencia y barniz.
      const vidrio = new THREE.MeshPhysicalMaterial({
        color: 0x3d1fb0,
        metalness: 0.05,
        roughness: 0.12,
        clearcoat: 1,
        clearcoatRoughness: 0.02,
        iridescence: 0.4,
        iridescenceIOR: 1.3,
        envMapIntensity: 1.2,
        emissive: 0x1c0866,
        emissiveIntensity: 0.55,
        transparent: true,
        opacity: 0.93,
      });
      // Bisel luminoso: borde de Fresnel aditivo sobre la misma geometría.
      const borde = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uColor: { value: new THREE.Color(0xeee6ff) }, uOpacidad: { value: 1 } },
        vertexShader: `varying vec3 vN; varying vec3 vV;
          void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
        fragmentShader: `uniform vec3 uColor; uniform float uOpacidad; varying vec3 vN; varying vec3 vV;
          void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 1.8); gl_FragColor = vec4(uColor, clamp(f*3.2,0.0,1.0)*uOpacidad); }`,
      });
      const malla = new THREE.Mesh(geo, vidrio);
      const brillo = new THREE.Mesh(geo, borde);
      const grupo = new THREE.Group();
      grupo.add(malla, brillo);
      escena.add(grupo);

      const v = crearVidrio(C, w, h);
      const filtro = crearFiltroSensor();
      let sensorPrevio = { x: 0, y: 0 };
      let usarSensor = movimientoPermitido();
      const orientar = (e: DeviceOrientationEvent) => {
        if (!usarSensor || e.beta == null || e.gamma == null) return;
        filtro.leerOrientacion(e.beta, e.gamma);
      };
      const alMovimiento = () => {
        usarSensor = movimientoPermitido();
        filtro.reset();
        sensorPrevio = { x: 0, y: 0 };
        if (!usarSensor) reiniciar(v);
      };
      window.addEventListener('deviceorientation', orientar, { passive: true });
      window.addEventListener(EVENTO_MOVIMIENTO, alMovimiento);

      const ray = new THREE.Raycaster();
      let ultimo: { x: number; y: number } | null = null;
      const tocar = (e: PointerEvent) => {
        const ndc = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
        ray.setFromCamera(ndc, camara);
        const hit = ray.intersectObject(malla, false)[0];
        // Fuera de la malla (esquina redondeada del botón): el punto sobre el plano de la tarjeta.
        const enPlano = new THREE.Vector3();
        ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -grupo.position.z - FISICA.grosor / 2), enPlano);
        const p = (hit ? hit.point : enPlano).clone().sub(grupo.position);
        empujar(C, v, p, ray.ray.direction.clone().normalize(), hit ? FISICA.intensidadBoton : FISICA.intensidadCuerpo);
        ultimo = { x: e.clientX, y: e.clientY };
      };
      const mover = (e: PointerEvent) => {
        if (!ultimo || !(e.buttons & 1)) return;
        arrastrar(v, e.clientX - ultimo.x, e.clientY - ultimo.y);
        ultimo = { x: e.clientX, y: e.clientY };
      };
      const soltar = () => (ultimo = null);
      boton.addEventListener('pointerdown', tocar);
      boton.addEventListener('pointermove', mover);
      window.addEventListener('pointerup', soltar);

      let raf = 0;
      let antes = performance.now();
      const cuadro = (ahora: number) => {
        raf = 0;
        if (!vivo || document.hidden) return;
        const dt = Math.min(0.1, (ahora - antes) / 1000);
        antes = ahora;
        r = boton.getBoundingClientRect();
        // La tarjeta sigue al botón DOM (scroll, giro de la carta del wizard, cambio de tamaño).
        grupo.position.set((r.left + r.width / 2 - window.innerWidth / 2) / PX, -(r.top + r.height / 2 - window.innerHeight / 2) / PX, 0);
        const s = usarSensor ? filtro.valor : null;
        if (s && sentir(v, sensorPrevio, s)) sensorPrevio = { ...s };
        const a = avanzarVidrio(C, v, dt, ahora / 1000, s);
        grupo.rotation.set(a.x, a.y, a.z);
        // Las luces se mueven despacio: reflejos vivos sin que nada "respire".
        const t = ahora / 1000;
        lavanda.position.set(grupo.position.x - 2.2 + Math.sin(t * 0.3) * 0.6, grupo.position.y + 1.8, 3);
        magenta.position.set(grupo.position.x - 1.2, grupo.position.y - 1.2 + Math.cos(t * 0.25) * 0.4, 1.6);
        azul.position.set(grupo.position.x + 2.4, grupo.position.y - 0.6, 2.2);
        // Alejarse y desvanecer al elegir (independiente de la física y de la navegación).
        let k = 0;
        if (alejarRef.current && inicioAlejar.current != null) k = Math.min(1, (ahora - inicioAlejar.current) / ALEJARSE_MS);
        const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        grupo.position.z = -e * 6;
        grupo.scale.setScalar(1 - e * 0.25);
        vidrio.opacity = 0.93 * (1 - e);
        borde.uniforms.uOpacidad.value = 1 - e;
        // Fuera de pantalla (la carta giró) no se dibuja nada.
        const visible = r.bottom > 0 && r.top < window.innerHeight && r.width > 0 && !boton.closest('[inert]');
        grupo.visible = visible && e < 1;
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
        onEstado('fallback');
      };
      canvas.addEventListener('webglcontextlost', perdido);
      document.addEventListener('visibilitychange', reanudar);
      window.addEventListener('resize', ajustar);
      raf = requestAnimationFrame(cuadro);
      // Diagnóstico sólo con ?vidriodebug=1 (QA): nunca en uso normal.
      if (new URLSearchParams(location.search).has('vidriodebug')) (window as unknown as Record<string, unknown>).__vidrio = { renderer, escena, camara, grupo, vidrio, borde, cuerpo: v.cuerpo, cuadro: (t: number) => { cancelAnimationFrame(raf); cuadro(t); } };
      onEstado('listo');
      limpiar = () => {
        cancelAnimationFrame(raf);
        canvas.removeEventListener('webglcontextlost', perdido);
        document.removeEventListener('visibilitychange', reanudar);
        window.removeEventListener('resize', ajustar);
        window.removeEventListener('deviceorientation', orientar);
        window.removeEventListener(EVENTO_MOVIMIENTO, alMovimiento);
        window.removeEventListener('pointerup', soltar);
        boton.removeEventListener('pointerdown', tocar);
        boton.removeEventListener('pointermove', mover);
        geo.dispose();
        estudio.traverse((o) => {
          const m = o as import('three').Mesh;
          m.geometry?.dispose();
          (m.material as import('three').Material | undefined)?.dispose?.();
        });
        vidrio.dispose();
        borde.dispose();
        entorno.dispose();
        pmrem.dispose();
        renderer.dispose();
      };
    })();
    return () => {
      vivo = false;
      limpiar();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <canvas ref={lienzo} className="bv-vidrio-lienzo" aria-hidden="true" />;
}
