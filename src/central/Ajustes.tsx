import { useState } from "react";
import { escribir } from "../motor/almacen";
import { type ModoInicio, useAjustes } from "../motor/central";
import { agitarDisponible, necesitaPermiso, pedirPermisoMovimiento } from "../ui/agitar";

export const NOMBRES_INICIO: Record<ModoInicio, string> = {
  dedos: "Dedos en la pantalla",
  ruleta: "Ruleta",
  duelo: "Duelo de dados",
  azar: "Al azar",
  lista: "Orden de la lista",
};

export function Interruptor(props: {
  id: string;
  titulo: string;
  detalle?: string;
  valor: boolean;
  cambiar: (v: boolean) => void;
}) {
  return (
    <label className="interruptor" htmlFor={props.id}>
      <span className="t">
        <b>{props.titulo}</b>
        {props.detalle && <small>{props.detalle}</small>}
      </span>
      <input
        id={props.id}
        type="checkbox"
        role="switch"
        aria-checked={props.valor}
        checked={props.valor}
        onChange={(e) => props.cambiar(e.target.checked)}
      />
    </label>
  );
}

export function AjustesEfectos() {
  const [a, setA] = useAjustes();
  const puedeVibrar = typeof navigator !== "undefined" && "vibrate" in navigator;
  return (
    <div className="columna">
      <Interruptor id="aj-sonido" titulo="Sonido" valor={a.sonido} cambiar={(v) => setA({ ...a, sonido: v })} />
      <Interruptor
        id="aj-vibracion"
        titulo="Vibración"
        detalle={puedeVibrar ? undefined : "Este equipo no permite vibrar"}
        valor={a.vibracion}
        cambiar={(v) => setA({ ...a, vibracion: v })}
      />
      <Interruptor
        id="aj-agitar"
        titulo="Agitar para lanzar"
        detalle={
          agitarDisponible() ? "Siempre puedes tocar el botón para lanzar" : "Este equipo no tiene sensor de movimiento"
        }
        valor={a.agitar}
        cambiar={async (v) => {
          if (v && necesitaPermiso() && !(await pedirPermisoMovimiento())) return;
          setA({ ...a, agitar: v });
        }}
      />
    </div>
  );
}

export function Ajustes() {
  const [a, setA] = useAjustes();
  const [confirmar, setConfirmar] = useState(false);
  return (
    <>
      <h1 className="titulo">Ajustes</h1>
      <AjustesEfectos />
      <span className="lbl">Quién empieza, por defecto</span>
      <div className="chips">
        {(Object.keys(NOMBRES_INICIO) as ModoInicio[]).map((m) => (
          <button
            type="button"
            key={m}
            className={`chip ${a.modoInicio === m ? "on" : ""}`}
            onClick={() => setA({ ...a, modoInicio: m })}
          >
            {NOMBRES_INICIO[m]}
          </button>
        ))}
      </div>
      <span className="grow" />
      {confirmar ? (
        <div className="tarjeta columna">
          <b>¿Borrar todo el historial de partidas?</b>
          <span className="dim" style={{ fontSize: 14 }}>
            No se puede deshacer. Los jugadores se conservan.
          </span>
          <div className="fila">
            <button type="button" className="btn borde chico grow" onClick={() => setConfirmar(false)}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn peligro chico grow"
              onClick={() => {
                escribir("historial", []);
                setConfirmar(false);
              }}
            >
              Borrar
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn peligro-borde chico" onClick={() => setConfirmar(true)}>
          Borrar historial
        </button>
      )}
      <p className="dim" style={{ fontSize: 12, margin: 0, textAlign: "center" }}>
        Todo se guarda solo en este teléfono.
      </p>
    </>
  );
}
