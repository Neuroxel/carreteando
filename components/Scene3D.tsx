'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

/**
 * Fondo espacial de la interfaz: una escena Three.js con capas de profundidad
 * real y paralaje que responde al acelerómetro/giroscopio (o al ratón en
 * escritorio). Es decoración pura: el contenido HTML vive encima y nunca se
 * toca. Sin WebGL se omite y el CSS de respaldo mantiene la atmósfera.
 */

const PALETA = {
  tinta: 0x090b13,
  noche: 0x10152b,
  indigo: 0x202746,
  lavanda: 0x9388b8,
  violeta: 0xb49be2,
  coral: 0xdb506a,
  turquesa: 0xa9d8cf,
};

function hexRgba(hex: number, a: number): string {
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;
  return `rgba(${r},${g},${b},${a})`;
}

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fondo cósmico: degradado de noche + nebulosas + grano + viñeta. */
function makeBackgroundTexture(): THREE.CanvasTexture {
  const s = 1024;
  const c = document.createElement('canvas');
  c.width = s;
  c.height = s;
  const ctx = c.getContext('2d')!;
  const rnd = mulberry(1337);
  const cielo = ctx.createLinearGradient(0, 0, 0, s);
  cielo.addColorStop(0, '#090b13');
  cielo.addColorStop(0.45, '#0d1122');
  cielo.addColorStop(1, '#10152b');
  ctx.fillStyle = cielo;
  ctx.fillRect(0, 0, s, s);
  const manchas: Array<[number, number, number, number]> = [
    [0.18, 0.2, 0.55, PALETA.indigo],
    [0.82, 0.16, 0.5, PALETA.indigo],
    [0.5, 0.72, 0.6, PALETA.noche],
    [0.15, 0.82, 0.5, PALETA.violeta],
    [0.88, 0.78, 0.45, PALETA.lavanda],
    [0.35, 0.3, 0.4, PALETA.coral],
  ];
  for (const [x, y, r, color] of manchas) {
    const cx = x * s;
    const cy = y * s;
    const rr = r * s;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
    g.addColorStop(0, hexRgba(color, 0.28));
    g.addColorStop(1, hexRgba(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  }
  for (let i = 0; i < 7000; i++) {
    const x = rnd() * s;
    const y = rnd() * s;
    const v = Math.floor(rnd() * 255);
    ctx.fillStyle = `rgba(${v},${v},${v},${(0.05 + rnd() * 0.05).toFixed(3)})`;
    ctx.fillRect(x, y, 1, 1);
  }
  const v = ctx.createRadialGradient(s / 2, s / 2, s * 0.2, s / 2, s / 2, s * 0.72);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(3,4,9,0.85)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Mancha de pigmento suave (nube abstracta) para las capas atmosféricas. */
function makeCloudTexture(hex: number, seed: number, spots: number): THREE.CanvasTexture {
  const s = 512;
  const c = document.createElement('canvas');
  c.width = s;
  c.height = s;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, s, s);
  const rnd = mulberry(seed);
  for (let i = 0; i < spots; i++) {
    const x = rnd() * s;
    const y = rnd() * s;
    const r = (0.16 + rnd() * 0.4) * s;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, hexRgba(hex, 0.34 + rnd() * 0.2));
    g.addColorStop(0.55, hexRgba(hex, 0.1));
    g.addColorStop(1, hexRgba(hex, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Silueta escultórica (roca/arquitectura) para enmarcar los bordes. */
function makeRoca(seed: number, width: number, height: number): THREE.Mesh {
  const rnd = mulberry(seed);
  const shape = new THREE.Shape();
  const puntos = 7;
  shape.moveTo(-width / 2, 0);
  for (let i = 0; i <= puntos; i++) {
    const x = -width / 2 + (width * i) / puntos;
    const y = (0.25 + rnd() * 0.75) * height;
    shape.lineTo(x, y);
  }
  shape.lineTo(width / 2, 0);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 1.4, bevelEnabled: false });
  const mat = new THREE.MeshStandardMaterial({
    color: PALETA.tinta,
    roughness: 1,
    metalness: 0,
    flatShading: true,
  });
  return new THREE.Mesh(geo, mat);
}

interface Capa {
  obj: THREE.Object3D;
  base: THREE.Vector3;
  depth: number;
  spin: number;
  bob: number;
}

export default function Scene3D() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);
  const enabledRef = useRef(false);
  const orientationSeenRef = useRef(false);
  const targetRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    } catch {
      return; // sin WebGL: el CSS de respaldo mantiene la atmósfera.
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 120);
    camera.position.set(0, 0, 0);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.inset = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    host.appendChild(renderer.domElement);

    // Luces artísticas: ambiente frío + dirección violeta + reborde coral.
    scene.add(new THREE.AmbientLight(0x7a7a9e, 1.1));
    const sol = new THREE.DirectionalLight(0xb49be2, 1.9);
    sol.position.set(4, 6, 8);
    scene.add(sol);
    const reborde = new THREE.DirectionalLight(0xdb506a, 0.9);
    reborde.position.set(-6, -1, 4);
    scene.add(reborde);

    const capas: Capa[] = [];
    const disposables: Array<{ dispose(): void }> = [];

    const push = (obj: THREE.Object3D, depth: number, spin = 0, bob = 0) => {
      scene.add(obj);
      capas.push({ obj, base: obj.position.clone(), depth, spin, bob });
    };

    // Capa 1: fondo cósmico.
    const bgTex = makeBackgroundTexture();
    disposables.push(bgTex);
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(90, 90),
      new THREE.MeshBasicMaterial({ map: bgTex, depthWrite: false }),
    );
    bg.position.set(0, 0, -22);
    push(bg, 0.3);

    // Capa 2: atmósfera suspendida (pigmento).
    const nubes: Array<[number, number, number, number, number]> = [
      [PALETA.violeta, -9, -2, 34, 0.16],
      [PALETA.lavanda, 10, 3, 40, 0.14],
      [PALETA.coral, 6, -6, 30, 0.1],
      [PALETA.turquesa, -12, 6, 32, 0.08],
    ];
    let i = 0;
    for (const [color, x, y, w, op] of nubes) {
      const tex = makeCloudTexture(color, 2000 + i * 313, 26);
      disposables.push(tex);
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(w, w * 0.66),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: op, depthWrite: false }),
      );
      plane.position.set(x, y, -13 - i);
      push(plane, 0.55 + i * 0.12, 0, 0.5);
      i++;
    }

    // Capa 3: estructuras escultóricas (rocas en los bordes).
    const rocaIzq = makeRoca(51, 11, 8);
    rocaIzq.position.set(-16, -7, -6);
    rocaIzq.rotation.z = 0.06;
    push(rocaIzq, 1.0);
    const rocaDer = makeRoca(82, 12, 9);
    rocaDer.position.set(17, -8, -7);
    rocaDer.rotation.z = -0.05;
    push(rocaDer, 1.05);

    // Capa 4: símbolos flotantes.
    const materiales = {
      coral: new THREE.MeshStandardMaterial({ color: PALETA.coral, roughness: 0.5, metalness: 0.1, flatShading: true }),
      violeta: new THREE.MeshStandardMaterial({ color: PALETA.violeta, roughness: 0.45, metalness: 0.12, flatShading: true }),
      turquesa: new THREE.MeshStandardMaterial({ color: PALETA.turquesa, roughness: 0.5, metalness: 0.1, flatShading: true }),
    };

    const anillo1 = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.09, 12, 64), materiales.violeta);
    anillo1.position.set(-5.5, 3.5, -4);
    anillo1.rotation.set(1.1, 0.4, 0.3);
    push(anillo1, 1.4, 0.12);

    const anillo2 = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.06, 10, 48), materiales.coral);
    anillo2.position.set(6, -3, -3);
    anillo2.rotation.set(0.4, -0.6, 0.2);
    push(anillo2, 1.55, -0.18);

    const nodo = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 0), materiales.turquesa);
    nodo.position.set(3.5, 4.2, -5);
    push(nodo, 1.3, 0.2, 0.35);

    const luna = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), materiales.coral);
    luna.position.set(-4, -2.5, -2.5);
    push(luna, 1.65, 0.1, 0.45);

    // Estado del paralaje.
    let curX = 0;
    let curY = 0;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const amp = reduced ? 0 : 1;

    const onMouse = (e: MouseEvent) => {
      if (orientationSeenRef.current) return;
      targetRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      targetRef.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const onOrientation = (e: DeviceOrientationEvent) => {
      if (!enabledRef.current) return;
      if (e.beta == null || e.gamma == null) return;
      orientationSeenRef.current = true;
      const gamma = Math.max(-30, Math.min(30, e.gamma)) / 30;
      const beta = Math.max(-25, Math.min(25, e.beta - 50)) / 25;
      targetRef.current.x = gamma;
      targetRef.current.y = beta;
    };
    window.addEventListener('mousemove', onMouse, { passive: true });
    window.addEventListener('deviceorientation', onOrientation as EventListener, { passive: true });

    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    onResize();
    window.addEventListener('resize', onResize);

    let raf = 0;
    const onVisibility = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else raf = requestAnimationFrame(tick);
    };
    document.addEventListener('visibilitychange', onVisibility);

    const start = performance.now();
    let last = start;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const t = (now - start) / 1000;
      const s = 1 - Math.exp(-dt * 4); // suavizado independiente de la tasa de frames
      curX += (targetRef.current.x - curX) * s;
      curY += (targetRef.current.y - curY) * s;

      for (const capa of capas) {
        const { obj, base, depth, spin, bob } = capa;
        obj.position.x = base.x + curX * depth * amp * 1.3;
        obj.position.y = base.y - curY * depth * amp * 1.1;
        if (!reduced) {
          if (spin) {
            obj.rotation.y += spin * dt;
            obj.rotation.x += spin * dt * 0.4;
          }
          if (bob) obj.position.y += Math.sin(t * 0.5 + depth * 2) * bob;
        }
      }

      camera.position.x = curX * 0.35 * amp;
      camera.position.y = -curY * 0.28 * amp;
      camera.lookAt(0, 0, -10);

      renderer.render(scene, camera);

      if (!reduced) {
        document.documentElement.style.setProperty('--px', curX.toFixed(4));
        document.documentElement.style.setProperty('--py', curY.toFixed(4));
      }
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('deviceorientation', onOrientation as EventListener);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      for (const capa of capas) {
        const obj = capa.obj as THREE.Mesh;
        obj.geometry?.dispose?.();
        const m = obj.material as THREE.Material | THREE.Material[];
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m?.dispose?.();
        scene.remove(obj);
      }
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
      document.documentElement.classList.remove('d3-on');
      document.documentElement.style.removeProperty('--px');
      document.documentElement.style.removeProperty('--py');
    };
  }, []);

  const activar = useCallback(async () => {
    const next = !enabledRef.current;
    if (next) {
      const DO = window.DeviceOrientationEvent as unknown as
        | { requestPermission?: () => Promise<string> }
        | undefined;
      if (DO && typeof DO.requestPermission === 'function') {
        try {
          await DO.requestPermission();
        } catch {
          /* sin permiso se sigue con ratón/táctil */
        }
      }
    } else {
      orientationSeenRef.current = false;
    }
    enabledRef.current = next;
    setEnabled(next);
    document.documentElement.classList.toggle('d3-on', next);
  }, []);

  return (
    <>
      <div className="scene3d" ref={hostRef} aria-hidden="true" />
      <button type="button" className="scene3d-toggle" aria-pressed={enabled} onClick={activar}>
        <span className="scene3d-toggle-marca" aria-hidden="true">
          ✳
        </span>
        {enabled ? 'EXPERIENCIA 3D ACTIVA' : 'ACTIVAR EXPERIENCIA 3D'}
      </button>
    </>
  );
}
