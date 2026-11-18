import { useState } from "react";
import { type StarterMode, useSettings } from "../engine/hub";
import { write } from "../engine/storage";
import { LANGUAGES, useT } from "../i18n";
import type { Texts } from "../i18n/es";
import { needsMotionPermission, requestMotionPermission, shakeAvailable } from "../ui/shake";

export const STARTER_MODES: StarterMode[] = ["fingers", "spinner", "duel", "random", "list"];

export const starterName = (t: Texts, m: StarterMode): string =>
  ({
    fingers: t.starters.fingers,
    spinner: t.starters.spinner,
    duel: t.starters.duel,
    random: t.starters.random,
    list: t.starters.list,
  })[m];

export function Toggle(props: {
  id: string;
  title: string;
  detail?: string;
  value: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <label className="toggle" htmlFor={props.id}>
      <span className="t">
        <b>{props.title}</b>
        {props.detail && <small>{props.detail}</small>}
      </span>
      <input
        id={props.id}
        type="checkbox"
        role="switch"
        aria-checked={props.value}
        checked={props.value}
        onChange={(e) => props.onToggle(e.target.checked)}
      />
    </label>
  );
}

/** Sound, vibration and shake toggles. Also shown in the in-game pause menu. */
export function EffectSettings() {
  const t = useT();
  const [a, setA] = useSettings();
  const canVibrate = typeof navigator !== "undefined" && "vibrate" in navigator;
  return (
    <div className="column">
      <Toggle id="aj-sound" title={t.settings.sound} value={a.sound} onToggle={(v) => setA({ ...a, sound: v })} />
      <Toggle
        id="aj-vibration"
        title={t.settings.vibration}
        detail={canVibrate ? undefined : t.settings.noVibration}
        value={a.vibration}
        onToggle={(v) => setA({ ...a, vibration: v })}
      />
      <Toggle
        id="aj-shake"
        title={t.settings.shake}
        detail={shakeAvailable() ? t.settings.shakeHint : t.settings.noShake}
        value={a.shake}
        onToggle={async (v) => {
          if (v && needsMotionPermission() && !(await requestMotionPermission())) return;
          setA({ ...a, shake: v });
        }}
      />
    </div>
  );
}

export function Settings() {
  const t = useT();
  const [a, setA] = useSettings();
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <h1 className="title">{t.settings.title}</h1>
      <span className="lbl">{t.settings.language}</span>
      <div className="chips">
        {LANGUAGES.map((l) => (
          <button
            type="button"
            key={l.id}
            className={`chip ${a.language === l.id ? "on" : ""}`}
            onClick={() => setA({ ...a, language: l.id })}
            lang={l.id}
          >
            {l.label}
          </button>
        ))}
      </div>
      <EffectSettings />
      <span className="lbl">{t.settings.defaultStarter}</span>
      <div className="chips">
        {STARTER_MODES.map((m) => (
          <button
            type="button"
            key={m}
            className={`chip ${a.starterMode === m ? "on" : ""}`}
            onClick={() => setA({ ...a, starterMode: m })}
          >
            {starterName(t, m)}
          </button>
        ))}
      </div>
      <span className="grow" />
      {confirming ? (
        <div className="card column">
          <b>{t.settings.clearConfirm}</b>
          <span className="dim" style={{ fontSize: 14 }}>
            {t.settings.clearDetail}
          </span>
          <div className="row">
            <button type="button" className="btn outlined small grow" onClick={() => setConfirming(false)}>
              {t.common.cancel}
            </button>
            <button
              type="button"
              className="btn danger small grow"
              onClick={() => {
                write("history", []);
                setConfirming(false);
              }}
            >
              {t.settings.clear}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn danger-outlined small" onClick={() => setConfirming(true)}>
          {t.settings.clearHistory}
        </button>
      )}
      <p className="dim" style={{ fontSize: 12, margin: 0, textAlign: "center" }}>
        {t.settings.localOnly}
      </p>
    </>
  );
}
