# Decisions and proposed work

## Current decisions

Confirm these decisions in code before you change an affected path.

| Decision | Reason | Inspect |
| --- | --- | --- |
| ChatGPT creates content | Keep provider calls outside the application | `src/server/`, `src/client/bridge.ts` |
| Website and panel use the same records | Keep study data consistent | `src/client/index.ts`, `src/server/index.ts` |
| Sites provides identity | Use the authenticated ChatGPT account | `identity` in `src/server/index.ts` |
| D1 stores server records | Support ownership and atomic writes | Server SQL, `drizzle/` |
| IndexedDB stores local data and pending changes | Support disconnected website use | `src/client/store.ts` |
| Sessions keep question snapshots | Preserve content used for an existing result | Shared engine and server validation |
| Review events produce SRS state | Recompute a deterministic schedule | `replayReviews` in the shared engine |
| Design tokens are account data | Change supported design values without deployment | Preference modules and theme application |
| Custom HTML uses an isolated frame | Separate scripts from application access | `src/ui/Tools.tsx` |
| Server PDF uses `pdf-lib` | Avoid the client renderer's server startup dependency path | `src/server/exports.ts`, Worker smoke script |

## Proposed: content blocks and media

**This section is a proposal. It does not describe current support.**

Current content fields are strings. A later version can add a versioned document with text, image, formula, table, diagram, chart, and simulation blocks.

1. Keep existing strings readable as text blocks.
2. Add a schema version and explicit block types.
3. Give each block a validator, renderer, and export fallback.
4. Reuse rendering in materials, questions, explanations, and flashcards.
5. Keep saved session content independent of later bank changes.
6. Store media bytes in an asset service. Store asset references in content.
7. Check ownership, publications, offline caching, and deletion for each asset.
8. Check actual host file-transfer support. Do not assume access to all chat attachments.
9. Provide a static fallback for unsupported interactions.
10. Keep custom simulations isolated.

The current hosting manifest has no R2 binding. A media service needs storage, configuration, access checks, and tests. Markdown image syntax does not provide managed storage.

## Plugin visual-learning skill

Plugin version `1.1.0` includes the versioned source in `plugin/skills/noodl-visual-learning/SKILL.md`. It requires clarification before design, factual accuracy, the user's chosen style, actual result inspection, corrections, and saved-content readback. The App binding, presentation, and audience are unchanged. The published package was read back on 2026-11-17.

Comic artifacts use a versioned JSON document inside the existing string content field. They do not implement the general content-block or managed-media proposal above. See [Comics](COMICS.md).

Repository design skills do not install themselves in the plugin. A source push does not publish a plugin package. Update the package separately when its behavior instructions change.

## Pending reference review

The user requested analysis of the ChatGPT project “KULIAH GASTRO V3 ANJIR ADA LAGI”. Its contents were not accessible. No preference findings from that project are established.

Obtain actual prompts, responses, instructions, and visual examples before you use them as requirements. Do not infer a teaching style from the title.
