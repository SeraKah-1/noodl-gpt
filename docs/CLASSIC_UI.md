# Classic Noodl interface

The interface follows the upstream Noodl layout at commit `ec8342b85213dd7c00b11f367298ee4df8ccb3b7`.
The source is https://github.com/SeraKah-1/noodl. Its MIT license remains in the repository.

The restored presentation includes the centered Noodl heading, kaomoji companion, translucent practice setup card, floating bottom navigation, quick-jump dialog, and tactile practice controls. The quiz uses the upstream narrow column and compact controls. It retains the current answer engine and persisted session snapshots.

## Component ownership

- `src/ui/classic/Navigation.tsx`: five primary destinations and the quick-jump dialog.
- `src/ui/classic/Home.tsx`: study setup, bank selection, JSON import, ChatGPT requests, resume, and companion.
- `src/ui/classic/StudyOptions.tsx`: shared mode controls for home and bank launch dialogs.
- `src/ui/classic/ToolPicker.tsx`: bank selection for materials, concept maps, and visualizations.
- `src/ui/classic/Classic.css`: layout, surface, navigation, and study presentation.
- `src/App.tsx`: authenticated or guest state and actions passed to these components.
- `src/ui/Tools.tsx`: renders the selected tool through its `initialTab` prop.

Presentation components accept records and callbacks. They do not create another database or call an AI provider. Changes to navigation can therefore be made without replacing synchronization or scoring code.

## Adaptations from upstream

The original source-upload, provider-key, and model-selection flows are replaced by existing Noodl GPT capabilities: saved banks, validated JSON input, and ChatGPT requests. The website copies a request before the user pastes it into ChatGPT; the embedded panel uses the host bridge.

The companion uses completed session counts from the current workspace. Its review button opens the actual review schedule. The quick-jump menu selects a bank before opening materials, a concept map, or Visual Lab. These are working paths, not decorative controls.

Guest information is collapsed by default. Guests can use local-only storage or a separate server workspace identified by their guest cookie. Cloud guests can publish their own banks. No stored content or learning history is migrated by this presentation update.

This restores the upstream layout and interaction patterns. It does not claim pixel-for-pixel equivalence for every upstream screen. Account preferences still control supported theme and design tokens. Camera and ChatGPT host behavior require their respective environments to verify.

## Verification

On 2026-11-17, all 40 repository tests passed. The production build passed, including TypeScript, Vite, Worker startup, database access, and PDF generation. A server-rendering check covered Indonesian and English, empty and populated home views, saved-session resume, calculated scores, navigation destinations, and companion stages. The output CSS places the classic rules after the older layout rules.

Interactive browser and ChatGPT-host checks were unavailable in this environment. Server rendering does not establish visual equivalence, dialog focus behavior, clipboard access, or camera behavior in a real browser. The existing build warning for chunks larger than 500 kB remains.

## Study controls and follow-up

During a quiz, Left or Space shows an earlier answered question. Right or Enter returns toward the current question or advances an answered question. Browsing uses a separate display position. The active Time Rush deadline continues. Editable fields keep their normal keyboard behavior.

Flashcards accept click, Space, or Enter to flip. After flipping, Left, Down, Up, and Right record the four ratings in order from Again to Easy. Numbers 1 through 4 use the same order. A left swipe records Again. A right swipe records Easy. Camera hand controls send the same numbered keys. Escape closes the cards.

Open practice history on a bank in File to resume a session or review its results. Results link to materials, concept maps, Visual Lab, comics, and question-specific flashcards for available source banks. Follow-up requests include the recorded answer and question context or aggregate weak topics. Guests can request importable JSON. In a standalone browser, paste the copied request in ChatGPT. In the embedded panel, the bridge sends the request to the conversation.

Home and Results support optional Bloom percentages, source references, and instructions. The percentages must sum to 100. Noodl assigns whole questions before sending the brief. The daily study calendar exports a recurring 30-minute event at the selected local time. Import the file into a calendar to schedule it.

Concept map search and branch focus operate on the saved bank. Edges indicate shared wording in explanations or key points. Visual Lab lets the learner select a topic and format, then ask ChatGPT for a design proposal before creating the visual.
