import { useEffect, useState } from "react";
import { CATALOGO } from "../juegos/catalogo";
import { useT } from "../i18n";
import { Dado } from "../ui/Dado";
import { Ajustes } from "./Ajustes";
import { Historial } from "./Historial";
import { Jugadores } from "./Jugadores";

type Pestana = "juegos" | "historial" | "jugadores" | "ajustes";

const PESTANAS: { id: Pestana; icono: string }[] = [
  { id: "juegos", icono: "⚄" },
  { id: "historial", icono: "☰" },
  { id: "jugadores", icono: "☺" },
  { id: "ajustes", icono: "⚙" },
];

interface EventoInstalar extends Event {
  prompt: () => Promise<void>;
}

export function Central({ abrir }: { abrir: (id: string) => void }) {
  const [pestana, setPestana] = useState<Pestana>("juegos");
  const t = useT();
  const nombres: Record<Pestana, string> = { juegos: t.nav.games, historial: t.nav.history, jugadores: t.nav.players, ajustes: t.nav.settings };
  return (
    <>
      <div className="pantalla con-nav">
        {pestana === "juegos" && <Juegos abrir={abrir} />}
        {pestana === "historial" && <Historial />}
        {pestana === "jugadores" && <Jugadores />}
        {pestana === "ajustes" && <Ajustes />}
      </div>
      <nav className="nav" aria-label={t.nav.sections}>
        <div>
          {PESTANAS.map((p) => (
            <button key={p.id} className={pestana === p.id ? "on" : ""} onClick={() => setPestana(p.id)} aria-current={pestana === p.id}>
              <span className="ic" aria-hidden="true">{p.icono}</span>
              {nombres[p.id]}
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}

function Juegos({ abrir }: { abrir: (id: string) => void }) {
  const t = useT();
  const [instalar, setInstalar] = useState<EventoInstalar | null>(null);
  useEffect(() => {
    const alOfrecer = (e: Event) => {
      e.preventDefault();
      setInstalar(e as EventoInstalar);
    };
    window.addEventListener("beforeinstallprompt", alOfrecer);
    return () => window.removeEventListener("beforeinstallprompt", alOfrecer);
  }, []);

  const pendientes = CATALOGO.map((j) => ({ j, resumen: j.resumenPartida() })).filter((x) => x.resumen);

  return (
    <>
      <div className="fila" style={{ gap: 10 }}>
        <Dado cara={5} tamano={30} />
        <h1 className="titulo">{t.appName}</h1>
      </div>

      {pendientes.map(({ j, resumen }) => (
        <button key={j.id} className="tarjeta oro btn" style={{ justifyContent: "space-between", textAlign: "left", fontWeight: 500 }} onClick={() => abrir(j.id)}>
          <span className="columna" style={{ gap: 2 }}>
            <span className="lbl" style={{ color: "var(--gold)" }}>{t.home.continue}</span>
            <span>{j.nombre(t)} · {resumen}</span>
          </span>
          <b style={{ color: "var(--gold)" }}>{t.home.resume}</b>
        </button>
      ))}

      <span className="lbl">{t.home.games}</span>
      <div className="juegos">
        {CATALOGO.map((j) => (
          <button key={j.id} className="tarjeta-juego" onClick={() => abrir(j.id)}>
            <span className="fila" style={{ gap: 4 }}>
              {j.caras.map((c, i) => <Dado key={i} cara={c} tamano={26} />)}
            </span>
            <span className="grow" />
            <b>{j.nombre(t)}</b>
            <span className="dim" style={{ fontSize: 13 }}>{j.descripcion(t)}</span>
          </button>
        ))}
        {Array.from({ length: Math.max(1, 3 - (CATALOGO.length - 1)) }, (_, i) => (
          <div key={i} className="tarjeta-juego pronto" aria-hidden="true">
            <span className="grow" />
            <b>{t.common.nextGame}</b>
            <span style={{ fontSize: 13 }}>{t.common.soon}</span>
          </div>
        ))}
      </div>

      {instalar && (
        <div className="tarjeta columna">
          <b>{t.home.installTitle}</b>
          <span className="dim" style={{ fontSize: 14 }}>{t.home.installBody}</span>
          <button className="btn sec chico" onClick={() => { void instalar.prompt(); setInstalar(null); }}>{t.home.install}</button>
        </div>
      )}
    </>
  );
}
