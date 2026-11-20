# Noodl V4 Implementation Ledger

**Updated:** 2026-11-20  
**Source of truth:** reviewed code merged into `main`, not the live Sites runtime.  
**Release label policy:** `merged-code` = changes merged and checks green; `limited` = useful but intentionally narrower than the V4 design; `planned` = no completed implementation. No row below is automatically `verified-live`.

| Workstream | Repository state | Evidence | Remaining work |
| --- | --- | --- | --- |
| Flashcards — layered swipe deck, four ratings, keyboard, local persistence feedback | merged-code | PR #12; gesture unit tests + browser journey | More device profiling, offline conflict feedback, long-deck stress |
| MCP context and operation receipts | merged-code | PR #12; owner-scoped tests | Rich contextual inline cards and smarter cross-device reconciliation |
| MCP prepare → commit for new banks and appends | merged-code, limited | PR #13; atomic revisions and replay tests | General artifact/metadata transactional preview and configurable source policy |
| Evidence-linked concept map | merged-code, limited | PR #14; typed relation and source tests, Chrome | Larger canvas layout, relation authoring UI, independent source verification |
| Deterministic simulation runner | merged-code, limited | PR #14; two math models, unit + Chrome | More validated models, signed reference models, stronger accessibility and model licensing |
| Comic reader | merged-code | PR #15; focused/grid/keyboard/zoom with browser screenshots | Model-to-image pipeline depends on ChatGPT host; avoid synthetic storyboard claims |
| Quiz error → unseen repair Batch | merged-code | PR #16; owner/history tests | Cross-app UI affordance and richer evidence labels |
| Opaque publication IDs | merged-code | PR #17; canonical and legacy link tests | Existing older ID links intentionally remain; approval and auditing |
| Question source references + Brain Dump gap reader | merged-code | PR #18; last-reviewed/hinted gap tests | Independent document verification, source binding for generated questions |
| Informed bank publication dialog | merged-code | PR #19; consent and keyboard Chrome tests | More granular public subset sharing, optional question/answer redaction |
| Brain Dump → saved independent repair Batch | merged-code, limited | PR #20; server provenance validation, own-account tests | Improve concept matching beyond exact labels, source inspection, UI entry from ChatGPT host |
| Autopilot exposure and quick checks | limited-existing | Existing code and tests | Better pause/resume UX, explicit evidence differentiation, accessibility/device trials |
| Generalized Knowledge Debugger | merged-code, limited | PR #23; two non-gastric scenarios, validator, server scoring/history, Chrome | Scientific source review still author-reported; expand authored scenarios and host/device validation; old gastric pilot remains distinct |
| Short sessions — Quick 1 and Short Batch 3 | merged-code | PR #22; actual Batch persistence, unseen-first selection and Chrome reload test | Small-screen usability study and adaptive due review integration |
| Opaque public link revocation | merged-code | PR #21; owner-scoped source lookup, REST + embedded MCP tests | Live owner-account verification before shipping |
| Bloom & Calendar | limited-existing | Generation planning and .ics export | Honest target-vs-observed learning levels; actual notifications require scheduling integration |
| Inline ChatGPT MCP result cards | planned | Whole workspace UI resource exists | Small receipt, error, due review and next-step widgets with host tests |
| Production / Sites deployment | **not deployed by GitHub merges** | Release candidate built successfully at commit `46ca078d`, Actions run `44770261984`; still only an archive | Authorized Sites deployment, D1 readiness, verify `/api/health`, identity, MCP tools and stored writes using test account |

## Active-host gap and next implementation gates

The connected Noodl MCP returned `get_capabilities.version = 2.2.0` in a read-only call on 2026-11-20, while `src/server/control.ts` in `main` advertises `2.9.0`. The connected host therefore cannot be assumed to expose new V4 tools. A GitHub release artifact is **not** an OpenAI Sites deployment.

1. Release the existing project's tested Sites candidate through the authorized Sites mechanism without replacing project ID or bypassing host authentication.
2. Verify the live tool registry and owner-scoped write receipts on a **disposable account** only. Do not test mutation with personal study data.
3. Continue P1/2 gaps: Autopilot evidence/UX, generalized debugger authoring UI, graph scalability, deeper simulation validity, truthful Bloom generation coverage, offline sync recovery and accessible host-specific inline MCP cards.
4. Preserve this ledger on every future PR, distinguishing `merged-code`, `limited`, `planned`, and `verified-live`.

## Acceptance discipline

1. A PR is marked ready only after `npm run typecheck`, `npm test`, `npm run build`, and relevant Chrome smoke pass. Source-level checks do not prove real hosting.
2. Every server mutation must isolate owner data, retain revision guards, be idempotent on retry and return an actual receipt.
3. A quiz screenshot, similarity graph, timed exposure or simulated formula is never interchangeable with proof of recalled, correctly answered knowledge.
4. A slide number saved by ChatGPT is source metadata; it is not verification of the source file. Unavailable or uninspected material is labeled accordingly.
5. Keep full-user-data migrations separate from visual changes; test guest-to-account ownership and conflict handling before production release.
6. The next PR should close a measurable feature gap, not introduce a decorative duplicate of an existing workspace.

Review [V4 master plan](NOODL_V4_MCP_STUDIO_MASTER_PLAN.md) and [V4 feature execution specification](NOODL_V4_FEATURE_REFINEMENT_EXECUTION_SPEC.md) for the target design. The ledger is a narrower report of code actually implemented.
