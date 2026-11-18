import { useState } from "react";
import { useHistory } from "../engine/hub";
import { CATALOG } from "../games/catalog";
import { fmt, useT } from "../i18n";
import type { Texts } from "../i18n/es";

const date = (iso: string, t: Texts) => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 864e5);
  if (d.toDateString() === today.toDateString()) return t.history.today;
  if (d.toDateString() === yesterday.toDateString()) return t.history.yesterday;
  return d.toLocaleDateString(t.locale, { day: "numeric", month: "short" });
};

export function History() {
  const t = useT();
  const [history] = useHistory();
  const [openId, setOpenId] = useState<string | null>(null);

  const wins = new Map<string, { name: string; n: number }>();
  for (const h of history) {
    for (const id of h.winners) {
      const j = h.players.find((x) => x.id === id);
      if (!j) continue;
      const v = wins.get(id) ?? { name: j.name, n: 0 };
      wins.set(id, { name: j.name, n: v.n + 1 });
    }
  }
  const ranking = [...wins.values()].sort((a, b) => b.n - a.n);

  return (
    <>
      <h1 className="title">{t.history.title}</h1>
      {ranking.length > 0 && (
        <div className="chips">
          {ranking.map((r, i) => (
            <span key={r.name + i} className={`pill ${i === 0 ? "gold" : ""}`}>
              {r.name} · {t.history.wins(r.n)}
            </span>
          ))}
        </div>
      )}
      {history.length === 0 && <div className="card dim">{t.history.empty}</div>}
      <div className="column">
        {history.map((h) => {
          const winners = h.players.filter((j) => h.winners.includes(j.id));
          const entry = CATALOG.find((c) => c.id === h.game);
          const game = entry ? entry.name(t) : h.game;
          const title =
            winners.length === 0
              ? t.history.noWinner
              : winners.length === 1
                ? t.history.won(winners[0].name)
                : t.history.tie(t.join(winners.map((g) => g.name)));
          return (
            <button
              type="button"
              key={h.id}
              className="card btn"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "stretch",
                fontWeight: 500,
                opacity: winners.length ? 1 : 0.6,
                textAlign: "left",
              }}
              onClick={() => setOpenId(openId === h.id ? null : h.id)}
              aria-expanded={openId === h.id}
            >
              <span className="row">
                {winners[0] && <span className="dot" style={{ background: winners[0].color }} />}
                <b className="grow">{title}</b>
                <span className="mono" style={{ fontSize: 13 }}>
                  {winners[0] ? fmt(winners[0].points) : "—"}
                </span>
              </span>
              <span className="dim" style={{ fontSize: 12 }}>
                {date(h.date, t)} · {game} · {h.players.map((j) => j.name).join(", ")} ·{" "}
                {entry && h.info ? entry.describeGame(h.info, t) : ""}
              </span>
              {openId === h.id && (
                <span className="column" style={{ marginTop: 8, gap: 4 }}>
                  {[...h.players]
                    .sort((a, b) => b.points - a.points)
                    .map((j) => (
                      <span key={j.id} className="row" style={{ fontSize: 14 }}>
                        <span className="dot" style={{ background: j.color }} />
                        <span className="grow">{j.name}</span>
                        <span className="mono">{fmt(j.points)}</span>
                      </span>
                    ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}
