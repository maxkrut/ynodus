import type { Locale } from "../shared/types";

const STORAGE_KEY = "ynodus-locale";
export function readLocalePreference(): Locale | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "en" || value === "ru" ? value : null;
  }
  catch { return null; } // Browser storage is optional.
}

/** Only explicit switcher choices persist; storage failure must not block switching. */
export function saveLocalePreference(locale: Locale): void {
  try { localStorage.setItem(STORAGE_KEY, locale); } catch { /* Optional preference. */ }
}
