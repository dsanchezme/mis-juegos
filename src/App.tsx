import { useEffect, useState } from "react";
import { Central } from "./central/Central";
import { CATALOGO } from "./juegos/catalogo";
import { desbloquearAudio } from "./ui/efectos";

const juegoDesdeHash = () => {
  const id = location.hash.replace(/^#\/?/, "");
  return CATALOGO.some((j) => j.id === id) ? id : null;
};

export function App() {
  const [juego, setJuego] = useState<string | null>(juegoDesdeHash);

  useEffect(() => {
    const alCambiar = () => setJuego(juegoDesdeHash());
    window.addEventListener("hashchange", alCambiar);
    const desbloquear = () => desbloquearAudio();
    window.addEventListener("pointerdown", desbloquear, { once: true });
    return () => {
      window.removeEventListener("hashchange", alCambiar);
      window.removeEventListener("pointerdown", desbloquear);
    };
  }, []);

  const abrir = (id: string) => {
    location.hash = id;
  };
  const salir = () => {
    history.replaceState(null, "", location.pathname + location.search);
    setJuego(null);
  };

  const entrada = CATALOGO.find((j) => j.id === juego);
  if (entrada) return <entrada.Componente salir={salir} />;
  return <Central abrir={abrir} />;
}
