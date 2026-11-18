import { useCallback, useEffect, useRef, useState } from "react";

const PREFIJO = "mis-juegos:";

export function leer<T>(clave: string, porDefecto: T): T {
  try {
    const crudo = localStorage.getItem(PREFIJO + clave);
    return crudo ? (JSON.parse(crudo) as T) : porDefecto;
  } catch {
    return porDefecto;
  }
}

export function escribir<T>(clave: string, valor: T | null): void {
  try {
    if (valor === null) localStorage.removeItem(PREFIJO + clave);
    else localStorage.setItem(PREFIJO + clave, JSON.stringify(valor));
  } catch {
    /* storage unavailable: the game still works, it just is not saved */
  }
  window.dispatchEvent(new CustomEvent("mis-juegos:almacen", { detail: clave }));
}

/** React state backed by the device's local storage. */
export function useAlmacen<T>(clave: string, porDefecto: T): [T, (v: T | ((previo: T) => T)) => void] {
  const [valor, setValor] = useState<T>(() => leer(clave, porDefecto));
  // Callers usually pass a fresh literal (`[]`, `{}`) on every render. Keeping the latest one in a ref
  // means the listener and `guardar` only change when the key does, without stale defaults.
  const porDefectoRef = useRef(porDefecto);
  porDefectoRef.current = porDefecto;

  useEffect(() => {
    const alCambiar = (ev: Event) => {
      if ((ev as CustomEvent).detail === clave) setValor(leer(clave, porDefectoRef.current));
    };
    window.addEventListener("mis-juegos:almacen", alCambiar);
    return () => window.removeEventListener("mis-juegos:almacen", alCambiar);
  }, [clave]);

  const guardar = useCallback(
    (v: T | ((previo: T) => T)) => {
      const nuevo = typeof v === "function" ? (v as (p: T) => T)(leer(clave, porDefectoRef.current)) : v;
      escribir(clave, nuevo);
      setValor(nuevo);
    },
    [clave],
  );
  return [valor, guardar];
}

export const nuevoId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
