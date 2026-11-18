import { useState } from "react";
import { COLORES, crearPersona, useHistorial, useJugadores } from "../motor/central";

export function Jugadores() {
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
    setPersonas((ps) =>
      ps.map((p) => (p.id === id ? { ...p, color: COLORES[(COLORES.indexOf(p.color) + 1) % COLORES.length] } : p)),
    );
  const renombrar = (id: string, n: string) =>
    setPersonas((ps) => ps.map((p) => (p.id === id ? { ...p, nombre: n } : p)));

  return (
    <>
      <h1 className="titulo">Jugadores</h1>
      <p className="dim" style={{ margin: 0 }}>
        Las personas con las que has jugado, para no escribir el nombre cada vez. Al crear una partida eliges quién
        juega hoy.
      </p>
      <div className="columna">
        {personas.map((p) => (
          <div key={p.id} className="persona">
            <button
              type="button"
              className="muestra"
              style={{ background: p.color }}
              onClick={() => cambiarColor(p.id)}
              aria-label={`Cambiar color de ${p.nombre}`}
            />
            <input
              className="nombre campo"
              style={{ border: "none", padding: "4px 0", background: "transparent" }}
              value={p.nombre}
              onChange={(e) => renombrar(p.id, e.target.value)}
              onBlur={(e) => !e.target.value.trim() && renombrar(p.id, "Sin nombre")}
              aria-label="Nombre"
              id={`nombre-${p.id}`}
            />
            <span className="mono dim" style={{ fontSize: 12 }}>
              {partidas(p.id)} {partidas(p.id) === 1 ? "partida" : "partidas"}
            </span>
            {borrando === p.id ? (
              <button
                type="button"
                className="btn peligro chico"
                onClick={() => {
                  setPersonas((ps) => ps.filter((x) => x.id !== p.id));
                  setBorrando(null);
                }}
              >
                Quitar
              </button>
            ) : (
              <button
                type="button"
                className="boton-icono"
                onClick={() => setBorrando(p.id)}
                aria-label={`Quitar a ${p.nombre}`}
              >
                ✕
              </button>
            )}
          </div>
        ))}
        {personas.length === 0 && (
          <div className="tarjeta dim">Todavía no hay jugadores. Agrega el primero aquí o al crear una partida.</div>
        )}
      </div>
      <form
        className="fila"
        onSubmit={(e) => {
          e.preventDefault();
          agregar();
        }}
      >
        <input
          id="nuevo-jugador"
          className="campo"
          placeholder="Nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          maxLength={20}
        />
        <button className="btn sec chico" type="submit" disabled={!nombre.trim()}>
          Agregar
        </button>
      </form>
    </>
  );
}
