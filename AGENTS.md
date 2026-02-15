# AGENTS.md

## Scope

This file documents how tests are organized in `chrome-chatgpt-mermaid-extension`.

## Test Structure

- `tests/fixtures/examples.md`
  - Source of truth for Mermaid patch test cases.
  - Each case defines:
    - case name
    - JSON spec (`expectation`, `variant`, optional `mustContain`, `mustNotContain`)
    - Mermaid input block

- `tests/helpers/examples.mjs`
  - Parses `examples.md` into structured test cases.
  - Validates the case schema.

- `tests/unit/mermaid-patch.test.mjs`
  - Data-driven unit runner.
  - Iterates over parsed cases from `examples.md` and applies assertions from each case spec.

- `tests/e2e/html-mermaid-flow.test.mjs`
  - HTML fixture flow test.
  - Extracts Mermaid blocks from `tests/fixtures/chatgpt-snippet.html` and verifies patch behavior in a ChatGPT-like DOM snippet.

- `tests/build.test.mjs`
  - Repo structure sanity check for required extension files.

## How To Add Cases

1. Add a new `### Case: ...` entry in `tests/fixtures/examples.md`.
2. Provide JSON spec + Mermaid block.
3. Run `npm test`.

No test logic changes are required for standard patch scenarios.
