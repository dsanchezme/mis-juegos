import { useState } from "react";
import { createPerson, hasTouch, type StarterMode, usePlayers, useSettings } from "../../../engine/hub";
import type { Person } from "../../../engine/types";
import { STARTER_MODES, starterName } from "../../../hub/Settings";
import { fmt, useT } from "../../../i18n";
import type { AmbiciosoConfig, TargetMode } from "../rules/ambicioso";

const TARGETS = [3000, 5000, 10000];

export interface Setup {
  people: Person[];
  config: AmbiciosoConfig;
  starterMode: StarterMode;
}

interface Props {
  previous?: Setup;
  ready: (p: Setup) => void;
  exit: () => void;
}

export function NewGame({ previous, ready, exit }: Props) {
  const t = useT();
  const a = t.ambicioso;
  const [roster, setRoster] = usePlayers();
  const [settings] = useSettings();
  const [selectedIds, setSelectedIds] = useState<string[]>(() => previous?.people.map((p) => p.id) ?? []);
  const [name, setName] = useState("");
  const [target, setTarget] = useState(previous?.config.target ?? 5000);
  const [customTarget, setCustomTarget] = useState(!TARGETS.includes(previous?.config.target ?? 5000));
  const [targetMode, setTargetMode] = useState<TargetMode>(previous?.config.targetMode ?? "reachOrPass");
  const [starterMode, setStarterMode] = useState<StarterMode>(previous?.starterMode ?? settings.starterMode);

  const byId = new Map(roster.map((p) => [p.id, p]));
  const selected = selectedIds.map((id) => byId.get(id)).filter((p): p is Person => !!p);
  const available = roster.filter((p) => !selectedIds.includes(p.id));

  const toggle = (id: string) => setSelectedIds((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]));
  const move = (i: number, d: -1 | 1) =>
    setSelectedIds((e) => {
      const c = [...e];
      [c[i], c[i + d]] = [c[i + d], c[i]];
      return c;
    });
  const add = () => {
    const n = name.trim();
    if (!n) return;
    const existing = roster.find((p) => p.name.toLowerCase() === n.toLowerCase());
    if (existing) {
      if (!selectedIds.includes(existing.id)) toggle(existing.id);
    } else {
      const person = createPerson(n, roster);
      setRoster((l) => [...l, person]);
      setSelectedIds((e) => [...e, person.id]);
    }
    setName("");
  };

  const targetValid = Number.isFinite(target) && target >= 50 && target % 50 === 0;
  const canStart = selected.length >= 2 && targetValid;
  const modes: StarterMode[] = hasTouch() ? STARTER_MODES : STARTER_MODES.filter((m) => m !== "fingers");

  return (
    <div className="screen">
      <div className="bar">
        <button type="button" className="link" onClick={exit}>
          {t.common.backToGames}
        </button>
        <span>{a.name}</span>
        <span style={{ width: 50 }} />
      </div>
      <h1 className="title">{a.newGame}</h1>

      <span className="lbl">{a.whoPlays}</span>
      {selected.length > 0 && (
        <div className="column" style={{ gap: 6 }}>
          {selected.map((p, i) => (
            <div key={p.id} className="person">
              <span className="dot" style={{ background: p.color }} />
              <span className="name">{p.name}</span>
              <button
                type="button"
                className="icon-button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label={a.moveUp(p.name)}
              >
                ↑
              </button>
              <button
                type="button"
                className="icon-button"
                onClick={() => move(i, 1)}
                disabled={i === selected.length - 1}
                aria-label={a.moveDown(p.name)}
              >
                ↓
              </button>
              <button
                type="button"
                className="icon-button"
                onClick={() => toggle(p.id)}
                aria-label={t.players.removeLabel(p.name)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      {available.length > 0 && (
        <div className="chips">
          {available.map((p) => (
            <button type="button" key={p.id} className="chip" onClick={() => toggle(p.id)}>
              <span className="dot" style={{ background: p.color }} />+ {p.name}
            </button>
          ))}
        </div>
      )}
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          id="np-name"
          className="field"
          placeholder={a.addNew}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
        />
        <button className="btn sec small" type="submit" disabled={!name.trim()}>
          {t.common.add}
        </button>
      </form>
      {selected.length === 1 && (
        <span className="dim" style={{ fontSize: 14 }}>
          {a.oneMore}
        </span>
      )}

      <span className="lbl">{a.target}</span>
      <div className="chips">
        {TARGETS.map((m) => (
          <button
            type="button"
            key={m}
            className={`chip mono ${!customTarget && target === m ? "on" : ""}`}
            onClick={() => {
              setTarget(m);
              setCustomTarget(false);
            }}
          >
            {fmt(m)}
          </button>
        ))}
        <button type="button" className={`chip ${customTarget ? "on" : ""}`} onClick={() => setCustomTarget(true)}>
          {a.other}
        </button>
      </div>
      {customTarget && (
        <div className="column" style={{ gap: 4 }}>
          <input
            id="np-target"
            className="field mono"
            type="number"
            inputMode="numeric"
            step={50}
            min={50}
            value={Number.isFinite(target) ? target : ""}
            onChange={(e) => setTarget(parseInt(e.target.value, 10))}
          />
          {!targetValid && <span style={{ color: "var(--bust)", fontSize: 13 }}>{a.invalidTarget}</span>}
        </div>
      )}
      <div className="chips">
        <button
          type="button"
          className={`chip ${targetMode === "reachOrPass" ? "on" : ""}`}
          onClick={() => setTargetMode("reachOrPass")}
        >
          {a.reachOrPass}
        </button>
        <button
          type="button"
          className={`chip ${targetMode === "exact" ? "on" : ""}`}
          onClick={() => setTargetMode("exact")}
        >
          {a.exact}
        </button>
      </div>
      <span className="dim" style={{ fontSize: 13 }}>
        {targetMode === "exact" ? a.exactHint : a.reachHint} {a.roundEndsHint}
      </span>

      <span className="lbl">{a.whoStarts}</span>
      <div className="chips">
        {modes.map((m) => (
          <button
            type="button"
            key={m}
            className={`chip ${starterMode === m ? "on" : ""}`}
            onClick={() => setStarterMode(m)}
          >
            {starterName(t, m)}
          </button>
        ))}
      </div>

      <span className="grow" />
      <button
        type="button"
        className="btn pri"
        disabled={!canStart}
        onClick={() => ready({ people: selected, config: { target, targetMode }, starterMode })}
      >
        {a.start}
      </button>
    </div>
  );
}
