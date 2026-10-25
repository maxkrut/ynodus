# Notices

yNodus

Copyright 2026 Maksim Krutikov

The application source code in this repository is licensed under the
Apache License, Version 2.0. See `LICENSE`.

## Generated Data Index

`public/data/hras-index.json` is a generated, normalized data artifact.
It is not original application code and is not relicensed as Apache-2.0.

The generated index is built from public HRAS/reference-tree data sources
and from the official reference tree version marker. The generator
normalizes fields into a static application index, including Y-DNA nodes,
parent links, source formation-age estimates, aggregated country-coded sample counts,
and country/region codes. It does not store or expose individual sample identifiers.
It reads HRAS/YSEQ text data endpoints under `https://hras.yseq.net/data/`;
it does not scrape upstream HTML pages and the browser app does not fetch
upstream services per visitor.

Changes made by this project include filtering, normalization,
country-code mapping, path indexing, metadata correlation, and packaging
as a static JSON file for browser use.

The generated index and analysis output do not imply endorsement by
YSEQ, HRAS, or any listed upstream project.

## Upstream Sources

- HRAS/YSEQ: https://hras.yseq.net/
- HRAS data manifest: https://hras.yseq.net/data/manifest
- HRAS source repository: https://github.com/hprovyn/hras
- Reference tree source: https://www.yfull.com/tree/
- Reference tree repository: https://github.com/YFullTeam/YTree
- Reference tree license: https://github.com/YFullTeam/YTree/blob/master/LICENSE.md
- Reference tree current version marker: https://raw.githubusercontent.com/YFullTeam/YTree/master/current_version.txt

## Font Attribution

The yNodus wordmark and UI stack use the self-hosted Geologica face
shipped as `fonts/geologica-ynodus-600.woff2`. Geologica is Copyright 2020
The Geologica Project Authors
(https://github.com/monokromskriftforlag/geologisk) and is distributed under
the SIL Open Font License, Version 1.1. The complete font license is shipped
with the web assets as `fonts/Geologica-OFL.txt`.

Timeline period labels use the self-hosted Roboto Condensed 600 subset
shipped as `fonts/roboto-condensed-epochs-600.woff2`, obtained through
Google Fonts. Roboto Condensed is Copyright 2011 The Roboto Project Authors
(https://github.com/googlefonts/roboto-classic), under the SIL Open Font
License, Version 1.1. The complete license is shipped as
`fonts/RobotoCondensed-OFL.txt`. The subset covers Latin and Cyrillic labels.

## Country Flag Attribution

Country flag SVG assets are provided by `flag-icons`, Copyright (c) 2013
Panayiotis Lipiridis, under the MIT License. The complete license is shipped
with the web assets as `flags/flag-icons-MIT.txt`.

## License Notes Checked On 2026-05-03

- The reference tree repository is published under Creative Commons Attribution 4.0
  International (CC BY 4.0).
- CC BY 4.0 permits sharing and adaptation when attribution, a license
  link, and indication of changes are provided.
- The HRAS source repository is licensed under Apache-2.0.
- HRAS documentation describes its inputs as publicly available reference tree
  country/regional codes, Y-SNP branching structure, and TMRCA
  estimates.

## Public Release Checklist

Before making the repository or hosted app public:

- Keep this `NOTICE.md` linked from the application UI and README.
- Keep upstream links visible near the source/version metadata.
- Keep the generated data index date, HRAS/tree version, and reference
  official version marker visible in the application UI.
- Do not imply affiliation, sponsorship, or endorsement by YSEQ or HRAS.
- Re-check upstream repository licenses and Terms of Service.
- If the hosting model changes to frequent automated refreshes, use a
  conservative update cadence and avoid per-user upstream fetches.
- For broad public distribution, get a legal review of the generated
  data index and attribution text.
