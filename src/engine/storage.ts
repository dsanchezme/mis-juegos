import { useCallback, useEffect, useRef, useState } from "react";

const PREFIX = "mis-juegos:";

export function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function write<T>(key: string, value: T | null): void {
  try {
    if (value === null) localStorage.removeItem(PREFIX + key);
    else localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage unavailable: the game still works, it just is not saved */
  }
  window.dispatchEvent(new CustomEvent("mis-juegos:storage", { detail: key }));
}

/** React state backed by the device's local storage. */
export function useStored<T>(key: string, fallback: T): [T, (v: T | ((previous: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => read(key, fallback));
  // Callers usually pass a fresh literal (`[]`, `{}`) on every render. Keeping the latest one in a ref
  // means the listener and `save` only change when the key does, without stale defaults.
  const fallbackRef = useRef(fallback);
  fallbackRef.current = fallback;

  useEffect(() => {
    const handleChange = (ev: Event) => {
      if ((ev as CustomEvent).detail === key) setValue(read(key, fallbackRef.current));
    };
    window.addEventListener("mis-juegos:storage", handleChange);
    return () => window.removeEventListener("mis-juegos:storage", handleChange);
  }, [key]);

  const save = useCallback(
    (v: T | ((previous: T) => T)) => {
      const updated = typeof v === "function" ? (v as (p: T) => T)(read(key, fallbackRef.current)) : v;
      write(key, updated);
      setValue(updated);
    },
    [key],
  );
  return [value, save];
}

export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
