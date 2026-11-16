# Instructions for agents

## Check the code first

**You must inspect the implementation before you change it. Reading documentation alone is not sufficient.** Documentation is a navigation aid. Executable code and observed checks establish current behavior.

1. Read the user's request and `git status --short`.
2. Find the affected symbol with `rg`.
3. Read its caller, implementation, validator, persistence path, and relevant tests.
4. Trace one complete input-to-output path. Include the HTTP or MCP boundary when applicable.
5. Check whether the website, embedded panel, and offline client use that path.
6. Compare documentation with code. Report a conflict. Correct related documentation in the same change.
7. Make the smallest complete change that meets the request.
8. Run relevant checks. Record what passed and what you could not verify.

Do not invent endpoints, tool parameters, migrations, or test results from a document. Inspect their definitions.

## Select the entry points

| Change | Inspect first |
| --- | --- |
| Content types and limits | `src/shared/types.ts`, `src/shared/validation.ts` |
| Scoring, session flow, SRS | `src/shared/engine.ts`, `src/ui/Study.tsx` |
| MCP or HTTP behavior | `src/server/index.ts`, `src/server/control.ts` |
| Preferences or design | `src/shared/preferences.ts`, `src/server/preferences.ts`, `src/ui/theme.ts` |
| Output or input JSON | `src/server/exports.ts`, `src/ui/Tools.tsx` |
| Offline storage and sync | `src/client/store.ts`, `src/client/index.ts` |
| ChatGPT host integration | `src/client/bridge.ts`, MCP resource handling |
| Database changes | `drizzle/`, `migrations/`, server SQL, test adapters |
| Production artifact | `scripts/build-worker.mjs`, `scripts/verify-worker.mjs` |

## Preserve the data rules

- Scope private records to the authenticated account. Read identity from the trusted hosting proxy.
- Keep revisions and operation deduplication. Reuse an operation ID only for an identical retry.
- Keep pending offline changes until the server has acknowledged them.
- Preserve question and option IDs during an edit.
- Preserve saved questions and options in existing session snapshots.
- Do not replace calculated scores or progress with fixed display values.
- Keep deleted-record markers. A disconnected device must not restore a deleted record.
- Keep custom visualization HTML isolated from the application and network.
- Do not add AI provider keys, a provider client, or source-file processing without a user request.
- Do not describe a proposal as an implemented function.

These rules describe the intended design. Inspect the code to confirm enforcement for the path you change.

## Use design skills when applicable

For interface changes, read the relevant local skill before you select a visual or interaction design:

- `.agents/skills/anti-slop-design/SKILL.md`: visual direction and craft review.
- `.agents/skills/design-system/SKILL.md`: tokens and component states.
- `.agents/skills/ui-ux-pro-max/SKILL.md`: patterns, accessibility, and interaction guidance.

The pattern search command is `python3 .agents/skills/ui-ux-pro-max/scripts/search.py`.

Existing product decisions and explicit user instructions take precedence over skill examples. The retained visual language includes violet colors and glass effects. A skill does not authorize unrelated changes or external messages. Do not change vendored skill text during an application change. See `docs/DESIGN_SKILLS.md` for sources and licenses.

## Verify and report

Use `docs/TESTING.md` to find checks. Confirm commands in `package.json`. Run full checks for a change across data, transport, or build boundaries. For documentation changes, verify paths, links, examples, and statements against code.

Report the change, its reason, checks, and remaining limitations. A successful Node.js check does not prove browser, camera, ChatGPT host, or Cloudflare runtime behavior.

## Write clear technical text

Use `docs/WRITING.md` for project-authored documentation. Use short English sentences and stable terms. Keep exact code names. Explain a prerequisite before an action. Avoid promotional text and unsupported claims of ASD-STE100 compliance.
