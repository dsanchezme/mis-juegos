import { useState } from "react";
import { CATALOGO } from "../juegos/catalogo";
import { type Texts } from "../i18n/es";
import { fmt, useT } from "../i18n";
import { useHistorial } from "../motor/central";

const fecha = (iso: string, t: Texts) => {
  const d = new Date(iso);
  const hoy = new Date();
  const ayer = new Date(Date.now() - 864e5);
  if (d.toDateString() === hoy.toDateString()) return t.history.today;
  if (d.toDateString() === ayer.toDateString()) return t.history.yesterday;
  return d.toLocaleDateString(t.locale, { day: "numeric", month: "short" });
};

export function Historial() {
  const t = useT();
  const [historial] = useHistorial();
  const [abierta, setAbierta] = useState<string | null>(null);

  const victorias = new Map<string, { nombre: string; n: number }>();
  historial.forEach((h) =>
    h.ganadores.forEach((id) => {
      const j = h.jugadores.find((x) => x.id === id);
      if (!j) return;
      const v = victorias.get(id) ?? { nombre: j.nombre, n: 0 };
      victorias.set(id, { nombre: j.nombre, n: v.n + 1 });
    }),
  );
  const ranking = [...victorias.values()].sort((a, b) => b.n - a.n);

  return (
    <>
      <h1 className="titulo">{t.history.title}</h1>
      {ranking.length > 0 && (
        <div className="chips">
          {ranking.map((r, i) => (
            <span key={r.nombre + i} className={`pildora ${i === 0 ? "oro" : ""}`}>{r.nombre} · {t.history.wins(r.n)}</span>
          ))}
        </div>
      )}
      {historial.length === 0 && <div className="tarjeta dim">{t.history.empty}</div>}
      <div className="columna">
        {historial.map((h) => {
          const ganadores = h.jugadores.filter((j) => h.ganadores.includes(j.id));
          const entrada = CATALOGO.find((c) => c.id === h.juego);
          const juego = entrada ? entrada.nombre(t) : h.juego;
          const titulo =
            ganadores.length === 0
              ? t.history.noWinner
              : ganadores.length === 1
                ? t.history.won(ganadores[0].nombre)
                : t.history.tie(t.join(ganadores.map((g) => g.nombre)));
          return (
            <button key={h.id} className="tarjeta btn" style={{ display: "flex", flexDirection: "column", alignItems: "stretch", fontWeight: 500, opacity: ganadores.length ? 1 : 0.6, textAlign: "left" }} onClick={() => setAbierta(abierta === h.id ? null : h.id)} aria-expanded={abierta === h.id}>
              <span className="fila">
                {ganadores[0] && <span className="punto" style={{ background: ganadores[0].color }} />}
                <b className="grow">{titulo}</b>
                <span className="mono" style={{ fontSize: 13 }}>{ganadores[0] ? fmt(ganadores[0].puntos) : "—"}</span>
              </span>
              <span className="dim" style={{ fontSize: 12 }}>
                {fecha(h.fecha, t)} · {juego} · {h.jugadores.map((j) => j.nombre).join(", ")} · {entrada && h.info ? entrada.describir(h.info, t) : ""}
              </span>
              {abierta === h.id && (
                <span className="columna" style={{ marginTop: 8, gap: 4 }}>
                  {[...h.jugadores].sort((a, b) => b.puntos - a.puntos).map((j) => (
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
