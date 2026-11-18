import { useState } from "react";
import { useT } from "../i18n";
import { COLORES, crearPersona, useHistorial, useJugadores } from "../motor/central";

export function Jugadores() {
  const t = useT();
  const [personas, setPersonas] = useJugadores();
  const [historial] = useHistorial();
  const [nombre, setNombre] = useState("");
  const [borrando, setBorrando] = useState<string | null>(null);

  const partidas = (id: string) => historial.filter((h) => h.jugadores.some((j) => j.id === id)).length;
  const agregar = () => {
    if (!nombre.trim()) return;
    setPersonas((p) => [...p, crearPersona(nombre, p)]);
    setNombre("");
  };
  const cambiarColor = (id: string) =>
    setPersonas((ps) => ps.map((p) => (p.id === id ? { ...p, color: COLORES[(COLORES.indexOf(p.color) + 1) % COLORES.length] } : p)));
  const renombrar = (id: string, n: string) => setPersonas((ps) => ps.map((p) => (p.id === id ? { ...p, nombre: n } : p)));

  return (
    <>
      <h1 className="titulo">{t.players.title}</h1>
      <p className="dim" style={{ margin: 0 }}>
        {t.players.intro}
      </p>
      <div className="columna">
        {personas.map((p) => (
          <div key={p.id} className="persona">
            <button className="muestra" style={{ background: p.color }} onClick={() => cambiarColor(p.id)} aria-label={t.players.changeColor(p.nombre)} />
            <input
              className="nombre campo"
              style={{ border: "none", padding: "4px 0", background: "transparent" }}
              value={p.nombre}
              onChange={(e) => renombrar(p.id, e.target.value)}
              onBlur={(e) => !e.target.value.trim() && renombrar(p.id, t.players.unnamed)}
              aria-label={t.common.name}
              id={`nombre-${p.id}`}
            />
            <span className="mono dim" style={{ fontSize: 12 }}>{t.players.games(partidas(p.id))}</span>
            {borrando === p.id ? (
              <button className="btn peligro chico" onClick={() => { setPersonas((ps) => ps.filter((x) => x.id !== p.id)); setBorrando(null); }}>{t.common.remove}</button>
            ) : (
              <button className="boton-icono" onClick={() => setBorrando(p.id)} aria-label={t.players.removeLabel(p.nombre)}>✕</button>
            )}
          </div>
        ))}
        {personas.length === 0 && <div className="tarjeta dim">{t.players.empty}</div>}
      </div>
      <form className="fila" onSubmit={(e) => { e.preventDefault(); agregar(); }}>
        <input id="nuevo-jugador" className="campo" placeholder={t.common.name} value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={20} />
        <button className="btn sec chico" type="submit" disabled={!nombre.trim()}>{t.common.add}</button>
      </form>
    </>
  );
}
