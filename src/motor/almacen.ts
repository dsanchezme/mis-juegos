import { useCallback, useEffect, useState } from "react";

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
    /* sin almacenamiento disponible: se juega igual, sin guardar */
  }
  window.dispatchEvent(new CustomEvent("mis-juegos:almacen", { detail: clave }));
}

/** Estado de React respaldado en el almacenamiento del teléfono. */
export function useAlmacen<T>(clave: string, porDefecto: T): [T, (v: T | ((previo: T) => T)) => void] {
  const [valor, setValor] = useState<T>(() => leer(clave, porDefecto));

  useEffect(() => {
    const alCambiar = (ev: Event) => {
      if ((ev as CustomEvent).detail === clave) setValor(leer(clave, porDefecto));
    };
    window.addEventListener("mis-juegos:almacen", alCambiar);
    return () => window.removeEventListener("mis-juegos:almacen", alCambiar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, porDefecto]);

  const guardar = useCallback(
    (v: T | ((previo: T) => T)) => {
      const nuevo = typeof v === "function" ? (v as (p: T) => T)(leer(clave, porDefecto)) : v;
      escribir(clave, nuevo);
      setValor(nuevo);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clave, porDefecto],
  );
  return [valor, guardar];
}

export const nuevoId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
