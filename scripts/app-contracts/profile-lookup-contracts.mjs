import assert from "node:assert/strict";
import { fakeEventTarget, signatureRow } from "./fixtures.mjs";

export function assertExactProfileLookupPriority(signatureOptionsForQuery) {
  const rows = Array.from({ length: 12 }, (_, i) => signatureRow(`R-TEST${i}`, 20));
  const exact = signatureRow("R-TEST", 1);
  rows.push(exact);
  const result = signatureOptionsForQuery({ signatureRows: rows }, "r-test");
  assert.equal(result[0], exact, "exact identifiers outrank the eight-item prefix cap regardless of sample count");
  assert.equal(result.length, 8);
  assert.equal(new Set(result.map(row => row.node.id)).size, 8);
}

export async function assertProfileLookupContract(createProfileLookup) {
  const oldWindow = globalThis.window;
  const scheduled = new Map();
  let timerId = 0;
  globalThis.window = {
    setTimeout(callback) { scheduled.set(++timerId, callback); return timerId; },
    clearTimeout(id) { scheduled.delete(id); },
  };
  const node = () => ({ ...fakeEventTarget(), textContent: "", innerHTML: "", attrs: {},
    setAttribute(key, value) { this.attrs[key] = value; },
    querySelector: () => null, querySelectorAll: () => [],
  });
  const input = { ...node(), value: "", matches: () => false };
  const status = node();
  const list = node();
  const title = node();
  const label = node();
  const form = node();
  form.querySelector = (selector) => ({ input, label,
    "#profile-lookup-status": status, "#profile-lookup-options": list,
  })[selector];
  const root = { querySelector: (selector) => selector === "#profile-lookup" ? form : title };
  let profileId = "R-ROOT";
  let active = true;
  let ready = true;
  let language = "ru";
  const requests = [];
  const opened = [];
  const flush = async () => { for (let i = 0; i < 6; i += 1) await Promise.resolve(); };
  const respond = (request, ids) => request.resolve({ type: "signatureOptions", options: ids.map((id) => signatureRow(id, 1)) });
  try {
    const lookup = createProfileLookup({ root, ready: () => ready, active: () => active,
      profileId: () => profileId, t: (key) => `${language}:${key}`,
      workerClient: { request(message) {
        return new Promise((resolve, reject) => requests.push({ message, resolve, reject }));
      } },
      async loadProfile(id) { opened.push(id); profileId = id; return true; },
    });
    lookup.render();
    assert.equal(input.value, "R-ROOT");
    assert.equal(title.textContent, "ru:subcladeProfileView");
    assert.equal(label.textContent, "ru:profileFindAnother");

    input.value = "  r-child  ";
    form.dispatch("submit");
    assert.deepEqual(requests.at(-1).message, { type: "signatureOptions", query: "r-child" });
    respond(requests.at(-1), ["R-CHILD", "R-CHILD2"]);
    await flush();
    assert.deepEqual(opened, ["R-CHILD"], "case-insensitive exact input opens the canonical identifier");
    lookup.render();
    assert.equal(input.value, "R-CHILD");

    input.value = "R-";
    form.dispatch("submit");
    respond(requests.at(-1), ["R-ROOT", "R-CHILD"]);
    await flush();
    assert.equal(opened.length, 1, "ambiguous input must not silently choose a profile");
    assert.match(list.innerHTML, /R-ROOT/);
    assert.equal(status.textContent, "ru:profileLookupChoices");

    input.value = "NOT-IN-INDEX";
    form.dispatch("submit");
    respond(requests.at(-1), []);
    await flush();
    assert.equal(status.textContent, "ru:profileLookupMissing");
    assert.equal(input.attrs["aria-invalid"], "true");
    assert.equal(profileId, "R-CHILD", "unknown input must preserve the open profile");
    language = "en";
    lookup.render();
    assert.equal(status.textContent, "en:profileLookupMissing");
    assert.equal(input.value, "NOT-IN-INDEX", "locale changes preserve the input draft");

    input.value = "R-OLD";
    form.dispatch("submit");
    const old = requests.at(-1);
    input.value = "R-NEW";
    form.dispatch("submit");
    const latest = requests.at(-1);
    respond(latest, ["R-NEW"]);
    await flush();
    respond(old, ["R-OLD"]);
    await flush();
    assert.equal(profileId, "R-NEW", "late completion must not navigate to the previous input");

    input.value = "R-AWAY";
    form.dispatch("submit");
    const away = requests.at(-1);
    active = false;
    lookup.render();
    respond(away, ["R-AWAY"]);
    await flush();
    assert.equal(profileId, "R-NEW", "leaving the workspace invalidates pending lookup navigation");

    active = true;
    input.value = "R-";
    input.dispatch("input");
    assert.equal(scheduled.size, 1);
    form.dispatch("keydown", { key: "Escape" });
    assert.equal(scheduled.size, 0, "Escape cancels queued suggestions");
    assert.equal(list.hidden, true);

    ready = false;
    const count = requests.length;
    form.dispatch("submit");
    assert.equal(requests.length, count, "unloaded index must not receive a search request");
    assert.equal(status.textContent, "en:profileLookupWait");
    ready = true;
    lookup.render();
    assert.equal(requests.length, count + 1, "ready notification resumes the submitted lookup exactly once");
    lookup.render();
    assert.equal(requests.length, count + 1);
    requests.at(-1).reject(new Error("synthetic failure"));
    await flush();
    assert.equal(status.textContent, "en:profileLookupFailed");
    assert.equal(profileId, "R-NEW");
  } finally { globalThis.window = oldWindow; }
}
