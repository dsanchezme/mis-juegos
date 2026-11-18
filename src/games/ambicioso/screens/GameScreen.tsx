import { useEffect, useRef, useState } from "react";
import { useSettings } from "../../../engine/hub";
import { EffectSettings } from "../../../hub/Settings";
import { fmt, useT } from "../../../i18n";
import type { Texts } from "../../../i18n/es";
import { Die } from "../../../ui/Die";
import { effects } from "../../../ui/effects";
import { shakeAvailable, useShake } from "../../../ui/shake";
import { type AmbiciosoState, apply, pointsToTarget, pointsToWin, type TurnEvent } from "../rules/ambicioso";

interface Props {
  state: AmbiciosoState;
  update: (e: AmbiciosoState) => void;
  exit: () => void;
  rematch: () => void;
  onNewGame: () => void;
}

type Overlay = null | "pause" | "scoreboard" | "rules";

const ROLL_DURATION = 700;

export function GameScreen({ state: e, update, exit, rematch, onNewGame }: Props) {
  const t = useT();
  const [settings] = useSettings();
  const [rolling, setRolling] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [ready, setReady] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const lastShakeSound = useRef(0);
  const prevFinalRound = useRef(e.finalRound);

  const shakeEnabled = settings.shake && shakeAvailable();

  // When the turn changes, go back to the hand-off screen.
  // biome-ignore lint/correctness/useExhaustiveDependencies: must re-run whenever the turn or round changes.
  useEffect(() => setReady(false), [e.turnIndex, e.round]);

  // Bell when the final round starts.
  useEffect(() => {
    if (e.finalRound && !prevFinalRound.current && e.phase === "handOff") effects.finalRound();
    prevFinalRound.current = e.finalRound;
  }, [e.finalRound, e.phase]);

  const roll = () => {
    if (rolling || (e.phase !== "rolled" && e.phase !== "handOff")) return;
    const updated = apply(e, { type: "ROLL" });
    update(updated); // saved before it is shown, so closing the app can't undo a bust
    setRolling(true);
    effects.shaking();
    window.setTimeout(() => {
      setRolling(false);
      const l = updated.lastRoll;
      if (!l) return;
      effects.land(l.faces.length);
      if (updated.phase === "busted") effects.bust();
      else if (l.hotDice) {
        effects.scoring(l.scoring.filter(Boolean).length);
        effects.hotDice();
      } else effects.scoring(l.scoring.filter(Boolean).length);
    }, ROLL_DURATION);
  };

  const bank = () => {
    effects.bank();
    update(apply(e, { type: "BANK" }));
  };

  const canShake =
    shakeEnabled && !rolling && overlay === null && (e.phase === "rolled" || (e.phase === "handOff" && ready));
  useShake(
    canShake,
    () => {
      setShaking(true);
      const now = performance.now();
      if (now - lastShakeSound.current > 140) {
        lastShakeSound.current = now;
        effects.shaking();
      }
    },
    () => {
      setShaking(false);
      roll();
    },
  );

  let content: React.ReactNode;
  if (e.phase === "winner") {
    content = <Winner e={e} rematch={rematch} exit={exit} onNewGame={onNewGame} />;
  } else if (rolling || shaking) {
    content = <Rolling e={e} shaking={shaking && !rolling} />;
  } else if (e.phase === "handOff" && !ready) {
    content = <HandOff e={e} ready={() => (shakeEnabled ? setReady(true) : roll())} shakeEnabled={shakeEnabled} />;
  } else if (e.phase === "handOff") {
    content = <ReadyToRoll e={e} roll={roll} />;
  } else if (e.phase === "rolled") {
    content = <Turn e={e} roll={roll} bank={bank} shakeEnabled={shakeEnabled} />;
  } else if (e.phase === "busted") {
    content = <Busted e={e} passTurn={() => update(apply(e, { type: "PASS_TURN" }))} />;
  }

  const bg = e.phase === "busted" && !rolling ? "bg-bust" : e.phase === "winner" ? "bg-winner" : "";

  return (
    <>
      <div className={`screen ${bg}`} style={{ maxWidth: "none" }}>
        <div className="column" style={{ maxWidth: 480, width: "100%", margin: "0 auto", flex: 1, gap: 14 }}>
          {e.phase !== "winner" && (
            <>
              <div className="bar">
                <span className="mono" style={{ fontSize: 12 }}>
                  {t.ambicioso.round(e.round)} ·{" "}
                  {t.ambicioso.targetLabel(e.config.targetMode === "exact", fmt(e.config.target))}
                </span>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setOverlay("pause")}
                  aria-label={t.common.pause}
                >
                  ⏸
                </button>
              </div>
              <ScoreStrip e={e} open={() => setOverlay("scoreboard")} />
            </>
          )}
          {content}
        </div>
      </div>
      {overlay === "pause" && (
        <PauseMenu
          e={e}
          close={() => setOverlay(null)}
          open={setOverlay}
          exit={exit}
          endGame={() => update(apply(e, { type: "END" }))}
        />
      )}
      {overlay === "scoreboard" && <Scoreboard e={e} close={() => setOverlay(null)} />}
      {overlay === "rules" && <Rules close={() => setOverlay("pause")} />}
    </>
  );
}

/* ---------- Pieces ---------- */

function ScoreStrip({ e, open }: { e: AmbiciosoState; open: () => void }) {
  const t = useT();
  return (
    <button type="button" className="strip" onClick={open} aria-label={t.ambicioso.showScores}>
      {e.players.map((j, i) => (
        <div key={j.id} className={i === e.turnIndex ? "now" : ""} style={{ ["--c" as string]: j.color }}>
          <span>{j.name}</span>
          <b>{fmt(j.points)}</b>
        </div>
      ))}
    </button>
  );
}

function CurrentPlayer({ e, extra }: { e: AmbiciosoState; extra?: React.ReactNode }) {
  const t = useT();
  const j = e.players[e.turnIndex];
  return (
    <div className="row">
      <span className="dot" style={{ background: j.color }} />
      <b>{t.ambicioso.turnOf(j.name)}</b>
      <span className="grow" />
      {extra}
    </div>
  );
}

function eventText(e: AmbiciosoState, ev: TurnEvent, t: Texts) {
  const name = e.players.find((x) => x.id === ev.playerId)?.name ?? "";
  if (ev.type === "banked") return t.ambicioso.logBanked(name, fmt(ev.points), fmt(ev.total));
  if (ev.type === "overshot") return t.ambicioso.logOvershot(name, fmt(ev.points));
  return t.ambicioso.logBust(name, ev.points ? fmt(ev.points) : null);
}

function FinalRoundNotice({ e }: { e: AmbiciosoState }) {
  const t = useT();
  if (!e.finalRound) return null;
  const who = e.players.find((j) => j.id === e.reachedBy);
  const remaining = e.players.slice(e.turnIndex).map((j) => j.name);
  return (
    <div className="notice column" style={{ gap: 2 }}>
      <span className="lbl">{t.ambicioso.lastRound}</span>
      <span>
        {t.ambicioso.lastRoundBody(who?.name ?? "", fmt(who?.points ?? 0), t.join(remaining), remaining.length > 1)}
      </span>
    </div>
  );
}

function HandOff({ e, ready, shakeEnabled }: { e: AmbiciosoState; ready: () => void; shakeEnabled: boolean }) {
  const t = useT();
  const a = t.ambicioso;
  const j = e.players[e.turnIndex];
  const last = e.history.at(-1);
  const detail = e.finalRound
    ? e.config.targetMode === "exact"
      ? a.hasNeedsExact(fmt(j.points), fmt(pointsToWin(e)))
      : a.hasNeedsLead(fmt(j.points), fmt(pointsToWin(e)))
    : a.hasMissing(fmt(j.points), fmt(pointsToTarget(e)));
  return (
    <>
      <FinalRoundNotice e={e} />
      <span className="grow" />
      <div className="handoff" style={{ ["--c" as string]: j.color }}>
        <span className="dot" style={{ background: j.color, width: 20, height: 20 }} />
        <span className="lbl">{a.passTo}</span>
        <h2>{j.name}</h2>
        <span className="dim">{detail}</span>
      </div>
      <span className="grow" />
      {last && (
        <div className="card log">
          <span>{a.lastTurn}</span>
          <span style={{ color: "var(--ink)" }}>{eventText(e, last, t)}</span>
        </div>
      )}
      <button type="button" className="btn pri" onClick={ready}>
        {shakeEnabled ? a.ready : a.readyRoll}
      </button>
    </>
  );
}

function ReadyToRoll({ e, roll }: { e: AmbiciosoState; roll: () => void }) {
  const t = useT();
  return (
    <>
      <CurrentPlayer e={e} extra={<span className="pill">{t.ambicioso.dice(4)}</span>} />
      <span className="grow" />
      <div className="column center" style={{ textAlign: "center" }}>
        <svg viewBox="0 0 70 110" width="70" height="110" aria-hidden="true" className="shake-icon">
          <rect x="15" y="10" width="40" height="80" rx="8" fill="none" stroke="#f6efe0" strokeWidth="4" />
          <path
            d="M6 35 q-6 15 0 30 M64 35 q6 15 0 30"
            stroke="#f4b942"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
        <h2 style={{ fontSize: 28 }}>{t.ambicioso.shakeToRoll}</h2>
        <span className="dim">{t.ambicioso.shakeHint}</span>
      </div>
      <span className="grow" />
      <button type="button" className="btn outlined" onClick={roll}>
        {t.ambicioso.tapToRoll}
      </button>
    </>
  );
}

function Rolling({ e, shaking }: { e: AmbiciosoState; shaking: boolean }) {
  // While rolling, the state already holds the result; random faces are shown until it lands.
  const t = useT();
  const n = shaking ? e.diceLeft : (e.lastRoll?.faces.length ?? e.diceLeft);
  const previous = e.lastRoll;
  const keptDice = shaking
    ? e.phase === "rolled" && previous && !previous.hotDice
      ? [...e.keptDice, ...previous.faces.filter((_, i) => previous.scoring[i])]
      : []
    : e.keptDice;
  const [faces, setFaces] = useState(() => Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 6)));
  useEffect(() => {
    const t = window.setInterval(
      () => setFaces(Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 6))),
      110,
    );
    return () => window.clearInterval(t);
  }, [n]);
  return (
    <>
      <CurrentPlayer
        e={e}
        extra={<span className="pill">{shaking ? t.ambicioso.shaking : t.ambicioso.rolling}</span>}
      />
      <span className="grow" />
      <div className="tray">
        <div className="kept-dice">
          {keptDice.map((c, i) => (
            <Die key={i} face={c} size={28} state="kept" />
          ))}
        </div>
        <div className="dice">
          {faces.map((c, i) => (
            <Die key={i} face={c} size={60} state="rolling" delay={i * -90} />
          ))}
        </div>
      </div>
      <div className="column center" style={{ textAlign: "center", gap: 2 }}>
        <span className="lbl">{t.ambicioso.turnTotal}</span>
        <span className="big">
          {fmt(shaking ? e.turnTotal : e.phase === "busted" ? e.lost : e.turnTotal - (e.lastRoll?.points ?? 0))}
        </span>
      </div>
      <span className="grow" />
    </>
  );
}

function Turn({
  e,
  roll,
  bank,
  shakeEnabled,
}: {
  e: AmbiciosoState;
  roll: () => void;
  bank: () => void;
  shakeEnabled: boolean;
}) {
  const t = useT();
  const a = t.ambicioso;
  const j = e.players[e.turnIndex];
  const l = e.lastRoll;
  if (!l) return null;
  const total = j.points + e.turnTotal;
  const onTarget = e.config.targetMode === "exact" && total === e.config.target;
  const reaches = e.config.targetMode === "reachOrPass" && total >= e.config.target && !e.finalRound;
  return (
    <>
      <CurrentPlayer e={e} extra={<span className="pill">{a.rollN(e.rollNumber)}</span>} />
      <FinalRoundNotice e={e} />
      <div className="tray">
        <div className="kept-dice">
          {e.keptDice.map((c, i) => (
            <Die key={i} face={c} size={28} state="kept" />
          ))}
        </div>
        <div className="dice" key={e.rollNumber}>
          {l.faces.map((c, i) => (
            <div key={i} className="die-slot">
              <Die face={c} size={60} state={l.scoring[i] ? "scoring" : "normal"} />
            </div>
          ))}
        </div>
        <span className="pill gold">
          +{fmt(l.points)} · {l.parts.map((p) => a.part(p, fmt)).join(" + ")}
          {l.hotDice && ` · ${a.hotDice}`}
        </span>
      </div>
      <div className="column center" style={{ textAlign: "center", gap: 2 }}>
        <span className="lbl">{t.ambicioso.turnTotal}</span>
        <span className="big" style={{ color: l.hotDice ? "var(--gold)" : undefined }}>
          {fmt(e.turnTotal)}
        </span>
        <span className="dim" style={{ fontSize: 14 }}>
          {l.hotDice ? a.hotDiceBody : ""}
          {a.ifYouBank(fmt(j.points), fmt(total))}
        </span>
        {onTarget && <span style={{ color: "var(--gold)", fontWeight: 700 }}>{a.exactHit}</span>}
        {reaches && <span style={{ color: "var(--gold)", fontWeight: 700 }}>{a.reachesTarget}</span>}
        {e.config.targetMode === "exact" && !onTarget && (
          <span className="dim" style={{ fontSize: 13 }}>
            {a.exactMissing(fmt(e.config.target - total))}
          </span>
        )}
      </div>
      <span className="grow" />
      <div className="column">
        <button type="button" className={`btn ${onTarget ? "sec" : "pri"}`} onClick={roll}>
          {a.keepRolling(e.diceLeft, shakeEnabled)}
        </button>
        <button type="button" className={`btn ${onTarget ? "pri" : "sec"}`} onClick={bank}>
          {a.bank(fmt(e.turnTotal))}
        </button>
      </div>
    </>
  );
}

function Busted({ e, passTurn }: { e: AmbiciosoState; passTurn: () => void }) {
  const t = useT();
  const a = t.ambicioso;
  const j = e.players[e.turnIndex];
  const l = e.lastRoll;
  if (!l) return null;
  const next = (e.turnIndex + 1) % e.players.length;
  const isLast = e.finalRound && next === 0;
  const overshot = e.lossReason === "overshot";
  return (
    <>
      <CurrentPlayer e={e} />
      <span className="grow" />
      <div className="tray" style={{ background: "transparent", minHeight: 0 }}>
        <div className="dice">
          {l.faces.map((c, i) => (
            <Die key={i} face={c} size={56} state={l.scoring[i] ? "scoring" : "dead"} />
          ))}
        </div>
      </div>
      {!overshot && (
        <div className="pot center" style={{ textAlign: "center" }} aria-hidden="true">
          🍲
        </div>
      )}
      <h1 style={{ textAlign: "center", fontSize: 44, color: "var(--bust)" }}>{overshot ? a.overshot : a.bust}</h1>
      {e.lost > 0 && (
        <div className="struck" style={{ textAlign: "center" }}>
          {fmt(e.lost)}
        </div>
      )}
      <p className="dim" style={{ textAlign: "center", margin: 0 }}>
        {overshot
          ? a.overshotBody(fmt(j.points), fmt(e.lost), fmt(j.points + e.lost + l.points), j.name)
          : a.bustBody(j.name, fmt(j.points))}
      </p>
      <span className="grow" />
      <button type="button" className="btn danger" onClick={passTurn}>
        {isLast ? a.seeWinner : a.passTurn(e.players[next].name)}
      </button>
    </>
  );
}

function Winner({
  e,
  rematch,
  exit,
  onNewGame,
}: {
  e: AmbiciosoState;
  rematch: () => void;
  exit: () => void;
  onNewGame: () => void;
}) {
  const t = useT();
  const a = t.ambicioso;
  useEffect(() => effects.winner(), []);
  const winners = e.players.filter((g) => e.winners.includes(g.id));
  const rest = [...e.players].filter((j) => !e.winners.includes(j.id)).sort((a, b) => b.points - a.points);
  const g = winners[0];
  return (
    <>
      <div className="confetti" />
      <span className="grow" />
      <div className="column center" style={{ textAlign: "center", gap: 6, position: "relative" }}>
        <span className="lbl">{a.endOfRound(e.round)}</span>
        <h1 style={{ fontSize: winners.length > 1 ? 40 : 50, color: g.color }}>
          {winners.length === 1 ? a.wins(g.name) : a.tieWin(t.join(winners.map((x) => x.name)))}
        </h1>
        <span className="big" style={{ fontSize: 44 }}>
          {fmt(g.points)}
        </span>
        {winners.length === 1 && <span className="dim">{a.winnerStats(g.turns, fmt(g.bestTurn))}</span>}
      </div>
      <div className="ranking" style={{ position: "relative" }}>
        {rest.map((j, i) => (
          <div key={j.id} className="r">
            <b>{winners.length + 1 + i}</b>
            <span className="dot" style={{ background: j.color }} />
            <span>{j.name}</span>
            <b className="mono">{fmt(j.points)}</b>
          </div>
        ))}
      </div>
      <span className="grow" />
      <div className="column">
        <button type="button" className="btn pri" onClick={rematch}>
          {a.rematch}
        </button>
        <button type="button" className="btn outlined" onClick={onNewGame}>
          {a.changeSetup}
        </button>
        <button type="button" className="btn outlined" onClick={exit}>
          {a.backHome}
        </button>
      </div>
    </>
  );
}

/* ---------- Overlays ---------- */

function PauseMenu({
  e,
  close,
  open,
  exit,
  endGame,
}: {
  e: AmbiciosoState;
  close: () => void;
  open: (c: Overlay) => void;
  exit: () => void;
  endGame: () => void;
}) {
  const t = useT();
  const a = t.ambicioso;
  const [confirming, setConfirming] = useState(false);
  const [effectsOpen, setEffectsOpen] = useState(false);
  const j = e.players[e.turnIndex];
  return (
    <div className="overlay" role="dialog" aria-label={a.paused}>
      <div className="screen">
        <div className="bar">
          <span className="mono" style={{ fontSize: 12 }}>
            {a.round(e.round)} · {a.targetLabel(e.config.targetMode === "exact", fmt(e.config.target))}
          </span>
        </div>
        <h1 className="title">{a.paused}</h1>
        <div className="card column" style={{ gap: 2 }}>
          <span className="lbl">{a.pausedTurn(j.name)}</span>
          <span>{e.phase === "rolled" ? a.pausedProgress(fmt(e.turnTotal), a.dice(e.diceLeft)) : a.notRolledYet}</span>
        </div>
        <div className="column">
          <button type="button" className="btn pri" onClick={close}>
            {a.keepPlaying}
          </button>
          <button type="button" className="btn sec" onClick={() => open("scoreboard")}>
            {a.showScores}
          </button>
          <button type="button" className="btn sec" onClick={() => open("rules")}>
            {a.rules}
          </button>
          <button
            type="button"
            className="btn sec"
            onClick={() => setEffectsOpen((v) => !v)}
            aria-expanded={effectsOpen}
          >
            {a.soundVibration}
          </button>
          {effectsOpen && <EffectSettings />}
          <button type="button" className="btn outlined" onClick={exit}>
            {a.exitSaved}
          </button>
        </div>
        <span className="grow" />
        {confirming ? (
          <div className="card column">
            <b>{a.endConfirm}</b>
            <span className="dim" style={{ fontSize: 14 }}>
              {a.endDetail}
            </span>
            <div className="row">
              <button type="button" className="btn outlined small grow" onClick={() => setConfirming(false)}>
                {t.common.cancel}
              </button>
              <button type="button" className="btn danger small grow" onClick={endGame}>
                {a.end}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn danger-outlined" onClick={() => setConfirming(true)}>
            {a.endNoWinner}
          </button>
        )}
      </div>
    </div>
  );
}

function Scoreboard({ e, close }: { e: AmbiciosoState; close: () => void }) {
  const t = useT();
  const a = t.ambicioso;
  const ordered = [...e.players].sort((a, b) => b.points - a.points);
  return (
    <div className="overlay" role="dialog" aria-label={a.scoreboard}>
      <div className="screen">
        <div className="bar">
          <button type="button" className="link" onClick={close}>
            {a.backToGame}
          </button>
          <span className="mono" style={{ fontSize: 12 }}>
            {a.targetLabel(e.config.targetMode === "exact", fmt(e.config.target))}
          </span>
        </div>
        <h1 className="title">{a.scoreboard}</h1>
        <div className="ranking">
          {ordered.map((j, i) => (
            <div key={j.id} className="r">
              <b>{i + 1}</b>
              <span className="dot" style={{ background: j.color }} />
              <span>{j.name}</span>
              <b className="mono">{fmt(j.points)}</b>
              <div className="meter">
                <i style={{ width: `${Math.min(100, (j.points / e.config.target) * 100)}%`, background: j.color }} />
              </div>
            </div>
          ))}
        </div>
        <span className="lbl">{a.log}</span>
        <div className="card log">
          {e.history.length === 0 && <span>{a.noTurns}</span>}
          {[...e.history].reverse().map((ev, i) => (
            <span key={i} style={{ color: ev.type === "banked" ? undefined : "var(--bust)" }}>
              {a.roundShort(ev.round)} · {eventText(e, ev, t)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Rules({ close }: { close: () => void }) {
  const t = useT();
  const a = t.ambicioso;
  return (
    <div className="overlay" role="dialog" aria-label={a.rules}>
      <div className="screen rules">
        <div className="bar">
          <button type="button" className="link" onClick={close}>
            {t.common.back}
          </button>
        </div>
        <h1 className="title">{a.rulesTitle}</h1>
        <ul>
          {a.rulesList.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
