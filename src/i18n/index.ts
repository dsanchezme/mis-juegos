import { useEffect } from "react";
import { readSettings, useSettings } from "../engine/hub";
import { en } from "./en";
import { es, type Texts } from "./es";

import type { Language } from "./language";

export { defaultLanguage, type Language } from "./language";
export const LANGUAGES: { id: Language; label: string }[] = [
  { id: "es", label: "Español" },
  { id: "en", label: "English" },
];

const TEXTS: Record<Language, Texts> = { es, en };

/** Texts for the current language. Re-renders when the language changes. */
export function useT(): Texts {
  const [settings] = useSettings();
  const t = TEXTS[settings.language] ?? es;
  useEffect(() => {
    document.documentElement.lang = settings.language;
  }, [settings.language]);
  return t;
}

/** Texts for the current language, outside React components. */
export const currentTexts = (): Texts => TEXTS[readSettings().language] ?? es;

/** Formats a number using the current language (5.000 in Spanish, 5,000 in English). */
export const fmt = (n: number) => n.toLocaleString(currentTexts().locale);
