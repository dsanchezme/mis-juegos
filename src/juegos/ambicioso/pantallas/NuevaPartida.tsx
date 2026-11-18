import { useState } from "react";
import { MODOS_INICIO, nombreInicio } from "../../../central/Ajustes";
import { fmt, useT } from "../../../i18n";
import { crearPersona, type ModoInicio, tieneTactil, useAjustes, useJugadores } from "../../../motor/central";
import type { Persona } from "../../../motor/tipos";
import type { ConfigAmbicioso, ModoMeta } from "../reglas/ambicioso";

const METAS = [3000, 5000, 10000];

export interface Preparacion {
  personas: Persona[];
  config: ConfigAmbicioso;
  modoInicio: ModoInicio;
}

interface Props {
  previa?: Preparacion;
  listo: (p: Preparacion) => void;
  salir: () => void;
}

export function NuevaPartida({ previa, listo, salir }: Props) {
  const t = useT();
  const a = t.ambicioso;
  const [libreta, setLibreta] = useJugadores();
  const [ajustes] = useAjustes();
  const [elegidos, setElegidos] = useState<string[]>(() => previa?.personas.map((p) => p.id) ?? []);
  const [nombre, setNombre] = useState("");
  const [meta, setMeta] = useState(previa?.config.meta ?? 5000);
  const [otraMeta, setOtraMeta] = useState(!METAS.includes(previa?.config.meta ?? 5000));
  const [modoMeta, setModoMeta] = useState<ModoMeta>(previa?.config.modoMeta ?? "llegarOPasar");
  const [modoInicio, setModoInicio] = useState<ModoInicio>(previa?.modoInicio ?? ajustes.modoInicio);

  const porId = new Map(libreta.map((p) => [p.id, p]));
  const seleccion = elegidos.map((id) => porId.get(id)).filter((p): p is Persona => !!p);
  const disponibles = libreta.filter((p) => !elegidos.includes(p.id));

  const alternar = (id: string) => setElegidos((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]));
  const mover = (i: number, d: -1 | 1) =>
    setElegidos((e) => {
      const c = [...e];
      [c[i], c[i + d]] = [c[i + d], c[i]];
      return c;
    });
  const agregar = () => {
    const n = nombre.trim();
    if (!n) return;
    const existente = libreta.find((p) => p.nombre.toLowerCase() === n.toLowerCase());
    if (existente) {
      if (!elegidos.includes(existente.id)) alternar(existente.id);
    } else {
      const nueva = crearPersona(n, libreta);
      setLibreta((l) => [...l, nueva]);
      setElegidos((e) => [...e, nueva.id]);
    }
    setNombre("");
  };

  const metaValida = Number.isFinite(meta) && meta >= 50 && meta % 50 === 0;
  const puede = seleccion.length >= 2 && metaValida;
  const modos: ModoInicio[] = tieneTactil() ? MODOS_INICIO : MODOS_INICIO.filter((m) => m !== "dedos");

  return (
    <div className="pantalla">
      <div className="barra">
        <button className="enlace" onClick={salir}>{t.common.backToGames}</button>
        <span>{a.name}</span>
        <span style={{ width: 50 }} />
      </div>
      <h1 className="titulo">{a.newGame}</h1>

      <span className="lbl">{a.whoPlays}</span>
      {seleccion.length > 0 && (
        <div className="columna" style={{ gap: 6 }}>
          {seleccion.map((p, i) => (
            <div key={p.id} className="persona">
              <span className="punto" style={{ background: p.color }} />
              <span className="nombre">{p.nombre}</span>
              <button className="boton-icono" onClick={() => mover(i, -1)} disabled={i === 0} aria-label={a.moveUp(p.nombre)}>↑</button>
              <button className="boton-icono" onClick={() => mover(i, 1)} disabled={i === seleccion.length - 1} aria-label={a.moveDown(p.nombre)}>↓</button>
              <button className="boton-icono" onClick={() => alternar(p.id)} aria-label={t.players.removeLabel(p.nombre)}>✕</button>
            </div>
          ))}
        </div>
      )}
      {disponibles.length > 0 && (
        <div className="chips">
          {disponibles.map((p) => (
            <button key={p.id} className="chip" onClick={() => alternar(p.id)}>
              <span className="punto" style={{ background: p.color }} />+ {p.nombre}
            </button>
          ))}
        </div>
      )}
      <form className="fila" onSubmit={(e) => { e.preventDefault(); agregar(); }}>
        <input id="np-nombre" className="campo" placeholder={a.addNew} value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={20} />
        <button className="btn sec chico" type="submit" disabled={!nombre.trim()}>{t.common.add}</button>
      </form>
      {seleccion.length === 1 && <span className="dim" style={{ fontSize: 14 }}>{a.oneMore}</span>}

      <span className="lbl">{a.target}</span>
      <div className="chips">
        {METAS.map((m) => (
          <button key={m} className={`chip mono ${!otraMeta && meta === m ? "on" : ""}`} onClick={() => { setMeta(m); setOtraMeta(false); }}>{fmt(m)}</button>
        ))}
        <button className={`chip ${otraMeta ? "on" : ""}`} onClick={() => setOtraMeta(true)}>{a.other}</button>
      </div>
      {otraMeta && (
        <div className="columna" style={{ gap: 4 }}>
          <input id="np-meta" className="campo mono" type="number" inputMode="numeric" step={50} min={50} value={Number.isFinite(meta) ? meta : ""} onChange={(e) => setMeta(parseInt(e.target.value, 10))} />
          {!metaValida && <span style={{ color: "var(--bust)", fontSize: 13 }}>{a.invalidTarget}</span>}
        </div>
      )}
      <div className="chips">
        <button className={`chip ${modoMeta === "llegarOPasar" ? "on" : ""}`} onClick={() => setModoMeta("llegarOPasar")}>{a.reachOrPass}</button>
        <button className={`chip ${modoMeta === "exacta" ? "on" : ""}`} onClick={() => setModoMeta("exacta")}>{a.exact}</button>
      </div>
      <span className="dim" style={{ fontSize: 13 }}>
        {modoMeta === "exacta" ? a.exactHint : a.reachHint} {a.roundEndsHint}
      </span>

      <span className="lbl">{a.whoStarts}</span>
      <div className="chips">
        {modos.map((m) => (
          <button key={m} className={`chip ${modoInicio === m ? "on" : ""}`} onClick={() => setModoInicio(m)}>{nombreInicio(t, m)}</button>
        ))}
      </div>

      <span className="grow" />
      <button className="btn pri" disabled={!puede} onClick={() => listo({ personas: seleccion, config: { meta, modoMeta }, modoInicio })}>
        {a.start}
      </button>
    </div>
  );
}
