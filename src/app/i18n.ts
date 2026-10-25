import type { Locale, LocalizedText } from "../shared/types";
import { en, type TextKey } from "./i18n/en";
import { ru } from "./i18n/ru";

const TEXT = { en, ru } satisfies Record<Locale, Record<TextKey, string>>;

export type { TextKey } from "./i18n/en";

export function translate(locale: Locale, key: TextKey): string {
  return TEXT[locale][key] ?? TEXT.en[key];
}

export function localizedText(value: LocalizedText, locale: Locale): string {
  if (typeof value === "string") return value;
  return value[locale] ?? value.en;
}
