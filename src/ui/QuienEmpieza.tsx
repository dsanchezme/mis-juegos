import { useEffect, useRef, useState } from "react";
import { useT } from "../i18n";
import type { ModoInicio } from "../motor/central";
import { leerAjustes } from "../motor/central";
import type { Persona } from "../motor/tipos";
import { useAgitar } from "./agitar";
import { Dado } from "./Dado";
import { efectos } from "./efectos";

interface Props {
  personas: Persona[];
  modo: ModoInicio;
  alElegir: (indice: number) => void;
  volver: () => void;
}

/** Screen to pick who goes first. Shared by every game. */
export function QuienEmpieza(props: Props) {
  const t = useT();
  return (
    <div className="pantalla">
      <div className="barra">
        <button type="button" className="enlace" onClick={props.volver}>
          {t.common.back}
        </button>
        <span>{t.whoStarts.title}</span>
        <span style={{ width: 50 }} />
      </div>
      {props.modo === "dedos" && <Dedos {...props} />}
      {props.modo === "ruleta" && <Ruleta {...props} />}
      {props.modo === "duelo" && <Duelo {...props} />}
      {props.modo === "azar" && <Azar {...props} />}
    </div>
  );
}

function Resultado({ persona, continuar }: { persona: Persona; continuar: () => void }) {
  const t = useT();
  return (
    <>
      <div className="relevo" style={{ ["--c" as string]: persona.color }}>
        <span className="punto" style={{ background: persona.color, width: 20, height: 20 }} />
        <span className="lbl">{t.whoStarts.starts}</span>
        <h2>{persona.nombre}</h2>
      </div>
      <span className="grow" />
      <button type="button" className="btn pri" onClick={continuar}>
        {t.whoStarts.startGame}
      </button>
    </>
  );
}

/* ---------- Fingers on the screen ---------- */

const COLORES_DEDOS = [
  "#f4b942",
  "#4cc9f0",
  "#f27aa7",
  "#7fdc97",
  "#c3a6ff",
  "#ff9f68",
  "#5ee0d0",
  "#e4e4e4",
  "#ffd1dc",
  "#9ad1ff",
];

function Dedos({ personas, alElegir }: Props) {
  const t = useT();
  const zona = useRef<HTMLDivElement>(null);
  const [dedos, setDedos] = useState<Record<number, { x: number; y: number; color: string }>>({});
  const [cuenta, setCuenta] = useState<number | null>(null);
  const [ganador, setGanador] = useState<number | null>(null);
  const colorSiguiente = useRef(0);
  const dedosRef = useRef(dedos);
  dedosRef.current = dedos;
  const n = Object.keys(dedos).length;

  // With 2+ fingers held still: wait, count down 3-2-1 and pick one.
  useEffect(() => {
    if (ganador !== null) return;
    setCuenta(null);
    if (n < 2) return;
    let c = 3;
    let intervalo: number | undefined;
    const espera = window.setTimeout(() => {
      setCuenta(c);
      efectos.tic();
      intervalo = window.setInterval(() => {
        c--;
        if (c > 0) {
          setCuenta(c);
          efectos.tic();
        } else {
          window.clearInterval(intervalo);
          setCuenta(null);
          const ids = Object.keys(dedosRef.current).map(Number);
          setGanador(ids[Math.floor(Math.random() * ids.length)]);
          efectos.ganador();
        }
      }, 700);
    }, 1200);
    return () => {
      window.clearTimeout(espera);
      window.clearInterval(intervalo);
    };
  }, [n, ganador]);

  const pos = (e: React.PointerEvent) => {
    const r = zona.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  };
  const esRaton = (e: React.PointerEvent) => e.pointerType === "mouse";

  const abajo = (e: React.PointerEvent) => {
    if (ganador !== null) return;
    e.preventDefault();
    const id = esRaton(e) ? Date.now() : e.pointerId;
    if (!esRaton(e)) {
      try {
        zona.current?.setPointerCapture(e.pointerId);
      } catch {
        /* capture not available */
      }
    }
    const color = COLORES_DEDOS[colorSiguiente.current++ % COLORES_DEDOS.length];
    setDedos((d) => ({ ...d, [id]: { ...pos(e), color } }));
    efectos.toque();
  };
  const mover = (e: React.PointerEvent) => {
    if (ganador !== null || esRaton(e)) return;
    setDedos((d) => (d[e.pointerId] ? { ...d, [e.pointerId]: { ...d[e.pointerId], ...pos(e) } } : d));
  };
  const arriba = (e: React.PointerEvent) => {
    if (ganador !== null || esRaton(e)) return;
    setDedos((d) => {
      const { [e.pointerId]: _quitado, ...resto } = d;
      return resto;
    });
  };
  const reiniciar = () => {
    setDedos({});
    setGanador(null);
  };

  const mensaje =
    ganador !== null
      ? t.whoStarts.fingersPicked
      : n === 0
        ? t.whoStarts.fingersPlace
        : n === 1
          ? t.whoStarts.fingersOneMore
          : cuenta === null
            ? t.whoStarts.fingersHold
            : "";

  return (
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: multi-touch area; the other ways to pick who goes first are accessible buttons. */}
      <div
        ref={zona}
        className="zona-dedos"
        onPointerDown={abajo}
        onPointerMove={mover}
        onPointerUp={arriba}
        onPointerCancel={arriba}
        onContextMenu={(e) => e.preventDefault()}
      >
        {cuenta !== null && <div className="cuenta">{cuenta}</div>}
        {Object.entries(dedos).map(([id, d]) => (
          <span
            key={id}
            className={`dedo ${ganador === null ? "" : Number(id) === ganador ? "gana" : "pierde"}`}
            style={{ left: d.x, top: d.y, color: d.color }}
          />
        ))}
        <div className="msg">{mensaje}</div>
      </div>
      {ganador !== null ? (
        <div className="columna centro">
          <b>{t.whoStarts.whoseFinger}</b>
          <div className="chips" style={{ justifyContent: "center" }}>
            {personas.map((p, i) => (
              <button type="button" key={p.id} className="chip" onClick={() => alElegir(i)}>
                <span className="punto" style={{ background: p.color }} />
                {p.nombre}
              </button>
            ))}
          </div>
          <button type="button" className="enlace" onClick={reiniciar}>
            {t.whoStarts.again}
          </button>
        </div>
      ) : (
        <p className="dim centro" style={{ margin: 0, textAlign: "center", fontSize: 14 }}>
          {t.whoStarts.fingersHint}
        </p>
      )}
    </>
  );
}

/* ---------- Spinner ---------- */

function Ruleta({ personas, alElegir }: Props) {
  const t = useT();
  const [giro, setGiro] = useState(0);
  const [elegido, setElegido] = useState<number | null>(null);
  const [girando, setGirando] = useState(false);
  const seg = 360 / personas.length;
  const fondo = `conic-gradient(${personas.map((p, i) => `${p.color} ${i * seg}deg ${(i + 1) * seg}deg`).join(",")})`;

  const girar = () => {
    if (girando) return;
    const i = Math.floor(Math.random() * personas.length);
    const variacion = (Math.random() - 0.5) * seg * 0.7;
    const actual = giro - (giro % 360);
    setGiro(actual + 360 * 6 - (i + 0.5) * seg + variacion);
    setGirando(true);
    setElegido(null);
    // Ticks that slow down as the wheel stops
    let t = 0;
    let paso = 40;
    while (t < 3800) {
      window.setTimeout(() => efectos.tic(), t);
      t += paso;
      paso *= 1.09;
    }
    window.setTimeout(() => {
      setGirando(false);
      setElegido(i);
      efectos.ganador();
    }, 4200);
  };

  useAgitar(leerAjustes().agitar && !girando && elegido === null, () => {}, girar);

  return (
    <>
      <span className="grow" />
      <div className="ruleta-caja">
        <div className="ruleta-aguja" />
        <div
          className="ruleta"
          style={{
            background: fondo,
            transform: `rotate(${giro}deg)`,
            transition: girando ? "transform 4.2s cubic-bezier(.12,.8,.2,1)" : "none",
          }}
        />
        <div className="ruleta-centro">{elegido !== null ? personas[elegido].nombre : "?"}</div>
      </div>
      <div className="chips" style={{ justifyContent: "center" }}>
        {personas.map((p) => (
          <span key={p.id} className="chip" style={{ background: p.color, color: "#14182a", cursor: "default" }}>
            {p.nombre}
          </span>
        ))}
      </div>
      <span className="grow" />
      {elegido !== null ? (
        <div className="columna">
          <button type="button" className="btn pri" onClick={() => alElegir(elegido)}>
            {t.whoStarts.startsName(personas[elegido].nombre)}
          </button>
          <button type="button" className="btn borde" onClick={girar}>
            {t.whoStarts.spinAgain}
          </button>
        </div>
      ) : (
        <button type="button" className="btn pri" onClick={girar} disabled={girando}>
          {girando ? t.whoStarts.spinning : t.whoStarts.spin}
        </button>
      )}
    </>
  );
}

/* ---------- Dice duel ---------- */

function Duelo({ personas, alElegir }: Props) {
  const t = useT();
  const [candidatos, setCandidatos] = useState<number[]>(personas.map((_, i) => i));
  const [tiradas, setTiradas] = useState<Record<number, number>>({});
  const [rodando, setRodando] = useState(false);
  const [empate, setEmpate] = useState<string | null>(null);
  const pendientes = candidatos.filter((i) => tiradas[i] === undefined);
  const turno = pendientes[0];
  const terminado = pendientes.length === 0;
  const max = Math.max(...candidatos.map((i) => tiradas[i] ?? 0));
  const ganadores = terminado ? candidatos.filter((i) => tiradas[i] === max) : [];

  const lanzar = () => {
    if (rodando || turno === undefined) return;
    setRodando(true);
    efectos.caen(1);
    window.setTimeout(() => {
      setTiradas((t) => ({ ...t, [turno]: 1 + Math.floor(Math.random() * 6) }));
      setRodando(false);
    }, 600);
  };

  const desempatar = () => {
    setEmpate(t.join(ganadores.map((i) => personas[i].nombre)));
    setCandidatos(ganadores);
    setTiradas({});
  };

  useAgitar(leerAjustes().agitar && !rodando && !terminado, () => {}, lanzar);

  return (
    <>
      <h1 className="titulo">{t.whoStarts.duelTitle}</h1>
      <p className="dim" style={{ margin: 0 }}>
        {t.whoStarts.duelIntro}
      </p>
      <div className="columna duelo">
        {personas.map((p, i) => {
          const fuera = !candidatos.includes(i);
          return (
            <div
              key={p.id}
              className="persona"
              style={{ opacity: fuera ? 0.35 : 1, outline: i === turno ? `2px solid ${p.color}` : "none" }}
            >
              <span className="punto" style={{ background: p.color }} />
              <span className="nombre">{p.nombre}</span>
              {i === turno && rodando ? (
                <Dado cara={1 + Math.floor(Math.random() * 6)} tamano={34} estado="rodando" />
              ) : tiradas[i] !== undefined ? (
                <Dado cara={tiradas[i]} tamano={34} estado={ganadores.includes(i) ? "suma" : "normal"} />
              ) : (
                <span className="dim" style={{ fontSize: 13 }}>
                  {fuera ? "" : "…"}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {empate && !terminado && (
        <div className="aviso centro" style={{ textAlign: "center" }}>
          <b style={{ color: "var(--gold)" }}>{t.whoStarts.tieBetween(empate)}</b>
          <div className="dim">{t.whoStarts.tieRoll}</div>
        </div>
      )}
      <span className="grow" />
      {!terminado && (
        <button type="button" className="btn pri" onClick={lanzar} disabled={rodando}>
          {t.whoStarts.rollYourDie(personas[turno].nombre, leerAjustes().agitar)}
        </button>
      )}
      {terminado && ganadores.length > 1 && (
        <button type="button" className="btn pri" onClick={desempatar}>
          {t.whoStarts.tieBreak(t.join(ganadores.map((i) => personas[i].nombre)))}
        </button>
      )}
      {terminado && ganadores.length === 1 && (
        <button type="button" className="btn pri" onClick={() => alElegir(ganadores[0])}>
          {t.whoStarts.startsName(personas[ganadores[0]].nombre)}
        </button>
      )}
    </>
  );
}

/* ---------- Random ---------- */

function Azar({ personas, alElegir }: Props) {
  const [elegido] = useState(() => Math.floor(Math.random() * personas.length));
  useEffect(() => efectos.ganador(), []);
  return <Resultado persona={personas[elegido]} continuar={() => alElegir(elegido)} />;
}
