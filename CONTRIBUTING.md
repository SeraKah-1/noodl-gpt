# Change procedure

Read [AGENTS.md](AGENTS.md) before you start. Inspect the code even if documentation appears complete.

## Prepare a change

1. Check `git status --short`. Preserve existing edits.
2. Identify the requested result and affected user flow.
3. Find relevant symbols with `rg`.
4. Read the callers, implementation, and tests.
5. Identify stored records and any offline copy.
6. Identify input validation and the account boundary.
7. Make the smallest complete change that satisfies the request.

Use a separate branch for independent work. Do not change unrelated content or vendored skills.

## Select the change path

| Request | Required inspection |
| --- | --- |
| Add a question field | Shared type, validator, MCP schemas, renderers, import/export, session snapshots |
| Add a tool | Tool definition, dispatch, validation, account scope, result shape, host updates |
| Add a preference | Zod schema, defaults, patch schema, revision, offline draft, theme application |
| Add a record type | D1, owner filter, snapshots, IDB, sync, deletion, backup output |
| Add a content format | Input schema, rendering, isolated execution, output fallback, offline behavior |
| Change scoring | Shared engine, server validation, saved attempts, result and SRS display |
| Change the build | Vite output, Worker assets, service worker, Worker smoke test |
| Change a database schema | Both migration directories, deployment journal, fresh database tests, upgrade procedure |

These lists can be incomplete for a specific change. Trace the actual execution path.

## Verify a change

1. Run checks that can detect a failure in the changed behavior.
2. Run type checks, tests, and the production build for changes across modules.
3. Check browser, camera, and host behavior in the actual environment when available.
4. Record a check that could not run. Do not claim it passed.
5. Update related documentation. Label future work as proposed.
6. Review `git diff --check` and `git diff --stat`.
7. Check staged files for credentials, account data, caches, and generated artifacts.

## Describe the result

State the problem, trigger, resulting behavior, compatibility effects, checks, and remaining limitations. Include a before-and-after example when useful. Do not claim deployment after a source-only push.
