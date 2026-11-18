export type Language = "es" | "en";

/** Language to use when the player has not chosen one: the device language, if supported. */
export function defaultLanguage(): Language {
  const lang = typeof navigator !== "undefined" ? navigator.language.toLowerCase() : "es";
  return lang.startsWith("es") ? "es" : "en";
}
