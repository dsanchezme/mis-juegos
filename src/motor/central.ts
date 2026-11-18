import { escribir, leer, nuevoId, useAlmacen } from "./almacen";
import type { PartidaTerminada, Persona } from "./tipos";

export const COLORES = ["#f4b942", "#4cc9f0", "#f27aa7", "#7fdc97", "#c3a6ff", "#ff9f68", "#5ee0d0", "#e4e4e4"];

export type ModoInicio = "dedos" | "ruleta" | "duelo" | "azar" | "lista";

export interface Ajustes {
  sonido: boolean;
  vibracion: boolean;
  agitar: boolean;
  modoInicio: ModoInicio;
}

export const AJUSTES_INICIALES: Ajustes = {
  sonido: true,
  vibracion: true,
  agitar: true,
  modoInicio: tieneTactil() ? "dedos" : "ruleta",
};

export function tieneTactil(): boolean {
  return typeof navigator !== "undefined" && (navigator.maxTouchPoints ?? 0) > 1;
}

export const useJugadores = () => useAlmacen<Persona[]>("jugadores", []);
export const useHistorial = () => useAlmacen<PartidaTerminada[]>("historial", []);
export const useAjustes = () => {
  const [a, set] = useAlmacen<Ajustes>("ajustes", AJUSTES_INICIALES);
  return [{ ...AJUSTES_INICIALES, ...a }, set] as const;
};
export const leerAjustes = (): Ajustes => ({ ...AJUSTES_INICIALES, ...leer<Partial<Ajustes>>("ajustes", {}) });

export function crearPersona(nombre: string, existentes: Persona[]): Persona {
  const usados = new Set(existentes.map((p) => p.color));
  const color = COLORES.find((c) => !usados.has(c)) ?? COLORES[existentes.length % COLORES.length];
  return { id: nuevoId(), nombre: nombre.trim(), color };
}

export function guardarEnHistorial(p: PartidaTerminada): void {
  const previo = leer<PartidaTerminada[]>("historial", []);
  if (previo.some((x) => x.id === p.id)) return;
  escribir("historial", [p, ...previo].slice(0, 200));
}

export const fmt = (n: number) => n.toLocaleString("es-CO");
