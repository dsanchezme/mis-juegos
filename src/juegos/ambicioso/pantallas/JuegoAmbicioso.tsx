import { useState } from "react";
import { escribir, leer, nuevoId } from "../../../motor/almacen";
import { fmt, guardarEnHistorial } from "../../../motor/central";
import { semillaNueva } from "../../../motor/azar";
import type { Persona } from "../../../motor/tipos";
import { QuienEmpieza } from "../../../ui/QuienEmpieza";
import { type EstadoAmbicioso, iniciar } from "../reglas/ambicioso";
import { NuevaPartida, type Preparacion } from "./NuevaPartida";
import { Partida } from "./Partida";

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
  return `le toca a ${r.estado.jugadores[r.estado.turnoDe].nombre}`;
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
    detalle: `meta ${e.config.modoMeta === "exacta" ? "exacta " : ""}${fmt(e.config.meta)} · ${e.fase === "ganador" ? `${e.ronda} rondas` : `ronda ${e.ronda}`}`,
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
    // Empieza quien quedó de último, conservando el orden de la mesa.
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
        if (enCurso(registro)) guardar(null); // se descarta la partida a medias
        if (prep.modoInicio === "lista") comenzar(prep, 0);
        else setPaso({ t: "quien", prep });
      }}
    />
  );
}

function Retomar({ r, seguir, nueva, salir }: { r: Registro; seguir: () => void; nueva: () => void; salir: () => void }) {
  const [confirmar, setConfirmar] = useState(false);
  const e = r.estado;
  const j = e.jugadores[e.turnoDe];
  const hace = Math.round((Date.now() - new Date(r.inicio).getTime()) / 60000);
  const cuando = hace < 60 ? `hace ${Math.max(1, hace)} min` : hace < 1440 ? `hace ${Math.round(hace / 60)} h` : `hace ${Math.round(hace / 1440)} días`;
  return (
    <div className="pantalla">
      <div className="barra"><button className="enlace" onClick={salir}>‹ Mis juegos</button></div>
      <h1 className="titulo">Tienes una partida a medias</h1>
      <div className="tarjeta columna">
        <span className="lbl">Ambicioso · empezó {cuando}</span>
        {[...e.jugadores].sort((a, b) => b.puntos - a.puntos).map((x) => (
          <div key={x.id} className="fila">
            <span className="punto" style={{ background: x.color }} />
            <span className="grow">{x.nombre}</span>
            <b className="mono">{fmt(x.puntos)}</b>
          </div>
        ))}
        <span className="dim" style={{ fontSize: 13 }}>
          Le toca a {j.nombre}
          {e.fase === "lanzado" ? `, lleva ${fmt(e.acumulado)} en el turno` : ""}
          {e.fase === "perdio" ? ", acaba de perder su turno" : ""}
        </span>
      </div>
      <span className="grow" />
      <div className="columna">
        <button className="btn pri" onClick={seguir}>Retomar</button>
        {confirmar ? (
          <div className="tarjeta columna">
            <b>¿Empezar otra? La partida a medias se descarta al empezar la nueva.</b>
            <div className="fila">
              <button className="btn borde chico grow" onClick={() => setConfirmar(false)}>Cancelar</button>
              <button className="btn peligro chico grow" onClick={nueva}>Sí, empezar otra</button>
            </div>
          </div>
        ) : (
          <button className="btn borde" onClick={() => setConfirmar(true)}>Empezar una nueva</button>
        )}
      </div>
    </div>
  );
}
