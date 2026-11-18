import { useEffect, useRef } from "react";

type WithPermission = typeof DeviceMotionEvent & { requestPermission?: () => Promise<"granted" | "denied"> };

export function shakeAvailable(): boolean {
  return typeof window !== "undefined" && "DeviceMotionEvent" in window && (navigator.maxTouchPoints ?? 0) > 0;
}

export function needsMotionPermission(): boolean {
  return shakeAvailable() && typeof (DeviceMotionEvent as WithPermission).requestPermission === "function";
}

/** On iPhone, motion access must be requested from a user tap. */
export async function requestMotionPermission(): Promise<boolean> {
  const D = DeviceMotionEvent as WithPermission;
  if (typeof D.requestPermission !== "function") return true;
  try {
    return (await D.requestPermission()) === "granted";
  } catch {
    return false;
  }
}

const SHAKE_THRESHOLD = 13; // change in m/s² that counts as shaking
const RELEASE_MS = 350; // time without shaking before the dice are released
const MIN_SHAKE_MS = 250; // minimum shake time to trigger a roll

/**
 * Detects the phone being shaken. Calls `onShake` while shaking
 * and `onRelease` once shaking stops.
 */
export function useShake(active: boolean, onShake: (force: number) => void, onRelease: () => void) {
  const callbacks = useRef({ onShake, onRelease });
  callbacks.current = { onShake, onRelease };

  useEffect(() => {
    if (!active || !shakeAvailable()) return;
    let previous: { x: number; y: number; z: number } | null = null;
    let startedAt = 0;
    let last = 0;
    let timer: number | undefined;

    const handleMotion = (ev: DeviceMotionEvent) => {
      const a = ev.accelerationIncludingGravity;
      if (!a || a.x == null || a.y == null || a.z == null) return;
      const current = { x: a.x, y: a.y, z: a.z };
      if (previous) {
        const delta = Math.hypot(current.x - previous.x, current.y - previous.y, current.z - previous.z);
        const now = performance.now();
        if (delta > SHAKE_THRESHOLD) {
          if (!startedAt) startedAt = now;
          last = now;
          callbacks.current.onShake(Math.min(1, delta / 40));
          window.clearTimeout(timer);
          timer = window.setTimeout(() => {
            if (last - startedAt >= MIN_SHAKE_MS) callbacks.current.onRelease();
            startedAt = 0;
          }, RELEASE_MS);
        }
      }
      previous = current;
    };
    window.addEventListener("devicemotion", handleMotion);
    return () => {
      window.removeEventListener("devicemotion", handleMotion);
      window.clearTimeout(timer);
    };
  }, [active]);
}
