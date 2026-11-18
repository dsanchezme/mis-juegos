import { useEffect, useRef } from "react";

type ConPermiso = typeof DeviceMotionEvent & { requestPermission?: () => Promise<"granted" | "denied"> };

export function agitarDisponible(): boolean {
  return typeof window !== "undefined" && "DeviceMotionEvent" in window && (navigator.maxTouchPoints ?? 0) > 0;
}

export function necesitaPermiso(): boolean {
  return agitarDisponible() && typeof (DeviceMotionEvent as ConPermiso).requestPermission === "function";
}

/** En iPhone hay que pedir permiso desde un toque del usuario. */
export async function pedirPermisoMovimiento(): Promise<boolean> {
  const D = DeviceMotionEvent as ConPermiso;
  if (typeof D.requestPermission !== "function") return true;
  try {
    return (await D.requestPermission()) === "granted";
  } catch {
    return false;
  }
}

const UMBRAL = 13; // m/s² de cambio para considerar que se está agitando
const SOLTAR_MS = 350; // tiempo quieto para considerar que soltó
const MINIMO_MS = 250; // agitar al menos esto para lanzar

/**
 * Detecta agitar el teléfono. Llama a `alAgitar` mientras se agita
 * y a `alSoltar` cuando se deja de agitar.
 */
export function useAgitar(activo: boolean, alAgitar: (fuerza: number) => void, alSoltar: () => void) {
  const cb = useRef({ alAgitar, alSoltar });
  cb.current = { alAgitar, alSoltar };

  useEffect(() => {
    if (!activo || !agitarDisponible()) return;
    let previo: { x: number; y: number; z: number } | null = null;
    let inicio = 0;
    let ultimo = 0;
    let timer: number | undefined;

    const alMover = (ev: DeviceMotionEvent) => {
      const a = ev.accelerationIncludingGravity;
      if (!a || a.x == null || a.y == null || a.z == null) return;
      const actual = { x: a.x, y: a.y, z: a.z };
      if (previo) {
        const delta = Math.hypot(actual.x - previo.x, actual.y - previo.y, actual.z - previo.z);
        const ahora = performance.now();
        if (delta > UMBRAL) {
          if (!inicio) inicio = ahora;
          ultimo = ahora;
          cb.current.alAgitar(Math.min(1, delta / 40));
          window.clearTimeout(timer);
          timer = window.setTimeout(() => {
            if (ultimo - inicio >= MINIMO_MS) cb.current.alSoltar();
            inicio = 0;
          }, SOLTAR_MS);
        }
      }
      previo = actual;
    };
    window.addEventListener("devicemotion", alMover);
    return () => {
      window.removeEventListener("devicemotion", alMover);
      window.clearTimeout(timer);
    };
  }, [activo]);
}
