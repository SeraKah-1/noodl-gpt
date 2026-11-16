# Verification record

## Conditions

Date: 2026-11-16.

Runtime: Node.js `v24.22.1` in the task's Linux workspace.

Application source base: `eba21de6d5f35e5ce7af9caae6cd73cc85d1fa1d`.

This change adds documentation and example input. It does not change application runtime code.

## Completed checks

| Check | Observed result |
| --- | --- |
| `npm test` | 37 tests passed; no failed or skipped tests |
| `npm run build` | TypeScript check, Vite build, Worker bundle, and Worker smoke check passed |
| Worker smoke check | Bundle startup, in-memory database access, and PDF output passed |
| `npm run audit:production` | npm reported zero vulnerabilities |
| Example bank validation | Shared validator accepted three questions and one artifact |
| Tool inspection | Source listed 60 tools; 51 were visible to the model |
| Documentation check | Relative Markdown links and JSON examples passed |
| Source review | Selected credential-pattern checks and `git diff --check` passed |

Vite reported large output chunks. Rollup removed two unsupported purity annotations from Zod comments. These messages did not fail the build. They are not evidence of browser performance.

## Not established by these checks

- A new GitHub repository exists or contains this source.
- A production deployment was updated.
- A plugin package was updated.
- Browser rendering, camera input, or host interactions passed visual checks.
- Future media and content-block proposals are implemented.
- Documentation has formal ASD-STE100 certification.

See [Source transfer](SOURCE_TRANSFER.md) for the GitHub permission failure. See [Testing](TESTING.md) for reproducible commands and manual checks.
