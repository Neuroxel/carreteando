'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float, Stars } from '@react-three/drei';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

/**
 * Fondo 3D: Valparaíso de noche. Cerros con silueta recortada, edificios
 * oscuros, ventanas iluminadas (las "luces de los cerros"), luna, estrellas y
 * un toque de neón de carrete. Parallax por acelerómetro/giroscopio
 * (deviceorientation con devicemotion de respaldo) o ratón; y el DOM se mueve
 * con la misma inclinación. Textura de papel orgánica en CSS. Sin WebGL solo
 * queda la aurora CSS + el paralaje DOM.
 */

const PALETTE = {
  violeta: '#b49be2',
  coral: '#db506a',
  turquesa: '#a9d8cf',
  lavanda: '#9388b8',
  ambar: '#ffb36b',
  tinta: '#060810',
  indigo: '#0a0d1c',
};

// Estado compartido de la inclinación (sin re-render por frame).
const tilt = { curX: 0, curY: 0, targetX: 0, targetY: 0, sensorSeen: false };

function clamp(v: number, m = 1) {
  return Math.max(-m, Math.min(m, v));
}

function detectWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mueve la cámara con la inclinación (ya suavizada) para el paralaje 3D. */
function Rig({ reduced }: { reduced: boolean }) {
  const camera = useThree((s) => s.camera);
  useFrame(() => {
    if (reduced) {
      camera.lookAt(0, -0.4, 0);
      return;
    }
    camera.position.x += (tilt.curX * 0.95 - camera.position.x) * 0.09;
    camera.position.y += (-tilt.curY * 0.75 - camera.position.y) * 0.09;
    camera.lookAt(0, -0.4, 0);
  });
  return null;
}

/** Silueta recortada de un cerro. */
function makeCerroShape(width: number, height: number, seed: number): THREE.Shape {
  const shape = new THREE.Shape();
  const n = 16;
  const rnd = mulberry(seed);
  shape.moveTo(-width / 2, 0);
  for (let i = 0; i <= n; i++) {
    const x = -width / 2 + (width * i) / n;
    const y = (0.3 + rnd() * 0.7) * height;
    shape.lineTo(x, y);
  }
  shape.lineTo(width / 2, 0);
  shape.closePath();
  return shape;
}

function Cerro({ width, height, z, color, seed }: { width: number; height: number; z: number; color: string; seed: number }) {
  const shape = useMemo(() => makeCerroShape(width, height, seed), [width, height, seed]);
  return (
    <mesh position={[0, -3.6, z]}>
      <shapeGeometry args={[shape]} />
      <meshBasicMaterial color={color} />
    </mesh>
  );
}

/** Edificios oscuros recortados contra el cielo. */
function Buildings() {
  const boxes: Array<[number, number, number, number]> = [
    [-7, 0.5, 0.9, 1.4], // x, y-centro, w, h
    [-5.6, 0.7, 0.7, 1.8],
    [-3.9, 0.4, 0.8, 1.0],
    [-2.2, 0.9, 0.7, 2.0],
    [0.4, 0.6, 0.9, 1.5],
    [2.6, 0.8, 0.7, 1.9],
    [4.4, 0.5, 0.8, 1.2],
    [6.4, 0.7, 0.7, 1.6],
  ];
  return (
    <group position={[0, -3.6, -7]}>
      {boxes.map(([x, yc, w, h], i) => (
        <mesh key={i} position={[x, yc, 0]}>
          <boxGeometry args={[w, h, w]} />
          <meshBasicMaterial color={PALETTE.tinta} />
        </mesh>
      ))}
    </group>
  );
}

/** Las luces de los cerros: ventanas encendidas. */
function CityLights({ count = 380 }: { count?: number }) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const palette = [PALETTE.ambar, PALETTE.violeta, PALETTE.turquesa, PALETTE.coral];
    const rnd = mulberry(20261011);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rnd() - 0.5) * 26;
      pos[i * 3 + 1] = -3.9 + rnd() * 3.6;
      pos[i * 3 + 2] = -8.5 + rnd() * 4;
      const c = new THREE.Color(palette[Math.floor(rnd() * palette.length)]);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  }, [count]);
  return (
    <points geometry={geometry}>
      <pointsMaterial size={0.07} vertexColors transparent opacity={0.95} depthWrite={false} sizeAttenuation />
    </points>
  );
}

/** Luna con halo coral. */
function Moon() {
  return (
    <group position={[4.6, 2.7, -13]}>
      <mesh>
        <circleGeometry args={[0.95, 32]} />
        <meshBasicMaterial color="#f4e3cf" />
      </mesh>
      <mesh>
        <circleGeometry args={[1.7, 32]} />
        <meshBasicMaterial color={PALETTE.coral} transparent opacity={0.16} />
      </mesh>
    </group>
  );
}

/** Neón de carrete: aros sueltos como letreros de bar en la distancia. */
function Neon() {
  return (
    <group>
      <Float speed={1.6} floatIntensity={0.9} rotationIntensity={0.4}>
        <mesh position={[-5.4, 0.6, -5.5]} rotation={[1.1, 0.3, 0.2]}>
          <torusGeometry args={[0.85, 0.05, 8, 40]} />
          <meshBasicMaterial color={PALETTE.coral} />
        </mesh>
      </Float>
      <Float speed={1.3} floatIntensity={1.1} rotationIntensity={0.5}>
        <mesh position={[5.6, 1.4, -6.5]} rotation={[0.5, -0.5, 0.2]}>
          <torusGeometry args={[0.65, 0.045, 8, 32]} />
          <meshBasicMaterial color={PALETTE.violeta} />
        </mesh>
      </Float>
      <Float speed={1.1} floatIntensity={0.7} rotationIntensity={0.3}>
        <mesh position={[0.2, 2.2, -9]}>
          <torusGeometry args={[0.5, 0.04, 8, 32]} />
          <meshBasicMaterial color={PALETTE.turquesa} />
        </mesh>
      </Float>
    </group>
  );
}

function Cityscape() {
  return (
    <group>
      <Stars radius={50} depth={40} count={2200} factor={4} saturation={0.35} fade speed={0.5} />
      <Moon />
      <Cerro width={30} height={4.6} z={-9} color={PALETTE.indigo} seed={11} />
      <Buildings />
      <Cerro width={34} height={3.6} z={-5.5} color={PALETTE.tinta} seed={77} />
      <CityLights />
      <Neon />
    </group>
  );
}

export default function Scene3D() {
  const [enabled, setEnabled] = useState(false);
  const [needsPermission, setNeedsPermission] = useState(false);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const enabledRef = useRef(false);
  const reducedRef = useRef(false);

  useEffect(() => {
    reducedRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setWebgl(detectWebGL());

    const DO = window.DeviceOrientationEvent as unknown as
      | { requestPermission?: () => Promise<string> }
      | undefined;
    const needsPerm = typeof DO?.requestPermission === 'function';
    setNeedsPermission(needsPerm);

    let orientationSeen = false;
    const onOrientation = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return;
      orientationSeen = true;
      tilt.targetX = clamp(e.gamma / 22);
      tilt.targetY = clamp((e.beta - 50) / 22);
      tilt.sensorSeen = true;
    };
    const onMotion = (e: DeviceMotionEvent) => {
      if (orientationSeen) return;
      const a = e.accelerationIncludingGravity;
      if (!a) return;
      const x = a.x ?? 0;
      const y = a.y ?? 0;
      tilt.targetX = clamp(x / 5);
      tilt.targetY = clamp((y + 3) / 5);
      tilt.sensorSeen = true;
    };
    const onMouse = (e: MouseEvent) => {
      if (tilt.sensorSeen) return;
      tilt.targetX = (e.clientX / window.innerWidth) * 2 - 1;
      tilt.targetY = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('deviceorientation', onOrientation as EventListener, { passive: true });
    window.addEventListener('devicemotion', onMotion as EventListener, { passive: true });
    window.addEventListener('mousemove', onMouse, { passive: true });

    if (!needsPerm) {
      enabledRef.current = true;
      setEnabled(true);
      document.documentElement.classList.add('d3-on');
    }

    let raf = 0;
    let last = performance.now();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const s = 1 - Math.exp(-dt * 4);
      tilt.curX += (tilt.targetX - tilt.curX) * s;
      tilt.curY += (tilt.targetY - tilt.curY) * s;
      if (!reducedRef.current) {
        document.documentElement.style.setProperty('--px', tilt.curX.toFixed(4));
        document.documentElement.style.setProperty('--py', tilt.curY.toFixed(4));
      }
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('deviceorientation', onOrientation as EventListener);
      window.removeEventListener('devicemotion', onMotion as EventListener);
      window.removeEventListener('mousemove', onMouse);
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
      if (typeof DO?.requestPermission === 'function') {
        try {
          await DO.requestPermission();
        } catch {
          /* sin permiso se sigue con ratón */
        }
      }
    } else {
      tilt.sensorSeen = false;
    }
    enabledRef.current = next;
    setEnabled(next);
    document.documentElement.classList.toggle('d3-on', next);
  }, []);

  return (
    <>
      <div className="scene3d" aria-hidden="true">
        {webgl && (
          <Canvas
            camera={{ position: [0, 0, 6], fov: 55 }}
            dpr={[1, 1.75]}
            gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
            style={{ position: 'absolute', inset: 0 }}
          >
            <Rig reduced={reducedRef.current} />
            <Cityscape />
          </Canvas>
        )}
      </div>
      {needsPermission && (
        <button type="button" className="scene3d-toggle" aria-pressed={enabled} onClick={activar}>
          <span className="scene3d-toggle-marca" aria-hidden="true">
            ✳
          </span>
          {enabled ? '3D ACTIVA' : 'ACTIVAR 3D'}
        </button>
      )}
    </>
  );
}
