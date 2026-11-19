import { useState } from "react";
import { useT } from "../../../i18n";
import { onlineAvailable } from "../../../online/client";
import { codeFromHash, formatCode } from "../../../online/lobby";
import { AmbiciosoGame } from "./AmbiciosoGame";
import { OnlineAmbicioso, readOpenRoom } from "./online/OnlineAmbicioso";

type Mode = "choose" | "local" | "online";

/** Entry point of the game: on this phone (pass and play) or online. */
export function AmbiciosoEntry({ exit }: { exit: () => void }) {
  const [joinCode] = useState(() => codeFromHash(location.hash, "ambicioso"));
  const [mode, setMode] = useState<Mode>(() => {
    if (!onlineAvailable()) return "local";
    return joinCode ? "online" : "choose";
  });

  if (mode === "local") return <AmbiciosoGame exit={exit} />;
  if (mode === "online") {
    return <OnlineAmbicioso exit={exit} back={() => setMode("choose")} joinCode={joinCode} />;
  }
  return <ModeChoice exit={exit} choose={setMode} />;
}

function ModeChoice({ exit, choose }: { exit: () => void; choose: (m: Mode) => void }) {
  const t = useT();
  const o = t.online;
  const openRoom = readOpenRoom();
  return (
    <div className="screen">
      <div className="bar">
        <button type="button" className="link" onClick={exit}>
          {t.common.backToGames}
        </button>
        <span>{t.ambicioso.name}</span>
        <span style={{ width: 50 }} />
      </div>
      <h1 className="title">{o.chooseTitle}</h1>
      <button type="button" className="card mode-card" onClick={() => choose("local")}>
        <b>📱 {o.thisPhone}</b>
        <span className="dim">{o.thisPhoneHint}</span>
      </button>
      <button type="button" className="card mode-card" onClick={() => choose("online")}>
        <b>🌐 {o.online}</b>
        <span className="dim">{o.onlineHint}</span>
      </button>
      <span className="grow" />
      {openRoom && (
        <button type="button" className="link gold" onClick={() => choose("online")}>
          {o.openRoom(formatCode(openRoom.code))}
        </button>
      )}
    </div>
  );
}
