import { useEffect, useState } from "react";
import { CATALOG } from "../games/catalog";
import { useT } from "../i18n";
import { Die } from "../ui/Die";
import { History } from "./History";
import { Players } from "./Players";
import { Settings } from "./Settings";

type Tab = "games" | "history" | "players" | "settings";

const TABS: { id: Tab; icon: string }[] = [
  { id: "games", icon: "⚄" },
  { id: "history", icon: "☰" },
  { id: "players", icon: "☺" },
  { id: "settings", icon: "⚙" },
];

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

export function Hub({ open }: { open: (id: string) => void }) {
  const [tab, setTab] = useState<Tab>("games");
  const t = useT();
  const names: Record<Tab, string> = {
    games: t.nav.games,
    history: t.nav.history,
    players: t.nav.players,
    settings: t.nav.settings,
  };
  return (
    <>
      <div className="screen with-nav">
        {tab === "games" && <GamesTab open={open} />}
        {tab === "history" && <History />}
        {tab === "players" && <Players />}
        {tab === "settings" && <Settings />}
      </div>
      <nav className="nav" aria-label={t.nav.sections}>
        <div>
          {TABS.map((p) => (
            <button
              type="button"
              key={p.id}
              className={tab === p.id ? "on" : ""}
              onClick={() => setTab(p.id)}
              aria-current={tab === p.id}
            >
              <span className="ic" aria-hidden="true">
                {p.icon}
              </span>
              {names[p.id]}
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}

function GamesTab({ open }: { open: (id: string) => void }) {
  const t = useT();
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  useEffect(() => {
    const handleInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
  }, []);

  const pending = CATALOG.map((j) => ({ j, summary: j.gameSummary() })).filter((x) => x.summary);

  return (
    <>
      <div className="row" style={{ gap: 10 }}>
        <Die face={5} size={30} />
        <h1 className="title">{t.appName}</h1>
      </div>

      {pending.map(({ j, summary }) => (
        <button
          type="button"
          key={j.id}
          className="card gold btn"
          style={{ justifyContent: "space-between", textAlign: "left", fontWeight: 500 }}
          onClick={() => open(j.id)}
        >
          <span className="column" style={{ gap: 2 }}>
            <span className="lbl" style={{ color: "var(--gold)" }}>
              {t.home.continue}
            </span>
            <span>
              {j.name(t)} · {summary}
            </span>
          </span>
          <b style={{ color: "var(--gold)" }}>{t.home.resume}</b>
        </button>
      ))}

      <span className="lbl">{t.home.games}</span>
      <div className="games">
        {CATALOG.map((j) => (
          <button type="button" key={j.id} className="game-card" onClick={() => open(j.id)}>
            <span className="row" style={{ gap: 4 }}>
              {j.faces.map((c, i) => (
                <Die key={i} face={c} size={26} />
              ))}
            </span>
            <span className="grow" />
            <b>{j.name(t)}</b>
            <span className="dim" style={{ fontSize: 13 }}>
              {j.description(t)}
            </span>
          </button>
        ))}
        {Array.from({ length: Math.max(1, 3 - (CATALOG.length - 1)) }, (_, i) => (
          <div key={i} className="game-card soon" aria-hidden="true">
            <span className="grow" />
            <b>{t.common.nextGame}</b>
            <span style={{ fontSize: 13 }}>{t.common.soon}</span>
          </div>
        ))}
      </div>

      {installPrompt && (
        <div className="card column">
          <b>{t.home.installTitle}</b>
          <span className="dim" style={{ fontSize: 14 }}>
            {t.home.installBody}
          </span>
          <button
            type="button"
            className="btn sec small"
            onClick={() => {
              void installPrompt.prompt();
              setInstallPrompt(null);
            }}
          >
            {t.home.install}
          </button>
        </div>
      )}
    </>
  );
}
