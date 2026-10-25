# Contributing

Human and agent-assisted contributions are welcome: reproducible bug fixes,
clearer EN/RU interface text, accessibility improvements, performance work and
focused regression tests. Small, well-explained pull requests are easiest to review.

## Before starting

- Read [README.md](README.md) for setup, [PRODUCT.md](PRODUCT.md) for the behavior
  affected by your change and [DEVELOPMENT.md](DEVELOPMENT.md) for engineering checks.
- Ordinary fixes can go directly to a PR. Discuss new features, changes to result
  semantics, data schemas, dependencies, external services or project guardrails
  before investing in implementation. An existing maintainer-requested task or
  agreed issue is sufficient; do not request the same decision again.
- Use a branch or fork and keep one purpose per PR. Avoid unrelated formatting,
  dependency updates and refactors. Preserve work outside your task.

## What a contribution must preserve

- Keep the product's evidence, hierarchy, time, pending-state and table/CSV
  invariants. A behavior change needs an agreed contract and acceptance update;
  do not silently change the meaning of results to make a test pass.
- Keep EN/RU behavior consistent. For UI changes, check relevant narrow and wide
  layouts, keyboard interaction and language switching.
- Never include names, real kit/sample identifiers, individual genetic results,
  credentials or private data in code, fixtures, screenshots or PR descriptions.
  Use synthetic fixtures and identifiers.
- Rebuild `public/data/hras-index.json` only through the documented data commands.
  Describe source versions, provenance and count/schema changes in data PRs.
  Do not hand-edit the generated index or commit build output, dependency trees,
  caches, temporary scripts, logs or historical audit reports.
- Preserve [LICENSE](LICENSE), [NOTICE.md](NOTICE.md) and third-party attribution.
  Only contribute code and assets you have permission to share; identify new
  dependencies and their licenses. Keep documentation concise and in English.

## Pull request and review

Use the [PR template](.github/pull_request_template.md). Describe the problem,
resulting behavior, relevant before/after example, validation and remaining risks.
Link an issue if one exists; an issue is not required for every small fix.

Run the relevant checks from [DEVELOPMENT.md](DEVELOPMENT.md). Code changes need
test and build evidence; UI changes also need affected browser scenarios and
representative synthetic screenshots attached to the PR rather than committed.
Documentation-only changes need link and diff checks, not an application rebuild.
Record exact commands, outcomes and anything not run. Reuse valid evidence for
unchanged inputs; CI still checks the submitted revision.

Report existing failures and limitations explicitly. Do not delete, skip or weaken
checks to hide a regression. Keep review follow-ups focused and update the PR
description when its scope changes. Maintainers review contributions before merge
and may request changes or decline work outside the project's scope.

## Working with agents

- Work within a human-authorized task. An invitation to contribute is not a request
  for bulk automated issues, PRs or unsolicited review comments.
- Prepare local changes and validation autonomously within that scope. Publishing
  a PR, pushing, commenting, merging or deploying needs the human's authorization;
  an explicit request for that action already provides it.
- State whether agents assisted and their role, what the submitting human reviewed,
  and what remains unreviewed. Maintainer review is still required; automated
  checks and another agent's approval do not replace it.
- Verify generated code and claims against actual source and observed checks.
  Never invent test results, review, screenshots, citations or compatibility claims.
  Do not include private prompts, conversation transcripts or hidden reasoning.
