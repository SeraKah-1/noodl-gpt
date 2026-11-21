# Noodl ChatGPT Workspace

Noodl stores question banks and study progress. It provides a website and an interactive panel in ChatGPT. ChatGPT supplies study content through MCP tools. The application does not call an AI provider.

This repository is a derivative of [SeraKah-1/noodl](https://github.com/SeraKah-1/noodl). The upstream reference is commit `ec8342b85213dd7c00b11f367298ee4df8ccb3b7`. The MIT license is retained in [LICENSE](LICENSE).

## Start here

**Inspect the code before you make a change. Do not use documentation as proof of behavior.** Start with [AGENTS.md](AGENTS.md). Read the relevant implementation and tests. Record a mismatch if documentation differs from code.

| Need | Read | Inspect in code |
| --- | --- | --- |
| Understand the application | [Architecture](docs/ARCHITECTURE.md) | `src/App.tsx`, `src/server/index.ts` |
| Set up a checkout | [Development](docs/DEVELOPMENT.md) | `package.json`, `vite.config.ts` |
| Change data or scoring | [Data model](docs/DATA_MODEL.md) | `src/shared/`, `src/server/` |
| Use ChatGPT tools | [ChatGPT control](docs/CHATGPT_CONTROL.md) | Tool definitions in `src/server/` |
| Use the HTTP interface | [HTTP interface](docs/HTTP_API.md) | `handleRequest` in `src/server/index.ts` |
| Make a change | [Contribution procedure](CONTRIBUTING.md) | Caller, handler, validator, and tests |
| Select checks | [Testing](docs/TESTING.md) and [verification record](docs/VERIFICATION.md) | `tests/`, `scripts/verify-worker.mjs` |
| Build and deploy | [Deployment](docs/DEPLOYMENT.md) | `.openai/hosting.json`, `scripts/` |
| Review data access | [Security](docs/SECURITY.md) | Identity checks, owner filters, iframe policy |
| Check missing functions | [Known limitations](docs/KNOWN_LIMITATIONS.md) | Current schemas and renderers |
| V5 Smart Sweep / exam coverage | [V5 implementation and release gates](docs/NOODL_V5_SMART_SWEEP.md) | Real Rapid Scan, self-claim audit, Full Exam and source-honest coverage ledger (source code, not guaranteed live) |
| Plan later work | [V4 MCP & Learning Studio master plan](docs/NOODL_V4_MCP_STUDIO_MASTER_PLAN.md) and [decisions](docs/DECISIONS.md) | Separate implemented behavior from proposed features |
| Publish the GitHub source | [Source transfer](docs/SOURCE_TRANSFER.md) | Check repository access before a push |
| Change the interface | [Design skills](docs/DESIGN_SKILLS.md) | `src/ui/`, `.agents/skills/` |
| Review the original code | [Upstream audit](docs/UPSTREAM_AUDIT.md) | Pinned upstream checkout |
| Write documentation | [Writing rules](docs/WRITING.md) | Keep names consistent with code |

## Interface

The website uses the classic Noodl layout: centered practice setup, kaomoji companion, floating bottom navigation, and a quick-jump menu. See [Classic UI](docs/CLASSIC_UI.md) for source mapping and intentional adaptations.

## Current functions

- Private question banks, folders, tags, and content search.
- Guest website access with a question editor, server sync, public bank links, and offline drafts.
- Optional private bank backups through [Supabase Storage](docs/SUPABASE.md).
- Multiple choice, true or false, and fill-in-the-blank questions.
- Standard, Survival, Time Rush, and Batch Quiz sessions. Batch drafts support edits before grading.
- Private Brain Dump sessions from slides attached to ChatGPT. The tutor records free recall, optional follow-ups, and slide-grounded feedback.
- Shuffled questions, mixed question types, and retention practice.
- Saved session snapshots, results, flashcards, and spaced repetition.
- Hands-free flashcards with delayed recall checks, one-question diagnostics, and a gastric acid diagram correction exercise.
- Markdown materials, insights, a concept graph, isolated HTML visualizations, and [learning comics](docs/COMICS.md) with explicit briefs and review records.
- Account preferences and design tokens that ChatGPT can change.
- JSON input and JSON, CSV, HTML, and PDF output through tools.
- Publications and copies. Publications include answer keys. They exclude learner responses and progress.
- An offline website after the application and required data are cached.
- Optional camera controls on supported website browsers.

## Local commands

Use Node.js 24 or later.

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run audit:production
npm run dev
```

`npm run dev` starts the Vite interface. It does not provide the authenticated Worker or D1 database. A login screen in this mode does not establish a backend failure. Read the development guide before you test an authenticated flow.

## Application and source

- Public GitHub repository: [SeraKah-1/noodl-gpt](https://github.com/SeraKah-1/noodl-gpt). See [Source transfer](docs/SOURCE_TRANSFER.md).
- Existing application: <https://noodl-chat-study.sire-e.chatgpt.site>.
- MCP endpoint: <https://noodl-chat-study.sire-e.chatgpt.site/mcp>.

The source includes the existing Sites project configuration. A new GitHub repository does not create a deployment or change the plugin connection.

The example input is [examples/pack.input.json](examples/pack.input.json). It contains all three question types. It is a bank input, not an HTTP or MCP request wrapper.

Public website visitors can create, edit, save, and publish banks as guests. In **File**, an empty library shows public banks that visitors can study or copy. Select **Bank publik** to browse them from a library that already contains banks. Sign in with the account that saved a bank in ChatGPT to access the private original. A browser cookie scopes guest server data. Signed-in users and MCP use trusted Sites identity headers. The server uses a D1 binding named `DB` for live records. Do not expose the Worker behind a proxy that accepts identity headers from visitors.

## Scope and status

The original AI providers, source-file processing, and prompt editor were removed. There is no multiplayer mode. Managed image storage and versioned content blocks are proposed work. They are not current functions.

The installed plugin has tool descriptions and a capability tool. Its visual-learning skill requires clarification before design and inspection of actual output; see `plugin/skills/noodl-visual-learning/SKILL.md`. Repository design skills guide source changes. They do not automatically become instructions in a user's ChatGPT conversation.

Documentation uses an ASD-STE100-inspired technical style. It is not certified as ASD-STE100 compliant. Third-party skill files retain their original text.
