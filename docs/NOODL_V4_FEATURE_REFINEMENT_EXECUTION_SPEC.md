# Noodl V4 — Feature Refinement and Interaction Execution Spec

**Revision:** 2 · 2026-11-20  
**Status:** implementation specification / proposed work, NOT shipped  
**Baseline:** `main` at `15dc23857fd3df537e501e328cdfbb1750a20804` (V4 master plan merged)  
**Companion:** [V4 MCP-first Learning Studio Master Plan](NOODL_V4_MCP_STUDIO_MASTER_PLAN.md)  
**Preserve:** Noodl V3 data, valid quiz/SRS engines, MCP 2.2.0, existing IDs, guest account separation, and Slate–White–Amber default.  
**Scope:** Interaction refinement, cross-feature learning, neglected product surfaces, honest feature completion, and measurable release gates. This is not a redesign-only ticket and does not authorize a deployment.

## 0. What the audit proves, and what it does not

At the baseline commit:

- `src/ui/Study.tsx` implements real manual flashcard flip, pointer drag with an 80-pixel release threshold, four review ratings, keyboard shortcuts, session and result flows. It uses React state for pointer offset; there is no completed physics-based card deck.
- `src/ui/BatchQuiz.tsx` has real draft persistence and explicit submission. `src/ui/Autopilot.tsx` records local exposure and offers optional checks; exposure is not mastery.
- `src/shared/conceptGraph.ts` creates a **lexical** graph using two or more shared explanation words; `src/ui/Tools.tsx` renders pan/zoom SVG, HTML visualization in an isolated iframe, and a ChatGPT *request* for a "simulation" HTML artifact.
- `src/ui/GastricDebugger.tsx` contains one fixed gastric-acid graph-correction pilot. It is not a general debugger engine.
- `src/ui/Comic.tsx` shows real comic text and available images and truthfully falls back to storyboard when an illustration is missing; artwork transfer is not automated.
- `src/ui/PackDetail.tsx` provides actual V3 Materials / Learn / Studio surfaces but a ChatGPT request acknowledgment is not a confirmed MCP write.
- `src/ui/StudyPlanning.tsx` builds a Bloom generation *brief* and downloads a calendar `.ics`; neither is a server-enforced Bloom allocation or an ongoing notification service.
- `src/server/control.ts` exposes the low-level tools. The installed connection reported version 2.2.0 and the workspace read succeeded during the design audit. That does NOT prove all mutation paths or the latest V3 UI have been deployed.
- `docs/KNOWN_LIMITATIONS.md` documents storage, guest, identity, exports, offline, sandbox and production-testing boundaries. A previous local test report is not proof of today's live host.

Use these statuses everywhere: **REAL** (stored and testable), **PARTIAL** (works but limited), **PILOT** (fixed topic or example), **HANDOFF** (ChatGPT must finish work elsewhere), **PROPOSED** (not implemented), **VERIFIED LIVE** (actually tested on deployed host). Never merge these states into a single “Done.”

## 1. Core product contract: a continuous learning loop

A study task should follow a traceable path:

`ChatGPT source/context → prepared, validated MCP content → saved pack/artifact receipt → Noodl retrieval/simulation → observed answer and feedback → evidence-linked gap → distinct unseen check → SRS/next action`.

Noodl **executes and records** learning. ChatGPT **reads sources, reasons, generates and explains**. No in-app OCR, LLM provider, duplicate document uploader, fake “AI processing” indicator, or in-app chatbot is required.

Every user-facing feature must have a **capability card in the engineering inventory** (not decorative UI): name, learner intent, real input, owner/scope, renderer, persistence path, read/write APIs, loading/empty/error/confirmation states, keyboard/single-pointer/touch behavior, source-truth status, acceptance tests, and supported host surfaces.

Track evidence, not manufactured mastery percentages. Repeated exposure, seeing a correct answer, selecting a reviewed concept and successfully recalling unaided are separate events.

## 2. Cross-app interaction architecture

### 2.1 A shared state model, not disconnected animations

Every consequential action travels through:

`idle → affordance/preview → pending-local → pending-server → confirmed`

or

`pending → failed/conflict → retry / reconcile / cancel`.

For a ChatGPT handoff, insert `request-sent`, `MCP-operation-started`, and `receipt-confirmed` as distinct steps. A success toast, colored checkmark, confetti animation or navigation may **not** imply persistence before the real layer acknowledges it. A local-first save can truthfully say "Saved on this device; waiting to sync."

Use shared components/tokens for:
- `ActionStatus`: short status, retry, conflict and delayed sync.
- `MotionProvider`: reduced-motion preference, transitions and device-safe timing.
- `ShortcutHelp`: contextual shortcut legend and focus rules.
- `SourceBadge`: provided vs inspected vs disputed vs unavailable source evidence.
- `CapabilityEmptyState`: precise prerequisite and working next action.
- `StudySurfaceHeader`: position, exit/resume, status and source context.
- `FeatureAvailability`: supported/limited/demo/host-specific state.

Do not force every feature into a generic card-grid. Surface shape must match learner intent.

### 2.2 Motion and visual language

Retain V3 Slate `#172A36`, White and Amber `#FFBA59` semantics; use neutral surfaces and clear hierarchy. Motion communicates **cause, direction and completion**, not continuous visual noise. Use Framer Motion already in dependencies; verify current installed API before coding. Provisional timings (design targets; tune by profiling):

| Interaction | Initial duration target | Purpose |
| --- | --- | --- |
| Press or tap acknowledgment | 80–140 ms | Immediate control response |
| Tab/content switch | 160–240 ms | Context continuity |
| Panel enter/exit | 200–300 ms | Spatial context |
| Flashcard flip | 200–320 ms | Show hidden answer |
| Swipe cancel/spring-back | 180–300 ms | Reveal release threshold |
| Successful card departure | 180–280 ms | Distinct committed review |
| Result detail reveal | 200–360 ms | Focus attention |

Respect `prefers-reduced-motion`; provide near-instant or opacity-only transitions. Avoid full-page blur, background parallax, animated counts without data, motion-induced CLS, and overly large bundles. Keep text selectable and vertical scrolling natural.

### 2.3 Interaction equivalence

Every essential action must work with touch, single-pointer clicks, keyboard and assistive technology. W3C WCAG 2.2 SC 2.5.7 requires a non-drag single-pointer alternative; providing a keyboard shortcut alone is not sufficient. Use semantic buttons, visible focus and concise live regions; do not take over key events in inputs, dialogs or other focused controls.

### 2.4 Mobile and split-screen mode

Reflow the existing responsive UI for 320, 390, 768 and 1440 px rather than scaling desktop panels down. In narrow and split-screen contexts, present one clear active task, a small persistent status and one primary action. Preserve exit/resume, avoid automatically advancing before feedback can be read and never fake passive learning. A compact "One question / One card" mode is a candidate **only after** its measured usability is demonstrated.

## 3. Flashcards V4: physical deck with correct SRS semantics — P0

**Current:** real flip, pointer swipe threshold, four rating buttons, number/arrow key ratings and persistence. **Missing:** spring physics, accessible drag alternatives, layered next-card affordance, explicit save state, long-content gesture arbitration, comprehensive failure handling.

### 3.1 Visible anatomy

A single large card with a subdued next-card silhouette. Front = question/active recall; back = answer, explanation, concept and optional source. The card face is scrollable for long explanations. A dock always exposes **Lupa (0), Sulit (1), Bagus (2), Mudah (3)** plus readable shortcut hints. The choice should not depend on color alone.

Tap/click or Space/Enter flips. Flipping never grades. Swipe left = Lupa; right = Mudah only **after answer reveal**. Other ratings remain one-tap and keyboard accessible; no forced two-choice reduction.

Gesture rules:
- Horizontal intent starts only after a small dead zone, with vertical scrolling winning when the user's initial motion is vertical.
- Show progressive left/right labels and rotation/translation on drag; below threshold spring back; above threshold/validated velocity trigger one rating.
- Pointer up, cancel, lost capture, rapid successive input, scroll inside a long answer, a route change and an embedded iframe must not double-write.
- Initial threshold experiments: dead zone 12–18px; distance 80–110px or intentional horizontal velocity; benchmark with actual touch users before locking constants.
- Avoid re-rendering the entire deck on each pointer frame. Motion values and a single deck controller own the gesture.

### 3.2 Persistence correctness

`front → back → candidate rating → commit pending → confirmed → next front`; on failure, restore an actionable same-card view without losing the user's choice and give retry. Guard repeated gestures with a single in-flight operation ID and keep deduplication through server write. When offline, show local queued state explicitly. If an animation needs to depart before cloud ACK, the outcome must remain recoverable and visibly "pending"; do not claim final success.

Undo is allowed only when backed by a reversible staged window or explicit safe compensating/tombstone operation; immutable review history cannot simply be rewritten for cosmetic undo.

### 3.3 Test definition

For 0–3 ratings, compare **swipe / visible buttons / keyboard** on identical initial SRS states; after refresh, exact one event, expected queue movement and history. Check a failed request, offline resync, stale revision, duplicate callback, browser background, reduced motion, screen reader, keyboard focus, 320px screen and a 3-screen-long explanation.

## 4. Quiz, Batch, Review, Results and tiny sessions — P0/P1

**Quiz Player:** Display one question, active state, visible options and predictable numbering. Keep server-graded scoring and immutable attempt snapshots. Use a state sequence `prompt → chosen/submitted → server-confirmed feedback → explanation → next` instead of color flashes implying correctness before the write. Shortcuts 1–N apply only when question controls have focus and a text input is not active. Never reveal unreached answer keys to the learner client; design separate learner/tutor response shapes.

**Batch Quiz:** Keep the draft/submit distinction. Add a question navigator with unanswered/answered/flagged states, reliable keyboard access, draft-save feedback and clear explanation of the all-at-once grading. Resume from a real draft, not fabricated in-memory answers. Disabled submit must explain the reason and allow explicit incomplete submission only if the engine contract permits it.

**Survival/Time Rush:** Preserve real mode behavior; a countdown, timeout, leaving, backgrounding and server time checks must agree. Prevent accidental repeated answer submissions during transition. Never use a dramatic animation as the source of the score.

**Review/SRS:** Separate *New*, *Learning*, *Due* and *Reviewed*, using real review events and deterministic scheduling. Present time estimates as policy outputs, not promises of long-term memory. Show why an item appears. Review failures remain retryable.

**Results:** Replace the generic wall of scores with observed counts and one defensible next task. Distinguish unanswered, incorrect, correct without hints and correct after hints where recorded. Show exact source/question and concept counts, not a simulated mastery percentage. Let each miss open its source explanation, card and a distinct unseen follow-up if available. Avoid repeating the same question as a claimed independent test.

**Tiny sessions:** Add *Quick 1*, *Review 3*, and *Short Batch* only as real saved attempts/reviews using existing engine. Offer them when session fatigue/friction is the problem, not by automatically turning Noodl into doomscrolling. Each small unit must have a stop point and one sensible next action.

## 5. Autopilot and Brain Dump — P1

**Autopilot:** Distinguish exposure (card displayed), explicit SRS rating and independently answered quick-check evidence. Make pause, speed, next/back and resume visibly controllable. Pause on hidden tabs and announce why. Never produce "mastered" or correct-rate data from timed card display. Create delayed checks only where distinct questions and reliable timing exist; when not available, say so.

**Brain Dump:** Keep the existing source-referenced, verbatim recall record and separate initial response from prompted response. Build a resumable one-prompt view that hides scoring points until the learner responds. After saved feedback, offer:
1. View specific missing reference points.
2. Ask ChatGPT for explanation with a verified source reference when available.
3. Prepare distinct follow-up questions through MCP; show a saved receipt before opening a new attempt.
4. Record the new response as independent evidence, not as automatic correction of the prior miss.

Use source page/slide anchors only if ChatGPT provided an actual inspected anchor; do not invent one after the attachment context has disappeared.

## 6. Concept Studio: text graph vs verified mind map — P1

Keep the current lexical graph under the literal name **Text Associations**. It should expose the shared words and never imply cause, inhibition or clinical correctness.

Add a separate **Evidence-linked Concept Map** model:
- Concepts have stable IDs, labels and aliases.
- Relations have stable IDs, `from`, `to`, typed predicate (causes, inhibits, part-of, contrasts, prerequisite, example-of), direction, rationale, sourceRefs, status, revision and disputed flag.
- Node actions: *Explain*, *Open source*, *Practice*, *Review*, *Inspect misses*, *Verify relationship*.
- Show a map canvas with minimap, fit, pan/zoom and collapse, plus an accessible searchable outline/list and side inspector. Node movement changes layout coordinates only, not factual relationships.
- Separate Explore, Focus, Repair and explicit Edit modes. Do not create a fake "AI confidence 98%" score when source evidence is absent.
- Large graph operations must avoid per-frame rerenders and quadratic link recomputations. Consider React Flow only after actual bundle/accessibility profiling.

Evidence policy: *ChatGPT generated* != *independently checked*. Every edge exposes its claim and a link/status where possible; uncertainty is textual and actionable.

## 7. Visual Lab: three honest artifact classes — P1

1. **Explanation visual:** readable diagrams, charts or interactive illustrations; they may not calculate anything.
2. **Custom HTML visual:** isolated HTML supplied through ChatGPT/MCP, with no arbitrary network or parent access. Must display provenance, draft/review state and sandbox limits.
3. **Deterministic simulation:** a validated structured specification with named parameters, units, ranges, defaults, assumptions, equations/transition rules, expected output fixtures, reset and compare.

A real simulation requires controls to change an actual model and produce the same outcomes for the same inputs. Inputs must be constrained, outputs legible, invalid combinations explained, and source/validity available. Save a versioned model definition. A visible slider that merely swaps canned paragraphs is an illustration, not a simulation.

The first template should be **one domain-limited, source-checked model** selected after reference validation, not a platform claiming to simulate everything. Example candidates: simplified receptor occupancy, qualitative gastric-acid regulation, or gas exchange. For each, record the model assumptions and limits before building controls. Add optional `Predict → Manipulate → Explain`: learner predicts direction, changes one parameter, sees the actual model output and compares the prediction. Prediction and correction become evidence only if persisted and explicitly graded.

Safety: standalone arbitrary HTML remains in a restricted iframe. No unsafe execution in the host app, no network by default, no external CDN dependencies. Keep real loading/error/reload/recovery states. Large diagrams support touch zoom, keyboard reset and text descriptions.

## 8. Knowledge Debugger and comics — P1/P2

**Knowledge Debugger:** Keep the gastric-acid example labeled as a PILOT. Generalize only after an authored scenario schema supports concepts, relations, deliberately flawed claims, allowed correction operations, a source-backed solution, gradeable validation and retries. UI should highlight the selected faulty edge/step with pointer and keyboard equivalence. No "generic debugger" navigation before at least one non-gastric scenario passes creation, save, reopen and scoring.

**Comics:** Existing reader and storyboard fallback remain. Add page/panel navigation, zoom, readable dialogue/captions, a progress indicator, source badges, mobile flow and retry for broken images. Report "Storyboard / Draft / Creator-reviewed / Externally verified" accurately; self-report is not external validation. Image bytes must actually be stored or reachable; don't pretend ChatGPT screenshots or generated images magically transfer through MCP. A managed media service is a separately approved storage/security project, not a UI toggle.

## 9. Neglected surfaces need real contracts — P1/P2

| Surface | Refinement and honest boundary | Acceptance gate |
| --- | --- | --- |
| Today / Smart Next Step | One exact recommended action, with observed reason and sample size; resume active, then due review, then repeated misses | CTA opens the precise owned session/queue; no invented predictions |
| Library | Fast searchable compact list; folder/tag filtering; separate public catalog and personal drafts; real counts and error/loading states | All bank types, empty/large states, guest and signed-in scoped |
| Bank detail Studio | Distinct Material / Learn / Studio roles; contextual create/modify via MCP; show receipt only after save | Creation, retry, refresh and old data preserved |
| Material/Insights | Markdown, formula, code, source jump and inline practice reference; readable in split-screen | Legacy plain text still renders; no invented document ingestion |
| Mix Room | Ephemeral cross-bank attempts, preserving source pack ID; "Save combined bank" is distinct | Mixing doesn't silently create a permanent bank |
| Bloom planner | Requested C1–C5 allocation vs actual generated distribution and sample count | Never call a prompt brief an enforced quota |
| Calendar | Label .ics download as export; real reminders require a separately working delivery system | No notification promises without registration/delivery |
| Offline | Separate application shell cached, bank present locally, queued write, server confirmed | Forced offline/reconnect restores without duplicate writes |
| Backup/export | Explicit included content, answers and exclusions; full workspace backup separate from pack export | Round-trip tests, size limits and safe privacy defaults |
| Publish/share | Explain that answer keys are in public snapshots; hide private progress; random opaque publication ID is a migration target | Account-scoping and link/access tests; unpublish limits explained |
| Settings | Real gesture sensitivity/help, theme contrast, reduced motion and input preferences only after wired to behavior | Save/cancel/reload and cross-device sync, no dead toggles |
| Assistive camera | Permission, calibration, recognition uncertainty, no-camera fallback, visible active state | Device-specific real hardware test; never compulsory |
| Feedback/help | Contextual ? shortcuts, retryable status, minimal tooltips, no modal bombardment | Every action locatable without a "feature showroom" |

Where a feature is absent, choose honest **Unavailable / Create in ChatGPT / Demo** copy with the exact functional action. No random example data in production learning metrics.

## 10. MCP workflow layer: fewer steps, more verified completion — P0

Preserve the existing 64 low-level tools for compatibility. Add a small set of intent-based operations:

| Proposed tool | Request → result |
| --- | --- |
| `get_study_context` | Scoped pack/attempt/review/repeated-miss summary with evidence counts, IDs and possible next actions; no whole bank |
| `prepare_pack_change` | Draft operations, schema validation, duplicate/coverage/source checks, impact preview; no persistent study mutation |
| `commit_pack_change` | Idempotent transactional commit against expected revision and owner scope; stable receipt |
| `get_operation_receipt` | Confirm committed/pending/conflict/failed, stable IDs, revision and safe recovery |
| `prepare_repair_practice` | Identify observed gaps, reserve genuinely unseen questions or state insufficiency |
| `open_study_surface` | Open small result or exact study surface; keep rendering decoupled from mutation |

The server should generate IDs for newly created questions/options where safe; strict discriminated schemas must enforce each question type. Avoid duplicating entire payloads in text and structured content. Expose explicit output schemas, typed error codes (`INVALID`, `CONFLICT`, `NOT_FOUND`, `UNAUTHORIZED`, `SOURCE_UNAVAILABLE`, `RATE_LIMITED`, `OPERATION_PENDING`), retry instructions and version compatibility.

`prepare` is a validated proposal, **not a save**. `commit` checks current owner/revision/permission and applies the prepared change atomically or rejects it. For conflicts, return precise changed IDs and safe retry guidance; never silently overwrite unrelated edits. `receipt` can be queried after a network timeout to prevent duplicate saves. Save IDs and timestamps are factual, not model narration.

**Privacy and answer boundary:** learner-facing active sessions should not expose keys until permitted by session state. Tutor/instructor access must be justified, not merely achieved through a UI toggle. Private pack owners, guest browser identities and published snapshots remain separate.

**Handoff boundary:** browser "Continue in ChatGPT" is a prompt/clipboard handoff. Embedded app communication is also not proof that a generated artifact was committed. Bind origin request ID → planned change ID → operation ID → receipt → opened saved artifact.

## 11. Minimal versioned data additions, without breaking existing packs

Add optional/sidecar records with explicit migration and backwards-compatible validators:

- `SourceRef`: source ID, title, page/slide/section anchor, scope, provided/inspected/unavailable/disputed status.
- `Concept` / `ConceptRelation`: IDs, typed direction and source-linked reasons.
- `LearningEvidence`: immutable observed answers, initial-vs-prompted flag, hint state, review event or simulation prediction, source concept, timestamp; no guessed mastery scalar.
- `VisualizationSpec` / `SimulationSpec`: artifact class, version, assumptions, units/controls/model/output fixtures, review status.
- `OperationReceipt`: operation and request IDs, owner, expected/result revision, pending/confirmed/error status, entity IDs and recovery.
- `FeatureCapability`: runtime/server-supported version, host availability and required prerequisites, so navigation can be truthful.

Old packs without these fields must open, study, export and sync. Snapshotting must freeze the question content relevant at attempt creation. New relations/layout should not rewrite existing attempt scores or review history. Enforce owner scope in server queries and D1 migration tests; do not trust client-supplied owner fields. Design a migration rollback before live releases.

## 12. Testing: no mock-feature completion

Define feature tests on four layers:

1. **Domain/unit:** schema, rules, grading, graph/provenance, relation validity, simulation fixtures, source handling and SRS event behavior.
2. **Integration:** MCP tool selection, prepared/commit/receipt idempotence, server writes, conflict handling, guest/owner boundaries and data migrations.
3. **Browser UI:** Chrome desktop/mobile, touch drag, keyboard, focus and screen reader spot checks; snapshot of loading/empty/success/failure; reduced motion and 320/390/768/1440px.
4. **Host/live:** actual ChatGPT embedded panel and OpenAI Sites runtime, read-only health by default; write checks only on disposable test accounts and packs, authorized release process separate from GitHub merge.

Required learning journeys:
- ChatGPT inspects real slide content, creates validated questions, confirms receipt and opens exactly the saved bank.
- Flip only → no SRS event. Left swipe → one "Forgot" event. Keyboard "Good" → one distinct rating. Vertical scroll → no rating. Offline retry → one eventual event.
- Batch draft survives reload and explicitly submitted answers are graded exactly once.
- Wrong question → unseen question on same observed concept if available; otherwise clear insufficiency message.
- Brain Dump initial/prompted answers stay distinct; reference gaps lead to saved independent practice.
- Text overlap edge is labeled heuristic; factual relationship has typed direction and traceable evidence.
- Visualization remains labeled correctly; simulation inputs yield deterministic expected outputs and reset/compare.
- Comic storyboard does not masquerade as illustration; incomplete external review cannot be marked verified.
- Guest local bank and signed-in MCP bank never silently merge. Public link reveals declared content only.
- Timeout, conflict, failed write, duplicate operation ID, missing asset and host unsupported action all have visible recovery.

**Performance targets, not claims:** approach 60fps card gesture on a mid-tier phone; avoid >100ms main-thread stalls on common interactions; record p95 response and bundle changes. Do not choose a heavier graph engine or giant animation dependency before measuring React 19 and embedded-host performance.

## 13. Delivery order with independent PR gates

| Wave / priority | Work and dependencies | Ship only when |
| --- | --- | --- |
| **0 / P0** | Audit current feature truth; screenshot states; tool and test map; verify actual live version | Versioned capability matrix; no fake done states |
| **1 / P0** | Shared action status, motion, focus, keyboard help and persistence-safe flashcards | All 4 input ratings, retry/offline, focus, mobile, reduced motion verified |
| **2 / P0** | MCP schemas/error codes, compact context, prepare/commit/receipt, host cards | Real write receipt, conflict/idempotence, owner safety demonstrated |
| **3 / P0–P1** | Results-to-repair, Brain Dump links, quiz and Batch state UX, Today reason cards | Evidence-driven next step with saved unseen attempt |
| **4 / P1** | Concept evidence model, lexical-vs-factual views, canvas+inspector | Typed, sourced relationships; accessible canvas/list parity |
| **5 / P1** | Visual Lab status and schema, one deterministic simulation, comic reader | Tested real calculation, reset/compare, source/validity and asset honesty |
| **6 / P1–P2** | General debugger framework and second validated scenario, source coverage/bank quality, split-screen usability | Real data-driven content and repeatable outcome, no hard-coded-only marketing |
| **7 / P2** | Publish/guest/offline/backups/camera/settings/calendar refinements and rollout | Host, browser, D1, auth and offline regression before deployment |

Each wave = small PR(s) with source diff, contract changes, test evidence, screenshots/recording where relevant, accessibility and rollback notes. **Merging PR is not deploying the Site**. Host version, migration status and tool visibility must be verified separately.

## 14. Acceptance metrics and anti-slop rule

Measure **task completion, not feature count**:
- Steps from "make 30 questions from slide" to verified saved bank.
- Fraction of successful writes with a receipt and recovery after timeout.
- Wrong-answer-to-distinct-follow-up completion rate.
- Card gesture false-commit/double-commit rate across devices.
- Median time to resume active session.
- Source-linked question share by actual verified evidence status.
- Host/browser performance and accessibility failures.
- User ability to locate one primary action without instructions.

Do not present estimates or target values as observed metrics. Never ship an inert button, a fake file import, passive exposure called recall, a guessed semantic link, HTML called a verified simulation, a creator checkbox called independent review, or an .ics download called push reminders. No feature is "complete" until input, calculation/behavior, visible feedback, real persistence or explicit non-persistence, failure recovery and supported input modes are demonstrably tested.

## 15. External technical references (checked 2026-11-20)

- Motion for React: https://motion.dev/docs/react-drag and https://motion.dev/docs/react-accessibility
- WCAG 2.2 Dragging Movements: https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements
- MCP Apps architecture: https://apps.extensions.modelcontextprotocol.io/api/documents/overview.html
- React Flow accessibility and performance: https://reactflow.dev/learn/advanced-use/accessibility and https://reactflow.dev/learn/advanced-use/performance

## Revision record

**2026-11-20 · Revision 2** — Builds on the merged V4 master plan with a cross-feature interaction state machine, complete feature-surface inventory, explicit mobile/split-screen behavior, production-safe flashcards, question-mode UX, brain-dump repair flow, typed map evidence, simulation validity, comic asset truth, high-level MCP contracts, additive data model, exact acceptance scenarios and phased implementation gates. **Documentation only. No application feature, database, MCP tool, deployment or user preference changed.**
