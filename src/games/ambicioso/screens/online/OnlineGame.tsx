import { useEffect, useRef, useState } from "react";
import { saveToHistory, useSettings } from "../../../../engine/hub";
import { EffectSettings } from "../../../../hub/Settings";
import { fmt, useT } from "../../../../i18n";
import { act, leaveGame, OnlineFailure, type RoomSnapshot } from "../../../../online/api";
import { type OnlineError, toOnlineError } from "../../../../online/errors";
import { clock, REACTIONS, senderName, turnView } from "../../../../online/game";
import { type ClientAction, type LastMove, SKIP_AFTER_MS } from "../../../../online/roomAction";
import type { RoomView } from "../../../../online/useRoom";
import { Die } from "../../../../ui/Die";
import { effects } from "../../../../ui/effects";
import { shakeAvailable, useShake } from "../../../../ui/shake";
import { type AmbiciosoState, pointsToTarget, pointsToWin } from "../../rules/ambicioso";
import {
  CurrentPlayer,
  eventText,
  FinalRoundNotice,
  HandOff,
  ROLL_DURATION,
  RollTray,
  Rules,
  Scoreboard,
  ScoreStrip,
  Winner,
} from "../GameScreen";

/** How long everyone sees a bust before the next turn shows. */
const BUST_MS = 2500;
/** A dropped live connection is only shown after this long (reconnecting is usually quick). */
const OFFLINE_NOTICE_MS = 3000;
/** Minimum time between two reactions from this phone. */
const REACTION_GAP_MS = 700;

type RollMove = Extract<LastMove, { kind: "roll" }>;
type Show = { kind: "rolling"; seat: number; dice: number } | { kind: "bust"; move: RollMove } | null;
type Overlay = null | "menu" | "scoreboard" | "rules";

interface Props {
  roomId: string;
  view: RoomView;
  snapshot: RoomSnapshot;
  /** This phone left the room. */
  left: () => void;
  exit: () => void;
}

/** The game, live on every phone in the room: your turn, someone else's, busts and reactions. */
export function OnlineGame({ roomId, view, snapshot, left, exit }: Props) {
  const t = useT();
  const o = t.online;
  const [settings] = useSettings();
  const { room, members, seats } = snapshot;
  // Only called while a game is on, so the state is there.
  const state = room.state as NonNullable<typeof room.state>;
  const game = state.game;
  const turn = turnView(state, seats, view.me);
  const spectator = members.find((m) => m.user_id === view.me)?.role === "spectator";
  const hostId = members.find((m) => m.role === "host")?.user_id;
  const isHost = hostId !== undefined && hostId === view.me;
  const hostName = seats.find((s) => s.user_id === hostId && !s.removed)?.name ?? "";

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<OnlineError | null>(null);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [ready, setReady] = useState(false);
  const [shaking, setShaking] = useState(false);
  const show = useMoveAnimation(state, room.version);
  const offline = useDelayed(!view.live, OFFLINE_NOTICE_MS);
  const shakeEnabled = settings.shake && shakeAvailable();
  const lastShakeSound = useRef(0);
  const idle = useIdleMs(room.version);
  useSaveToHistory(roomId, state, seats, view.me);

  // A new turn on a shared phone starts on the "pass the phone" screen again.
  // biome-ignore lint/correctness/useExhaustiveDependencies: must re-run whenever the turn or round changes.
  useEffect(() => setReady(false), [game.turnIndex, game.round]);

  const prevFinalRound = useRef(game.finalRound);
  useEffect(() => {
    if (game.finalRound && !prevFinalRound.current) effects.finalRound();
    prevFinalRound.current = game.finalRound;
  }, [game.finalRound]);

  const send = async (action: "ROLL" | "BANK") => {
    if (pending) return;
    setPending(true);
    setError(null);
    if (action === "ROLL") show.rollStarted(turn.currentSeat, game.diceLeft);
    try {
      await act(roomId, room.version, { type: action });
    } catch (e) {
      show.rollFailed();
      const code = e instanceof OnlineFailure ? e.code : toOnlineError(e);
      // Someone else's move got there first: the screen catches up and nothing is lost.
      if (code !== "stale_version") setError(code);
    } finally {
      setPending(false);
      view.refresh();
    }
  };
  const roll = () => void send("ROLL");
  const bank = () => void send("BANK");

  /** Anything else: skipping, taking someone out, rematch, leaving. */
  const run = async (task: () => Promise<unknown>) => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await task();
    } catch (e) {
      const code = e instanceof OnlineFailure ? e.code : toOnlineError(e);
      if (code !== "stale_version") setError(code);
    } finally {
      setPending(false);
      view.refresh();
    }
  };
  const move = (action: ClientAction) => run(() => act(roomId, room.version, action));
  const leave = () =>
    run(async () => {
      if (view.me) await leaveGame(roomId, view.me);
      left();
    });

  const canRoll = turn.myTurn && !pending && !show.current && (game.phase === "rolled" || game.phase === "handOff");
  useShake(
    shakeEnabled && canRoll && overlay === null && (game.phase === "rolled" || !turn.sharedPhone || ready),
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

  const finished = game.phase === "winner" || game.phase === "ended";
  let content: React.ReactNode;
  if (show.current?.kind === "rolling" || shaking) {
    const seat = show.current?.kind === "rolling" ? show.current.seat : turn.currentSeat;
    const dice = show.current?.kind === "rolling" ? show.current.dice : game.diceLeft;
    content = <Rolling e={game} seat={seat} dice={dice} />;
  } else if (show.current?.kind === "bust") {
    content = <Bust e={game} move={show.current.move} />;
  } else if (finished) {
    content = (
      <Winner e={game}>
        {isHost ? (
          <button type="button" className="btn pri" disabled={pending} onClick={() => move({ type: "REMATCH" })}>
            {o.rematch}
          </button>
        ) : (
          <span className="center dim">{o.waitingRematch(hostName)}</span>
        )}
        <button type="button" className="btn outlined" onClick={exit}>
          {t.ambicioso.backHome}
        </button>
        <button type="button" className="btn outlined" disabled={pending} onClick={leave}>
          {o.leave}
        </button>
      </Winner>
    );
  } else if (!turn.myTurn) {
    content = (
      <Watching e={game} connected={turn.currentPhone !== null && view.online.has(turn.currentPhone)}>
        {!spectator && (
          <Waiting
            e={game}
            waitLeft={SKIP_AFTER_MS - idle}
            busy={pending}
            skip={() => move({ type: "SKIP_TURN" })}
            remove={isHost ? () => move({ type: "REMOVE_PLAYER", seat: turn.currentSeat }) : undefined}
          />
        )}
      </Watching>
    );
  } else if (game.phase === "handOff" && turn.sharedPhone && !ready) {
    content = <HandOff e={game} ready={() => (shakeEnabled ? setReady(true) : roll())} shakeEnabled={shakeEnabled} />;
  } else if (game.phase === "handOff") {
    content = <YourTurn e={game} roll={roll} disabled={!canRoll} shakeEnabled={shakeEnabled} />;
  } else {
    content = <Turn e={game} roll={roll} bank={bank} disabled={!canRoll} shakeEnabled={shakeEnabled} />;
  }

  const showReactions = !finished && (!turn.myTurn || spectator);
  const bg = show.current?.kind === "bust" ? "bg-bust" : finished && !show.current ? "bg-winner" : "";

  return (
    <>
      <div className={`screen ${bg}`} style={{ maxWidth: "none" }}>
        <div className="column" style={{ maxWidth: 480, width: "100%", margin: "0 auto", flex: 1, gap: 14 }}>
          {(!finished || show.current) && (
            <>
              <div className="bar">
                <span className="mono" style={{ fontSize: 12 }}>
                  {t.ambicioso.round(game.round)} ·{" "}
                  {t.ambicioso.targetLabel(game.config.targetMode === "exact", fmt(game.config.target))}
                </span>
                <button type="button" className="icon-button" onClick={() => setOverlay("menu")} aria-label={o.menu}>
                  ☰
                </button>
              </div>
              <ScoreStrip e={game} open={() => setOverlay("scoreboard")} />
            </>
          )}
          {offline && (
            <div className="notice" role="status">
              ↻ {o.reconnecting}
            </div>
          )}
          {spectator && !finished && <span className="dim center">{o.watching}</span>}
          {content}
          {error && (
            <p role="alert" className="error-text">
              {o.errors[error]}
            </p>
          )}
          {showReactions && <ReactionBar react={view.react} />}
        </div>
      </div>
      <FloatingReactions reactions={view.reactions} seats={seats} />
      {overlay === "menu" && (
        <Menu
          close={() => setOverlay(null)}
          open={setOverlay}
          exit={exit}
          leave={finished ? undefined : leave}
          playing={!spectator && turn.myPlayers > 0}
        />
      )}
      {overlay === "scoreboard" && <Scoreboard e={game} close={() => setOverlay(null)} />}
      {overlay === "rules" && <Rules close={() => setOverlay("menu")} />}
    </>
  );
}

/**
 * Plays each move as it arrives: the dice tumble, land with sound, and a bust stays on
 * screen for a moment before the next turn, the same on every phone. A move this phone
 * sent starts tumbling right away, while the server rolls.
 */
function useMoveAnimation(state: NonNullable<RoomSnapshot["room"]["state"]>, version: number) {
  const [current, setCurrent] = useState<Show>(null);
  const seen = useRef(version);
  const startedAt = useRef<number | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
    if (version === seen.current) return;
    seen.current = version;
    clearTimers(timers.current);
    const last = state.last;
    if (last?.kind !== "roll") {
      if (last?.kind === "bank") effects.bank();
      startedAt.current = null;
      setCurrent(null);
      return;
    }
    const mine = startedAt.current;
    startedAt.current = null;
    if (mine === null) effects.shaking();
    setCurrent({ kind: "rolling", seat: last.seat, dice: last.roll.faces.length });
    const wait = mine === null ? ROLL_DURATION : Math.max(150, mine + ROLL_DURATION - Date.now());
    later(wait, () => {
      const scoring = last.roll.scoring.filter(Boolean).length;
      effects.land(last.roll.faces.length);
      if (last.outcome !== "rolled") {
        effects.bust();
        setCurrent({ kind: "bust", move: last });
        later(BUST_MS, () => setCurrent(null));
        return;
      }
      effects.scoring(scoring);
      if (last.roll.hotDice) effects.hotDice();
      setCurrent(null);
    });
  }, [version, state.last]);

  useEffect(() => () => clearTimers(timers.current), []);

  return {
    current,
    rollStarted(seat: number, dice: number) {
      startedAt.current = Date.now();
      effects.shaking();
      setCurrent({ kind: "rolling", seat, dice });
    },
    rollFailed() {
      if (startedAt.current === null) return;
      startedAt.current = null;
      setCurrent(null);
    },
  };
}

/** Milliseconds since the room last changed, as seen by this phone; ticks every second. */
function useIdleMs(version: number) {
  const [since, setSince] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  // biome-ignore lint/correctness/useExhaustiveDependencies: every change in the room restarts the wait.
  useEffect(() => {
    // Every change in the room (a move, someone joining) restarts the wait.
    setSince(Date.now());
    setNow(Date.now());
  }, [version]);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return Math.max(0, now - since);
}

/** Once a game this phone played in is over, it goes into the phone's history (once). */
function useSaveToHistory(
  roomId: string,
  state: NonNullable<RoomSnapshot["room"]["state"]>,
  seats: RoomSnapshot["seats"],
  me: string | null,
) {
  const { game, gameId } = state;
  const over = game.phase === "winner" || game.phase === "ended";
  const played =
    me !== null && game.players.some((p) => seats.some((s) => String(s.seat) === p.id && s.user_id === me));
  useEffect(() => {
    if (!over || !played) return;
    saveToHistory({
      id: `online-${roomId}-${gameId}`,
      game: "ambicioso",
      date: new Date().toISOString(),
      players: game.players.map((p) => ({ id: p.id, name: p.name, color: p.color, points: p.points })),
      winners: game.phase === "winner" ? game.winners : [],
      info: {
        target: game.config.target,
        exact: game.config.targetMode === "exact",
        rounds: game.round,
        complete: game.phase === "winner",
        online: true,
      },
    });
  }, [over, played, roomId, gameId, game]);
}

function clearTimers(ids: number[]) {
  for (const id of ids.splice(0)) window.clearTimeout(id);
}

/** `value`, but only once it has stayed true for `ms`. */
function useDelayed(value: boolean, ms: number) {
  const [delayed, setDelayed] = useState(false);
  useEffect(() => {
    if (!value) {
      setDelayed(false);
      return;
    }
    const id = window.setTimeout(() => setDelayed(true), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return delayed;
}

/* ---------- Pieces ---------- */

function Rolling({ e, seat, dice }: { e: AmbiciosoState; seat: number; dice: number }) {
  const t = useT();
  const player = e.players.find((p) => p.id === String(seat));
  const [faces, setFaces] = useState(() => randomFaces(dice));
  useEffect(() => {
    const id = window.setInterval(() => setFaces(randomFaces(dice)), 110);
    return () => window.clearInterval(id);
  }, [dice]);
  return (
    <>
      <div className="row">
        <span className="dot" style={{ background: player?.color }} />
        <b>{t.ambicioso.turnOf(player?.name ?? "")}</b>
        <span className="grow" />
        <span className="pill">{t.ambicioso.rolling}</span>
      </div>
      <span className="grow" />
      <div className="tray">
        <div className="dice">
          {faces.map((c, i) => (
            <Die key={i} face={c} size={60} state="rolling" delay={i * -90} />
          ))}
        </div>
      </div>
      <span className="grow" />
    </>
  );
}

const randomFaces = (n: number) => Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 6));

function Bust({ e, move }: { e: AmbiciosoState; move: RollMove }) {
  const t = useT();
  const a = t.ambicioso;
  const o = t.online;
  const player = e.players.find((p) => p.id === String(move.seat));
  const name = player?.name ?? "";
  const points = player?.points ?? 0;
  const overshot = move.outcome === "overshot";
  const over = e.phase === "winner" || e.phase === "ended";
  return (
    <>
      <div className="row">
        <span className="dot" style={{ background: player?.color }} />
        <b>{a.turnOf(name)}</b>
      </div>
      <span className="grow" />
      <div className="tray" style={{ background: "transparent", minHeight: 0 }}>
        <div className="dice">
          {move.roll.faces.map((c, i) => (
            <Die key={i} face={c} size={56} state={move.roll.scoring[i] ? "scoring" : "dead"} />
          ))}
        </div>
      </div>
      {!overshot && (
        <div className="pot center" style={{ textAlign: "center" }} aria-hidden="true">
          🍲
        </div>
      )}
      <h1 style={{ textAlign: "center", fontSize: 44, color: "var(--bust)" }}>{overshot ? a.overshot : a.bust}</h1>
      {move.lost > 0 && (
        <div className="struck" style={{ textAlign: "center" }}>
          {fmt(move.lost)}
        </div>
      )}
      <p className="dim" style={{ textAlign: "center", margin: 0 }}>
        {overshot
          ? a.overshotBody(fmt(points), fmt(move.lost), fmt(points + move.lost + move.roll.points), name)
          : a.bustBody(name, fmt(points))}
      </p>
      <span className="grow" />
      <div className="column center" style={{ gap: 6 }}>
        <span>{over ? o.gameOver : o.nextUp(e.players[e.turnIndex].name)}</span>
        <div className="turn-timer" style={{ width: "100%", animationDuration: `${BUST_MS}ms` }} />
      </div>
    </>
  );
}

function LastTurn({ e }: { e: AmbiciosoState }) {
  const t = useT();
  const last = e.history.at(-1);
  if (!last) return null;
  return (
    <div className="card log">
      <span>{t.ambicioso.lastTurn}</span>
      <span style={{ color: "var(--ink)" }}>{eventText(e, last, t)}</span>
    </div>
  );
}

function standing(e: AmbiciosoState, t: ReturnType<typeof useT>) {
  const a = t.ambicioso;
  const j = e.players[e.turnIndex];
  if (!e.finalRound) return a.hasMissing(fmt(j.points), fmt(pointsToTarget(e)));
  return e.config.targetMode === "exact"
    ? a.hasNeedsExact(fmt(j.points), fmt(pointsToWin(e)))
    : a.hasNeedsLead(fmt(j.points), fmt(pointsToWin(e)));
}

function YourTurn({
  e,
  roll,
  disabled,
  shakeEnabled,
}: {
  e: AmbiciosoState;
  roll: () => void;
  disabled: boolean;
  shakeEnabled: boolean;
}) {
  const t = useT();
  const o = t.online;
  const j = e.players[e.turnIndex];
  return (
    <>
      <FinalRoundNotice e={e} />
      <span className="grow" />
      <div className="handoff" style={{ ["--c" as string]: j.color }}>
        <span className="dot" style={{ background: j.color, width: 20, height: 20 }} />
        <span className="lbl">{j.name}</span>
        <h2>{o.yourTurn}</h2>
        <span className="dim">{standing(e, t)}</span>
      </div>
      <span className="grow" />
      <LastTurn e={e} />
      <button type="button" className="btn pri" disabled={disabled} onClick={roll}>
        {shakeEnabled ? o.shakeOrTap : `${o.rollNow} · ${t.ambicioso.dice(e.diceLeft)}`}
      </button>
    </>
  );
}

function Turn({
  e,
  roll,
  bank,
  disabled,
  shakeEnabled,
}: {
  e: AmbiciosoState;
  roll: () => void;
  bank: () => void;
  disabled: boolean;
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
      <RollTray e={e} />
      <div className="column center" style={{ textAlign: "center", gap: 2 }}>
        <span className="lbl">{a.turnTotal}</span>
        <span className="big" style={{ color: l.hotDice ? "var(--gold)" : undefined }}>
          {fmt(e.turnTotal)}
        </span>
        <span className="dim" style={{ fontSize: 14 }}>
          {l.hotDice ? a.hotDiceBody : ""}
          {a.ifYouBank(fmt(j.points), fmt(total))}
        </span>
        {onTarget && <span style={{ color: "var(--gold)", fontWeight: 700 }}>{a.exactHit}</span>}
        {reaches && <span style={{ color: "var(--gold)", fontWeight: 700 }}>{a.reachesTarget}</span>}
      </div>
      <span className="grow" />
      <div className="column">
        <button type="button" className={`btn ${onTarget ? "sec" : "pri"}`} disabled={disabled} onClick={roll}>
          {a.keepRolling(e.diceLeft, shakeEnabled)}
        </button>
        <button type="button" className={`btn ${onTarget ? "pri" : "sec"}`} disabled={disabled} onClick={bank}>
          {a.bank(fmt(e.turnTotal))}
        </button>
      </div>
    </>
  );
}

/** Someone else's turn: their dice, live. */
function Watching({ e, connected, children }: { e: AmbiciosoState; connected: boolean; children: React.ReactNode }) {
  const t = useT();
  const a = t.ambicioso;
  const o = t.online;
  const j = e.players[e.turnIndex];
  const presence = (
    <span
      className={`presence ${connected ? "on" : ""}`}
      role="img"
      aria-label={connected ? o.connected : o.disconnected}
    />
  );
  if (e.phase !== "rolled" || !e.lastRoll) {
    return (
      <>
        <CurrentPlayer e={e} extra={presence} />
        <FinalRoundNotice e={e} />
        <span className="grow" />
        <div className="column center" style={{ textAlign: "center", gap: 4 }}>
          <h2>{o.waitingRoll(j.name)}</h2>
          <span className="dim">{standing(e, t)}</span>
        </div>
        <span className="grow" />
        <LastTurn e={e} />
        {children}
      </>
    );
  }
  return (
    <>
      <CurrentPlayer
        e={e}
        extra={
          <>
            <span className="pill">{a.rollN(e.rollNumber)}</span>
            {presence}
          </>
        }
      />
      <FinalRoundNotice e={e} />
      <RollTray e={e} />
      <div className="column center" style={{ textAlign: "center", gap: 2 }}>
        <span className="lbl">{a.turnTotal}</span>
        <span className="big" style={{ color: e.lastRoll.hotDice ? "var(--gold)" : undefined }}>
          {fmt(e.turnTotal)}
        </span>
        <span className="dim" style={{ fontSize: 14 }}>
          {o.ifBanks(j.name, fmt(j.points), fmt(j.points + e.turnTotal))}
        </span>
      </div>
      <span className="grow" />
      {children}
    </>
  );
}

/**
 * When the player in turn does nothing for a minute (away, or offline), anyone playing can
 * skip their turn; the host can also take them out of the game.
 */
function Waiting({
  e,
  waitLeft,
  busy,
  skip,
  remove,
}: {
  e: AmbiciosoState;
  waitLeft: number;
  busy: boolean;
  skip: () => void;
  remove?: () => void;
}) {
  const t = useT();
  const o = t.online;
  const [confirming, setConfirming] = useState(false);
  const name = e.players[e.turnIndex].name;
  if (waitLeft > 0) {
    // Only worth mentioning once the wait is noticeable.
    if (waitLeft > SKIP_AFTER_MS - 20_000) return null;
    return <span className="dim center">{o.skipIn(name, clock(waitLeft))}</span>;
  }
  if (confirming && remove) {
    return (
      <div className="card column">
        <b>{o.removeConfirm(name)}</b>
        <div className="row">
          <button type="button" className="btn outlined small grow" onClick={() => setConfirming(false)}>
            {t.common.cancel}
          </button>
          <button
            type="button"
            className="btn danger small grow"
            disabled={busy}
            onClick={() => {
              setConfirming(false);
              remove();
            }}
          >
            {o.removeYes}
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="column" style={{ gap: 6 }}>
      <button type="button" className="btn sec" disabled={busy} onClick={skip}>
        {o.skipTurn(name)}
      </button>
      {remove && (
        <button type="button" className="btn danger-outlined" disabled={busy} onClick={() => setConfirming(true)}>
          {o.removePlayer(name)}
        </button>
      )}
    </div>
  );
}

function ReactionBar({ react }: { react: RoomView["react"] }) {
  const o = useT().online;
  const [resting, setResting] = useState(false);
  return (
    <fieldset className="reaction-bar" aria-label={o.reactions}>
      {REACTIONS.map((emoji) => (
        <button
          type="button"
          key={emoji}
          disabled={resting}
          aria-label={o.react(emoji)}
          onClick={() => {
            react(emoji);
            setResting(true);
            window.setTimeout(() => setResting(false), REACTION_GAP_MS);
          }}
        >
          {emoji}
        </button>
      ))}
    </fieldset>
  );
}

function FloatingReactions({ reactions, seats }: { reactions: RoomView["reactions"]; seats: RoomSnapshot["seats"] }) {
  if (reactions.length === 0) return null;
  return (
    <div className="floating-reactions" aria-live="polite">
      {reactions.map((r) => {
        const name = senderName(r.from, seats);
        // Spread them across the screen, the same place for the same reaction on every render.
        const left = 12 + ((r.id * 37) % 70);
        return (
          <span key={r.id} style={{ left: `${left}%` }}>
            {r.emoji}
            {name && <small>{name}</small>}
          </span>
        );
      })}
    </div>
  );
}

function Menu({
  close,
  open,
  exit,
  leave,
  playing,
}: {
  close: () => void;
  open: (o: Overlay) => void;
  exit: () => void;
  /** Leave the room for good (and, for a player, the game). */
  leave?: () => void;
  /** This phone has players still in the game. */
  playing: boolean;
}) {
  const t = useT();
  const a = t.ambicioso;
  const o = t.online;
  const [effectsOpen, setEffectsOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="overlay" role="dialog" aria-label={t.online.menu}>
      <div className="screen">
        <div className="bar">
          <button type="button" className="link" onClick={close}>
            {a.backToGame}
          </button>
        </div>
        <div className="column">
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
            {o.leaveForNow}
          </button>
        </div>
        <span className="grow" />
        {leave &&
          (confirming ? (
            <div className="card column">
              <b>{o.leaveGameConfirm}</b>
              <div className="row">
                <button type="button" className="btn outlined small grow" onClick={() => setConfirming(false)}>
                  {t.common.cancel}
                </button>
                <button type="button" className="btn danger small grow" onClick={leave}>
                  {o.leaveGame}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="btn danger-outlined"
              onClick={() => (playing ? setConfirming(true) : leave())}
            >
              {playing ? o.leaveGame : o.leave}
            </button>
          ))}
      </div>
    </div>
  );
}
