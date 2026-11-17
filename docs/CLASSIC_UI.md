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

Guest information is collapsed by default. Guest records remain local and separate from account records. Publication controls require an authenticated account. No stored content or learning history is migrated by this presentation update.

This restores the upstream layout and interaction patterns. It does not claim pixel-for-pixel equivalence for every upstream screen. Account preferences still control supported theme and design tokens. Camera and ChatGPT host behavior require their respective environments to verify.

## Verification

On 2026-11-17, all 40 repository tests passed. The production build passed, including TypeScript, Vite, Worker startup, database access, and PDF generation. A server-rendering check covered Indonesian and English, empty and populated home views, saved-session resume, calculated scores, navigation destinations, and companion stages. The output CSS places the classic rules after the older layout rules.

Interactive browser and ChatGPT-host checks were unavailable in this environment. Server rendering does not establish visual equivalence, dialog focus behavior, clipboard access, or camera behavior in a real browser. The existing build warning for chunks larger than 500 kB remains.
