import { useEffect, useRef, useState } from "react";
import { AjustesEfectos } from "../../../central/Ajustes";
import { fmt, useAjustes } from "../../../motor/central";
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
  const [ajustes] = useAjustes();
  const [rodando, setRodando] = useState(false);
  const [agitando, setAgitando] = useState(false);
  const [listo, setListo] = useState(false);
  const [capa, setCapa] = useState<Capa>(null);
  const ultimoSonidoAgitar = useRef(0);
  const ultimaRondaPrevia = useRef(e.ultimaRonda);

  const usarAgitar = ajustes.agitar && agitarDisponible();

  // Al cambiar de turno, volver a la pantalla de relevo.
  useEffect(() => setListo(false), []);

  // Campanazo cuando empieza la última ronda.
  useEffect(() => {
    if (e.ultimaRonda && !ultimaRondaPrevia.current && e.fase === "cambioDeTurno") efectos.ultimaRonda();
    ultimaRondaPrevia.current = e.ultimaRonda;
  }, [e.ultimaRonda, e.fase]);

  const lanzar = () => {
    if (rodando || (e.fase !== "lanzado" && e.fase !== "cambioDeTurno")) return;
    const nuevo = aplicar(e, { tipo: "LANZAR" });
    actualizar(nuevo); // se guarda antes de mostrar: cerrar la app no evita un sancocho
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
                  Ronda {e.ronda} · Meta {e.config.modoMeta === "exacta" ? "exacta " : ""}
                  {fmt(e.config.meta)}
                </span>
                <button type="button" className="boton-icono" onClick={() => setCapa("pausa")} aria-label="Pausar">
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

/* ---------- Piezas ---------- */

function Tira({ e, abrir }: { e: EstadoAmbicioso; abrir: () => void }) {
  return (
    <button type="button" className="tira" onClick={abrir} title="Ver marcador">
      {e.jugadores.map((j, i) => (
        <span key={j.id} className={i === e.turnoDe ? "ahora" : ""} style={{ ["--c" as string]: j.color }}>
          <span>{j.nombre}</span>
          <b>{fmt(j.puntos)}</b>
        </span>
      ))}
    </button>
  );
}

function QuienJuega({ e, extra }: { e: EstadoAmbicioso; extra?: React.ReactNode }) {
  const j = e.jugadores[e.turnoDe];
  return (
    <div className="fila">
      <span className="punto" style={{ background: j.color }} />
      <b>Turno de {j.nombre}</b>
      <span className="grow" />
      {extra}
    </div>
  );
}

function textoEvento(e: EstadoAmbicioso, ev: Evento) {
  const j = e.jugadores.find((x) => x.id === ev.jugadorId);
  if (ev.tipo === "planto") return `${j?.nombre} se plantó con ${fmt(ev.puntos)} → ${fmt(ev.total)}`;
  if (ev.tipo === "pasado") return `${j?.nombre} se pasó y perdió ${fmt(ev.puntos)}`;
  return `${j?.nombre} sacó sancocho${ev.puntos ? ` y perdió ${fmt(ev.puntos)}` : ""}`;
}

function AvisoUltimaRonda({ e }: { e: EstadoAmbicioso }) {
  if (!e.ultimaRonda) return null;
  const quien = e.jugadores.find((j) => j.id === e.quienLlego);
  const restantes = e.jugadores.slice(e.turnoDe).map((j) => j.nombre);
  return (
    <div className="aviso columna" style={{ gap: 2 }}>
      <span className="lbl">Última ronda</span>
      <span>
        {quien?.nombre} llegó a {fmt(quien?.puntos ?? 0)}. {restantes.join(", ").replace(/, ([^,]*)$/, " y $1")}{" "}
        {restantes.length === 1 ? "tiene" : "tienen"} un último turno.
      </span>
    </div>
  );
}

function Relevo({ e, listo, usarAgitar }: { e: EstadoAmbicioso; listo: () => void; usarAgitar: boolean }) {
  const j = e.jugadores[e.turnoDe];
  const ultimo = e.historial.at(-1);
  const detalle = e.ultimaRonda
    ? e.config.modoMeta === "exacta"
      ? `Tiene ${fmt(j.puntos)} · necesita exactamente ${fmt(necesitaParaGanar(e))}`
      : `Tiene ${fmt(j.puntos)} · necesita ${fmt(necesitaParaGanar(e))} para quedar de primero`
    : `Tiene ${fmt(j.puntos)} · le faltan ${fmt(faltante(e))}`;
  return (
    <>
      <AvisoUltimaRonda e={e} />
      <span className="grow" />
      <div className="relevo" style={{ ["--c" as string]: j.color }}>
        <span className="punto" style={{ background: j.color, width: 20, height: 20 }} />
        <span className="lbl">Pásale el teléfono a</span>
        <h2>{j.nombre}</h2>
        <span className="dim">{detalle}</span>
      </div>
      <span className="grow" />
      {ultimo && (
        <div className="tarjeta bitacora">
          <span>Último turno</span>
          <span style={{ color: "var(--ink)" }}>{textoEvento(e, ultimo)}</span>
        </div>
      )}
      <button type="button" className="btn pri" onClick={listo}>
        {usarAgitar ? "Estoy listo" : "Estoy listo · lanzar"}
      </button>
    </>
  );
}

function ListoParaLanzar({ e, lanzar }: { e: EstadoAmbicioso; lanzar: () => void }) {
  return (
    <>
      <QuienJuega e={e} extra={<span className="pildora">4 dados</span>} />
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
        <h2 style={{ fontSize: 28 }}>Agita para lanzar</h2>
        <span className="dim">Los dados caen cuando dejas de agitar.</span>
      </div>
      <span className="grow" />
      <button type="button" className="btn borde" onClick={lanzar}>
        O toca aquí para lanzar
      </button>
    </>
  );
}

function Rodando({ e, agitando }: { e: EstadoAmbicioso; agitando: boolean }) {
  // Mientras rueda, el estado ya tiene el resultado; se muestran caras al azar.
  const n = agitando ? e.dadosDisponibles : (e.ultimoLanzamiento?.caras.length ?? e.dadosDisponibles);
  const apartados = agitando
    ? e.fase === "lanzado" && e.ultimoLanzamiento && !e.ultimoLanzamiento.manoLlena
      ? [...e.apartados, ...e.ultimoLanzamiento.caras.filter((_, i) => e.ultimoLanzamiento?.sirven[i])]
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
      <QuienJuega e={e} extra={<span className="pildora">{agitando ? "Agitando…" : "Lanzando…"}</span>} />
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
  const j = e.jugadores[e.turnoDe];
  const l = e.ultimoLanzamiento;
  if (!l) return null;
  const total = j.puntos + e.acumulado;
  const justo = e.config.modoMeta === "exacta" && total === e.config.meta;
  const llega = e.config.modoMeta === "llegarOPasar" && total >= e.config.meta && !e.ultimaRonda;
  return (
    <>
      <QuienJuega e={e} extra={<span className="pildora">Lanzamiento {e.numeroLanzamiento}</span>} />
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
          +{fmt(l.puntos)} · {l.partes.join(" + ")}
          {l.manoLlena && " · ¡mano llena!"}
        </span>
      </div>
      <div className="columna centro" style={{ textAlign: "center", gap: 2 }}>
        <span className="lbl">Acumulado del turno</span>
        <span className="grande" style={{ color: l.manoLlena ? "var(--gold)" : undefined }}>
          {fmt(e.acumulado)}
        </span>
        <span className="dim" style={{ fontSize: 14 }}>
          {l.manoLlena ? "Todos sumaron: recuperas los 4 dados. " : ""}
          Si te plantas: {fmt(j.puntos)} → {fmt(total)}
        </span>
        {justo && <span style={{ color: "var(--gold)", fontWeight: 700 }}>¡Justo la meta! Plántate para ganar.</span>}
        {llega && <span style={{ color: "var(--gold)", fontWeight: 700 }}>Si te plantas alcanzas la meta.</span>}
        {e.config.modoMeta === "exacta" && !justo && (
          <span className="dim" style={{ fontSize: 13 }}>
            Te faltarían {fmt(e.config.meta - total)} para la meta exacta.
          </span>
        )}
      </div>
      <span className="grow" />
      <div className="columna">
        <button type="button" className={`btn ${justo ? "sec" : "pri"}`} onClick={lanzar}>
          Seguir · {usarAgitar ? "agita o toca para" : ""} lanzar {e.dadosDisponibles}{" "}
          {e.dadosDisponibles === 1 ? "dado" : "dados"}
        </button>
        <button type="button" className={`btn ${justo ? "pri" : "sec"}`} onClick={plantarse}>
          Plantarme y anotar {fmt(e.acumulado)}
        </button>
      </div>
    </>
  );
}

function Perdio({ e, pasar }: { e: EstadoAmbicioso; pasar: () => void }) {
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
      <h1 style={{ textAlign: "center", fontSize: 44, color: "var(--bust)" }}>
        {pasado ? "¡Te pasaste!" : "¡Sancocho!"}
      </h1>
      {e.perdido > 0 && (
        <div className="tachado" style={{ textAlign: "center" }}>
          {fmt(e.perdido)}
        </div>
      )}
      <p className="dim" style={{ textAlign: "center", margin: 0 }}>
        {pasado
          ? `Tenías ${fmt(j.puntos)} + ${fmt(e.perdido)} acumulados. Este lanzamiento te llevaba a ${fmt(j.puntos + e.perdido + l.puntos)}. ${j.nombre} se queda con ${fmt(j.puntos)}.`
          : `Ningún dado sirvió. ${j.nombre} se queda con ${fmt(j.puntos)}.`}
      </p>
      <span className="grow" />
      <button type="button" className="btn peligro" onClick={pasar}>
        {fin ? "Ver quién ganó" : `Pasar el turno a ${e.jugadores[siguiente].nombre}`}
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
  useEffect(() => efectos.ganador(), []);
  const ganadores = e.jugadores.filter((g) => e.ganadores.includes(g.id));
  const resto = [...e.jugadores].filter((j) => !e.ganadores.includes(j.id)).sort((a, b) => b.puntos - a.puntos);
  const g = ganadores[0];
  return (
    <>
      <div className="confeti" />
      <span className="grow" />
      <div className="columna centro" style={{ textAlign: "center", gap: 6, position: "relative" }}>
        <span className="lbl">Fin de la ronda {e.ronda}</span>
        <h1 style={{ fontSize: ganadores.length > 1 ? 40 : 50, color: g.color }}>
          {ganadores.length === 1
            ? `¡${g.nombre} gana!`
            : `¡Empate! Ganan ${ganadores.map((x) => x.nombre).join(" y ")}`}
        </h1>
        <span className="grande" style={{ fontSize: 44 }}>
          {fmt(g.puntos)}
        </span>
        {ganadores.length === 1 && (
          <span className="dim">
            {g.turnos} turnos · su mejor turno: {fmt(g.mejorTurno)}
          </span>
        )}
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
          Revancha (mismos jugadores)
        </button>
        <button type="button" className="btn borde" onClick={nuevaPartida}>
          Cambiar jugadores o meta
        </button>
        <button type="button" className="btn borde" onClick={salir}>
          Volver a Mis juegos
        </button>
      </div>
    </>
  );
}

/* ---------- Capas ---------- */

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
  const [confirmar, setConfirmar] = useState(false);
  const [efectosAbiertos, setEfectosAbiertos] = useState(false);
  const j = e.jugadores[e.turnoDe];
  return (
    <div className="capa" role="dialog" aria-label="Partida en pausa">
      <div className="pantalla">
        <div className="barra">
          <span className="mono" style={{ fontSize: 12 }}>
            Ronda {e.ronda} · Meta {fmt(e.config.meta)}
          </span>
        </div>
        <h1 className="titulo">Partida en pausa</h1>
        <div className="tarjeta columna" style={{ gap: 2 }}>
          <span className="lbl">Turno de {j.nombre}</span>
          <span>
            {e.fase === "lanzado"
              ? `Acumulado ${fmt(e.acumulado)} · quedan ${e.dadosDisponibles} ${e.dadosDisponibles === 1 ? "dado" : "dados"}`
              : "Todavía no ha lanzado"}
          </span>
        </div>
        <div className="columna">
          <button type="button" className="btn pri" onClick={cerrar}>
            Seguir jugando
          </button>
          <button type="button" className="btn sec" onClick={() => abrir("marcador")}>
            Ver marcador
          </button>
          <button type="button" className="btn sec" onClick={() => abrir("reglas")}>
            Reglas
          </button>
          <button
            type="button"
            className="btn sec"
            onClick={() => setEfectosAbiertos((v) => !v)}
            aria-expanded={efectosAbiertos}
          >
            Sonido y vibración
          </button>
          {efectosAbiertos && <AjustesEfectos />}
          <button type="button" className="btn borde" onClick={salir}>
            Salir (queda guardada)
          </button>
        </div>
        <span className="grow" />
        {confirmar ? (
          <div className="tarjeta columna">
            <b>¿Terminar la partida sin ganador?</b>
            <span className="dim" style={{ fontSize: 14 }}>
              Quedará en el historial como terminada sin ganador.
            </span>
            <div className="fila">
              <button type="button" className="btn borde chico grow" onClick={() => setConfirmar(false)}>
                Cancelar
              </button>
              <button type="button" className="btn peligro chico grow" onClick={terminar}>
                Terminar
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn peligro-borde" onClick={() => setConfirmar(true)}>
            Terminar partida sin ganador
          </button>
        )}
      </div>
    </div>
  );
}

function Marcador({ e, cerrar }: { e: EstadoAmbicioso; cerrar: () => void }) {
  const orden = [...e.jugadores].sort((a, b) => b.puntos - a.puntos);
  return (
    <div className="capa" role="dialog" aria-label="Marcador">
      <div className="pantalla">
        <div className="barra">
          <button type="button" className="enlace" onClick={cerrar}>
            ‹ Volver al juego
          </button>
          <span className="mono" style={{ fontSize: 12 }}>
            Meta {e.config.modoMeta === "exacta" ? "exacta " : ""}
            {fmt(e.config.meta)}
          </span>
        </div>
        <h1 className="titulo">Marcador</h1>
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
        <span className="lbl">Historial</span>
        <div className="tarjeta bitacora">
          {e.historial.length === 0 && <span>Todavía no hay turnos.</span>}
          {[...e.historial].reverse().map((ev, i) => (
            <span key={i} style={{ color: ev.tipo === "planto" ? undefined : "var(--bust)" }}>
              R{ev.ronda} · {textoEvento(e, ev)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Reglas({ cerrar }: { cerrar: () => void }) {
  return (
    <div className="capa" role="dialog" aria-label="Reglas">
      <div className="pantalla reglas">
        <div className="barra">
          <button type="button" className="enlace" onClick={cerrar}>
            ‹ Volver
          </button>
        </div>
        <h1 className="titulo">Reglas de Ambicioso</h1>
        <ul>
          <li>Se lanzan 4 dados. Cada 1 vale 100 y cada 5 vale 50.</li>
          <li>Tres iguales valen el número × 100 (tres 4 = 400). Tres 1 valen 1.000.</li>
          <li>Cuatro iguales valen el número × 1.000. Cuatro 1 valen 10.000.</li>
          <li>
            Los tríos y pókeres cuentan solo si salen en el mismo lanzamiento. Todos los dados que suman se apartan.
          </li>
          <li>
            Después de cada lanzamiento decides: plantarte y anotar lo acumulado, o seguir con los dados que quedan.
          </li>
          <li>
            Si ningún dado sirve es <b>sancocho</b>: pierdes todo lo acumulado en el turno.
          </li>
          <li>Si todos los dados que lanzaste sumaron (mano llena), vuelves a tener los 4.</li>
          <li>Con meta exacta, si te pasas de la meta pierdes lo acumulado en el turno.</li>
          <li>
            Cuando alguien alcanza la meta, se termina la ronda. Gana quien tenga más puntos; si hay empate, ganan los
            empatados.
          </li>
        </ul>
      </div>
    </div>
  );
}
