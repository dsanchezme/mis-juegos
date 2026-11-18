import { useEffect, useState } from "react";
import { CATALOGO } from "../juegos/catalogo";
import { Dado } from "../ui/Dado";
import { Ajustes } from "./Ajustes";
import { Historial } from "./Historial";
import { Jugadores } from "./Jugadores";

type Pestana = "juegos" | "historial" | "jugadores" | "ajustes";

const PESTANAS: { id: Pestana; nombre: string; icono: string }[] = [
  { id: "juegos", nombre: "Juegos", icono: "⚄" },
  { id: "historial", nombre: "Historial", icono: "☰" },
  { id: "jugadores", nombre: "Jugadores", icono: "☺" },
  { id: "ajustes", nombre: "Ajustes", icono: "⚙" },
];

interface EventoInstalar extends Event {
  prompt: () => Promise<void>;
}

export function Central({ abrir }: { abrir: (id: string) => void }) {
  const [pestana, setPestana] = useState<Pestana>("juegos");
  return (
    <>
      <div className="pantalla con-nav">
        {pestana === "juegos" && <Juegos abrir={abrir} />}
        {pestana === "historial" && <Historial />}
        {pestana === "jugadores" && <Jugadores />}
        {pestana === "ajustes" && <Ajustes />}
      </div>
      <nav className="nav" aria-label="Secciones">
        <div>
          {PESTANAS.map((p) => (
            <button
              type="button"
              key={p.id}
              className={pestana === p.id ? "on" : ""}
              onClick={() => setPestana(p.id)}
              aria-current={pestana === p.id}
            >
              <span className="ic" aria-hidden="true">
                {p.icono}
              </span>
              {p.nombre}
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}

function Juegos({ abrir }: { abrir: (id: string) => void }) {
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
        <h1 className="titulo">Mis juegos</h1>
      </div>

      {pendientes.map(({ j, resumen }) => (
        <button
          type="button"
          key={j.id}
          className="tarjeta oro btn"
          style={{ justifyContent: "space-between", textAlign: "left", fontWeight: 500 }}
          onClick={() => abrir(j.id)}
        >
          <span className="columna" style={{ gap: 2 }}>
            <span className="lbl" style={{ color: "var(--gold)" }}>
              Continuar
            </span>
            <span>
              {j.nombre} · {resumen}
            </span>
          </span>
          <b style={{ color: "var(--gold)" }}>Seguir ›</b>
        </button>
      ))}

      <span className="lbl">Juegos</span>
      <div className="juegos">
        {CATALOGO.map((j) => (
          <button type="button" key={j.id} className="tarjeta-juego" onClick={() => abrir(j.id)}>
            <span className="fila" style={{ gap: 4 }}>
              {j.caras.map((c, i) => (
                <Dado key={i} cara={c} tamano={26} />
              ))}
            </span>
            <span className="grow" />
            <b>{j.nombre}</b>
            <span className="dim" style={{ fontSize: 13 }}>
              {j.descripcion}
            </span>
          </button>
        ))}
        {Array.from({ length: Math.max(1, 3 - (CATALOGO.length - 1)) }, (_, i) => (
          <div key={i} className="tarjeta-juego pronto" aria-hidden="true">
            <span className="grow" />
            <b>Próximo juego</b>
            <span style={{ fontSize: 13 }}>Pronto</span>
          </div>
        ))}
      </div>

      {instalar && (
        <div className="tarjeta columna">
          <b>Instalar Mis juegos</b>
          <span className="dim" style={{ fontSize: 14 }}>
            Queda como app en tu teléfono y funciona sin internet.
          </span>
          <button
            type="button"
            className="btn sec chico"
            onClick={() => {
              void instalar.prompt();
              setInstalar(null);
            }}
          >
            Instalar
          </button>
        </div>
      )}
    </>
  );
}
