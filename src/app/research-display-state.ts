/** An explicit selection of every in-scope country is equivalent to no local filter. */
export function activeCountryFilter(countries: readonly string[] | undefined, available: ReadonlyMap<string, number>): string[] {
  const selected = [...new Set(countries)].filter(code => available.has(code));
  return selected.length < available.size ? selected : [];
}

/** Keep drafts synchronous, but build the large matrix only after typing pauses. */
export function deferredResearchRender(render: () => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => { clearTimeout(timer); timer = undefined; };
  return { cancel, schedule: () => { cancel(); timer = setTimeout(() => { timer = undefined; render(); }, 150); } };
}

export function restoreCountrySearch(root: HTMLElement, query = ""): void {
  const input = root.querySelector<HTMLInputElement>("[data-profile-country-search]");
  if (!input) return;
  input.value = query;
  filterCountryList(root, query);
}

export function filterCountryList(root: HTMLElement, value: string): void {
  const query = value.trim().toLocaleLowerCase();
  const rows = [...root.querySelectorAll<HTMLElement>("[data-country-search-text]")];
  const exactCode = rows.some(row => row.dataset.countrySearchText?.split(" ")[0] === query);
  rows.forEach(row => {
    const text = row.dataset.countrySearchText ?? "";
    row.hidden = query ? !(exactCode ? text.split(" ")[0] === query : text.includes(query)) : row.dataset.countryCollapsed === "true";
  });
  const reveal = root.querySelector<HTMLElement>('[data-reveal-evidence="profile-countries"]');
  if (reveal) reveal.hidden = Boolean(query);
  const empty = root.querySelector<HTMLElement>("[data-profile-country-empty]");
  if (empty) empty.hidden = rows.some(row => !row.hidden);
}
