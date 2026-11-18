import { useEffect, useRef, useState } from "react";
import { AjustesEfectos } from "../../../central/Ajustes";
import { fmt, useT } from "../../../i18n";
import type { Texts } from "../../../i18n/es";
import { useAjustes } from "../../../motor/central";
import { agitarDisponible, useAgitar } from "../../../ui/agitar";
import { Dado } from "../../../ui/Dado";
import { efectos } from "../../../ui/efectos";
import { aplicar, type EstadoAmbicioso, type Evento, faltante, necesitaParaGanar } from "../reglas/ambicioso";

interface Props {
  estado: EstadoAmbicioso;
  actualizar: (e: EstadoAmbicioso) => void;
  salir: () => void;
  revancha: () => void;
  nuevaPartida: () => void;
}

type Capa = null | "pausa" | "marcador" | "reglas";

const DURACION_LANZAMIENTO = 700;

export function Partida({ estado: e, actualizar, salir, revancha, nuevaPartida }: Props) {
  const t = useT();
  const [ajustes] = useAjustes();
  const [rodando, setRodando] = useState(false);
  const [agitando, setAgitando] = useState(false);
  const [listo, setListo] = useState(false);
  const [capa, setCapa] = useState<Capa>(null);
  const ultimoSonidoAgitar = useRef(0);
  const ultimaRondaPrevia = useRef(e.ultimaRonda);

  const usarAgitar = ajustes.agitar && agitarDisponible();

  // When the turn changes, go back to the hand-off screen.
  // biome-ignore lint/correctness/useExhaustiveDependencies: must re-run whenever the turn or round changes.
  useEffect(() => setListo(false), [e.turnoDe, e.ronda]);

  // Bell when the final round starts.
  useEffect(() => {
    if (e.ultimaRonda && !ultimaRondaPrevia.current && e.fase === "cambioDeTurno") efectos.ultimaRonda();
    ultimaRondaPrevia.current = e.ultimaRonda;
  }, [e.ultimaRonda, e.fase]);

  const lanzar = () => {
    if (rodando || (e.fase !== "lanzado" && e.fase !== "cambioDeTurno")) return;
    const nuevo = aplicar(e, { tipo: "LANZAR" });
    actualizar(nuevo); // saved before it is shown, so closing the app can't undo a bust
    setRodando(true);
    efectos.agitando();
    window.setTimeout(() => {
      setRodando(false);
      const l = nuevo.ultimoLanzamiento;
      if (!l) return;
      efectos.caen(l.caras.length);
      if (nuevo.fase === "perdio") efectos.sancocho();
      else if (l.manoLlena) {
        efectos.suman(l.sirven.filter(Boolean).length);
        efectos.manoLlena();
      } else efectos.suman(l.sirven.filter(Boolean).length);
    }, DURACION_LANZAMIENTO);
  };

  const plantarse = () => {
    efectos.plantarse();
    actualizar(aplicar(e, { tipo: "PLANTARSE" }));
  };

  const puedeAgitar =
    usarAgitar && !rodando && capa === null && (e.fase === "lanzado" || (e.fase === "cambioDeTurno" && listo));
  useAgitar(
    puedeAgitar,
    () => {
      setAgitando(true);
      const ahora = performance.now();
      if (ahora - ultimoSonidoAgitar.current > 140) {
        ultimoSonidoAgitar.current = ahora;
        efectos.agitando();
      }
    },
    () => {
      setAgitando(false);
      lanzar();
    },
  );

  let contenido: React.ReactNode;
  if (e.fase === "ganador") {
    contenido = <Ganador e={e} revancha={revancha} salir={salir} nuevaPartida={nuevaPartida} />;
  } else if (rodando || agitando) {
    contenido = <Rodando e={e} agitando={agitando && !rodando} />;
  } else if (e.fase === "cambioDeTurno" && !listo) {
    contenido = <Relevo e={e} listo={() => (usarAgitar ? setListo(true) : lanzar())} usarAgitar={usarAgitar} />;
  } else if (e.fase === "cambioDeTurno") {
    contenido = <ListoParaLanzar e={e} lanzar={lanzar} />;
  } else if (e.fase === "lanzado") {
    contenido = <Turno e={e} lanzar={lanzar} plantarse={plantarse} usarAgitar={usarAgitar} />;
  } else if (e.fase === "perdio") {
    contenido = <Perdio e={e} pasar={() => actualizar(aplicar(e, { tipo: "PASAR_TURNO" }))} />;
  }

  const fondo = e.fase === "perdio" && !rodando ? "fondo-sancocho" : e.fase === "ganador" ? "fondo-ganador" : "";

  return (
    <>
      <div className={`pantalla ${fondo}`} style={{ maxWidth: "none" }}>
        <div className="columna" style={{ maxWidth: 480, width: "100%", margin: "0 auto", flex: 1, gap: 14 }}>
          {e.fase !== "ganador" && (
            <>
              <div className="barra">
                <span className="mono" style={{ fontSize: 12 }}>
                  {t.ambicioso.round(e.ronda)} ·{" "}
                  {t.ambicioso.targetLabel(e.config.modoMeta === "exacta", fmt(e.config.meta))}
                </span>
                <button
                  type="button"
                  className="boton-icono"
                  onClick={() => setCapa("pausa")}
                  aria-label={t.common.pause}
                >
                  ⏸
                </button>
              </div>
              <Tira e={e} abrir={() => setCapa("marcador")} />
            </>
          )}
          {contenido}
        </div>
      </div>
      {capa === "pausa" && (
        <Pausa
          e={e}
          cerrar={() => setCapa(null)}
          abrir={setCapa}
          salir={salir}
          terminar={() => actualizar(aplicar(e, { tipo: "TERMINAR" }))}
        />
      )}
      {capa === "marcador" && <Marcador e={e} cerrar={() => setCapa(null)} />}
      {capa === "reglas" && <Reglas cerrar={() => setCapa("pausa")} />}
    </>
  );
}

/* ---------- Pieces ---------- */

function Tira({ e, abrir }: { e: EstadoAmbicioso; abrir: () => void }) {
  const t = useT();
  return (
    <button type="button" className="tira" onClick={abrir} aria-label={t.ambicioso.showScores}>
      {e.jugadores.map((j, i) => (
        <div key={j.id} className={i === e.turnoDe ? "ahora" : ""} style={{ ["--c" as string]: j.color }}>
          <span>{j.nombre}</span>
          <b>{fmt(j.puntos)}</b>
        </div>
      ))}
    </button>
  );
}

function QuienJuega({ e, extra }: { e: EstadoAmbicioso; extra?: React.ReactNode }) {
  const t = useT();
  const j = e.jugadores[e.turnoDe];
  return (
    <div className="fila">
      <span className="punto" style={{ background: j.color }} />
      <b>{t.ambicioso.turnOf(j.nombre)}</b>
      <span className="grow" />
      {extra}
    </div>
  );
}

function textoEvento(e: EstadoAmbicioso, ev: Evento, t: Texts) {
  const nombre = e.jugadores.find((x) => x.id === ev.jugadorId)?.nombre ?? "";
  if (ev.tipo === "planto") return t.ambicioso.logBanked(nombre, fmt(ev.puntos), fmt(ev.total));
  if (ev.tipo === "pasado") return t.ambicioso.logOvershot(nombre, fmt(ev.puntos));
  return t.ambicioso.logBust(nombre, ev.puntos ? fmt(ev.puntos) : null);
}

function AvisoUltimaRonda({ e }: { e: EstadoAmbicioso }) {
  const t = useT();
  if (!e.ultimaRonda) return null;
  const quien = e.jugadores.find((j) => j.id === e.quienLlego);
  const restantes = e.jugadores.slice(e.turnoDe).map((j) => j.nombre);
  return (
    <div className="aviso columna" style={{ gap: 2 }}>
      <span className="lbl">{t.ambicioso.lastRound}</span>
      <span>
        {t.ambicioso.lastRoundBody(
          quien?.nombre ?? "",
          fmt(quien?.puntos ?? 0),
          t.join(restantes),
          restantes.length > 1,
        )}
      </span>
    </div>
  );
}

function Relevo({ e, listo, usarAgitar }: { e: EstadoAmbicioso; listo: () => void; usarAgitar: boolean }) {
  const t = useT();
  const a = t.ambicioso;
  const j = e.jugadores[e.turnoDe];
  const ultimo = e.historial.at(-1);
  const detalle = e.ultimaRonda
    ? e.config.modoMeta === "exacta"
      ? a.hasNeedsExact(fmt(j.puntos), fmt(necesitaParaGanar(e)))
      : a.hasNeedsLead(fmt(j.puntos), fmt(necesitaParaGanar(e)))
    : a.hasMissing(fmt(j.puntos), fmt(faltante(e)));
  return (
    <>
      <AvisoUltimaRonda e={e} />
      <span className="grow" />
      <div className="relevo" style={{ ["--c" as string]: j.color }}>
        <span className="punto" style={{ background: j.color, width: 20, height: 20 }} />
        <span className="lbl">{a.passTo}</span>
        <h2>{j.nombre}</h2>
        <span className="dim">{detalle}</span>
      </div>
      <span className="grow" />
      {ultimo && (
        <div className="tarjeta bitacora">
          <span>{a.lastTurn}</span>
          <span style={{ color: "var(--ink)" }}>{textoEvento(e, ultimo, t)}</span>
        </div>
      )}
      <button type="button" className="btn pri" onClick={listo}>
        {usarAgitar ? a.ready : a.readyRoll}
      </button>
    </>
  );
}

function ListoParaLanzar({ e, lanzar }: { e: EstadoAmbicioso; lanzar: () => void }) {
  const t = useT();
  return (
    <>
      <QuienJuega e={e} extra={<span className="pildora">{t.ambicioso.dice(4)}</span>} />
      <span className="grow" />
      <div className="columna centro" style={{ textAlign: "center" }}>
        <svg viewBox="0 0 70 110" width="70" height="110" aria-hidden="true" className="agitar-ic">
          <rect x="15" y="10" width="40" height="80" rx="8" fill="none" stroke="#f6efe0" strokeWidth="4" />
          <path
            d="M6 35 q-6 15 0 30 M64 35 q6 15 0 30"
            stroke="#f4b942"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
        <h2 style={{ fontSize: 28 }}>{t.ambicioso.shakeToRoll}</h2>
        <span className="dim">{t.ambicioso.shakeHint}</span>
      </div>
      <span className="grow" />
      <button type="button" className="btn borde" onClick={lanzar}>
        {t.ambicioso.tapToRoll}
      </button>
    </>
  );
}

function Rodando({ e, agitando }: { e: EstadoAmbicioso; agitando: boolean }) {
  // While rolling, the state already holds the result; random faces are shown until it lands.
  const t = useT();
  const n = agitando ? e.dadosDisponibles : (e.ultimoLanzamiento?.caras.length ?? e.dadosDisponibles);
  const previo = e.ultimoLanzamiento;
  const apartados = agitando
    ? e.fase === "lanzado" && previo && !previo.manoLlena
      ? [...e.apartados, ...previo.caras.filter((_, i) => previo.sirven[i])]
      : []
    : e.apartados;
  const [caras, setCaras] = useState(() => Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 6)));
  useEffect(() => {
    const t = window.setInterval(
      () => setCaras(Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 6))),
      110,
    );
    return () => window.clearInterval(t);
  }, [n]);
  return (
    <>
      <QuienJuega
        e={e}
        extra={<span className="pildora">{agitando ? t.ambicioso.shaking : t.ambicioso.rolling}</span>}
      />
      <span className="grow" />
      <div className="bandeja">
        <div className="apartados">
          {apartados.map((c, i) => (
            <Dado key={i} cara={c} tamano={28} estado="apartado" />
          ))}
        </div>
        <div className="dados">
          {caras.map((c, i) => (
            <Dado key={i} cara={c} tamano={60} estado="rodando" retraso={i * -90} />
          ))}
        </div>
      </div>
      <div className="columna centro" style={{ textAlign: "center", gap: 2 }}>
        <span className="lbl">Acumulado del turno</span>
        <span className="grande">
          {fmt(
            agitando ? e.acumulado : e.fase === "perdio" ? e.perdido : e.acumulado - (e.ultimoLanzamiento?.puntos ?? 0),
          )}
        </span>
      </div>
      <span className="grow" />
    </>
  );
}

function Turno({
  e,
  lanzar,
  plantarse,
  usarAgitar,
}: {
  e: EstadoAmbicioso;
  lanzar: () => void;
  plantarse: () => void;
  usarAgitar: boolean;
}) {
  const t = useT();
  const a = t.ambicioso;
  const j = e.jugadores[e.turnoDe];
  const l = e.ultimoLanzamiento;
  if (!l) return null;
  const total = j.puntos + e.acumulado;
  const justo = e.config.modoMeta === "exacta" && total === e.config.meta;
  const llega = e.config.modoMeta === "llegarOPasar" && total >= e.config.meta && !e.ultimaRonda;
  return (
    <>
      <QuienJuega e={e} extra={<span className="pildora">{a.rollN(e.numeroLanzamiento)}</span>} />
      <AvisoUltimaRonda e={e} />
      <div className="bandeja">
        <div className="apartados">
          {e.apartados.map((c, i) => (
            <Dado key={i} cara={c} tamano={28} estado="apartado" />
          ))}
        </div>
        <div className="dados" key={e.numeroLanzamiento}>
          {l.caras.map((c, i) => (
            <div key={i} className="dado-caja">
              <Dado cara={c} tamano={60} estado={l.sirven[i] ? "suma" : "normal"} />
            </div>
          ))}
        </div>
        <span className="pildora oro">
          +{fmt(l.puntos)} · {l.partes.map((p) => a.part(p, fmt)).join(" + ")}
          {l.manoLlena && ` · ${a.hotDice}`}
        </span>
      </div>
      <div className="columna centro" style={{ textAlign: "center", gap: 2 }}>
        <span className="lbl">Acumulado del turno</span>
        <span className="grande" style={{ color: l.manoLlena ? "var(--gold)" : undefined }}>
          {fmt(e.acumulado)}
        </span>
        <span className="dim" style={{ fontSize: 14 }}>
          {l.manoLlena ? a.hotDiceBody : ""}
          {a.ifYouBank(fmt(j.puntos), fmt(total))}
        </span>
        {justo && <span style={{ color: "var(--gold)", fontWeight: 700 }}>{a.exactHit}</span>}
        {llega && <span style={{ color: "var(--gold)", fontWeight: 700 }}>{a.reachesTarget}</span>}
        {e.config.modoMeta === "exacta" && !justo && (
          <span className="dim" style={{ fontSize: 13 }}>
            {a.exactMissing(fmt(e.config.meta - total))}
          </span>
        )}
      </div>
      <span className="grow" />
      <div className="columna">
        <button type="button" className={`btn ${justo ? "sec" : "pri"}`} onClick={lanzar}>
          {a.keepRolling(e.dadosDisponibles, usarAgitar)}
        </button>
        <button type="button" className={`btn ${justo ? "pri" : "sec"}`} onClick={plantarse}>
          {a.bank(fmt(e.acumulado))}
        </button>
      </div>
    </>
  );
}

function Perdio({ e, pasar }: { e: EstadoAmbicioso; pasar: () => void }) {
  const t = useT();
  const a = t.ambicioso;
  const j = e.jugadores[e.turnoDe];
  const l = e.ultimoLanzamiento;
  if (!l) return null;
  const siguiente = (e.turnoDe + 1) % e.jugadores.length;
  const fin = e.ultimaRonda && siguiente === 0;
  const pasado = e.motivoPerdida === "pasado";
  return (
    <>
      <QuienJuega e={e} />
      <span className="grow" />
      <div className="bandeja" style={{ background: "transparent", minHeight: 0 }}>
        <div className="dados">
          {l.caras.map((c, i) => (
            <Dado key={i} cara={c} tamano={56} estado={l.sirven[i] ? "suma" : "muerto"} />
          ))}
        </div>
      </div>
      {!pasado && (
        <div className="olla centro" style={{ textAlign: "center" }} aria-hidden="true">
          🍲
        </div>
      )}
      <h1 style={{ textAlign: "center", fontSize: 44, color: "var(--bust)" }}>{pasado ? a.overshot : a.bust}</h1>
      {e.perdido > 0 && (
        <div className="tachado" style={{ textAlign: "center" }}>
          {fmt(e.perdido)}
        </div>
      )}
      <p className="dim" style={{ textAlign: "center", margin: 0 }}>
        {pasado
          ? a.overshotBody(fmt(j.puntos), fmt(e.perdido), fmt(j.puntos + e.perdido + l.puntos), j.nombre)
          : a.bustBody(j.nombre, fmt(j.puntos))}
      </p>
      <span className="grow" />
      <button type="button" className="btn peligro" onClick={pasar}>
        {fin ? a.seeWinner : a.passTurn(e.jugadores[siguiente].nombre)}
      </button>
    </>
  );
}

function Ganador({
  e,
  revancha,
  salir,
  nuevaPartida,
}: {
  e: EstadoAmbicioso;
  revancha: () => void;
  salir: () => void;
  nuevaPartida: () => void;
}) {
  const t = useT();
  const a = t.ambicioso;
  useEffect(() => efectos.ganador(), []);
  const ganadores = e.jugadores.filter((g) => e.ganadores.includes(g.id));
  const resto = [...e.jugadores].filter((j) => !e.ganadores.includes(j.id)).sort((a, b) => b.puntos - a.puntos);
  const g = ganadores[0];
  return (
    <>
      <div className="confeti" />
      <span className="grow" />
      <div className="columna centro" style={{ textAlign: "center", gap: 6, position: "relative" }}>
        <span className="lbl">{a.endOfRound(e.ronda)}</span>
        <h1 style={{ fontSize: ganadores.length > 1 ? 40 : 50, color: g.color }}>
          {ganadores.length === 1 ? a.wins(g.nombre) : a.tieWin(t.join(ganadores.map((x) => x.nombre)))}
        </h1>
        <span className="grande" style={{ fontSize: 44 }}>
          {fmt(g.puntos)}
        </span>
        {ganadores.length === 1 && <span className="dim">{a.winnerStats(g.turnos, fmt(g.mejorTurno))}</span>}
      </div>
      <div className="ranking" style={{ position: "relative" }}>
        {resto.map((j, i) => (
          <div key={j.id} className="r">
            <b>{ganadores.length + 1 + i}</b>
            <span className="punto" style={{ background: j.color }} />
            <span>{j.nombre}</span>
            <b className="mono">{fmt(j.puntos)}</b>
          </div>
        ))}
      </div>
      <span className="grow" />
      <div className="columna">
        <button type="button" className="btn pri" onClick={revancha}>
          {a.rematch}
        </button>
        <button type="button" className="btn borde" onClick={nuevaPartida}>
          {a.changeSetup}
        </button>
        <button type="button" className="btn borde" onClick={salir}>
          {a.backHome}
        </button>
      </div>
    </>
  );
}

/* ---------- Overlays ---------- */

function Pausa({
  e,
  cerrar,
  abrir,
  salir,
  terminar,
}: {
  e: EstadoAmbicioso;
  cerrar: () => void;
  abrir: (c: Capa) => void;
  salir: () => void;
  terminar: () => void;
}) {
  const t = useT();
  const a = t.ambicioso;
  const [confirmar, setConfirmar] = useState(false);
  const [efectosAbiertos, setEfectosAbiertos] = useState(false);
  const j = e.jugadores[e.turnoDe];
  return (
    <div className="capa" role="dialog" aria-label={a.paused}>
      <div className="pantalla">
        <div className="barra">
          <span className="mono" style={{ fontSize: 12 }}>
            {a.round(e.ronda)} · {a.targetLabel(e.config.modoMeta === "exacta", fmt(e.config.meta))}
          </span>
        </div>
        <h1 className="titulo">{a.paused}</h1>
        <div className="tarjeta columna" style={{ gap: 2 }}>
          <span className="lbl">{a.pausedTurn(j.nombre)}</span>
          <span>
            {e.fase === "lanzado" ? a.pausedProgress(fmt(e.acumulado), a.dice(e.dadosDisponibles)) : a.notRolledYet}
          </span>
        </div>
        <div className="columna">
          <button type="button" className="btn pri" onClick={cerrar}>
            {a.keepPlaying}
          </button>
          <button type="button" className="btn sec" onClick={() => abrir("marcador")}>
            {a.showScores}
          </button>
          <button type="button" className="btn sec" onClick={() => abrir("reglas")}>
            {a.rules}
          </button>
          <button
            type="button"
            className="btn sec"
            onClick={() => setEfectosAbiertos((v) => !v)}
            aria-expanded={efectosAbiertos}
          >
            {a.soundVibration}
          </button>
          {efectosAbiertos && <AjustesEfectos />}
          <button type="button" className="btn borde" onClick={salir}>
            {a.exitSaved}
          </button>
        </div>
        <span className="grow" />
        {confirmar ? (
          <div className="tarjeta columna">
            <b>{a.endConfirm}</b>
            <span className="dim" style={{ fontSize: 14 }}>
              {a.endDetail}
            </span>
            <div className="fila">
              <button type="button" className="btn borde chico grow" onClick={() => setConfirmar(false)}>
                {t.common.cancel}
              </button>
              <button type="button" className="btn peligro chico grow" onClick={terminar}>
                {a.end}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn peligro-borde" onClick={() => setConfirmar(true)}>
            {a.endNoWinner}
          </button>
        )}
      </div>
    </div>
  );
}

function Marcador({ e, cerrar }: { e: EstadoAmbicioso; cerrar: () => void }) {
  const t = useT();
  const a = t.ambicioso;
  const orden = [...e.jugadores].sort((a, b) => b.puntos - a.puntos);
  return (
    <div className="capa" role="dialog" aria-label={a.scoreboard}>
      <div className="pantalla">
        <div className="barra">
          <button type="button" className="enlace" onClick={cerrar}>
            {a.backToGame}
          </button>
          <span className="mono" style={{ fontSize: 12 }}>
            {a.targetLabel(e.config.modoMeta === "exacta", fmt(e.config.meta))}
          </span>
        </div>
        <h1 className="titulo">{a.scoreboard}</h1>
        <div className="ranking">
          {orden.map((j, i) => (
            <div key={j.id} className="r">
              <b>{i + 1}</b>
              <span className="punto" style={{ background: j.color }} />
              <span>{j.nombre}</span>
              <b className="mono">{fmt(j.puntos)}</b>
              <div className="medidor">
                <i style={{ width: `${Math.min(100, (j.puntos / e.config.meta) * 100)}%`, background: j.color }} />
              </div>
            </div>
          ))}
        </div>
        <span className="lbl">{a.log}</span>
        <div className="tarjeta bitacora">
          {e.historial.length === 0 && <span>{a.noTurns}</span>}
          {[...e.historial].reverse().map((ev, i) => (
            <span key={i} style={{ color: ev.tipo === "planto" ? undefined : "var(--bust)" }}>
              {a.roundShort(ev.ronda)} · {textoEvento(e, ev, t)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Reglas({ cerrar }: { cerrar: () => void }) {
  const t = useT();
  const a = t.ambicioso;
  return (
    <div className="capa" role="dialog" aria-label={a.rules}>
      <div className="pantalla reglas">
        <div className="barra">
          <button type="button" className="enlace" onClick={cerrar}>
            {t.common.back}
          </button>
        </div>
        <h1 className="titulo">{a.rulesTitle}</h1>
        <ul>
          {a.rulesList.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
