# Learning comics

Comics are bank artifacts with `kind: comic`. Their `content` is a JSON string validated by `src/shared/comic.ts`. Read `get_comic_guide` for the current JSON schema and workflow. The UI opens them through the Comics quick-jump entry or the Komik tab in study tools.

## Creation workflow

1. Clarify the learning objective, audience, source material, language, panel count, and user-requested style. Wait for the user's response before designing.
2. Record that response in the brief. Do not invent confirmation or assume an aesthetic preference.
3. Create the factual sequence, captions, dialogue, and illustrations. Prioritize accuracy and the user's chosen style.
4. Inspect the actual rendered output. Check facts against sources, sequence, labels, spelling, readability, and style. Correct findings and repeat affected checks.
5. Save with `create_artifact`, `update_artifact`, or `save_artifacts`, using the bank's current revision. Read back with `get_artifact`.

The plugin's `noodl-visual-learning` skill applies the clarification and review workflow to comics and other Noodl visual designs. The Site tool guide exposes the same requirements to clients that cannot load the plugin skill. A tool description cannot guarantee model compliance.

## Data and rendering

Version 1 documents contain a confirmed brief, 1–24 panels with unique IDs, source references, and review notes. Every panel has a title, visual description, caption, dialogue list, and alternative text. An illustration can be standalone static SVG or embedded PNG/JPEG/WebP data. The content limit remains 500,000 JavaScript string units per artifact. Individual SVG strings are limited to 180,000 units; raster data URLs to 300,000 units.

SVG is rendered through an image element with an encoded data URL, never injected into the application DOM. Validation rejects scripts, event handlers, external resources, links, foreign objects, styles, and animation elements. Raster data URLs have a restricted MIME allowlist. There is no remote image fetch or managed media upload in this feature. Captions and dialogue remain separate readable text. Missing or failed images show the visual description.

`draft` allows incomplete artwork or checks. `reviewed` requires illustrations for every panel, source references, all five review flags, and no unresolved issues. These checks validate a creator report. The application does not independently verify sources, scientific accuracy, that a user actually confirmed the brief, or that a human/model actually inspected the image. The reader states this distinction explicitly.

Creating an image in ChatGPT does not automatically transfer it to Noodl. Transfer depends on host tools making the actual image bytes available within storage limits. If transfer or visual inspection is unavailable, retain a draft and report the limitation. Never invent an accessible attachment or claim a completed visual review.

## Existing workflows

Comics use the existing bank revisions, owner checks, operation IDs, offline snapshots, JSON bank import, workspace backup, publication snapshots, and publication copies. Guest users can view comics in copied or imported banks. Saving through ChatGPT MCP still requires authentication. The reader can download one comic artifact as JSON; that file is an artifact, not a complete bank input. Existing pack JSON/CSV/HTML/PDF exports remain question-only and omit artifacts. Workspace JSON includes comics.

## Maintainer entry points

- `src/shared/comic.ts`: schema, guide, and request prompt.
- `src/shared/validation.ts`: all artifact persistence paths validate comic content.
- `src/server/control.ts`: guide and advertised artifact capabilities.
- `src/ui/Comic.tsx`: reader, transcript, review details, and ChatGPT request.
- `plugin/skills/noodl-visual-learning/SKILL.md`: plugin workflow instructions.

The plugin package has its own guarded release workflow. A Git push or Site deployment does not publish the plugin skill. Keep the App binding and presentation metadata unchanged when updating its skills.
