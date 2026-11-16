# Local design skills

These skills provide local guidance for future UI work in this repository. Each upstream package's MIT license is included as `.agents/skills/<name>/LICENSE`.

| Skill | Use it for | Source and pinned commit |
|---|---|---|
| `anti-slop-design` | Visual direction, deliberate UI choices, craft and anti-pattern reviews | [Ferousco-dev/anti-slop-design](https://github.com/Ferousco-dev/anti-slop-design), `484f99edef59020e564cf28fdf77aaca27b32c3f` |
| `design-system` | Token architecture, component states/specifications, token and slide tools | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill), `902bf616a0cc590d3f89f233f0c4e00072e549f0` |
| `ui-ux-pro-max` | Searchable patterns for styles, palettes, typography, accessibility, stacks, and design-system recommendations | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill), `902bf616a0cc590d3f89f233f0c4e00072e549f0` |

## Installed contents

- `anti-slop-design`: upstream `SKILL.md`, all 20 linked reference modules, project-context template, and MIT license.
- `design-system`: upstream skill, references, CSV data, scripts, token template, and MIT license. The upstream describes optional `brand` and `ui-styling` sibling skills; those are not installed here. Its token and slide tools work from the included local package, while those integrations need separate guidance.
- `ui-ux-pro-max`: upstream skill, references, the local CSV/JSON corpus, Python search and generation scripts, and MIT license. Upstream script tests and test fixtures were omitted; no runtime dependency installation was needed.

The UI/UX Pro Max source contains UI pattern data and implementation recommendations. Treat those results as starting points to evaluate against this project's brief and existing choices, not as mandatory templates. Its search program is self-contained and reads its adjacent `data/` directory. Search and design-system generation are read-only by default; commands with `--persist`, `--preview`, or an explicit output path can create files, so keep outputs scoped to a user-requested destination.

## Upstream revisions

Both source trees were checked out at the full commits listed above. Only the skill directories and root MIT license text were copied; no remote installer was run. UI/UX Pro Max fixture/test directories were excluded to avoid shipping upstream development artifacts. All included source files remain unmodified. The upstream licenses are retained in each installed skill directory.
