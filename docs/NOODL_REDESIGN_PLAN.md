# Noodl 2.0 — UX/UI redesign execution plan

**Status:** implementation-ready proposal; no runtime UI changes have been made.  
**Baseline:** branch `main`, commit `d6494c4b6b28294c6ac356c0a4aae1595fe89c8d` (2026-11-19).  
**Audience:** learners who already have study banks and want to start, resume, or review without navigating a feature showroom.  
**Primary outcome:** fewer decisions before meaningful learning, without losing existing Noodl capabilities or data.  
**Scope:** React website, embedded ChatGPT panel, offline/guest states, UI feature truthfulness, and foundations for future features.  
**Non-goals:** rewrite the learning engine, silently alter scores, migrate private records, replace brand identity, add an AI provider, or deploy to production as part of this plan.

## 1. Why a redesign is warranted (observed code)

The actual interface concentrates too many unrelated tasks in `src/ui/classic/Home.tsx`: bank picker, JSON import, ChatGPT request, mode controls, flashcards, one-question probe, Brain Dump handoff, a hard-coded gastric-acid debugger, calendar download, recent practice, and mascot. `src/ui/classic/Navigation.tsx` has five persistent destinations plus a quick-jump dialog containing eleven routes/actions. `src/App.tsx` combines routing, account lifecycle, import, publication, preferences, study session state, library lists, and modal management. `src/ui/Tools.tsx` handles export, material, a lexical concept graph, HTML simulations, and the review dashboard.

This is a **hierarchy and task-location problem**, not a mandate to delete features. Keep the functions, locate them where users expect them, and stop displaying low-frequency actions beside a primary task.

### Evidence-backed behavior and misleading affordances

| UI/feature today | What the code actually does | Redesign contract | Files to inspect |
| --- | --- | --- | --- |
| Save offline | `markDownloaded` sets a local flag; account packs are already cached by snapshot sync, while the service worker caches app shell/assets | Show separately **local copy**, **app available offline**, and **pending sync**; avoid the language of a downloaded package until it really exists | `src/client/store.ts`, `src/client/index.ts`, `scripts/build-worker.mjs`, `src/App.tsx` |
| Home ChatGPT generation | Browser opens ChatGPT and attempts clipboard copy; embedded panel sends a host message; source-file processing is not implemented in the website | Explicit "Continue in ChatGPT" handoff in browser, in-panel creation flow only when host exists; never imply native in-page generation | `src/client/bridge.ts`, `src/ui/classic/Home.tsx`, `src/App.tsx` |
| Brain Dump from PPT | Real MCP session tools; the website button initiates a ChatGPT request, not an in-app slide reader | Move to contextual "Create / from slides" handoff and explain where the practice occurs; no fake upload/process indicator | `src/server/brainDump.ts`, `src/ui/classic/Home.tsx` |
| Concept map | Connects concepts if explanations/key points share at least two words; not evidence of scientific causality | Say **textual associations** and expose why an edge exists; future structured relationship model only with source evidence | `src/ui/Tools.tsx` |
| Knowledge Debugger | One hard-coded gastric-acid exercise with one incorrect link | Remove global Home entry; retain as clearly labeled "Gastric acid pilot" inside a contextual Lab until data-driven exercises exist | `src/ui/GastricDebugger.tsx`, `src/App.tsx`, `src/ui/classic/Home.tsx` |
| Mix Room | Copies every selected pack's questions into a NEW persistent bank | Prefer an ephemeral multi-pack session using the existing `SelectionItem` and snapshot validation; preserve per-source provenance; make "Save combined bank" a separate explicit action | `src/App.tsx`, `src/shared/engine.ts`, `src/server/index.ts`, tests |
| Bond | Mascot level depends on number of completed sessions (0/5/30), not independently measured understanding | Keep kaomoji as brand character; label level as session milestone, not mastery or interpersonal bond; put it in Today only | `src/ui/classic/Home.tsx` |
| Review due | `ReviewDashboard` counts never-reviewed cards as "due" along with genuinely due SRS cards | Distinguish **New**, **Due**, **Learning**, and **Completed**; explain rating effect without unsupported mastery claims | `src/ui/Tools.tsx`, `src/shared/engine.ts` |
| Autopilot | Times exposures; flips cards; explicit rating or later one-question probe supplies recall signal | Show exposure count/time as exposure, not learning or grades; keep pause and delayed check; keep it out of Quiz primary action | `src/ui/Autopilot.tsx`, `src/shared/practice.ts` |
| Study calendar | Generates a downloadable recurring .ics file | Label "Export calendar event"; never claim active reminders/notifications | `src/ui/StudyPlanning.tsx` |
| Mixed questions | Rule-based transformation of MCQ into true/false or fill-blank; exact normalized text matching for fill-blank | Show a mode explanation and avoid framing it as semantic grading; do not change evaluator silently | `src/shared/engine.ts`, `src/shared/validation.ts` |

A feature becomes a global navigation destination only if it is implemented, usable without hidden prerequisites, and repeatedly used as a primary task. A pilot can remain reachable contextually without pretending to be a product-wide capability.

## 2. Product identity (must remain)

**Design thesis: “Noodl Study Desk.”** A playful, calm learning workspace with readable questions, a recognizable kaomoji companion, light paper-like surfaces, purposeful indigo accents, and confident controls. Keep the wordmark, the mascot's character, Noodl's optional theme palette, learning vocabulary, and approachable tone. Not a SaaS analytics dashboard, not a purple-gradient landing page, and not sterile monochrome.

- **Color:** retain the existing default indigo (`--primary` currently `#4f46e5`) and all ten supported themes as compatibility inputs. Use surfaces and typography for hierarchy; indigo for a real selected/primary action, not on every icon. A violet accent is a *brand decision*, not a generic-gradient default.
- **Surfaces:** mainly solid or subtle translucent paper; at most one prominent glass surface in a viewport. No stacking blur on cards, navigation, and dialogs simultaneously.
- **Typography:** readable content-first scale; questions 18–22px responsive, learning prose at least 16px where practical; compact metadata may be smaller if accessible. Preserve math/Markdown rendering.
- **Mascot:** one recognizable interaction in Today and optional contextual result feedback. Avoid nonstop bouncing, fake claims of empathy, or repeated mascot overhead in every question.
- **Tokens:** define spacing, type, radii, density, focus, surface elevations, and motion at one source of truth. Map from `src/ui/theme.ts` and `src/shared/preferences.ts`; do not discard user customizations.
- **Liveliness target (anti-slop scale):** ENERGY 2 / RHYTHM 2 / MOTION 2 globally; during a timed quiz MOTION 1. Calm is part of focus; no constant parallax.
- **Responsive identity:** phone layouts are designed, not desktop squeezed. Do not force desktop-sized multi-columns and toolbars into a phone.
- **One focal action per screen:** inactive secondary choices must not look equally important. Do not invent whitespace-filler charts, badges, testimonials or statistics.

## 3. Information architecture: move tools to their context

### Primary navigation (desktop and phone)

1. **Today** — resume the last unfinished attempt or start a recent bank; then genuine due reviews; then recent activity. One primary CTA.
2. **Library** — search, browse, create/import banks, browse public packs. Selecting a bank opens its detail workspace.
3. **Review** — distinguish new cards and due cards; study history, card queue, and next explicit review action.

Settings lives under account menu. Explore/public catalog lives as a Library subview, not a main tab. Mix is a multi-select action within Library, not a persistent top-level tab. Materials/Concept map/Visual Lab/Comics live inside a selected bank, not global routes that first ask which bank to use.

**Practice is a full-screen task flow**, not a fourth global tab. When practicing, the regular navigation is hidden and a clear "save and leave" control returns to the originating context. Direct-open ChatGPT tool actions and existing public bank URLs must continue to work.

### Destination-level screen design

| Screen | First visible answer to the user's question | Dominant action | Secondary/next content | Deliberate omissions |
| --- | --- | --- | --- | --- |
| Today with active session | What can I continue? Attempt title, answered/total, mode, last update | Resume | Due review preview, recent banks | No import, debugger, three mode grids, or long tool index |
| Today without active session | Which saved bank should I start? Recent bank(s), concise onboarding if empty | Start/choose bank | Review queue, create/import in secondary location | No fake activity statistics |
| Library | What content do I own, and where is it? Search and compact bank list | Open bank | Folder filters, select multiple for Mix, create/import, Public catalog | No duplicate full dashboard on every card |
| Pack detail | What can I do with this bank? Real question count, description, last session | Practice | Flashcards, Materials, Visual Lab, Concept map, Comics, History | Show only tools with content, or clearly state what will be created in ChatGPT |
| Practice setup | Which actual mode and rules will apply? | Start session | Mode descriptions, shuffled/mixed/retention controls, initial probe under "More" | No giant Home form |
| Active Quiz | What question should I answer now? Question and options | Answer / Continue | Progress, optional hint, contextual explanation | Global nav, promotional AI CTA, unrelated tools |
| Batch Quiz | Which items remain unanswered? | Submit when complete | Numbered question list, jump-to-unanswered, autosave status | No pretend instant grading before submission |
| Results | What did I get right or miss? Recorded accuracy and unanswered count | Retry mistakes | Explanations, concepts, history, contextual tools | No fabricated mastery score |
| Review | Which cards actually require recall? | Review due cards | New cards distinct, short schedule explanation | No unearned “learned” label |
| Tools inside Pack | What material/diagram exists for this bank? | Read/open selected real artifact | Relevant cross-links, create via explicit ChatGPT handoff | No all-tools grid independent of pack |
| Settings | Which settings can I really control? | Save settings | Theme, density, motion, sync/backup/account | No decorative KPI |

For a new bank, do not show empty Visual Lab and Comics as working content. Provide an honest empty state with an exact action: "Create in ChatGPT" where supported. A missing artifact is not a broken link or a sample artifact presented as real.

### User journeys

- **Returning learner:** Today → Resume → Answer → Results → Retry mistakes. Target: one click from an active session to resume (design target, not measured).
- **Start from owned bank:** Library → Bank detail → Start practice → Quiz. Mode can use a remembered default; an edit control opens the setup. Target: at most three deliberate actions from Library to first question (to be tested).
- **Review:** Today due prompt OR Review → Due queue → answer/rate → Next. Never count untouched cards as due.
- **Prepare content:** Library → Create/Import → Bank detail. ChatGPT content creation uses a transparent web/embedded handoff.
- **Mix:** Library multi-select → configure mix → ephemeral study attempt; do not create a permanent bank as a side effect.
- **Explore:** Library → Public → Preview → Copy → owned Pack detail. Explicitly warn that published banks expose answer keys.

## 4. Motion design (use the installed framer-motion dependency)

Framer Motion is already in `package.json`; do not install an overlapping motion library. Extract a `NoodlMotionProvider` that integrates the existing reduced-motion preference and operating-system preference.

| Motion | Purpose | Suggested behavior | Failure to prevent |
| --- | --- | --- | --- |
| Page/route transitions | Make context changes legible | 160–220 ms opacity + 4–8px transform, no heavy stagger; avoid animating on initial offline hydration | Remounting active session, losing draft, focus disappearing |
| Tab/segment selection | Show selected mode or study tool | 150–200 ms selection indicator, no bouncing | Layout shift, ambiguous state |
| Answer feedback | Couple interaction with consequence | 120–180 ms state change; correct/incorrect differentiated by text and icon, not color alone | Delaying immediate answer submission |
| Study progress | Show actual work completed | width transition <=250 ms, disable when reduced motion; do not animate a false score | Fake progress |
| Sheet/dialog | Preserve orientation | 160–220 ms enter/exit; trap focus, close with Escape, return focus to trigger | Keyboard trap |
| Skeleton loading | Show layout shape while data is genuinely pending | Static shapes by default; restrained optional opacity pulse; avoid showing for trivial waits (<~150–200 ms) | Shimmer everywhere, fake data, CLS |
| Mascot | Brand delight on meaningful event | One short response after explicit milestone, not idle loops | Attention drain while reading |
| Reduced motion | Respect system/user setting | Zero translation/scale parallax; instant or subtle color/opacity; never hide readable content | Invisible content or involuntary motion |

Motion should animate `transform` and `opacity`, not properties that force repeated layout work. Focus must move predictably after route changes. No scroll hijacking, carousel auto-scroll, giant entrance before content is readable, or infinite decoration.

## 5. Loading, empty, error, offline, and pending states

Replace the one global loading message in `src/App.tsx` with a typed initialization state: `checking-local`, `ready-local`, `syncing`, `authentication-required`, `error`. This is a **proposed UI state model**, not a new current server API. Prefer showing cached content immediately while sync runs, not blocking the whole app.

Build dedicated components: `StudyShellSkeleton`, `LibraryListSkeleton`, `PackDetailSkeleton`, `ResultSkeleton` only if that region actually waits for data. Keep their geometry stable; use `aria-busy` and polite status text. Do not use a skeleton after the user already has a local record; show a small sync indicator instead. Skeletons must never imitate a fake chart, score, or bank. For long tasks, give a specific retry or exit path.

For each data view, explicitly define:
- **Empty:** what is absent + one real next action.
- **Loading:** what is being fetched + shape-accurate placeholder (if latency warrants).
- **Error:** what failed + retry or recovery that really exists.
- **Offline:** whether cached content is available and whether a write is pending.
- **Conflict:** preserve both versions; present existing "use server" or "save local copy" choices without loss.
- **Success:** only after actual local commit or server acknowledgement as appropriate.

## 6. Component architecture for future development

Do not create a new full framework just for a facelift. Extract gradually while preserving existing state and routes.

Proposed structure (not yet implemented):

`src/ui/shell/AppShell.tsx` — global top-level context, contextual navigation  
`src/ui/shell/PrimaryNav.tsx` — Today / Library / Review  
`src/ui/screens/TodayPage.tsx` — single real next action  
`src/ui/screens/LibraryPage.tsx` — bank list, filters, selections  
`src/ui/screens/PackDetailPage.tsx` — primary practice task and contextual tools  
`src/ui/screens/ReviewPage.tsx` — new vs due separation  
`src/ui/screens/SettingsPage.tsx` — account and preferences  
`src/ui/practice/PracticeSetup.tsx` — modes and study rules  
`src/ui/components/{AsyncBoundary,Skeleton,EmptyState,ErrorState,StatusBar}.tsx`  
`src/ui/motion/{NoodlMotionProvider,variants}.ts(x)`  
`src/ui/styles/{tokens,primitives,layout}.css` — mapped onto existing theme variables

Keep the domain source of truth in `src/shared/`, account transport in `src/client/`, and server validation in `src/server/`. Do not duplicate scoring, SRS, login, or offline sync logic inside presentation components. Replace giant CSS override chains with locally owned styles, and remove old styles only after parity review.

New features should register a clear **capability contract**: owner scope, prerequisites, saved data or read-only origin, navigation entry point, error/empty behavior, and completion event. A feature not supported by its backend must not appear as a working primary action. In-panel navigation still must honor `noodl-host-update`, `open_view`, `open_pack`, `open_attempt`, `open_autopilot`, and browser public/visual deep links.

## 7. Phased delivery (small reversible PRs, no big-bang rewrite)

### Phase 0 — Baseline and feature-truth audit (P0, prerequisite)
**Work:** capture real mobile/tablet/desktop and embedded/guest/authorized workflows; inventory all clickable controls and their consequences; capture a test-account dataset for empty, active, completed, offline, stale revision, and public bank; record current build/test status. Inventory current 10 themes and custom token overrides. Check mobile widths 320/390/768/1024/1440 and 200% text zoom.

**Touches:** tests, documentation; no production write.  
**Acceptance:** every exposed navigation/control has a named destination and an evidence label (working / handoff / pilot / absent), screenshots are actual renderings not assumed, current tests run, no real-user content modified.

### Phase 1 — Design tokens, primitives, focus, motion, and async states (P0)
**Work:** theme-compatible semantic tokens, button/form/dialog states, typography hierarchy, component spacing, a motion provider using existing framer-motion, representative skeletons, reduced motion, error/empty patterns, and accessible focus.

**Touches:** `src/ui/theme.ts`, `src/shared/preferences.ts` only if needed, existing CSS, new primitives and motion files, tests.  
**Acceptance:** all supported themes remain functional, existing custom preferences survive, no new duplicate color system, buttons/links meet contrast and accessible names, loading and failure never appear as success, keyboard-only navigation works.

### Phase 2 — Information architecture and Today/Library/Pack (P0)
**Work:** extract `App.tsx` view composition; three primary destinations; account settings; contextual bank detail; creation/import/public in Library; Mix action inside Library; relocate hard-coded pilot; remove global tool-picker detours where bank context already exists. Preserve legacy host/deep-link actions during transition.

**Touches:** `src/App.tsx`, `src/ui/classic/`, new screen/shell components, `src/ui/Tools.tsx`, `src/client/bridge.ts` only if necessary, UI tests.  
**Acceptance:** all existing owned bank actions reachable, at most one dominant CTA per page, one-click resume from Today when available, no dead nav entry, no anonymous user accidentally shown private tools, no regressions in guest/public paths.

### Phase 3 — Focused practice and honest results (P0/P1)
**Work:** focused quiz layout, answer feedback, readable math/long options, stable progress, batch jump-to-unanswered with real draft persistence, compact setup, results with real scored/unanswered counts, and retry mistakes. Use reduced motion and preserve keyboard/camera controls and TIME_RUSH deadlines. Do not change scoring policy in this redesign.

**Touches:** `src/ui/Study.tsx`, `src/ui/BatchQuiz.tsx`, `src/ui/Study.css`, `src/ui/classic/StudyOptions.tsx`, `src/App.tsx`, tests.  
**Acceptance:** saved attempt snapshot and revision preserved after navigation/reload/offline; exact correct/incorrect behavior unchanged; keyboard shortcuts work; timer not reset by animation/remount; no option clipped at narrow viewport.

### Phase 4 — Make secondary features truthful and useful (P1)
**Work:** separate new vs due SRS; label exposure honestly; add evidence to lexical concept edges; turn Mix into provenance-preserving ephemeral attempt; relabel Calendar and offline action; separate the real ChatGPT handoff from local creation; demote gastric pilot until generalized. Keep publication/exposure safety.

**Touches:** `src/ui/Tools.tsx`, `src/shared/practice.ts`, `src/shared/engine.ts`, `src/App.tsx`, `src/client/{index,store,bridge}.ts`, tests.  
**Acceptance:** no phantom "due" cards, no unwanted permanent bank on Mix, no misrepresented offline download or in-app AI, no invisible data migration, actual tests verify all revised behaviors.

### Phase 5 — Performance, hardening, and release (P1)
**Work:** lazy-load rarely used tool screens and high-cost PDF/vision logic, inspect bundle split, audit CSS overlap, exercise all states in real browsers, run build/smoke/auth/public/guest/offline regression, and deploy through the existing authorized Sites process only after explicit release decision.

**Touches:** `src/App.tsx`, `src/main.tsx`, `src/ui/`, build/test scripts as justified; preserve `.openai/hosting.json` project ID and D1 binding.  
**Acceptance:** no feature regression across standard, batch, survival, time rush, guest, embedded host, offline and public; real measurements reported separately from goals; no deploy implied by GitHub commit.

## 8. Required verification and performance budgets

**Existing checks:** `npm run typecheck`, `npm test`, `npm run build`, `npm run audit:production`. Test files currently contain 69 named cases by source inspection; this is NOT an executed passing result. The GitHub repository shows no workflow runs in the queried API response. The earlier docs have older verification counts.

**New browser/e2e coverage:** keyboard navigation, accessible dialogs, initial login/guest state, library filter, resume, quiz input, batch draft, timeout after navigation, retry, actual due/new review counts, offline reload, publication browse, ChatGPT host event mapping, focus after transition, all themes and reduced-motion. Add a browser test runner if necessary; do not pretend Node tests cover cameras or visual rendering.

**Target thresholds (not measured):**
- WCAG 2.2 AA and visible focus; normal text contrast >= 4.5:1, large text >= 3:1; UI non-text where required >= 3:1.
- Working touch targets ~44px in Noodl design; no obscured controls at 320px; no horizontal page overflow; zoom 200% without losing content.
- No layout shift during skeleton replacement where component geometry can be reserved.
- LCP <=2.5 s, INP <=200 ms, CLS <=0.1 at p75 **when real field data is available**; these are targets, not claims.
- Main quiz controls give immediate pressed/selected feedback; all timer and grading calculations remain engine-derived.
- Animations prefer <=240 ms for routine actions; no continuous non-essential motion without pause; use reduced-motion alternatives.

**Release guardrails:** unchanged account isolation, operationId/idempotency, expectedRevision conflicts, session snapshots, original question/option IDs, tombstones, offline outbox, publication answer-key warning, sandboxed visual HTML, and trusted host auth headers. No overwrite of active production data for visual testing.

## 9. PR sequencing and test ownership

| PR | Theme | Risk | Must pass |
| --- | --- | --- | --- |
| 0 | Baseline capture + screen and feature inventory | Low | Actual runtime evidence documented |
| 1 | Tokens/primitives/motion/skeleton foundation | Medium | Theme, reduced motion, accessible state tests |
| 2 | Today/Library/contextual navigation | Medium | Deep-link, guest, MCP open events, empty/error |
| 3 | Pack detail + practice setup | Medium | Existing content actions and defaults |
| 4 | Quiz/Batch/Results focus | High | Scoring immutability, deadlines, save/reload |
| 5 | Review and feature-truth cleanup | High | Due/new counts, mix provenance, offline semantics |
| 6 | Cleanup, split bundles, browser QA, deployment prep | Medium | Full test/build/browser matrix |

Each PR should specify **before/after screenshots from a real render**, changed components, why the motion/layout serves the task, test evidence, and limits not verified. Do not mark a mock as implemented based on a prettier UI.

## 10. Skill translation and intentional exceptions

**Anti Slop** (`miqdadbadjuber/anti-slop`, commit `1969b459f843603ba2efbbb24e8e1bf963c889b3`): purpose test, real functionality, empty/loading/error, accessibility, no invented metrics, mobile reflow, restrained glass, documented identity, and evidence-backed delivery gates.

**Taste Skill** (`Leonxlnx/taste-skill`, commit `f6b76575f949707b4e3c37cd86cb44b0b98643e8`): consistent spacing/typography/button system, real UI over decorative mockups, one task per visible region, focus/press response, motion budget, and real-browser inspection. **Exceptions:** its marketing-site hero/section recipes, automatic photography, dealt/random palette, and categorical “never violet” rule do not override Noodl's existing identity or app-specific needs. We also do not add shaders, parallax, or marketing “moments” to study screens.

**Repo-local anti-slop-design**: require a product-specific reason for color, motion, hierarchy, and visual personality. The existing `AGENTS.md` still applies: inspect callers/validators/tests and preserve stored data rules.

Sources:
- https://github.com/miqdadbadjuber/anti-slop/blob/main/antislop.md
- https://github.com/miqdadbadjuber/anti-slop/blob/main/skills/antislop-ui/SKILL.md
- https://github.com/miqdadbadjuber/anti-slop/blob/main/skills/antislop-layoutmobile/SKILL.md
- https://github.com/Leonxlnx/taste-skill/blob/main/skills/taste-skill/SKILL.md
- https://github.com/Leonxlnx/taste-skill/blob/main/skills/taste-skill/references/motion.md
- https://www.w3.org/TR/WCAG22/
- https://web.dev/articles/vitals

## 11. Implementation decision log

- **Retain:** Indigo/violet brand, kaomoji, ten themes, shared study engine, local-first caching, MCP host bridge, proven backend features.
- **Move:** Mix to Library; Tools to Pack detail; settings to account; Brain Dump to contextual ChatGPT creation; gastric pilot out of global Home.
- **Rename honestly:** "Offline" local/pending/app-ready states; "Due" vs "New"; exposed vs recalled for Autopilot; lexical links not causal concept maps.
- **Defer (not pretend to ship):** fully automatic semantic grading, source-file processing in website, generalized Knowledge Debugger, true cross-device exposure history, causal-graph inference.
- **Never:** block practice on animation, paint fake scores, discard offline changes on route refactor, or silently deploy a planning branch.

**Next executable action:** Phase 0 screen captures and Phase 1 token/primitives branch. This document intentionally does not claim that the interface has already been redesigned.
