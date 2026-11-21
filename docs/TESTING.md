# Testing

Run commands from the repository root. Install dependencies first with `npm ci`.

## Automated checks

Run the type check:

```sh
npm run typecheck
```

Run the test suite:

```sh
npm test
```

The tests use Node's built-in SQLite module and a D1-style adapter. They cover domain rules, account separation, revision conflicts, offline storage and sync, server routes, MCP tools, exports, preferences, and output escaping. They use disposable in-memory data. They do not connect to a live D1 database or ChatGPT.

Build the client and Worker, then run the bundled Worker smoke check:

```sh
npm run build
```

The build script checks TypeScript, builds the Vite client, bundles the Worker, and runs `scripts/verify-worker.mjs`. The smoke check imports the built Worker, creates an in-memory SQLite database from the initial migration, calls `/api/health`, creates a pack through MCP, creates a PDF export, and checks the PDF signature. It checks the built bundle with a test identity. It does not test platform authentication, deployed D1, browser rendering, the ChatGPT panel, camera input, or offline behavior in a real browser.

Run the production dependency audit separately:

```sh
npm run audit:production
```

This asks npm to check production dependencies for high severity vulnerabilities. It is not part of `npm run build`.

## V4 browser flows and release candidate

GitHub Actions executes the normal `Noodl browser UX` workflow after changes to application source. It includes:
- `scripts/smoke-ui.mjs`: responsive layout, flashcards, quiz, state recovery, evidence-linked concept map and deterministic simulation.
- `scripts/smoke-comic.mjs`: focused comic reading, keyboard, zoom, missing artwork and 320px layout.
- `scripts/smoke-quick.mjs`: Quick 1 and Short Batch 3, saved results and browser reload.

The separate `Noodl knowledge debugger Chrome QA` workflow executes `scripts/smoke-debugger.mjs` to import **two non-gastric** scenarios, correct a relationship, inspect source references, retry, and verify honest local-only result status. Server scoring/ownership/idempotence is covered by `tests/server.test.ts`, not by a fake browser server.

The `OpenAI Sites release candidate` workflow packages a verified archive, its SHA256 and archive manifest on `main`; the successful artifact from commit `46ca078d` is in Actions run `44770261984`. The archive does **not** deploy or migrate an OpenAI Sites project. Current connected MCP capability version must be checked independently because the repository can be ahead of production.

## V5 Smart Sweep acceptance

The V5 implementation is covered by:
- `tests/exam-coverage.test.ts`: point-map validation, omitted variants, separate self-claims vs correct answers, stable evidence, priority ordering, mandatory repair and deterministic audit.
- `tests/server.test.ts`: owner-scoped and idempotent Sweep REST/MCP app records, stale revision refusal and no scored-answer contamination.
- `tests/offline.test.ts`: claim persistence after IndexedDB restart, account isolation, pending retry, remote merge and conflict retention.
- `scripts/smoke-sweep.mjs` via `.github/workflows/browser-sweep.yml`: imported bank, keyboard and bulk claimed-know actions, zero premature score, actual saved Batch verification, reload ledger evidence and unfiltered Full Exam.
- Existing `scripts/smoke-ui.mjs` keeps Flashcards first in the Studio action list and guards quiz/Studio regressions.

The successful OpenAI Sites candidate package built from V5 main commit `d50baa8ad48a6d248420d2b7acdb94f528b9de68` is [Actions run 44854525296](https://github.com/SeraKah-1/noodl-gpt/actions/runs/44854525296). This verifies a release **archive**, not deployment. The installed ChatGPT connector last reported 2.9.0, whereas this source advertises 3.0.0. V5 live behavior and real-device usability have not been verified.

## Manual checks

Use these checks when you have access to the relevant host:

1. Open the deployed app through its supported host. Confirm that the host provides the signed-in user identity.
2. If you need to check writes, use a disposable test account to create a pack, reload the app, and confirm that the pack remains available to that account.
3. Open the ChatGPT panel and confirm that it connects to MCP and opens the workspace.
4. In a browser, save the app and one pack, then test offline use. Test camera features separately because they need browser permissions and model downloads.

These checks are not covered by the automated suite. Use read-only checks on production by default. If a live write check is required, use a disposable test account and pack, then remove the pack. Do not write test data to a real user account. Record the host, account type, browser, and result when you perform these checks. Do not treat a successful local build or Worker smoke check as evidence that the live host works.
