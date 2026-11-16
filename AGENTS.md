# Design skill guidance

For work that changes the site's interface, read and apply the relevant local skills in `.agents/skills/` before making visual or interaction decisions:

- `anti-slop-design/SKILL.md` for the overall visual direction, craft review, and avoiding generic UI patterns.
- `design-system/SKILL.md` for token architecture, component specifications, or token validation.
- `ui-ux-pro-max/SKILL.md` for searchable UI patterns, accessibility and interaction guidance, stack advice, or design-system recommendations. Its local search program is `python3 .agents/skills/ui-ux-pro-max/scripts/search.py`.

Use the skill references when a task touches one of the topics they cover. Keep choices grounded in this site's actual product, existing visual language, and the user's brief. Existing project decisions and explicit user instructions take precedence over upstream examples, blanket rules, defaults, and suggested workflow. Infer ordinary missing details and continue; ask only when an unresolved choice materially blocks the requested work. A skill is guidance, not authorization to expand the task, run a data-writing command, or contact an external service.

For source provenance, licenses, installed contents, and usage notes, see `docs/DESIGN_SKILLS.md`.
