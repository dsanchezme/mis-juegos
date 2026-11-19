import { useEffect, useRef, useState } from "react";
import { usePlayers } from "../../../../engine/hub";
import { read, write } from "../../../../engine/storage";
import { useT } from "../../../../i18n";
import { addSeatWithFreeColor, createRoom, fetchRoom, joinRoom, OnlineFailure } from "../../../../online/api";
import { signIn } from "../../../../online/client";
import { type OnlineError, toOnlineError } from "../../../../online/errors";
import { CODE_LENGTH, cleanCode, freeColor } from "../../../../online/lobby";
import { Lobby } from "./Lobby";

/** The room this phone is in, so closing the app does not lose it. */
const ROOM_KEY = "online:ambicioso";
/** Name and color used last time online. */
const PROFILE_KEY = "online:profile";

export interface OpenRoom {
  roomId: string;
  code: string;
}
interface Profile {
  name: string;
  color: string;
}

export const readOpenRoom = () => read<OpenRoom | null>(ROOM_KEY, null);

interface Props {
  exit: () => void;
  back: () => void;
  /** Code from a shared link (#ambicioso/join/CODE). */
  joinCode: string | null;
}

export function OnlineAmbicioso({ exit, back, joinCode }: Props) {
  const [room, setRoom] = useState<OpenRoom | null>(readOpenRoom);
  const enter = (r: OpenRoom | null) => {
    write(ROOM_KEY, r);
    setRoom(r);
    // A join link has done its job: reloading should not join again.
    if (location.hash.includes("/join/")) history.replaceState(null, "", "#ambicioso");
  };

  if (room && (!joinCode || joinCode === room.code)) {
    return <Lobby roomId={room.roomId} code={room.code} left={() => enter(null)} exit={exit} />;
  }
  return <OnlineHome back={back} joinCode={joinCode} entered={enter} />;
}

function OnlineHome({
  back,
  joinCode,
  entered,
}: {
  back: () => void;
  joinCode: string | null;
  entered: (r: OpenRoom) => void;
}) {
  const t = useT();
  const o = t.online;
  const [players] = usePlayers();
  const [profile] = useState<Profile>(() =>
    read<Profile>(PROFILE_KEY, { name: players[0]?.name ?? "", color: players[0]?.color ?? freeColor([]) }),
  );
  const [name, setName] = useState(profile.name);
  const [code, setCode] = useState(joinCode ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<OnlineError | null>(null);

  const run = async (task: () => Promise<OpenRoom>) => {
    setBusy(true);
    setError(null);
    try {
      write(PROFILE_KEY, { name: name.trim(), color: profile.color });
      entered(await task());
    } catch (e) {
      setError(e instanceof OnlineFailure ? e.code : toOnlineError(e));
      setBusy(false);
    }
  };

  const create = () => run(() => createRoom({ target: 5000, targetMode: "reachOrPass" }, name.trim(), profile.color));
  const join = () =>
    run(async () => {
      const roomId = await joinRoom(code);
      await takeASeat(roomId, name.trim(), profile.color);
      return { roomId, code };
    });

  // Opened from a shared link with a name already known: join straight away.
  const autoJoined = useRef(false);
  useEffect(() => {
    if (joinCode && name.trim() && !autoJoined.current) {
      autoJoined.current = true;
      void join();
    }
  });

  const nameOk = name.trim().length > 0;
  return (
    <div className="screen">
      <div className="bar">
        <button type="button" className="link" onClick={back}>
          {t.common.back}
        </button>
        <span>{t.ambicioso.name}</span>
        <span style={{ width: 50 }} />
      </div>
      <h1 className="title">{o.title}</h1>
      <label className="lbl" htmlFor="online-name">
        {o.yourName}
      </label>
      <div className="row">
        <input
          id="online-name"
          className="field grow"
          value={name}
          maxLength={20}
          autoComplete="nickname"
          onChange={(e) => setName(e.target.value)}
        />
        <span className="dot" style={{ background: profile.color, width: 18, height: 18 }} aria-hidden="true" />
      </div>
      <button type="button" className="btn pri" disabled={!nameOk || busy} onClick={create}>
        {busy ? o.connecting : o.createRoom}
      </button>
      <span className="lbl center">{o.orJoin}</span>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          void join();
        }}
      >
        <input
          className="field grow mono code-input"
          aria-label={o.codeLabel}
          value={code}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder="K7MQ2P"
          onChange={(e) => setCode(cleanCode(e.target.value))}
        />
        <button className="btn sec small" type="submit" disabled={!nameOk || code.length !== CODE_LENGTH || busy}>
          {o.join}
        </button>
      </form>
      {error && (
        <p role="alert" className="error-text">
          {o.errors[error]}
        </p>
      )}
      <span className="grow" />
      <span className="dim center" style={{ fontSize: 13 }}>
        {o.joinHint}
      </span>
    </div>
  );
}

/** After joining a room that is still in the lobby, adds this phone's player (once). */
async function takeASeat(roomId: string, name: string, preferred: string): Promise<void> {
  const snapshot = await fetchRoom(roomId);
  if (snapshot?.room.status !== "lobby") return; // gone, or a game in progress: watch it
  const { userId } = await signIn();
  if (snapshot.seats.some((s) => s.user_id === userId)) return; // already in, e.g. opened the link twice
  await addSeatWithFreeColor(roomId, name, preferred);
}
