# Data model

## Storage layout

The server stores each record as JSON text in the `records.data` column. The SQL table also stores the owner ID, record kind, record ID, and integer revision. Its primary key is `(owner_id, kind, id)`. The application uses these kinds: `pack`, `attempt`, `review`, `preferences`, and `export`. See `drizzle/0000_initial.sql` and `src/server/index.ts`.

The server also stores operation results, public content snapshots, and saved pack revisions. `operations` is keyed by owner and operation ID. `publications` is keyed by publication ID and has a unique `(owner_id, source_id)` pair. `pack_versions` is keyed by owner, pack ID, and revision. The same schema appears in `migrations/0001_initial.sql` and `drizzle/0000_initial.sql`.

The browser uses IndexedDB database `noodl-chatgpt-v1`. It has `records`, `outbox`, and `meta` object stores. Record and outbox keys include owner ID. The outbox stores sequence, operation, status, and optional lease or conflict data. Metadata stores the local profile, preferences, cursor, last sync time, and operation sequence. These are client-side structures, not SQL tables. See `src/client/store.ts`.

## Main records

| Record | Main fields and meaning | Lifecycle |
| --- | --- | --- |
| Pack | `id`, `ownerId`, title, description, folder, tags, questions, artifacts, revision, timestamps, optional `deletedAt` | A pack contains one or more validated questions and up to 100 artifacts. A pack update replaces its content at the expected revision. Delete sets a timestamp. |
| Question | `id`, type, text, explanation, difficulty, and type-specific answer fields; optional hint, key point, concept, and priority | Types are `MULTIPLE_CHOICE`, `TRUE_FALSE`, and `FILL_BLANK`. Validation checks answer fields and unique question IDs within a pack. |
| Artifact | `id`, kind, title, content, optional explanation and interaction guide | Kinds are `insight`, `material`, and `visualization`. The server validates their size and required fields. |
| Attempt | `id`, owner, pack ID and revision, title, study options, occurrence items, answers, current index, lives, streak, deadline, status, timestamps, revision | A session preserves its question snapshots and recorded answers. A completed session cannot be edited. |
| Occurrence | Unique occurrence ID, source pack ID, source question ID, copied question | A repeated question gets a separate occurrence ID. This lets each appearance have its own answer. |
| Answer | Occurrence ID, string or boolean value, correctness, answer time | The server checks answer type, order, correctness, timeout state, and Survival lives. Existing answers are immutable. |
| Review event | Event ID, card ID, pack and question IDs, question snapshot, rating, review time | Ratings are integers 0 through 3. The server checks that the question matches an owned saved pack revision. |
| Workspace preferences | Fixed ID `workspace`, owner, theme, language, design tokens, study defaults, revision, updated time | Preferences use a separate read and patch route. Updates require the expected revision and an operation ID. |
| Publication | Publication ID, source owner and pack IDs, content snapshot, title, description, question count, publish time | One current publication exists per owner and source pack. Unpublish deletes its row. Copying creates a private pack with fresh question and artifact IDs. |
| Export | ID, owner, filename, MIME type, encoding, body, creation time, optional deletion time | Exports are stored as records. A download reads the export through an authenticated route. |

Types and record fields are defined in `src/shared/types.ts`. Validation is in `src/shared/validation.ts`; preference schemas are in `src/shared/preferences.ts`.

## Revisions and operations

Pack and attempt revisions increase on each accepted mutation. A new record starts at revision 1 on the server. The browser predicts the next revision for local writes. Each pack or attempt operation includes the revision expected by the writer. If it differs from the stored revision, the server returns a conflict and the current record when available.

The server stores the result for each operation ID. A retry with the same owner and operation ID returns the saved result. This supports safe retries after a lost response. Reusing an operation ID for a different operation can return the earlier result; callers must use a new ID for each logical change. Review events are immutable and use operation IDs for duplicate handling. See `src/client/store.ts` and `src/server/index.ts`.

Each accepted pack mutation writes a row to `pack_versions`. The server uses saved versions to validate question snapshots in new attempts and review events. It does not rewrite these versions when the current pack changes. Pack, attempt, review, and export deletion uses a `deletedAt` value in record JSON. Snapshot APIs still return tombstones; client and tool views filter them where appropriate. See `src/server/index.ts` and `src/server/control.ts`.

## Snapshot and history rules

An attempt stores its questions instead of relying on the current pack content. Its `packRevision` identifies the source revision. Its item order and question snapshots remain fixed. The server validates new attempts against a saved pack version. For mixed mode, it accepts the corresponding true/false or fill-in transformation of a multiple-choice question. This allows the pack to change without changing prior study material.

The server returns a full account snapshot with packs, attempts, reviews, preferences, and a numeric time cursor. The browser merges this snapshot with pending local changes. The cursor prevents an older response from replacing a newer local sync. The cursor is `Date.now()` and is not a database revision or incremental log position.

Review cards are derived from review events. The replay sorts events by review time, then event ID, and ignores duplicate event IDs. It computes interval, repetition, easiness, and next review time. It does not store a separate current-card row. See `src/shared/engine.ts`.

## Offline state and ownership

IndexedDB stores records under an owner ID. It stores a locally cached profile and a `locked` flag. On logout the client locks the profile and clears records from UI state; the code does not erase or encrypt stored records. `downloaded` is a local flag on a pack record. It is not a separate server-side download or an offline file. See `src/client/store.ts` and `src/client/index.ts`.

The server scopes private rows by the authenticated owner ID from trusted request headers. Publication rows are readable as shared content; write operations check the publication owner. The SQL schema does not define foreign keys or SQL constraints for JSON contents. The application enforces record shape and relationships in `src/shared/validation.ts`, `src/server/index.ts`, and `src/server/control.ts`.

## Export contents

Pack JSON contains title, description, tags, and questions. If `includeAnswers` is false, the renderer removes answer keys, explanation, hints, and key points. CSV and HTML also omit answers unless requested. PDF renders questions and optional answer explanations. A workspace export includes rows of kind `pack`, `attempt`, `review`, and `preferences`; it does not include the export records themselves or publication rows. The workspace export query uses singular record-kind names. See `src/server/exports.ts`.

## Sources

This document reflects the current definitions in `src/shared/types.ts`, `src/shared/validation.ts`, `src/client/store.ts`, `src/server/index.ts`, `src/server/control.ts`, `src/server/exports.ts`, `drizzle/0000_initial.sql`, and `migrations/0001_initial.sql`. It does not claim formal ASD-STE100 compliance.
