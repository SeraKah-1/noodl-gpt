# Noodl V4 — MCP-first Learning Studio Master Plan

**Status:** approved direction / design and engineering specification only — not implemented.  
**Baseline audited:** main at commit 5046780620b9323c131138f71d20b9e8ac806b92 (2026-11-20).  
**Detailed refinement addendum:** [V4 Feature Refinement and Interaction Execution Spec (revision 2)](NOODL_V4_FEATURE_REFINEMENT_EXECUTION_SPEC.md) — concrete interaction contracts, neglected features, acceptance tests and delivery gates; documentation only.  
**Supersedes as future work:** the unimplemented parts of the older Noodl 2.0 redesign and the MCP refinement discussion. **Preserve** working Noodl V3 functionality and data.  
**Review cadence:** append dated decisions and verified implementation evidence; do not label proposed or drafted work as shipped.  
**Ownership:** React app + shared learning engine + MCP worker + embedded ChatGPT app. Source-file reading and AI content generation remain in ChatGPT, not Noodl.

## 0. Product decision and hard boundaries

Noodl is a **learning execution workspace**: ChatGPT reads sources, reasons about them, creates study content and communicates over MCP; Noodl presents real study interactions, records responses, schedules review and exposes verified next actions. The product must NOT duplicate ChatGPT with document uploads, OCR, model orchestration, new AI provider configuration, a pretend in-app chatbot, or another AI backend.

The primary user journey is **source in ChatGPT → structured questions/materials/visuals through MCP → Noodl practice/recall → observed errors and due reviews → ChatGPT correction using minimal evidence → DIFFERENT unseen checks → schedule a later review**.

Four non-negotiables:
1. **Truth of capability:** a link that requests ChatGPT creation is not in-app generation; a rendered HTML visualization is not necessarily a scientifically verified simulation; an exposure is not proof of recall; word overlap is not a causal relationship; an .ics download is not a push notification.
2. **One job / one primary action:** each surface communicates its purpose, available source data, next action, loading status, errors and completion. Remove visually misleading affordances. Never ship inert controls or fake result cards.
3. **Multiple input methods:** touch swipe, pointer, click and keyboard must reach the same outcome, with visible focus, predictable shortcuts, reduced motion and accurate assistive feedback.
4. **No data regression:** preserve stable bank/question IDs, revision preconditions, immutable attempt snapshots, review event history, offline outbox and account/Guest separation. A UI animation cannot claim cloud success before the server acknowledges it.

Keep Noodl V3 Slate–White–Amber and its accessible theme architecture as the base. The current Sites live deployment was not verified as part of this planning document.

## 1. Source-code-based feature truth audit

Terms: **REAL** = implemented and connected to actual stored state; **PARTIAL** = genuinely functional but narrow or insufficiently refined; **DEMO/PILOT** = specifically hard-coded; **HANDOFF** = request goes to ChatGPT, and completion depends on separate MCP write; **PROPOSED** = not implemented yet.

| Feature today | Evidence in source at baseline | Truth status | Required change |
| --- | --- | --- | --- |
| Manual Flashcards | Study.tsx has flip, pointer-captured swipe, left→Forgot (0), right→Easy (3), explicit four SRS buttons, keyboard 1–4 and arrow keys; onReview persists review event | REAL, interaction PARTIAL | Replace abrupt CSS translation with physics-based fling / spring-back, layered next-card preview, accessible action feedback, failure recovery; keep ALL four ratings and keyboard |
| Autopilot | Autopilot.tsx times front/back, pauses on page hide, records local exposures and offers a distinct Quick Check where an unseen item exists | REAL, PARTIAL | Clear exposure/local vs server states, ease of pause/pace, Quick Check and delayed check, accessibility; do not score passive display |
| Concept Graph | conceptGraph.ts links concept labels based on >=2 shared tokens in explanations; Tools.tsx SVG supports pan/zoom/pinch, concept selection and accessible list | REAL lexical association, NOT semantic mind map | Keep “Text Associations” distinct; add a real source-backed typed-relationship mind map and related learning actions |
| Visual Lab | Tools.tsx displays saved visualization artifacts as sandboxed srcDoc HTML iframe, reload and explanation; creation button asks ChatGPT | REAL viewer / HANDOFF creation | Build artifact lifecycle, rendering status, source notes, validation, replay/reset and mobile controls. Never call HTML alone a simulation |
| Simulations | Currently a visual-artifact HTML format selected via a ChatGPT prompt; sandboxed iframe has no external network | PARTIAL; no general trusted simulation engine | Introduce validated simulation specifications and reproducible state/control runner; keep arbitrary HTML as explicitly “Custom interactive visual” |
| Knowledge Debugger | GastricDebugger.tsx is a fixed gastric-acid relationship correction with cited references | DEMO/PILOT | Label “Gastric acid demo” until generic data-driven scenarios exist; do not advertise a broad debugger engine |
| Learning Comics | Comic.tsx reads parsed panel JSON, images or honest storyboard placeholders; chat handoff creates drafts; validation contains creator-reported review fields | REAL reader / HANDOFF generation, verification PARTIAL | Render/zoom/navigation/source badges and truthful draft/verified statuses; never equate creator checkbox with independent validation |
| Brain Dump | server/brainDump.ts persists recall, initial/prompted responses, slide points and feedback via MCP | REAL MCP workflow | Connect feedback gaps to evidence-linked questions and subsequent independent practice; expose resumption and honest status in UI |
| Quiz modes / Batch | Study.tsx, BatchQuiz.tsx, engine and MCP control route validate and persist real sessions and grading | REAL | Smooth focus transitions, keyboard consistency, results/repair actions, pending/confirmed states; no fabricated mastery score |
| Mistake-to-Mastery | V3 Results and shared/practice.ts select unseen questions when available, with ChatGPT fallback | REAL, PARTIAL cross-surface | Connect results, brain dump, graph, cards and SRS through one concept evidence layer; handle insufficient source questions |
| Smart Next Step | shared/nextStep.ts recommends active session → due review → repeated misses → recent bank | REAL deterministic | Show explicit reason/sample size; open exact session or study action; no hallucinated predictions |
| SRS review | review queue, engine review events and MCP rating are real | REAL | Better rating confirmation, undo design respecting event immutability, real pending/cloud states |
| Bloom study setup | StudyPlanning.tsx emits a generation brief with weighting; ChatGPT may use it | REAL prompt builder, NOT server-enforced Bloom distribution | If needed, add declared cognitive-level metadata and measured review before claiming exact percentages |
| Calendar reminder | StudyPlanning.tsx builds downloadable .ics | REAL export, NOT a reminder delivery service | Label as “Download calendar file”; no promise of push reminders |
| Assistive camera | Assistive.tsx uses optional local MediaPipe-based hand/nose interactions | REAL device-dependent | Permission/calibration/recognition confidence/errors with no compulsory camera; keyboard fallback |
| Settings / backup / export | SettingsV3, exports, revisioned account preferences and backup routes exist | REAL; host-specific limits | Clarify actual local/server state, contrast validation across themes, no fake sync success or silent conflict resolution |
| MCP operations | Connected server currently exposes 64 tools; get_capabilities reports 2.2.0; read-only workspace/packs/attempt calls were exercised successfully during audit | REAL connector; write end-to-end not tested during audit | Upgrade discoverability and workflows with evidence/codes, not tool-count inflation |

**Audit output required before implementation:** an owner, UI screenshot or failing interaction trace, underlying read/write API, classification, user value, test and status for every row. A mock-only feature must be relabeled as DEMO or removed from main navigation until it has a real contract.

## 2. Flashcards V4: Tinder-like motion, actual SRS, full keyboard equivalence

### Interaction contract
- Present one readable, centered card and a quiet next-card silhouette. A tap, click, Space or Enter flips; a flip must not grade. The front is the question; the back is the actual answer plus explanation and optional evidence reference. Long answers scroll *inside* the card without accidentally starting a swipe.
- Horizontal drag uses Motion/Framer Motion gesture values (x, rotation, opacity, directional overlays). Left means **Lupa (0)** and right means **Mudah (3)** only after the answer is revealed. This preserves current semantics; the other two valid ratings are **Sulit (1)** and **Bagus (2)** via large visible buttons and arrow/number shortcuts. Do not compress four review outcomes into two without explanation.
- During drag: feedback “← Lupa” or “Mudah →” emerges gradually at a meaningful threshold; haptic feedback is optional and never the sole indicator. Below threshold release springs card back; above a tested distance/velocity threshold it leaves the screen, next card rises, and a brief status acknowledges the rating.
- Suggested *testable starting values*, not proven constants: dead zone 12–18 px; release distance 80–110 px OR horizontal velocity above a tuned threshold with intention safeguards; spring return 180–300 ms; departure 180–280 ms; flip 200–320 ms. Tune on touch devices, reduced-motion, narrow devices, small text and scrolled card bodies.
- On busy save: avoid repeated commits; stage/persist the rating through the actual review API and show “Tersimpan lokal” or “Tersinkron” as warranted. Do NOT show “Rated” for a failed write. On error restore/retry the same card without losing its choice. No celebratory animation for ordinary review.
- Undo is a **separate persistence design decision**, not a decorative toast: either implement a staged grace window with guaranteed flush/recovery or use a new safe inverse review operation that respects immutable events and tombstones. Until completed, omit Undo.
- Progress: n/N of the selected queue; count actually rated vs only viewed; due/new labels follow real SRS data; on empty, say why. Session exit and resume should not duplicate review events.

### Accessibility and shortcuts
- Front: Enter/Space to flip, Esc to close. Back: 1/← Lupa, 2/↓ Sulit, 3/↑ Bagus, 4/→ Mudah. Provide an always-available “?” shortcut guide and readable labels on buttons. Do not hijack keys while a text field, dialog, link or other focused control owns them. Preserve Tab navigation and focus after moving cards.
- Swipe must have a **single-pointer click alternative AND keyboard equivalent**, independently satisfying WCAG 2.2 dragging requirements. Screen readers get card position, flipped side, rating action and save result via concise live regions, never a flood of animations.
- Reduced motion replaces rotation/fling with a short crossfade or instant state; no forced camera, vibration or sound. Avoid hover-only feedback.
- Touch-action policy prevents horizontal gesture from blocking page vertical scrolling; a vertical scroll of long card text must never count as a rating.

### Component design
Separate FlashcardDeck controller, FlashcardMotionView, CardFace, RatingDock, KeyboardShortcuts, ReviewCommitStatus and PersistenceAdapter; one reducer/state machine governs idle/front/back/dragging/committing/failed/completed. Motion updates x/rotation via motion values, not a React state update on every pointer frame. The backend/engine, not animation, produces the rating event.

**Done only when:** left/right swipe AND 1–4 keyboard AND button paths create identical persisted ratings; failure can retry; a refresh preserves committed state; no double writes under fast swipe; narrow-screen and long-text cards work; screen readers and reduced motion pass.

## 3. Concept Studio V4: true mind maps, associations and learning evidence

Do **not** rename the current token-overlap graph a “verified mind map.” Provide two explicitly different views:
1. **Text Associations (existing, improved):** heuristic links from shared explanatory terms, with a visible “inferred by text overlap” label. Edge details reveal the exact shared terms. Useful for discovery, never authority on causality.
2. **Concept Map (new, evidence-linked):** typed relations saved as structured entities, for example “causes”, “inhibits”, “part of”, “regulated by”, “prerequisite”, “contrasts with”, and “example of”. Direction, source provenance, author/reviewer status and optional explanation are required before presenting a link as a factual relationship.

Nodes connect directly to: source material (when available), related questions, flashcards/review queue, diagnostic attempts, latest observed misses and contextual ChatGPT “explain / verify / create a test” actions. Confidence is *evidence visibility* (source supplied/checked) rather than a fabricated percentage.

### Layout and controls
- Dedicated Map Canvas with overview/minimap, fit, zoom, pan, collapse branch, search/highlight, keyboard node search and accessible outline/tree list. Node detail is a side inspector, not a popup covering the entire map.
- Modes: **Explore** (read), **Focus** (isolate one concept), **Repair** (show observed missed concepts and available unseen questions), optional **Edit** (explicit content write). Avoid silent writes when dragging nodes.
- Save user-edited spatial positions separately from conceptual facts, so moving a node does not imply editing a relationship. Stable concept IDs; avoid using concept label as a long-term identifier.
- For a handful of nodes, SVG with carefully engineered layout may suffice. Evaluate @xyflow/react / React Flow for drag handles, custom edges, accessibility and subgraphs only after bundle size and iframe-host performance tests. React Flow 13 changed APIs in Nov 2026: migration must be version-aware, not copied blindly.
- Large graphs need bounded rendering/virtualization, deterministic layout, search filters and no quadratic re-computation on each render. Use worker computation only if profiling proves it helpful.
- Accessibility: selectable/expandable concept list with the same operations as canvas; no drag-only reordering. Keyboard focus follows selection. Edges have textual relation statements accessible to screen readers.

**Done only when:** graph can be searched and used to open true source/question/review destinations, scientific typed links have evidence and status, text-only heuristic links never masquerade as facts, and keyboard/mobile navigation is complete.

## 4. Visual Lab V4: visualization is not automatically a simulation

Distinguish three artifact types in UI and structured schema:
- **Explanation visual:** diagrams/charts/interactive illustrations; describes a mechanism but may be static.
- **Interactive simulation:** controls drive a declared model, parameter ranges and units, a deterministic state transition/calculation, a plotted/visible outcome, reset, compare and export.
- **Custom HTML visual:** standalone sandboxed artifact made by ChatGPT; must be explicitly labeled user/generated content, not verified science.

A real simulation artifact requires:
- A topic, learner objective, source reference, assumptions, model definition/version, named controls, labels and units, min/max/default/step, outputs, state transitions, reset behavior, expected ranges, known limitations and validation cases.
- A renderer library of composable safe controls (sliders, switches, select, play/pause, stepped mechanism, compare A/B). Prefer typed data-driven simulations for ordinary subjects. Allow sandboxed HTML only for cases that cannot be represented by safe reusable components.
- **Scenario compare:** before/after or control/intervention paired state with exactly the same model and input conditions except explicitly changed variables. Slider updates show cause/effect with readable feedback, but never invent clinical certainty.
- Deterministic tests with expected output fixtures from provided authoritative references. Invalid parameter combinations show an explanation and disable unsupported transitions. Users can inspect “what changed and why”.
- Full lifecycle: requested → generating in ChatGPT → validated draft → saved via MCP → loaded/rendered → reviewable → edited/versioned. A request-to-ChatGPT acknowledgment is NOT a completed artifact.
- Sandboxing stays restrictive: no arbitrary network, no parent access, no untrusted script in main app. Provide explicit loading/failure states, offline handling, resize, keyboard control and link to context/source. Do not silently add scripts or CDN dependencies.
- Preview can be honest and useful without “run simulation” if the content is just HTML explanation.

Examples of worthwhile first simulation templates (only with verified inputs): pharmacology receptor occupancy with clearly stated simplified assumptions; gastric acid regulatory direction stepper; gas-exchange parameter relation; renal filtration qualitative comparison. Each must label domain validity—simulation outputs are not medical predictions.

**Done only when:** users can manipulate valid inputs and observe repeatable outputs, compare scenarios, reset, access a readable explanation/source, and save/open the artifact from ChatGPT via a confirmed MCP receipt. No simulated output without an actual model.

## 5. Other under-refined surfaces and honest product identities

### Comics
Reader with panel-by-panel navigation, progress, text zoom, mobile horizontal reading or scroll, accessible dialogue/caption separation, caption/source popover and image loading/error/retry. Show status Draft / Creator-reviewed (self-reported) / Externally verified (only with actual external proof, if ever). Existing storyboard placeholder remains explicitly labeled and never presented as a final illustration. Handle unavailable image transfer: ChatGPT can draft a storyboard, but the Noodl saved image must be actual bytes or a validated standalone SVG.

### Brain Dump / free recall
Add a resumable recall entry to relevant bank workspace, not a simulated form. Per unit show objective, learner's verbatim answer, neutral hint if justified, feedback split into initial vs prompted recall, reference slide and unresolved gap. Tool-level ChatGPT session remains authoritative. “Practice this gap” requests unseen question candidates, creates real attempt through MCP and displays what was actually saved. Respect the existing reveal boundary (do not show reference scoring points before first attempt).

### Knowledge Debugger
Current GastricDebugger is intentionally a hardcoded pilot: move to a labeled Demo section until a generic authored-scenario schema exists. Real debugger objects require nodes/relations, one or more intentionally incorrect claims, rationale, credible sources, user edits, validation rules and explicit feedback. Use meaningful graph highlighting and keyboard-selectable edges; do not pretend the fixed demo supports arbitrary topics. Track retries only if real records persist.

### Quiz, Batch, Results and SRS
Continue real server grading and immutable snapshots. Improve progressive disclosure: prompt → response → committed feedback → explanation → new question; no changes to grading by animation. Batch supports keyboard selection and editing before explicit submit. Results links exact missed concepts, known evidence counts, and unseen diagnostic questions if available. A correct retry is a *new observation*, not proof of mastery. SRS counters always distinguish new, due and already rated cards.

### Smart Next Step / Today
Preserve deterministic active session → due SRS → repeated misses → bank order. Add "why recommended" and freshness of evidence. When no facts support a personalized recommendation, show “Continue last bank” rather than AI-flavored invented weaknesses. Offer one primary CTA and secondary navigation without hiding options.

### Library / MCP creation
“Create with ChatGPT” is a handoff, not direct generation. Provide an operation context receipt/status if the MCP flow actually commits, plus browse/search/reopen the saved bank. Manual editor remains a secondary valid path. Create/append/edit operations must preserve version checks and avoid duplicate questions on retries.

### Study calendar / Bloom / assistive camera / offline / publishing
- Calendar: label .ics as downloadable calendar file, NOT background alarm service.
- Bloom: display requested distribution separately from actual achieved distribution. Prompt percentages alone cannot guarantee a certain cognitive level.
- Camera: real optional local recognition with transparent device permissions and fallback; never require it to complete any study activity.
- Offline/sync: distinguish saved device copy, changes pending, server confirmed and conflict. Avoid showing a reassuring checkmark when it is only queued.
- Publications: explain publicly visible answer keys and copy permanence. Sharing needs explicit consent and a clear, accessible confirmation.

## 6. MCP V4: fewer steps, not dozens of additional low-level tools

Keep the existing 64-tool surface for backwards compatibility, but introduce a handful of intent-based operations:
- **get_study_context:** compact account/bank/current attempt/due review/observed errors with counts and provenance; no full bank or answer keys unless needed.
- **prepare_pack_change:** validate questions/artifacts/relations/source citations without committing; return structured diff, duplicates and conflicts.
- **commit_pack_change:** atomic, revision-aware commit of an approved prepared change; idempotent retries, no silent overwrite.
- **get_operation_receipt:** show submitted/committed/conflict/failed status, saved IDs and revisions, surfaced consistently to host and app.
- **prepare_repair_practice:** select genuinely unseen question candidates on observed weak concepts (or explain why none exist).
- **open_study_surface:** small result UI for confirmation and larger workspace only for practice. Never attach full bank data to an unrelated status card.

Use structured input/output schemas and stable error codes with recovery instructions. Avoid returning entire bank snapshots in both model-visible text and structured UI payload. Separate model-visible summary from UI data where host capabilities permit. Link specific actions with source IDs, revision and context rather than copying private full histories in every handoff.

### Suggested structured source/evidence entities (planned, schema design required)
- **SourceRef:** sourceId, displayed title, page/slide/section, snippet/anchor (optional), verification status, optional stable external URI. Do not fake a source anchor when original source has left the ChatGPT session.
- **Concept:** stable id, label, aliases, optional tags. Content label changes should not orphan historical links.
- **ConceptRelation:** id, from/to concept ids, relationType, direction, rationale, sourceRefs, status {derived, reviewed, disputed}, revision.
- **LearningEvidence:** immutable event ID linking account, subject concept, attempt/brain-dump/review, observed result, hint status, timestamp; not an inferred mastery number.
- **VisualizationSpec / SimulationSpec:** type, version, sourceRefs, validity, parameter controls, deterministic model and expected outputs, review state.
- **OperationReceipt:** operationId, type, target ids/revisions, status, committedAt, pendingSync, error code, safe recovery action.

Keep the existing pack/question/artifact shapes readable. Add versioned optional fields or sidecar entities and explicit migrations; do not require every older pack to be rewritten. Schema changes must be round-trip tested through app UI, API, MCP and exports.

## 7. Interaction, motion, feedback and identity across features

Baseline palette: Slate #172A36 text/focus, white surfaces, neutral #F6F8FA background, Amber #FFBA59 primary action. Keep semantic text-on-surface color roles, accessible focus and themes. Avoid repaints with huge gradients and identical “all-feature cards”. Give modes different **layout shapes**:
- Flashcards = one physical card + fixed rating dock;
- Concept Map = spatial canvas + inspector + accessible list;
- Visual Lab = large interactive exhibit + parameter inspector;
- Simulation = controls + outcome + comparison + validity note;
- Brain Dump = single prompt/response + feedback with source points;
- Review = queue of scheduled questions;
- Results = observed metrics + one defensible next action.

Motion tokens (provisional tuning): press 80–140 ms, tab 160–240 ms, panel 200–300 ms, swipe release 180–300 ms, small overlay 180–260 ms, results entrance 240–400 ms. Motion must encode state or spatial continuity. Keep reduced-motion alternative and prevent unnecessary layout jumps.

Feedback matrix for every interactive component:
**idle / ready → interaction started → local pending → server confirmed OR failed/conflict → recover/retry**. Show these as small, consistent inline states, not endless success toasts. For data generated by ChatGPT add **request sent** and **MCP write verified** as distinct states. A button is disabled only with a reason, never permanently because its backend isn't implemented.

## 8. Input and mobile interaction matrix

| Action | Touch | Mouse | Keyboard | Screen reader |
| --- | --- | --- | --- | --- |
| Flip flashcard | Tap | Click | Space/Enter | Accessible “reveal answer” button |
| SRS Forgot/Easy | Swipe left/right **after flip** | Drag or click button | ←/→, 1/4 | Labeled buttons and commit status |
| SRS Difficult/Good | Tap explicit button | Click | ↓/↑, 2/3 | Labeled buttons and commit status |
| Pan/zoom map | Touch pan/pinch + visible controls | Drag/wheel + controls | Zoom buttons, node list, arrow focus | Textual graph relations/list |
| Simulate parameter | Slider/tap step | Slider/input | Tab + arrow +/- on focused control | Labeled value/unit/output |
| Quiz | Select option and submit | Click | 1–N / Tab / Enter as context allows | Question/answer/feedback announced once |
| Close/dismiss | Visible close button | Click | Esc | Named close control |

WCAG 2.2 2.5.7 requires an alternative to dragging operable by a single pointer. Keyboard access is an additional, separate requirement. For any gesture, preserve non-gesture button controls and focus navigation. Respect minimum target sizes, non-color cues, text contrast and reduced motion.

## 9. Build architecture and migration order

Components to refactor/reuse:
- src/ui/Study.tsx ManualFlashcards → separate deck controller/animated surface/rating persistence/shortcut manager; retain engine and onReview API.
- src/ui/Tools.tsx LearningTools → MaterialViewer, ConceptExplorer, MindMapCanvas, VisualGallery, SimulationRunner, StudioStatus; keep the shared accessibility model and existing historical artifacts.
- src/shared/conceptGraph.ts → keep lexical graph as a distinct data source; typed concept relations are separate.
- src/ui/Autopilot.tsx → shared card chrome and feedback with timed exposure semantics preserved.
- src/ui/GastricDebugger.tsx → honest one-scenario demo until scenario DSL and validator exist.
- src/ui/Comic.tsx → reader polish and verified asset availability; keep schema validation.
- src/server/control.ts, index.ts, brainDump.ts → compact MCP context, prepare/commit/receipt and source/event bridge with revision safety.
- src/shared/types.ts and validation.ts → optional versioned source refs and relation/simulation entities with migration compatibility.
- src/ui/SettingsV3.tsx → coherent controls for gesture sensitivity / reduced motion / keyboard help / sound and source presentation; do not add dead toggles.

Preserve the scoped default theme vs editorial overrides; no blanket CSS replacement of study/player logic. Feature flag major renderer changes, allow reverting to existing map/viewer without changing data. Test dependency upgrades against current React 19, Motion 12 and embedded iframe. Avoid automatically choosing heavy graph or physics dependencies just for visuals.

## 10. Prioritized delivery plan, with real acceptance gates

**Phase A — Feature truth and baseline (P0)**
- Inventory every existing tool/control and its data read/write, mark REAL / PARTIAL / DEMO / HANDOFF / PROPOSED.
- Capture real desktop/mobile screenshots and device keyboard traces. Add tests for current flash shortcuts, drag thresholds, concept heuristic disclaimers, simulation sandbox and ChatGPT handoff.
- Deliverable: audited feature matrix, acceptance test cases, UX flows, no code behavior changes until approved.

**Phase B — Flashcards and shared interaction foundation (P0)**
- Implement robust SRS swipe physics, click/keyboard equivalence, the fixed rating dock, long-card scrolling and accessible feedback; unify motion/status patterns.
- Implement persistence-safe failure/retry; optional undo only when designed with actual immutable events.
- Gate: no duplicate rating, consistent 0–3 outcomes across input modes, local/server status truth, 320/390/768/1440 px and reduced-motion pass.

**Phase C — MCP reliability and cross-feature links (P0/P1)**
- Compact study context, prepare/commit/receipt, proper schema and error recovery; instrument source IDs and confirmed writes.
- Wire Results → ChatGPT → new questions → saved attempt; Brain Dump → diagnosed missing point → independent test when source supports it.
- Gate: full *real* host-connected test, no invented IDs/sources, safe revision conflict and Guest fallback, no false success.

**Phase D — Concept Studio and verified relationships (P1)**
- New layout/inspector, accessible tree, source-backed typed edges, heuristic association mode and concept actions. Consider React Flow only after performance audit.
- Gate: every relation has a declaration of evidence/status, keyboard/touch controls parity, no fabricated causal facts.

**Phase E — Visual Lab, structured simulations, comics (P1/P2)**
- Make visualization loading, source, revision and feedback honest; implement at least **one genuinely parameter-driven, deterministic, source-checked simulation** before advertising generalized simulation capability.
- Improve comic reader and asset-review workflow.
- Gate: controls affect tested model outputs and reset/compare works; sandbox remains restrictive; error states and offline behavior tested.

**Phase F — Other product edges and rollout (P2)**
- Knowledge Debugger generic schema only when validated; Bloom generated-vs-actual report; optional schedule integration only when actual reminders are supported; advanced camera polish and exports; full Settings discoverability.
- Gate: no decorative controls, no fake background reminders, no false “reviewed” badges, no live regressions.

For each phase: independent GitHub PR, typecheck, unit+contract tests, browser smoke, keyboard and reduced-motion pass, screenshot inspection, accessibility review, migration/rollback proof, then merge. OpenAI Sites release packaging does not equal deployment; deploy separately and verify the live project version.

## 11. Test, performance and release definition of done

Functional end-to-end scenarios:
1. ChatGPT prepares and commits bank content; UI shows saved receipt and opens exactly that bank.
2. One flashcard is flipped, left-swiped as Forgot; another is rated Good with keyboard; review log matches and reload preserves counts.
3. Swipe threshold release below limit cancels; vertical scrolling on a long card never grades; no event written when flipping.
4. Offline rating has clear local status; sync later confirms, conflict does not silently discard.
5. A wrong quiz answer produces an observed error and a distinct unseen follow-up (or an explicit “no alternate question available”), not the same memorized option order.
6. Brain Dump shows only the prompt before initial recall; after assessment it connects a missing point to follow-up practice with source labels.
7. Lexical graph stays explicitly heuristic; verified map edge includes direction, citation and status; keyboard list opens same concept as canvas.
8. Visual Lab invalid or untrusted HTML cannot access host; a true simulation has deterministic valid controls, reset, repeatable outputs and documented assumptions.
9. Comics show draft/storyboard visibly when illustration is missing; claimed review is never inferred from a successful save.
10. Calendar download is described as a file, not scheduled background delivery; Bloom percentages are a request until measured.
11. All feature routes behave at 320/390/768/1440 px and with reduced motion, no overlap, clipping, or trapped keyboard focus.
12. Tool errors, retries, cross-account isolation, deleted entities, duplicate operationId, and stale revisions behave predictably.

Performance objectives to measure, not claim: visual swipe frame cadence approaching 60 fps on a mid-tier phone; no >100 ms main-thread stall on common actions; map pan/zoom responsive on realistic bank sizes; avoid bundle inflation and re-rendering every concept on each pointer frame. Test touch/desktop keyboard behavior in real Chrome, not only unit tests.

**An item is not DONE because its button exists, because a prompt was sent, because ChatGPT proposed output, or because a screenshot looks convincing.** It is DONE only with a validated source-data contract, actual outcome, feedback, persistence, error recovery, accessibility and regression proof.

## 12. References and revision log

Technical reference reading checked 2026-11-20:
- Motion for React drag and motion values: https://motion.dev/docs/react-drag and https://motion.dev/docs/react-motion-value
- React Flow map tutorial and accessibility: https://reactflow.dev/learn/tutorials/mind-map-app-with-react-flow and https://reactflow.dev/learn/advanced-use/accessibility
- React Flow 13 release 2026-11-16: https://reactflow.dev/whats-new/2026-11-16
- WCAG 2.2 dragging movements: https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements
- MCP Apps UI/structured-result architecture: https://apps.extensions.modelcontextprotocol.io/api/documents/overview.html

**2026-11-20 — V4 planning revision 1**
- Merged the earlier MCP-refinement proposals with V3 reality rather than pretending the MCP changes were shipped.
- Clarified that Flashcards **already swipe and support arrows/1–4**; work is physics, accessibility and persistence feedback, not basic gesture invention.
- Split lexical associations from true typed evidence-backed mind maps.
- Split existing HTML Visual Lab from a source-verified, deterministic simulation engine.
- Classified hard-coded gastric debugger as pilot and Bloom/calendar as honest prompt/export tools.
- Added component-level acceptance criteria, cross-feature learning evidence, phased migration and no-mock definition of done.
- **Document-only change. No app behavior, database, account preference, MCP tool or deployment changes made by this plan.**
