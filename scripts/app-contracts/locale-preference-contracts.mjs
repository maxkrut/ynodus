import assert from "node:assert/strict";
import { loadModule } from "./runtime.mjs";

export async function assertLocalePreferences() {
  const { readLocalePreference, saveLocalePreference } = await loadModule("app/locale-preference.ts");
  const { bindLocaleEvents } = await loadModule("app/core-events.ts");
  const { createWorkspaceUrl } = await loadModule("app/workspace-url.ts");
  const { createInitialState } = await loadModule("app/state.ts");
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const previousLocation = Object.getOwnPropertyDescriptor(globalThis, "location");
  const values = new Map();
  try {
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
      getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value),
    } });
    assert.equal(readLocalePreference(), null);
    for (const invalid of ["", "fr", "RU", "null"]) {
      values.set("ynodus-locale", invalid);
      assert.equal(readLocalePreference(), null);
    }
    values.clear();
    assert.equal(createInitialState().locale, "en");
    for (const locale of ["ru", "en"]) {
      saveLocalePreference(locale);
      assert.equal(readLocalePreference(), locale);
      Object.defineProperty(globalThis, "location", { configurable: true, value: new URL(`https://example.test/?lang=${locale === "ru" ? "en" : "ru"}`) });
      const state = createInitialState();
      createWorkspaceUrl(state, readLocalePreference() ?? undefined);
      assert.equal(state.locale, locale, "a saved manual choice takes precedence over a stale link language");
    }
    let changed;
    const state = { locale: "en" }, switcher = { value: "ru", addEventListener: (_type, listener) => { changed = listener; } };
    let rendered = 0;
    bindLocaleEvents({ state, elements: { localeSwitcher: switcher }, applyLocale: () => rendered++ });
    changed();
    assert.equal(state.locale, "ru"); assert.equal(readLocalePreference(), "ru"); assert.equal(rendered, 1);
    switcher.value = "fr"; changed(); assert.equal(rendered, 1);
    Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("Storage unavailable"); } });
    assert.equal(readLocalePreference(), null);
    assert.doesNotThrow(() => saveLocalePreference("en"));
    switcher.value = "en"; changed(); assert.equal(state.locale, "en"); assert.equal(rendered, 2);
  } finally {
    if (previousStorage) Object.defineProperty(globalThis, "localStorage", previousStorage); else delete globalThis.localStorage;
    if (previousLocation) Object.defineProperty(globalThis, "location", previousLocation); else delete globalThis.location;
  }
}
