import { useState } from "react";
import { fmt, useT } from "../../../../i18n";
import { act, addSeatWithFreeColor, leaveRoom, OnlineFailure, removeSeat, updateConfig } from "../../../../online/api";
import { type OnlineError, toOnlineError } from "../../../../online/errors";
import { formatCode, joinLink } from "../../../../online/lobby";
import { MIN_PLAYERS } from "../../../../online/roomAction";
import { useRoom } from "../../../../online/useRoom";
import type { AmbiciosoConfig } from "../../rules/ambicioso";
import { OnlineGame } from "./OnlineGame";

const TARGETS = [3000, 5000, 10000];
const MAX_SEATS = 8;

interface Props {
  roomId: string;
  code: string;
  /** This phone left the room (or the room is gone). */
  left: () => void;
  exit: () => void;
}

/** Waiting room: who is in, the rules, and the start button for the host. Updates live. */
export function Lobby({ roomId, code, left, exit }: Props) {
  const t = useT();
  const o = t.online;
  const view = useRoom(roomId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<OnlineError | null>(null);
  const [copied, setCopied] = useState(false);

  const run = async (task: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (e) {
      setError(e instanceof OnlineFailure ? e.code : toOnlineError(e));
    } finally {
      setBusy(false);
      view.refresh();
    }
  };

  const header = (
    <div className="bar">
      <button type="button" className="link" onClick={exit}>
        {t.common.backToGames}
      </button>
      <span>{o.room}</span>
      <span style={{ width: 50 }} />
    </div>
  );

  if (!view.snapshot) {
    const gone = !view.loading && !view.error;
    return (
      <div className="screen">
        {header}
        <div className="column center grow" style={{ justifyContent: "center" }}>
          <p role={view.error || gone ? "alert" : "status"}>
            {view.error ? o.errors[view.error] : gone ? o.gone : o.connecting}
          </p>
          {view.error && (
            <button type="button" className="btn sec small" onClick={view.refresh}>
              {o.retry}
            </button>
          )}
          {gone && (
            <button type="button" className="btn sec small" onClick={left}>
              {t.common.back}
            </button>
          )}
        </div>
      </div>
    );
  }

  const { room, members, seats } = view.snapshot;
  const me = view.me;
  const myRole = members.find((m) => m.user_id === me)?.role;
  const hostId = members.find((m) => m.role === "host")?.user_id;
  const isHost = myRole === "host";
  const active = seats.filter((s) => !s.removed);
  // The host's phone may hold several players; the first one stands for the host.
  const hostSeat = active.find((s) => s.user_id === hostId);
  const hostName = hostSeat?.name ?? "";

  if (room.status !== "lobby" && room.state) {
    return <OnlineGame roomId={roomId} view={view} snapshot={view.snapshot} left={left} exit={exit} />;
  }

  const setConfig = (config: AmbiciosoConfig) => run(() => updateConfig(roomId, config));
  const leave = () =>
    run(async () => {
      await leaveRoom(roomId);
      left();
    });
  const share = async () => {
    const url = joinLink("ambicioso", code, location);
    const text = o.shareText(t.ambicioso.name, formatCode(code));
    try {
      if (navigator.share) await navigator.share({ title: t.ambicioso.name, text, url });
      else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        setCopied(true);
      }
    } catch {
      /* the person closed the share sheet */
    }
  };

  return (
    <div className="screen">
      {header}
      <div className="column center" style={{ gap: 4 }}>
        <span className="lbl">{o.roomCode}</span>
        <output className="code-big mono" aria-label={o.roomCode}>
          {formatCode(code)}
        </output>
        <button type="button" className="chip" onClick={share}>
          🔗 {copied ? o.copied : o.share}
        </button>
      </div>

      <span className="lbl">{o.players(active.length, MAX_SEATS)}</span>
      <ul className="column plain-list" style={{ gap: 6 }}>
        {active.map((s) => {
          const mine = s.user_id === me;
          const connected = view.online.has(s.user_id);
          return (
            <li key={s.seat} className="person">
              <span className="dot" style={{ background: s.color }} />
              <span className="name">
                {s.name}
                {s === hostSeat && <small className="dim"> · {o.host}</small>}
                {mine && <small className="dim"> · {o.thisPhoneTag}</small>}
              </span>
              <span
                className={`presence ${connected ? "on" : ""}`}
                role="img"
                aria-label={connected ? o.connected : o.disconnected}
              />
              {(mine || isHost) && (
                <button
                  type="button"
                  className="icon-button"
                  disabled={busy}
                  onClick={() => run(() => removeSeat(roomId, s.seat))}
                  aria-label={o.removeLabel(s.name)}
                >
                  ✕
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {myRole !== "spectator" && active.length < MAX_SEATS && (
        <AddPlayer disabled={busy} add={(name) => run(() => addSeatWithFreeColor(roomId, name))} />
      )}

      <span className="lbl">{o.rules}</span>
      {isHost ? (
        <div className="column" style={{ gap: 8 }}>
          <div className="chips">
            {TARGETS.map((target) => (
              <button
                type="button"
                key={target}
                className={`chip mono ${room.config.target === target ? "on" : ""}`}
                aria-pressed={room.config.target === target}
                disabled={busy}
                onClick={() => setConfig({ ...room.config, target })}
              >
                {fmt(target)}
              </button>
            ))}
          </div>
          <div className="chips">
            {(["reachOrPass", "exact"] as const).map((mode) => (
              <button
                type="button"
                key={mode}
                className={`chip ${room.config.targetMode === mode ? "on" : ""}`}
                aria-pressed={room.config.targetMode === mode}
                disabled={busy}
                onClick={() => setConfig({ ...room.config, targetMode: mode })}
              >
                {mode === "exact" ? t.ambicioso.exact : t.ambicioso.reachOrPass}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="card">{o.rulesSummary(fmt(room.config.target), room.config.targetMode === "exact")}</div>
      )}

      {error && (
        <p role="alert" className="error-text">
          {o.errors[error]}
        </p>
      )}
      <span className="grow" />
      {isHost ? (
        <div className="column" style={{ gap: 6 }}>
          <button
            type="button"
            className="btn pri"
            disabled={busy || active.length < MIN_PLAYERS}
            onClick={() => run(() => act(roomId, room.version, { type: "START" }))}
          >
            {o.start}
          </button>
          <span className="dim center" style={{ fontSize: 13 }}>
            {active.length < MIN_PLAYERS ? o.needTwo : o.startHint}
          </span>
        </div>
      ) : (
        <div className="column center" style={{ gap: 2 }}>
          <b>{o.waitingHost(hostName)}</b>
          <span className="dim" style={{ fontSize: 13 }}>
            {o.waitingBody}
          </span>
        </div>
      )}
      <button type="button" className="btn outlined" disabled={busy} onClick={leave}>
        {o.leave}
      </button>
    </div>
  );
}

function AddPlayer({ add, disabled }: { add: (name: string) => Promise<void>; disabled: boolean }) {
  const t = useT();
  const [name, setName] = useState("");
  return (
    <form
      className="row"
      onSubmit={async (e) => {
        e.preventDefault();
        const n = name.trim();
        if (!n) return;
        await add(n);
        setName("");
      }}
    >
      <input
        className="field grow"
        aria-label={t.online.addHere}
        placeholder={t.online.addHere}
        value={name}
        maxLength={20}
        onChange={(e) => setName(e.target.value)}
      />
      <button className="btn sec small" type="submit" disabled={disabled || !name.trim()}>
        {t.common.add}
      </button>
    </form>
  );
}
