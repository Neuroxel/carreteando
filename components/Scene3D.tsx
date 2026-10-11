'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float, Sparkles, Stars } from '@react-three/drei';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

/**
 * Fondo espacial de la interfaz. Usa @react-three/fiber + @react-three/drei
 * (MIT) en vez de reinventar la escena: estrellas, destellos y formas flotantes
 * ya resueltas. El paralaje responde al acelerómetro/giroscopio (auto-activado
 * donde no hace falta permiso) o al ratón en escritorio, y además mueve el DOM
 * (tarjetas y titulares) con la misma inclinación para que el efecto se note
 * incluso sin WebGL. Sin WebGL solo queda la aurora CSS + el paralaje DOM.
 */

const PALETTE = {
  violeta: '#b49be2',
  coral: '#db506a',
  turquesa: '#a9d8cf',
  lavanda: '#9388b8',
};

// Estado compartido de la inclinación (sin re-render por frame).
const tilt = { curX: 0, curY: 0, targetX: 0, targetY: 0, sensorSeen: false };

function detectWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

/** Mueve la cámara con la inclinación (ya suavizada) para el paralaje 3D. */
function Rig({ reduced }: { reduced: boolean }) {
  const camera = useThree((s) => s.camera);
  useFrame(() => {
    if (reduced) {
      camera.lookAt(0, 0, 0);
      return;
    }
    camera.position.x += (tilt.curX * 0.55 - camera.position.x) * 0.08;
    camera.position.y += (-tilt.curY * 0.42 - camera.position.y) * 0.08;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

/** Símbolos flotantes inspirados en el afiche LALA. */
function FloatingShapes() {
  return (
    <group>
      <Float speed={1.4} rotationIntensity={0.7} floatIntensity={1.3}>
        <mesh position={[-4.6, 2.4, -2]} rotation={[1, 0.4, 0.2]}>
          <torusGeometry args={[1.7, 0.08, 12, 64]} />
          <meshStandardMaterial color={PALETTE.violeta} roughness={0.35} metalness={0.2} flatShading />
        </mesh>
      </Float>
      <Float speed={1.7} rotationIntensity={0.5} floatIntensity={1.1}>
        <mesh position={[5.2, -2.6, -1.5]} rotation={[0.4, -0.6, 0.2]}>
          <torusGeometry args={[1, 0.06, 10, 48]} />
          <meshStandardMaterial color={PALETTE.coral} roughness={0.4} metalness={0.15} flatShading />
        </mesh>
      </Float>
      <Float speed={1.2} rotationIntensity={0.9} floatIntensity={0.9}>
        <mesh position={[3.2, 3.4, -4]}>
          <icosahedronGeometry args={[0.85, 0]} />
          <meshStandardMaterial color={PALETTE.turquesa} roughness={0.4} flatShading />
        </mesh>
      </Float>
      <Float speed={1.6} rotationIntensity={0.6} floatIntensity={1.4}>
        <mesh position={[-3.4, -3.1, -0.8]}>
          <icosahedronGeometry args={[0.6, 1]} />
          <meshStandardMaterial color={PALETTE.coral} roughness={0.45} flatShading />
        </mesh>
      </Float>
      <Float speed={1.1} rotationIntensity={0.4} floatIntensity={0.8}>
        <mesh position={[1.4, 1.3, -5]}>
          <dodecahedronGeometry args={[0.7, 0]} />
          <meshStandardMaterial color={PALETTE.lavanda} roughness={0.5} flatShading />
        </mesh>
      </Float>
      <Float speed={0.9} rotationIntensity={0.3} floatIntensity={0.6}>
        <mesh position={[-1.6, -1.4, -6]}>
          <octahedronGeometry args={[0.5, 0]} />
          <meshStandardMaterial color={PALETTE.turquesa} roughness={0.5} flatShading />
        </mesh>
      </Float>
    </group>
  );
}

function SceneContent() {
  return (
    <>
      <ambientLight intensity={0.75} />
      <directionalLight position={[5, 6, 8]} intensity={1.7} color={PALETTE.violeta} />
      <directionalLight position={[-6, -2, 4]} intensity={0.9} color={PALETTE.coral} />
      <Stars radius={55} depth={40} count={2600} factor={4} saturation={0.4} fade speed={0.6} />
      <Sparkles count={90} scale={[15, 11, 8]} size={2.6} speed={0.3} opacity={0.55} color={PALETTE.violeta} />
      <Sparkles count={45} scale={[13, 9, 6]} size={3.2} speed={0.2} opacity={0.42} color={PALETTE.coral} />
      <FloatingShapes />
    </>
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

    const onOrientation = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return;
      const gamma = Math.max(-28, Math.min(28, e.gamma)) / 28;
      const beta = Math.max(-25, Math.min(25, e.beta - 50)) / 25;
      tilt.targetX = gamma;
      tilt.targetY = beta;
      tilt.sensorSeen = true;
    };
    const onMouse = (e: MouseEvent) => {
      if (tilt.sensorSeen) return;
      tilt.targetX = (e.clientX / window.innerWidth) * 2 - 1;
      tilt.targetY = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('deviceorientation', onOrientation as EventListener, { passive: true });
    window.addEventListener('mousemove', onMouse, { passive: true });

    // Sin permiso (Android, escritorio) se activa solo: la experiencia no debe
    // esperar a un botón que nadie pide.
    if (!needsPerm) {
      enabledRef.current = true;
      setEnabled(true);
      document.documentElement.classList.add('d3-on');
    }

    // Bucle propio para el paralaje DOM: funciona aunque WebGL no esté.
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
            camera={{ position: [0, 0, 5], fov: 50 }}
            dpr={[1, 1.75]}
            gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
            style={{ position: 'absolute', inset: 0 }}
          >
            <Rig reduced={reducedRef.current} />
            <SceneContent />
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
