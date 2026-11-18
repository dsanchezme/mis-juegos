import { useState } from "react";
import { CATALOGO } from "../juegos/catalogo";
import { fmt, useHistorial } from "../motor/central";

const fecha = (iso: string) => {
  const d = new Date(iso);
  const hoy = new Date();
  const ayer = new Date(Date.now() - 864e5);
  if (d.toDateString() === hoy.toDateString()) return "Hoy";
  if (d.toDateString() === ayer.toDateString()) return "Ayer";
  return d.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
};

export function Historial() {
  const [historial] = useHistorial();
  const [abierta, setAbierta] = useState<string | null>(null);

  const victorias = new Map<string, { nombre: string; n: number }>();
  for (const h of historial) {
    for (const id of h.ganadores) {
      const j = h.jugadores.find((x) => x.id === id);
      if (!j) continue;
      const v = victorias.get(id) ?? { nombre: j.nombre, n: 0 };
      victorias.set(id, { nombre: j.nombre, n: v.n + 1 });
    }
  }
  const ranking = [...victorias.values()].sort((a, b) => b.n - a.n);

  return (
    <>
      <h1 className="titulo">Historial</h1>
      {ranking.length > 0 && (
        <div className="chips">
          {ranking.map((r, i) => (
            <span key={r.nombre + i} className={`pildora ${i === 0 ? "oro" : ""}`}>
              {r.nombre} · {r.n} {r.n === 1 ? "victoria" : "victorias"}
            </span>
          ))}
        </div>
      )}
      {historial.length === 0 && <div className="tarjeta dim">Aquí aparecerán las partidas terminadas.</div>}
      <div className="columna">
        {historial.map((h) => {
          const ganadores = h.jugadores.filter((j) => h.ganadores.includes(j.id));
          const juego = CATALOGO.find((c) => c.id === h.juego)?.nombre ?? h.juego;
          const titulo =
            ganadores.length === 0
              ? "Terminada sin ganador"
              : ganadores.length === 1
                ? `${ganadores[0].nombre} ganó`
                : `Empate: ${ganadores.map((g) => g.nombre).join(" y ")}`;
          return (
            <button
              type="button"
              key={h.id}
              className="tarjeta btn"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "stretch",
                fontWeight: 500,
                opacity: ganadores.length ? 1 : 0.6,
                textAlign: "left",
              }}
              onClick={() => setAbierta(abierta === h.id ? null : h.id)}
              aria-expanded={abierta === h.id}
            >
              <span className="fila">
                {ganadores[0] && <span className="punto" style={{ background: ganadores[0].color }} />}
                <b className="grow">{titulo}</b>
                <span className="mono" style={{ fontSize: 13 }}>
                  {ganadores[0] ? fmt(ganadores[0].puntos) : "—"}
                </span>
              </span>
              <span className="dim" style={{ fontSize: 12 }}>
                {fecha(h.fecha)} · {juego} · {h.jugadores.map((j) => j.nombre).join(", ")} · {h.detalle}
              </span>
              {abierta === h.id && (
                <span className="columna" style={{ marginTop: 8, gap: 4 }}>
                  {[...h.jugadores]
                    .sort((a, b) => b.puntos - a.puntos)
                    .map((j) => (
                      <span key={j.id} className="fila" style={{ fontSize: 14 }}>
                        <span className="punto" style={{ background: j.color }} />
                        <span className="grow">{j.nombre}</span>
                        <span className="mono">{fmt(j.puntos)}</span>
                      </span>
                    ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}
