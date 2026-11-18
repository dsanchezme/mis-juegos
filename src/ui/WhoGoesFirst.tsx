import { useEffect, useRef, useState } from "react";
import type { StarterMode } from "../engine/hub";
import { readSettings } from "../engine/hub";
import type { Person } from "../engine/types";
import { useT } from "../i18n";
import { Die } from "./Die";
import { effects } from "./effects";
import { useShake } from "./shake";

interface Props {
  people: Person[];
  mode: StarterMode;
  onPick: (index: number) => void;
  back: () => void;
}

/** Screen to pick who goes first. Shared by every game. */
export function WhoGoesFirst(props: Props) {
  const t = useT();
  return (
    <div className="screen">
      <div className="bar">
        <button type="button" className="link" onClick={props.back}>
          {t.common.back}
        </button>
        <span>{t.whoStarts.title}</span>
        <span style={{ width: 50 }} />
      </div>
      {props.mode === "fingers" && <Fingers {...props} />}
      {props.mode === "spinner" && <Spinner {...props} />}
      {props.mode === "duel" && <Duel {...props} />}
      {props.mode === "random" && <RandomPick {...props} />}
    </div>
  );
}

function Result({ person, onContinue }: { person: Person; onContinue: () => void }) {
  const t = useT();
  return (
    <>
      <div className="handoff" style={{ ["--c" as string]: person.color }}>
        <span className="dot" style={{ background: person.color, width: 20, height: 20 }} />
        <span className="lbl">{t.whoStarts.starts}</span>
        <h2>{person.name}</h2>
      </div>
      <span className="grow" />
      <button type="button" className="btn pri" onClick={onContinue}>
        {t.whoStarts.startGame}
      </button>
    </>
  );
}

/* ---------- Fingers on the screen ---------- */

const FINGER_COLORS = [
  "#f4b942",
  "#4cc9f0",
  "#f27aa7",
  "#7fdc97",
  "#c3a6ff",
  "#ff9f68",
  "#5ee0d0",
  "#e4e4e4",
  "#ffd1dc",
  "#9ad1ff",
];

function Fingers({ people, onPick }: Props) {
  const t = useT();
  const area = useRef<HTMLDivElement>(null);
  const [fingers, setFingers] = useState<Record<number, { x: number; y: number; color: string }>>({});
  const [countdown, setCountdown] = useState<number | null>(null);
  const [winner, setWinner] = useState<number | null>(null);
  const nextColor = useRef(0);
  const fingersRef = useRef(fingers);
  fingersRef.current = fingers;
  const n = Object.keys(fingers).length;

  // With 2+ fingers held still: wait, count down 3-2-1 and pick one.
  useEffect(() => {
    if (winner !== null) return;
    setCountdown(null);
    if (n < 2) return;
    let c = 3;
    let interval: number | undefined;
    const wait = window.setTimeout(() => {
      setCountdown(c);
      effects.tic();
      interval = window.setInterval(() => {
        c--;
        if (c > 0) {
          setCountdown(c);
          effects.tic();
        } else {
          window.clearInterval(interval);
          setCountdown(null);
          const ids = Object.keys(fingersRef.current).map(Number);
          setWinner(ids[Math.floor(Math.random() * ids.length)]);
          effects.winner();
        }
      }, 700);
    }, 1200);
    return () => {
      window.clearTimeout(wait);
      window.clearInterval(interval);
    };
  }, [n, winner]);

  const pos = (e: React.PointerEvent) => {
    const r = area.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  };
  const isMouse = (e: React.PointerEvent) => e.pointerType === "mouse";

  const onDown = (e: React.PointerEvent) => {
    if (winner !== null) return;
    e.preventDefault();
    const id = isMouse(e) ? Date.now() : e.pointerId;
    if (!isMouse(e)) {
      try {
        area.current?.setPointerCapture(e.pointerId);
      } catch {
        /* capture not available */
      }
    }
    const color = FINGER_COLORS[nextColor.current++ % FINGER_COLORS.length];
    setFingers((d) => ({ ...d, [id]: { ...pos(e), color } }));
    effects.tap();
  };
  const move = (e: React.PointerEvent) => {
    if (winner !== null || isMouse(e)) return;
    setFingers((d) => (d[e.pointerId] ? { ...d, [e.pointerId]: { ...d[e.pointerId], ...pos(e) } } : d));
  };
  const onUp = (e: React.PointerEvent) => {
    if (winner !== null || isMouse(e)) return;
    setFingers((d) => {
      const { [e.pointerId]: _removed, ...rest } = d;
      return rest;
    });
  };
  const reset = () => {
    setFingers({});
    setWinner(null);
  };

  const message =
    winner !== null
      ? t.whoStarts.fingersPicked
      : n === 0
        ? t.whoStarts.fingersPlace
        : n === 1
          ? t.whoStarts.fingersOneMore
          : countdown === null
            ? t.whoStarts.fingersHold
            : "";

  return (
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: multi-touch area; the other ways to pick who goes first are accessible buttons. */}
      <div
        ref={area}
        className="finger-area"
        onPointerDown={onDown}
        onPointerMove={move}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        {countdown !== null && <div className="countdown">{countdown}</div>}
        {Object.entries(fingers).map(([id, d]) => (
          <span
            key={id}
            className={`finger ${winner === null ? "" : Number(id) === winner ? "wins" : "loses"}`}
            style={{ left: d.x, top: d.y, color: d.color }}
          />
        ))}
        <div className="msg">{message}</div>
      </div>
      {winner !== null ? (
        <div className="column center">
          <b>{t.whoStarts.whoseFinger}</b>
          <div className="chips" style={{ justifyContent: "center" }}>
            {people.map((p, i) => (
              <button type="button" key={p.id} className="chip" onClick={() => onPick(i)}>
                <span className="dot" style={{ background: p.color }} />
                {p.name}
              </button>
            ))}
          </div>
          <button type="button" className="link" onClick={reset}>
            {t.whoStarts.again}
          </button>
        </div>
      ) : (
        <p className="dim center" style={{ margin: 0, textAlign: "center", fontSize: 14 }}>
          {t.whoStarts.fingersHint}
        </p>
      )}
    </>
  );
}

/* ---------- Spinner ---------- */

function Spinner({ people, onPick }: Props) {
  const t = useT();
  const [rotation, setRotation] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(false);
  const segment = 360 / people.length;
  const bg = `conic-gradient(${people.map((p, i) => `${p.color} ${i * segment}deg ${(i + 1) * segment}deg`).join(",")})`;

  const spin = () => {
    if (spinning) return;
    const i = Math.floor(Math.random() * people.length);
    const jitter = (Math.random() - 0.5) * segment * 0.7;
    const current = rotation - (rotation % 360);
    setRotation(current + 360 * 6 - (i + 0.5) * segment + jitter);
    setSpinning(true);
    setPicked(null);
    // Ticks that slow down as the wheel stops
    let t = 0;
    let step = 40;
    while (t < 3800) {
      window.setTimeout(() => effects.tic(), t);
      t += step;
      step *= 1.09;
    }
    window.setTimeout(() => {
      setSpinning(false);
      setPicked(i);
      effects.winner();
    }, 4200);
  };

  useShake(readSettings().shake && !spinning && picked === null, () => {}, spin);

  return (
    <>
      <span className="grow" />
      <div className="spinner-box">
        <div className="spinner-pointer" />
        <div
          className="spinner"
          style={{
            background: bg,
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? "transform 4.2s cubic-bezier(.12,.8,.2,1)" : "none",
          }}
        />
        <div className="spinner-center">{picked !== null ? people[picked].name : "?"}</div>
      </div>
      <div className="chips" style={{ justifyContent: "center" }}>
        {people.map((p) => (
          <span key={p.id} className="chip" style={{ background: p.color, color: "#14182a", cursor: "default" }}>
            {p.name}
          </span>
        ))}
      </div>
      <span className="grow" />
      {picked !== null ? (
        <div className="column">
          <button type="button" className="btn pri" onClick={() => onPick(picked)}>
            {t.whoStarts.startsName(people[picked].name)}
          </button>
          <button type="button" className="btn outlined" onClick={spin}>
            {t.whoStarts.spinAgain}
          </button>
        </div>
      ) : (
        <button type="button" className="btn pri" onClick={spin} disabled={spinning}>
          {spinning ? t.whoStarts.spinning : t.whoStarts.spin}
        </button>
      )}
    </>
  );
}

/* ---------- Dice duel ---------- */

function Duel({ people, onPick }: Props) {
  const t = useT();
  const [contenders, setContenders] = useState<number[]>(people.map((_, i) => i));
  const [rolls, setRolls] = useState<Record<number, number>>({});
  const [rolling, setRolling] = useState(false);
  const [tie, setTie] = useState<string | null>(null);
  const pending = contenders.filter((i) => rolls[i] === undefined);
  const turn = pending[0];
  const done = pending.length === 0;
  const max = Math.max(...contenders.map((i) => rolls[i] ?? 0));
  const winners = done ? contenders.filter((i) => rolls[i] === max) : [];

  const roll = () => {
    if (rolling || turn === undefined) return;
    setRolling(true);
    effects.land(1);
    window.setTimeout(() => {
      setRolls((t) => ({ ...t, [turn]: 1 + Math.floor(Math.random() * 6) }));
      setRolling(false);
    }, 600);
  };

  const breakTie = () => {
    setTie(t.join(winners.map((i) => people[i].name)));
    setContenders(winners);
    setRolls({});
  };

  useShake(readSettings().shake && !rolling && !done, () => {}, roll);

  return (
    <>
      <h1 className="title">{t.whoStarts.duelTitle}</h1>
      <p className="dim" style={{ margin: 0 }}>
        {t.whoStarts.duelIntro}
      </p>
      <div className="column duel">
        {people.map((p, i) => {
          const out = !contenders.includes(i);
          return (
            <div
              key={p.id}
              className="person"
              style={{ opacity: out ? 0.35 : 1, outline: i === turn ? `2px solid ${p.color}` : "none" }}
            >
              <span className="dot" style={{ background: p.color }} />
              <span className="name">{p.name}</span>
              {i === turn && rolling ? (
                <Die face={1 + Math.floor(Math.random() * 6)} size={34} state="rolling" />
              ) : rolls[i] !== undefined ? (
                <Die face={rolls[i]} size={34} state={winners.includes(i) ? "scoring" : "normal"} />
              ) : (
                <span className="dim" style={{ fontSize: 13 }}>
                  {out ? "" : "…"}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {tie && !done && (
        <div className="notice center" style={{ textAlign: "center" }}>
          <b style={{ color: "var(--gold)" }}>{t.whoStarts.tieBetween(tie)}</b>
          <div className="dim">{t.whoStarts.tieRoll}</div>
        </div>
      )}
      <span className="grow" />
      {!done && (
        <button type="button" className="btn pri" onClick={roll} disabled={rolling}>
          {t.whoStarts.rollYourDie(people[turn].name, readSettings().shake)}
        </button>
      )}
      {done && winners.length > 1 && (
        <button type="button" className="btn pri" onClick={breakTie}>
          {t.whoStarts.tieBreak(t.join(winners.map((i) => people[i].name)))}
        </button>
      )}
      {done && winners.length === 1 && (
        <button type="button" className="btn pri" onClick={() => onPick(winners[0])}>
          {t.whoStarts.startsName(people[winners[0]].name)}
        </button>
      )}
    </>
  );
}

/* ---------- Random ---------- */

function RandomPick({ people, onPick }: Props) {
  const [picked] = useState(() => Math.floor(Math.random() * people.length));
  useEffect(() => effects.winner(), []);
  return <Result person={people[picked]} onContinue={() => onPick(picked)} />;
}
