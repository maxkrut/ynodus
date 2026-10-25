import { escapeHtml } from "../shared/html";
import type { SignatureRow } from "../shared/types";
import type { TextKey } from "./i18n";
import type { WorkerClient } from "./worker-client";
import { SIGNATURE_OPTIONS_DEBOUNCE_MS } from "./constants";

type ProfileLookupOptions = {
  root: HTMLElement;
  workerClient: WorkerClient;
  t: (key: TextKey) => string;
  ready: () => boolean;
  loadFailed?: () => boolean;
  active: () => boolean;
  profileId: () => string | undefined;
  loadProfile: (id: string) => Promise<boolean>;
};

/** The lookup has its own draft and suggestions; it never changes the time query. */
export function createProfileLookup(options: ProfileLookupOptions): {
  render: () => void; beginProfileLoad: () => number; hasNewDraft: (revision: number) => boolean;
} {
  const { root, t } = options;
  const form = root.querySelector?.<HTMLFormElement>("#profile-lookup");
  const input = form?.querySelector<HTMLInputElement>("input");
  const status = form?.querySelector<HTMLElement>("#profile-lookup-status");
  const list = form?.querySelector<HTMLElement>("#profile-lookup-options");
  if (!form || !input || !status || !list) return { render() {}, beginProfileLoad: () => 0, hasNewDraft: () => false };
  let token = 0;
  let timer: number | undefined;
  let shownProfile: string | undefined;
  let rows: SignatureRow[] = [];
  let message: TextKey | null = null;
  let invalid = false;
  let deferred: { query: string; submit: boolean } | undefined;
  let revision = 0;
  let loadRevision = 0;

  function cancel(): void {
    token += 1;
    deferred = undefined;
    window.clearTimeout(timer);
    timer = undefined;
  }

  function clear(): void {
    cancel();
    rows = [];
    message = null;
    invalid = false;
  }

  function paint(): void {
    const focused = list!.querySelector<HTMLButtonElement>(":focus")?.dataset.profileOption;
    status!.textContent = message ? t(message) : "";
    input!.setAttribute("aria-invalid", String(invalid));
    list!.hidden = rows.length === 0;
    list!.setAttribute("aria-label", t("profileLookupChoices"));
    list!.innerHTML = rows.map(({ node }) => `<button type="button" data-profile-option="${escapeHtml(node.id)}">${escapeHtml(node.id)}</button>`).join("");
    if (focused) [...list!.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.dataset.profileOption === focused)?.focus();
  }

  function current(request: number, query: string): boolean {
    return request === token && options.active() && input!.value.trim() === query;
  }

  async function search(submit: boolean): Promise<void> {
    cancel();
    const query = input!.value.trim();
    const request = token;
    rows = [];
    invalid = false;
    if (!query) { message = null; paint(); return; }
    message = options.ready() ? "profileLookupLoading" : options.loadFailed?.() ? "profileLookupIndexFailed" : "profileLookupWait";
    paint();
    if (!options.ready()) { deferred = { query, submit }; return; }
    try {
      const response = await options.workerClient.request({ type: "signatureOptions", query });
      if (!current(request, query)) return;
      if (response.type !== "signatureOptions") throw new Error("Unexpected worker response.");
      const exact = response.options.find(({ node }) => node.id.toUpperCase() === query.toUpperCase());
      if (submit && exact) {
        clear();
        paint();
        await options.loadProfile(exact.node.id);
        return;
      }
      rows = response.options.slice(0, 8);
      message = rows.length ? "profileLookupChoices" : "profileLookupMissing";
      invalid = submit && rows.length === 0;
      paint();
      if (submit && invalid) input!.focus();
    } catch {
      if (!current(request, query)) return;
      message = "profileLookupFailed";
      paint();
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void search(true);
  });
  input.addEventListener("input", () => {
    revision += 1;
    clear();
    paint();
    if (!input.value.trim() || input.matches(":disabled")) return;
    timer = window.setTimeout(() => void search(false), SIGNATURE_OPTIONS_DEBOUNCE_MS);
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" && rows.length) {
      event.preventDefault();
      list.querySelector<HTMLButtonElement>("button")?.focus();
    }
  });
  form.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { clear(); paint(); input.focus(); }
  });
  list.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const buttons = [...list.querySelectorAll<HTMLButtonElement>("button")];
    const index = buttons.indexOf(event.target as HTMLButtonElement);
    if (index < 0) return;
    event.preventDefault();
    const next = index + (event.key === "ArrowDown" ? 1 : -1);
    if (next < 0) input.focus();
    else buttons[Math.min(next, buttons.length - 1)]?.focus();
  });
  list.addEventListener("click", (event) => {
    const id = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-profile-option]")?.dataset.profileOption;
    if (!id) return;
    void options.loadProfile(id);
    clear();
    paint();
  });

  return {
    beginProfileLoad: () => { loadRevision = revision; return revision; },
    hasNewDraft: previous => revision !== previous,
    render(): void {
      const id = options.profileId();
      if (id !== shownProfile) {
        shownProfile = id;
        if (revision === loadRevision || !options.active()) {
          input.value = id ?? "";
          clear();
        }
      }
      if (!options.active()) clear();
      if (deferred && options.ready() && input.value.trim() === deferred.query) {
        void search(deferred.submit);
      } else if (deferred && options.loadFailed?.()) message = "profileLookupIndexFailed";
      const title = root.querySelector<HTMLElement>("#profile-workspace-title");
      const label = form.querySelector<HTMLLabelElement>("label");
      for (const [element, key] of [
        [title, id ? "subcladeProfileView" : "profileQuestion"],
        [label, id ? "profileFindAnother" : "signatureSubclade"],
      ] as const) {
        if (!element) continue;
        element.dataset.i18n = key;
        element.textContent = t(key);
      }
      paint();
    },
  };
}
