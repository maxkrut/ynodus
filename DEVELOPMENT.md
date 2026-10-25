# Development

## Architecture

Static Vite/TypeScript application; no backend, database, authentication or RBAC.
The browser reads one generated index and performs heavy work in a Web Worker.

| Location | Responsibility |
|---|---|
| `src/app/` | Controls, locale, query/research state, navigation, pending lifecycle and export |
| `src/worker/` | Index hydration, evidence, Formed/Crossing, profiles, country unions and bounded caches |
| `src/results/` | Sorting and table presentation |
| `src/presets/` | Country-code lists and EN/RU reference guides |
| `src/styles/app.css` | Ordered production stylesheet manifest |
| `scripts/` | Canonical data generation, source checks and test contracts |
| `tests/e2e/` | Synthetic browser regression scenarios |

[PRODUCT.md](PRODUCT.md) owns behavior. Types live in `src/shared/types.ts`.
Preserve unrelated uncommitted work. Keep maintained TS/JS/CSS/HTML files within
400 lines.

## Validation

```sh
npm test                         # size, i18n/export usage, app, semantics, data contracts
npm run build                   # type checking and production bundle
npx playwright install chromium # once, when the browser runtime is missing
npm run test:e2e                 # after build; Playwright owns its preview by default
npm run test:pages               # strict static hosting at / and /ynodus/
```

Use the smallest relevant ladder; reuse GREEN evidence while its inputs remain
unchanged. `test:app`, `test:i18n`, `test:exports`, `test:size`, `test:semantics` and
`test:data-check` can run individually. `test:semantics:exhaustive` expands the
default 132 preset/mode/presence cases across dates/windows. `test:ui-contrast`
checks named control text states, not whole-app accessibility certification.
The build uses TypeScript 7; AST-based tooling uses the existing official
`@typescript/typescript6` compatibility dependency.

For UI changes, inspect synthetic EN/RU screenshots plus relevant keyboard,
loading/error, narrow/wide and boundary-width states. Keep actual measurements
separate from human reading and browser emulation separate from physical-device
claims. Store generated captures/logs in ignored `output/` or `test-results/`, not
new dated documentation folders. Report checks in the task/PR; maintain this
documentation only when stable behavior or workflow changes.

Managed test servers require an exact command ID, recorded listener PID, port and
HTTP verification within 15 seconds, `finally` cleanup and confirmed closed port.
Never use a detached launcher. For an already managed/verified preview on the E2E URL, set
`YNODUS_TEST_EXTERNAL_SERVER=1`; the caller owns cleanup. Otherwise Playwright owns
its preview. Do not kill unrelated processes or reuse an unknown listener.

## Data generation

The runtime artifact is `public/data/hras-index.json`, format `ynodus/hras-index-v3`.
Never hand-edit it or generated `dist/` and `tsconfig.tsbuildinfo`.

```sh
npm run data:check
npm run data
npm run data -- --source-lock public/data/hras-index.json
npm run data -- --migrate-format
```

- `data:check` checks upstream metadata without rebuilding.
- `data` rebuilds from HRAS public manifest/haplogroup text endpoints and YFull's
  reference tree/version marker, not scraped HTML. Pin the reference to one commit.
  Required HRAS version/date/count and reference markers must be known and valid;
  missing/degraded provenance fails closed before publication.
- `inputSnapshot` records the reference commit, URLs, sizes and SHA-256 hashes.
  Read mutable HRAS inputs twice and recheck the manifest. Changed inputs, failed
  requests, the 60-second request limit or 64 MiB per-file limit stop publication.
  Replace the validated index atomically. This detects changes during observed
  reads; it cannot prove publisher-wide atomic release consistency.
- `--source-lock` reuses a recorded reference commit and requires exact input
  hashes/bytes. Evidence/topology are reproducible only while those HRAS files
  remain available; hashes are not an archive. New build/verification timestamps
  describe the new run. A mismatch preserves the existing index.
- `--migrate-format` is a namespace-only migration of an existing version-3 index:
  change only `format`, without fetching data or claiming a new snapshot. Source
  versions, timestamps, provenance, hierarchy and sample counts remain unchanged.
- `merge.formed` separates selected reference/HRAS values into known positive
  ages and unknown values; `missing` means neither source supplied a value and
  is included in the overall `unknown` count. `comparison` covers shared nodes,
  including unknown reference ages with known HRAS ages and those left unknown
  after merging. These counters replace `referenceTimingUsed`/`hrasTimingFallback`.
  Selection remains reference-first for non-null values: zero stays unknown;
  null/missing values permit HRAS fallback. The counters never change that rule.

Ancient membership is read during generation, then reduced to aggregate counts.
Only country-coded HRAS/YSEQ records are country evidence. Never store names,
kit/sample identifiers, individual profiles or private results in the runtime
artifact, fixtures, logs or screenshots. Keep synthetic identifiers in tests.
`ageProvenance` records unknown source epochs and the conditional application
calendar convention; source YBP remains intact. Source versions are independent,
not a synchronization verdict. Preserve the attribution in [NOTICE.md](NOTICE.md)
and the matching shipped `public/legal/NOTICE.txt`.

After schema/content changes, run app and semantic/data contracts plus build and
affected consumers. `.github/workflows/update-data.yml` performs weekly checks and
opens/updates a PR on `automation/update-hras-index`; it does not publish directly
to the default branch. `.github/workflows/build.yml` validates pushes and pull requests.

## GitHub Pages

Publish through the **Build and Pages** workflow, not by committing `dist/`.
Select **Settings > Pages > Build and deployment > Source > GitHub Actions**,
then create the Actions repository variable `ENABLE_PAGES=true`. A push to the
default branch (`main` or `master`), or a manual run on that branch, deploys only
after both minimum-Node builds, contracts and browser checks pass. Pull requests
and repositories without that variable only validate. The deployment job alone
receives Pages and OIDC write permissions; no personal access token is required.

Manual runs can select `layout` to diagnose the compact table, source ledger and
epoch labels on the Linux runner. This mode never publishes; `full` remains the
default and the publication gate. Failed browser checks retain diagnostic traces
as a workflow artifact for seven days.

Vite's `base: "./"` keeps assets relative to the built page. Navigation uses query
parameters, so direct result/profile/country links stay on `index.html` and do not
require a server-side SPA fallback. The same artifact supports a domain root or a
repository path such as `/ynodus/`; keep the trailing slash on the site's base URL.

After `npm run build`, `npm run test:pages` serves `dist/` with strict file lookup
at both paths and checks actual data, Worker/assets, EN/RU, result details, country
summaries, downloads and reloads. It owns a loopback listener on port 4181, verifies
HTTP readiness and closes the browser and listener in `finally`. Synthetic UI
captures are written to ignored `output/pages/`.

The shipped data snapshot is deployed as built. The separate data-update workflow
opens a reviewed PR; it does not fetch upstream data during visitors' sessions or
automatically merge new data. To publish a previous version, revert the change on
the default branch and let the same checks and deployment run again.

## Compatibility and documentation

`locale-preference.ts` stores only explicit switcher choices in localStorage as
`ynodus-locale`. At startup, a valid saved choice overrides URL `lang`; otherwise
the URL or English default applies. Storage reads/writes fail safely. Language
selection makes no external requests; history keeps the active language.

Public URL parameters remain stable and contain public query/research settings,
not result payloads or sample identities. `history-state.ts` migrates one
unambiguous valid version-1 navigation envelope to `ynodus*`, preserving owner,
origin, country/detail scope and supported presentation state. Current fields take
precedence; ambiguous envelopes fail closed. Retired tree/matrix fields are ignored
without losing active country filters, expansion, search, selected node or scroll.

Keep three main technical guides: README for orientation, PRODUCT for normative
behavior and this file for engineering procedures. Keep submission rules in
[CONTRIBUTING.md](CONTRIBUTING.md) and the [PR template](.github/pull_request_template.md),
alongside required legal notices. Write maintained
documentation in English; the application remains localized in English and Russian.
Avoid copied type schemas,
per-task handoff files and historical audit reports that can contradict current
behavior. Link to actual source/tests for implementation details.
