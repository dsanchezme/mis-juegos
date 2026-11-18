import { useState } from "react";
import { saveToHistory } from "../../../engine/hub";
import { newSeed } from "../../../engine/random";
import { newId, read, write } from "../../../engine/storage";
import type { Person } from "../../../engine/types";
import { currentTexts, fmt, useT } from "../../../i18n";
import { WhoGoesFirst } from "../../../ui/WhoGoesFirst";
import { type AmbiciosoState, newState } from "../rules/ambicioso";
import { GameScreen } from "./GameScreen";
import { NewGame, type Setup } from "./NewGame";

/** Storage key for the game in progress (one per game). */
const STORAGE_KEY = "game:ambicioso";

interface SavedGame {
  id: string;
  startedAt: string;
  setup: Setup;
  state: AmbiciosoState;
}

const inProgress = (r: SavedGame | null): r is SavedGame =>
  !!r && r.state.phase !== "winner" && r.state.phase !== "ended";

export function ambiciosoSummary(): string | null {
  const r = read<SavedGame | null>(STORAGE_KEY, null);
  if (!inProgress(r)) return null;
  return currentTexts().ambicioso.pendingSummary(r.state.players[r.state.turnIndex].name);
}

const toPerson = (p: Person): Person => ({ id: p.id, name: p.name, color: p.color });
const rotate = <T,>(list: T[], i: number) => [...list.slice(i), ...list.slice(0, i)];

function saveFinished(r: SavedGame) {
  const e = r.state;
  saveToHistory({
    id: r.id,
    game: "ambicioso",
    date: new Date().toISOString(),
    players: e.players.map((j) => ({ id: j.id, name: j.name, color: j.color, points: j.points })),
    winners: e.phase === "winner" ? e.winners : [],
    info: {
      target: e.config.target,
      exact: e.config.targetMode === "exact",
      rounds: e.round,
      complete: e.phase === "winner",
    },
  });
}

type Step = { t: "resume" } | { t: "setup" } | { t: "who"; prep: Setup } | { t: "game" };

export function AmbiciosoGame({ exit }: { exit: () => void }) {
  const [saved, setSaved] = useState<SavedGame | null>(() => read<SavedGame | null>(STORAGE_KEY, null));
  const [step, setStep] = useState<Step>(() => (inProgress(saved) ? { t: "resume" } : { t: "setup" }));

  const save = (r: SavedGame | null) => {
    write(STORAGE_KEY, r);
    setSaved(r);
  };

  const startGame = (prep: Setup, first: number) => {
    const people = rotate(prep.people.map(toPerson), first);
    save({
      id: newId(),
      startedAt: new Date().toISOString(),
      setup: prep,
      state: newState(people, prep.config, newSeed()),
    });
    setStep({ t: "game" });
  };

  const update = (state: AmbiciosoState) => {
    if (!saved) return;
    const updated = { ...saved, state };
    if (state.phase === "ended") {
      saveFinished(updated);
      save(null);
      exit();
      return;
    }
    if (state.phase === "winner") saveFinished(updated);
    save(updated);
  };

  const rematch = () => {
    if (!saved) return;
    const js = saved.state.players;
    // Whoever came last goes first; seating order is kept.
    const lowest = Math.min(...js.map((j) => j.points));
    const last = js.findIndex((j) => j.points === lowest);
    startGame({ ...saved.setup, people: js.map(toPerson) }, last);
  };

  if (step.t === "resume" && inProgress(saved)) {
    return (
      <Resume r={saved} resume={() => setStep({ t: "game" })} startNew={() => setStep({ t: "setup" })} exit={exit} />
    );
  }
  if (step.t === "who") {
    return (
      <WhoGoesFirst
        people={step.prep.people}
        mode={step.prep.starterMode}
        onPick={(i) => startGame(step.prep, i)}
        back={() => setStep({ t: "setup" })}
      />
    );
  }
  if (step.t === "game" && saved) {
    return (
      <GameScreen
        state={saved.state}
        update={update}
        exit={exit}
        rematch={rematch}
        onNewGame={() => setStep({ t: "setup" })}
      />
    );
  }
  return (
    <NewGame
      previous={saved?.setup}
      exit={exit}
      ready={(prep) => {
        if (inProgress(saved)) save(null); // discard the unfinished game
        if (prep.starterMode === "list") startGame(prep, 0);
        else setStep({ t: "who", prep });
      }}
    />
  );
}

function Resume({
  r,
  resume,
  startNew,
  exit,
}: {
  r: SavedGame;
  resume: () => void;
  startNew: () => void;
  exit: () => void;
}) {
  const t = useT();
  const a = t.ambicioso;
  const [confirming, setConfirming] = useState(false);
  const e = r.state;
  const j = e.players[e.turnIndex];
  const elapsed = Math.round((Date.now() - new Date(r.startedAt).getTime()) / 60000);
  const ago =
    elapsed < 60
      ? a.minutesAgo(Math.max(1, elapsed))
      : elapsed < 1440
        ? a.hoursAgo(Math.round(elapsed / 60))
        : a.daysAgo(Math.round(elapsed / 1440));
  return (
    <div className="screen">
      <div className="bar">
        <button type="button" className="link" onClick={exit}>
          {t.common.backToGames}
        </button>
      </div>
      <h1 className="title">{a.resumeTitle}</h1>
      <div className="card column">
        <span className="lbl">{a.startedAgo(ago)}</span>
        {[...e.players]
          .sort((a, b) => b.points - a.points)
          .map((x) => (
            <div key={x.id} className="row">
              <span className="dot" style={{ background: x.color }} />
              <span className="grow">{x.name}</span>
              <b className="mono">{fmt(x.points)}</b>
            </div>
          ))}
        <span className="dim" style={{ fontSize: 13 }}>
          {a.whoseTurn(j.name)}
          {e.phase === "rolled" ? a.turnSoFar(fmt(e.turnTotal)) : ""}
          {e.phase === "busted" ? a.justLost : ""}
        </span>
      </div>
      <span className="grow" />
      <div className="column">
        <button type="button" className="btn pri" onClick={resume}>
          {a.resume}
        </button>
        {confirming ? (
          <div className="card column">
            <b>{a.discardConfirm}</b>
            <div className="row">
              <button type="button" className="btn outlined small grow" onClick={() => setConfirming(false)}>
                {t.common.cancel}
              </button>
              <button type="button" className="btn danger small grow" onClick={startNew}>
                {a.discardYes}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn outlined" onClick={() => setConfirming(true)}>
            {a.newInstead}
          </button>
        )}
      </div>
    </div>
  );
}
