# DESIGN.md — Noodl Study Desk

**Design direction for Noodl V3. Status: Slate source in PR #8, subject to CI and browser validation. OpenAI Sites deployment is tracked separately.** This contract accompanies [docs/NOODL_REDESIGN_PLAN.md](docs/NOODL_REDESIGN_PLAN.md). It does not mean the redesign is already deployed.

## Product thesis

Noodl is a study desk, not a productivity dashboard and not a page advertising AI. It exists to help a learner select useful material, retrieve an answer, learn from feedback, and come back when review is due. The fastest path to a meaningful study action is more important than showing every feature at once.

**Personality:** smart, playful, warm without gamification theater; a recognizable kaomoji mascot, concise language, confidence without fake mastery claims.  
**Design dials:** ENERGY 2 / RHYTHM 2 / MOTION 2 for browsing; ENERGY 1 / RHYTHM 1 / MOTION 1 during active timed practice.  
**Counterexamples:** generic SaaS 4-metric dashboard, huge gradients and blurry blobs, every feature in a bento card, all-purple buttons, endless motion, generic AI sparkle motifs.

## Brand continuity

Keep the Noodl wordmark, kaomoji character, existing preferences, and the legacy Focus Indigo theme as a user-selectable option. The user selected Slate / White / Amber for the new default and requested smooth, informative motion. Preserve the original ten themes and the former Editorial palette as optional themes (twelve total), including custom design-token settings.

The new default uses Slate #172A36, canvas #F6F8FA, white surface #FFFFFF, muted text #485D69, and Amber CTA #FFBA59. Former Ink / Ivory / Lime is the selectable Editorial theme; Focus Indigo remains selectable. Amber uses dark foreground text; text/background, text/surface, control boundaries and selected states must remain legible in every theme. Most surfaces are solid or subtle; use translucent glass for at most one strong layer per viewport. Keep focus and error states legible in dark and light themes. Validate every supported palette against real contrast computations.

## Visual language

- **Reading comes first.** Content width for quiz/prose roughly 40–46rem unless equations or diagrams need more. Larger application canvas can hold secondary material, not stretch question paragraphs across the screen.
- **Type hierarchy.** One sans-serif typeface across wordmark, headings, questions, controls, and metadata. Five deliberate roles: page display, feature title, section title, body, and metadata. Never mix serif headlines with small sans-serif controls. Keep controls at 14px or larger and question text around 21–26px on phones/desktop.
- **Spatial scale.** Derive one system from 4, 8, 12, 16, 24, 32, 48 spacing steps; named semantic spaces for section separation, card groups and inline controls. Responsive phone use is a distinct layout state.
- **Radius hierarchy.** Approximately 10–12px controls, 14–18px standard surfaces, and up to 22–24px expressive focal surfaces, mapped to the existing user-controlled radius setting.
- **Borders and shadows.** Three distinct grouping levels: one dark enclosed focal action on Today; 2px Ink rules at section boundaries; 1px muted dividers for rows. Only a reading sheet or search/filter group needs a light surface enclosure. Inputs use clearly visible control borders. Do not solve ambiguity by making every row a card. Alternate themes retain their own surface language.
- **Mascot motif.** Appears on Today, meaningful completion feedback, or genuinely empty state. It should never compete with long questions or timers.
- **Icons.** Use only for navigation meaning or affordance. Keep consistent weight and shape. Avoid generic sparkles as a substitute for product language.
- **Copy.** Use familiar Indonesian/English labels. Primary action starts with a verb, e.g., "Lanjutkan sesi", "Mulai latihan", "Ulangi kesalahan". No claims like "mastered" without evidence. No fake statistics.

## Screen hierarchy

### Today
First: **resume active session** (if present). Otherwise: **due review** based on replayed SRS records; then evidence-based focus on repeated misses; then start a recent bank. Secondary: real review count and compact recent activity. One short mascot moment; no creation workflow grid. If user has no banks, explain exactly how to import/create/copy.

### Library
Search and browse at a glance. Filters remain compact; bank rows show title, real count, folder, last activity, and one open action. Context menus hold edit, delete, publish and export. Multi-select opens Mix action only when selected; do not make a new bank implicitly. Public bank browsing is a subview of Library.

### Bank Workspace
Desktop: real three-column **Materials / Learning Canvas / Studio**. Mobile: one active panel selected by tabs; Focus Mode retains an undistracted question page. Read real stored artifacts, concept-tagged questions and history. Studio opens existing Flashcards, text-association Concept Map, Visual Lab and Comics. An MCP handoff requests new questions/materials without pretending transport success means backend persistence. An actual contextual drill can run only when questions exist.

### Practice setup
Choose one of Standard, Batch, Survival or Time Rush with a compact explanation and actual current rules. Defaults are visible, advanced switches collapsed. Start immediately with remembered defaults when the user uses a quick-start action; never overwrite user preferences for an animation.

### Active question
Progress context at top, question and answer controls as the focal point, optional hint, then explanation after answer. Button feedback must not delay scoring. No global navigation or unrelated tools. Preserve complete keyboard and optional camera controls; both are secondary to the reading task.

### Batch
Show answered/total, jump to unanswered, autosave status, and submit disabled until complete. Avoid animating entire banks of up to 100 questions. Persist drafts; never pretend unsaved input is safe.

### Results
Use the actual stored score and attempted/unattempted counts, concise explanation of errors, and one clear retry action. When different unseen same-concept questions exist, offer a **saved remediation batch**; otherwise offer a ChatGPT MCP request for new questions. Repetition of old questions must be labeled as such. Secondary links lead to specific bank resources. Do not turn a percentage into a mastery label.

### Review
Separate New, Due, and scheduled cards. Ratings are explicit actions with visible scheduling consequences. Never count unreviewed cards as overdue or invent retention metrics.

### Settings
Category navigation for Appearance, Study Defaults, Accessibility, ChatGPT/MCP, Data & Sync, Account and Advanced. All 12 themes remain selectable with preview, Save/Cancel and working language controls; custom colors and density live in Advanced. Sync, offline status, backup and access controls use accurate labels. Failed saves are visible and retryable. Never overlay persistent status on page content.

## Motion principles

Use the already-installed Framer Motion package, a single motion provider, and system/user reduced-motion preferences. Do not introduce another animation framework merely to animate buttons.

- **120ms:** button press or immediate feedback.
- **160–200ms:** tab/selection change and compact dialog transitions.
- **180–240ms:** navigation and panel changes via opacity + small transform, only when the transition helps orientation.
- **No constant idle animation** on study screens, no scroll-bound text effects, no parallax, no page transition that remounts and resets a timer or draft.
- **Focus is not animated away.** Move and restore keyboard focus intentionally; disable unnecessary translation for reduced-motion users.
- **Skeletons describe actual pending content**, not fake metrics. Match final geometry; after cache is available, use a sync indicator rather than skeleton.

## Primitive components expected

Button (primary/secondary/text/danger + pending/disabled); Input/Select with visible label and error; NavigationItem; Dialog/Sheet; StatusMessage; Skeleton block and named layouts; EmptyState; ErrorState with retry; PackRow; ProgressBar; QuizChoice; DueCard. Every component needs hover, active, focus, disabled, error/empty/loading where applicable, and reduced-motion behavior. Native semantic controls first.

## Engineering constraints

Do not duplicate domain calculations in UI. `src/shared/` owns study rules; `src/client/` owns local state, IndexedDB and transport; `src/server/` validates operations and account boundaries. Keep session snapshots, expected revisions, operation IDs, immutable results/reviews, tombstones, guest isolation, and public sharing warnings intact. Preserve MCP app navigation and public bank deep links.

When adding a feature, write its **job**, **real data source**, **owner/account scope**, **navigation location**, **empty/loading/error state**, **completion behavior**, **accessibility**, and **verification** before adding its button. No source capability means no fake interface.

## Design review proof

Before declaring an implementation done, show actual screenshots (phone 320/390, tablet 768, desktop 1024/1440), theme variations, reduced-motion rendering, keyboard flow, loading/offline/error/conflict states, and a click-through of every affected action. Run TypeScript, tests, build and worker smoke checks. Record what was **not tested** separately; a passing build is not a visual or live-host test.

Reference skills and standards:
- [Anti Slop](https://github.com/miqdadbadjuber/anti-slop), particularly antislop core, UI, mobile and human skills.
- [Taste Skill](https://github.com/Leonxlnx/taste-skill), particularly design-system and motion principles (not marketing-site page recipes).
- [Repo-local Anti-Slop Design](.agents/skills/anti-slop-design/SKILL.md).
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/).
