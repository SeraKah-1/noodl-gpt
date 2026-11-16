# Upstream audit

## Scope

This audit concerns upstream commit `ec8342b85213dd7c00b11f367298ee4df8ccb3b7` of [SeraKah-1/noodl](https://github.com/SeraKah-1/noodl).

These findings came from a previous static code review. They were not reproduced as runtime failures. They do not establish current defects in this derivative.

Inspect the pinned upstream code before you change a finding. This repository has different source paths and data handling.

## Historical repository status

The previous review found no open GitHub issues or pull requests. That result is historical. It is not a current GitHub status check.

The review referenced [Actions run 32492360318](https://github.com/SeraKah-1/noodl/actions/runs/32492360318). Type checks, tests, and build passed. The dependency audit failed on a high-severity `brace-expansion` advisory. Check current dependencies separately.

## Static findings

| Upstream source | Observation | Possible effect |
| --- | --- | --- |
| `services/storageKeys.ts` | Account storage keys are global. | Local records from different accounts can share a namespace. |
| `syncService.ts:618` | An outbox write can replace an existing queue. | Pending changes can be lost. |
| `App.tsx:584` | Resume appears to select a different question order. | A resumed session can show the wrong position. |
| `answerEvaluation.ts:2` | Normalization removes a minus sign. | A negative answer can change meaning during scoring. |
| `FlashcardScreen.tsx:128` | Answer display reads only options. | Other question types can have an incomplete answer display. |
| `ResultScreen.tsx:168` | Some metrics use fixed values: 80, 75, 60, and 90. | Displayed metrics can differ from session performance. |
| `MaterialOverview.tsx:61` | Topic matching uses an index that can differ between lists. | Material can link to the wrong topic. |
| `questionTransformer.ts:12,55` | Transformation assumes specific formats and can rewrite terms such as vitamin D. | Mixed questions can contain changed scientific text. |
| `quizImportValidation.ts:28` | IDs can collide. Option filtering uses positions. | Import can change the answer mapping. |
| `storageService.ts:428` | A failure can be caught without propagation. | A caller can assume a failed save succeeded. |
| `NeuroSyncReview.tsx:25` | The processing state can remain set. | Review controls can remain unavailable. |

## Review procedure

1. Open the upstream file at the pinned commit.
2. Trace the affected caller and persistence path.
3. Reproduce the behavior before you assign operational severity.
4. Check the latest upstream code before you label a finding unresolved.
5. Check this derivative separately before you report a current defect here.

A roadmap item is not evidence of a defect. A static indication is not a confirmed production failure.
