import type { CountryPreset } from "../shared/types";
import { localizedText } from "./i18n";

type PresetModule = { default: CountryPreset } | CountryPreset;

const ARCHAEOLOGY_THEME_CATEGORY: CountryPreset["category"] = {
  en: "Archaeological themes",
  ru: "Археологические темы",
};

const LANGUAGE_THEME_CATEGORY: CountryPreset["category"] = {
  en: "Language themes",
  ru: "Языковые темы",
};

const COUNTRY_CODE_PROXY_KEYS = new Set([
  "anglosphere",
  "arabic",
  "celtic",
  "finnoUgric",
  "iranian",
  "slavic",
  "turkic",
]);

const PRESET_MODULES = import.meta.glob<PresetModule>("../presets/*.json", {
  eager: true,
});

function normalizePresetModule(path: string, module: PresetModule): CountryPreset {
  const preset = "default" in module ? module.default : module;
  const fallbackKey = path.split("/").pop()?.replace(/\.json$/, "") ?? path;
  const key = preset.key || fallbackKey;
  const kind = key.startsWith("arch-") || COUNTRY_CODE_PROXY_KEYS.has(key)
    ? "country-code-proxy"
    : "regional";
  return {
    key,
    label: preset.label,
    category: key.startsWith("arch-") ? ARCHAEOLOGY_THEME_CATEGORY
      : kind === "country-code-proxy" ? LANGUAGE_THEME_CATEGORY : preset.category,
    countries: [...preset.countries],
    guide: preset.guide,
    kind,
  };
}

export const COUNTRY_PRESETS = Object.entries(PRESET_MODULES)
  .map(([path, module]) => normalizePresetModule(path, module))
  .sort((a, b) => localizedText(a.category, "en").localeCompare(localizedText(b.category, "en")) || localizedText(a.label, "en").localeCompare(localizedText(b.label, "en")));

export const COUNTRY_PRESET_MAP = new Map(COUNTRY_PRESETS.map((preset) => [preset.key, preset]));
