import { useState } from "react";
import { escribir, leer, nuevoId } from "../../../motor/almacen";
import { currentTexts, fmt, useT } from "../../../i18n";
import { guardarEnHistorial } from "../../../motor/central";
import { semillaNueva } from "../../../motor/azar";
import type { Persona } from "../../../motor/tipos";
import { QuienEmpieza } from "../../../ui/QuienEmpieza";
import { type EstadoAmbicioso, iniciar } from "../reglas/ambicioso";
import { NuevaPartida, type Preparacion } from "./NuevaPartida";
import { Partida } from "./Partida";

/** Storage key for the game in progress (one per game). */
const CLAVE = "partida:ambicioso";

interface Registro {
  id: string;
  inicio: string;
  preparacion: Preparacion;
  estado: EstadoAmbicioso;
}

const enCurso = (r: Registro | null): r is Registro => !!r && r.estado.fase !== "ganador" && r.estado.fase !== "terminada";

export function resumenPartidaAmbicioso(): string | null {
  const r = leer<Registro | null>(CLAVE, null);
  if (!enCurso(r)) return null;
  return currentTexts().ambicioso.pendingSummary(r.estado.jugadores[r.estado.turnoDe].nombre);
}

const aPersona = (p: Persona): Persona => ({ id: p.id, nombre: p.nombre, color: p.color });
const rotar = <T,>(lista: T[], i: number) => [...lista.slice(i), ...lista.slice(0, i)];

function guardarFinal(r: Registro) {
  const e = r.estado;
  guardarEnHistorial({
    id: r.id,
    juego: "ambicioso",
    fecha: new Date().toISOString(),
    jugadores: e.jugadores.map((j) => ({ id: j.id, nombre: j.nombre, color: j.color, puntos: j.puntos })),
    ganadores: e.fase === "ganador" ? e.ganadores : [],
    info: { meta: e.config.meta, exacta: e.config.modoMeta === "exacta", rondas: e.ronda, completa: e.fase === "ganador" },
  });
}

type Paso = { t: "retomar" } | { t: "nueva" } | { t: "quien"; prep: Preparacion } | { t: "partida" };

export function JuegoAmbicioso({ salir }: { salir: () => void }) {
  const [registro, setRegistro] = useState<Registro | null>(() => leer<Registro | null>(CLAVE, null));
  const [paso, setPaso] = useState<Paso>(() => (enCurso(registro) ? { t: "retomar" } : { t: "nueva" }));

  const guardar = (r: Registro | null) => {
    escribir(CLAVE, r);
    setRegistro(r);
  };

  const comenzar = (prep: Preparacion, inicial: number) => {
    const personas = rotar(prep.personas.map(aPersona), inicial);
    guardar({ id: nuevoId(), inicio: new Date().toISOString(), preparacion: prep, estado: iniciar(personas, prep.config, semillaNueva()) });
    setPaso({ t: "partida" });
  };

  const actualizar = (estado: EstadoAmbicioso) => {
    if (!registro) return;
    const nuevo = { ...registro, estado };
    if (estado.fase === "terminada") {
      guardarFinal(nuevo);
      guardar(null);
      salir();
      return;
    }
    if (estado.fase === "ganador") guardarFinal(nuevo);
    guardar(nuevo);
  };

  const revancha = () => {
    if (!registro) return;
    const js = registro.estado.jugadores;
    // Whoever came last goes first; seating order is kept.
    const minimo = Math.min(...js.map((j) => j.puntos));
    const ultimo = js.findIndex((j) => j.puntos === minimo);
    comenzar({ ...registro.preparacion, personas: js.map(aPersona) }, ultimo);
  };

  if (paso.t === "retomar" && enCurso(registro)) {
    return <Retomar r={registro} seguir={() => setPaso({ t: "partida" })} nueva={() => setPaso({ t: "nueva" })} salir={salir} />;
  }
  if (paso.t === "quien") {
    return <QuienEmpieza personas={paso.prep.personas} modo={paso.prep.modoInicio} alElegir={(i) => comenzar(paso.prep, i)} volver={() => setPaso({ t: "nueva" })} />;
  }
  if (paso.t === "partida" && registro) {
    return (
      <Partida
        estado={registro.estado}
        actualizar={actualizar}
        salir={salir}
        revancha={revancha}
        nuevaPartida={() => setPaso({ t: "nueva" })}
      />
    );
  }
  return (
    <NuevaPartida
      previa={registro?.preparacion}
      salir={salir}
      listo={(prep) => {
        if (enCurso(registro)) guardar(null); // discard the unfinished game
        if (prep.modoInicio === "lista") comenzar(prep, 0);
        else setPaso({ t: "quien", prep });
      }}
    />
  );
}

function Retomar({ r, seguir, nueva, salir }: { r: Registro; seguir: () => void; nueva: () => void; salir: () => void }) {
  const t = useT();
  const a = t.ambicioso;
  const [confirmar, setConfirmar] = useState(false);
  const e = r.estado;
  const j = e.jugadores[e.turnoDe];
  const hace = Math.round((Date.now() - new Date(r.inicio).getTime()) / 60000);
  const cuando = hace < 60 ? a.minutesAgo(Math.max(1, hace)) : hace < 1440 ? a.hoursAgo(Math.round(hace / 60)) : a.daysAgo(Math.round(hace / 1440));
  return (
    <div className="pantalla">
      <div className="barra"><button className="enlace" onClick={salir}>{t.common.backToGames}</button></div>
      <h1 className="titulo">{a.resumeTitle}</h1>
      <div className="tarjeta columna">
        <span className="lbl">{a.startedAgo(cuando)}</span>
        {[...e.jugadores].sort((a, b) => b.puntos - a.puntos).map((x) => (
          <div key={x.id} className="fila">
            <span className="punto" style={{ background: x.color }} />
            <span className="grow">{x.nombre}</span>
            <b className="mono">{fmt(x.puntos)}</b>
          </div>
        ))}
        <span className="dim" style={{ fontSize: 13 }}>
          {a.whoseTurn(j.nombre)}
          {e.fase === "lanzado" ? a.turnSoFar(fmt(e.acumulado)) : ""}
          {e.fase === "perdio" ? a.justLost : ""}
        </span>
      </div>
      <span className="grow" />
      <div className="columna">
        <button className="btn pri" onClick={seguir}>{a.resume}</button>
        {confirmar ? (
          <div className="tarjeta columna">
            <b>{a.discardConfirm}</b>
            <div className="fila">
              <button className="btn borde chico grow" onClick={() => setConfirmar(false)}>{t.common.cancel}</button>
              <button className="btn peligro chico grow" onClick={nueva}>{a.discardYes}</button>
            </div>
          </div>
        ) : (
          <button className="btn borde" onClick={() => setConfirmar(true)}>{a.newInstead}</button>
        )}
      </div>
    </div>
  );
}
