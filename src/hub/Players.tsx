import { useState } from "react";
import { COLORS, createPerson, useHistory, usePlayers } from "../engine/hub";
import { useT } from "../i18n";

export function Players() {
  const t = useT();
  const [people, setPeople] = usePlayers();
  const [history] = useHistory();
  const [name, setName] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);

  const gamesPlayed = (id: string) => history.filter((h) => h.players.some((j) => j.id === id)).length;
  const add = () => {
    if (!name.trim()) return;
    setPeople((p) => [...p, createPerson(name, p)]);
    setName("");
  };
  const cycleColor = (id: string) =>
    setPeople((ps) =>
      ps.map((p) => (p.id === id ? { ...p, color: COLORS[(COLORS.indexOf(p.color) + 1) % COLORS.length] } : p)),
    );
  const rename = (id: string, n: string) => setPeople((ps) => ps.map((p) => (p.id === id ? { ...p, name: n } : p)));

  return (
    <>
      <h1 className="title">{t.players.title}</h1>
      <p className="dim" style={{ margin: 0 }}>
        {t.players.intro}
      </p>
      <div className="column">
        {people.map((p) => (
          <div key={p.id} className="person">
            <button
              type="button"
              className="swatch"
              style={{ background: p.color }}
              onClick={() => cycleColor(p.id)}
              aria-label={t.players.changeColor(p.name)}
            />
            <input
              className="name field"
              style={{ border: "none", padding: "4px 0", background: "transparent" }}
              value={p.name}
              onChange={(e) => rename(p.id, e.target.value)}
              onBlur={(e) => !e.target.value.trim() && rename(p.id, t.players.unnamed)}
              aria-label={t.common.name}
              id={`name-${p.id}`}
            />
            <span className="mono dim" style={{ fontSize: 12 }}>
              {t.players.games(gamesPlayed(p.id))}
            </span>
            {removingId === p.id ? (
              <button
                type="button"
                className="btn danger small"
                onClick={() => {
                  setPeople((ps) => ps.filter((x) => x.id !== p.id));
                  setRemovingId(null);
                }}
              >
                {t.common.remove}
              </button>
            ) : (
              <button
                type="button"
                className="icon-button"
                onClick={() => setRemovingId(p.id)}
                aria-label={t.players.removeLabel(p.name)}
              >
                ✕
              </button>
            )}
          </div>
        ))}
        {people.length === 0 && <div className="card dim">{t.players.empty}</div>}
      </div>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          id="new-player"
          className="field"
          placeholder={t.common.name}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
        />
        <button className="btn sec small" type="submit" disabled={!name.trim()}>
          {t.common.add}
        </button>
      </form>
    </>
  );
}
