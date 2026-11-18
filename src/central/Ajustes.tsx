import { useState } from "react";
import { LANGUAGES, useT } from "../i18n";
import type { Texts } from "../i18n/es";
import { escribir } from "../motor/almacen";
import { type ModoInicio, useAjustes } from "../motor/central";
import { agitarDisponible, necesitaPermiso, pedirPermisoMovimiento } from "../ui/agitar";

export const MODOS_INICIO: ModoInicio[] = ["dedos", "ruleta", "duelo", "azar", "lista"];

export const nombreInicio = (t: Texts, m: ModoInicio): string =>
  ({ dedos: t.starters.fingers, ruleta: t.starters.spinner, duelo: t.starters.duel, azar: t.starters.random, lista: t.starters.list })[m];

export function Interruptor(props: { id: string; titulo: string; detalle?: string; valor: boolean; cambiar: (v: boolean) => void }) {
  return (
    <label className="interruptor" htmlFor={props.id}>
      <span className="t">
        <b>{props.titulo}</b>
        {props.detalle && <small>{props.detalle}</small>}
      </span>
      <input id={props.id} type="checkbox" role="switch" checked={props.valor} onChange={(e) => props.cambiar(e.target.checked)} />
    </label>
  );
}

/** Sound, vibration and shake toggles. Also shown in the in-game pause menu. */
export function AjustesEfectos() {
  const t = useT();
  const [a, setA] = useAjustes();
  const puedeVibrar = typeof navigator !== "undefined" && "vibrate" in navigator;
  return (
    <div className="columna">
      <Interruptor id="aj-sonido" titulo={t.settings.sound} valor={a.sonido} cambiar={(v) => setA({ ...a, sonido: v })} />
      <Interruptor
        id="aj-vibracion"
        titulo={t.settings.vibration}
        detalle={puedeVibrar ? undefined : t.settings.noVibration}
        valor={a.vibracion}
        cambiar={(v) => setA({ ...a, vibracion: v })}
      />
      <Interruptor
        id="aj-agitar"
        titulo={t.settings.shake}
        detalle={agitarDisponible() ? t.settings.shakeHint : t.settings.noShake}
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
  const t = useT();
  const [a, setA] = useAjustes();
  const [confirmar, setConfirmar] = useState(false);
  return (
    <>
      <h1 className="titulo">{t.settings.title}</h1>
      <span className="lbl">{t.settings.language}</span>
      <div className="chips">
        {LANGUAGES.map((l) => (
          <button key={l.id} className={`chip ${a.idioma === l.id ? "on" : ""}`} onClick={() => setA({ ...a, idioma: l.id })} lang={l.id}>
            {l.label}
          </button>
        ))}
      </div>
      <AjustesEfectos />
      <span className="lbl">{t.settings.defaultStarter}</span>
      <div className="chips">
        {MODOS_INICIO.map((m) => (
          <button key={m} className={`chip ${a.modoInicio === m ? "on" : ""}`} onClick={() => setA({ ...a, modoInicio: m })}>
            {nombreInicio(t, m)}
          </button>
        ))}
      </div>
      <span className="grow" />
      {confirmar ? (
        <div className="tarjeta columna">
          <b>{t.settings.clearConfirm}</b>
          <span className="dim" style={{ fontSize: 14 }}>{t.settings.clearDetail}</span>
          <div className="fila">
            <button className="btn borde chico grow" onClick={() => setConfirmar(false)}>{t.common.cancel}</button>
            <button className="btn peligro chico grow" onClick={() => { escribir("historial", []); setConfirmar(false); }}>{t.settings.clear}</button>
          </div>
        </div>
      ) : (
        <button className="btn peligro-borde chico" onClick={() => setConfirmar(true)}>{t.settings.clearHistory}</button>
      )}
      <p className="dim" style={{ fontSize: 12, margin: 0, textAlign: "center" }}>{t.settings.localOnly}</p>
    </>
  );
}
