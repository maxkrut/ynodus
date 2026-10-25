# yNodus

A static browser application for exploring aggregate Y-DNA evidence from a local
HRAS/YSEQ snapshot with an independent YFull reference-tree marker. Analysis runs
locally in a Web Worker; there is no application backend or per-visitor upstream fetch.

- **Countries in sample records & time** finds supported Formed branches around a
  date and optionally real parent-to-child transitions spanning that date.
- **Explore a subclade** shows one branch's supported hierarchy and country matrix.
- **Explore a country** compares country-recorded evidence, including unique branches.

Country codes are sample metadata, not ancestral geography. Counts are dataset
coverage, not population frequency. Ages are source estimates; calendar labels
use an explicitly conditional convention. Names, sample identifiers and individual
results are not stored. Current full topology is available through YFull links.
The application supports English and Russian; project documentation is English.

## Run

Use Node.js `^20.19.0` or `>=22.12.0`, with npm.

```sh
npm ci
npm run dev
```

```sh
npm test
npm run build
npm run preview
```

The browser reads `public/data/hras-index.json`. Regenerate it only with the
canonical data commands; do not edit generated data by hand.

## GitHub Pages

Publication URL: [maxkrut.github.io/ynodus](https://maxkrut.github.io/ynodus/).
The **Build and Pages** workflow tests and builds the default branch, then deploys
the verified `dist/` artifact. Pull requests run checks without publishing.

For a new repository or fork, select **Settings > Pages > GitHub Actions** and set
the Actions repository variable `ENABLE_PAGES` to `true`. The relative Vite base
supports both a project path (`/ynodus/`) and a domain root. Run `npm run test:pages`
after building to check both. See [DEVELOPMENT.md](DEVELOPMENT.md#github-pages)
for publication and update details.

## Documentation

| Document | Purpose |
|---|---|
| [PRODUCT.md](PRODUCT.md) | Authoritative behavior, result semantics, UI/state invariants and acceptance criteria |
| [DEVELOPMENT.md](DEVELOPMENT.md) | Architecture, tests, data generation/provenance, compatibility and automation |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contribution and PR rules for people and agents |
| [CHANGELOG.md](CHANGELOG.md) | User-facing changes by application version |

Human and agent-assisted contributions are welcome; start with the contribution guide.

`src/` contains the application; `scripts/` and `tests/` contain its build, data
and validation tools. `public/` contains the runtime index, assets and notices.
Generated captures, logs and build output are ignored and are not source files.

## Sources and licensing

Application code: [Apache-2.0](LICENSE). The normalized data artifact has separate
source attribution and is not relicensed as original application code. See
[NOTICE.md](NOTICE.md) for HRAS/YSEQ, YFull, font and flag notices, and distribution
requirements. The app's source ledger keeps upstream links, versions and dates visible.
