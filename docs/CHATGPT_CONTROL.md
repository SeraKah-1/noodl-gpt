# Control Noodl from ChatGPT

This guide describes the MCP tools in this repository. The server reads and writes data for the signed-in user. It does not call an AI provider. ChatGPT creates content and sends it to Noodl as structured data.

## Start with discovery

Call `get_capabilities` to read the input types, output formats, page size, and main limits. Call `list_packs` or `search_workspace` to find a bank. Use the IDs returned by these tools. A bank is called a pack in the tool names and data.

The server also lists a resource named `ui://noodl/workspace`. It opens the Noodl interface inside ChatGPT. `open_view`, `open_pack`, and `open_attempt` select a page or open a saved session. The app resource does not add data access beyond the signed-in account.

## Read and change content

Use `get_workspace` for a page of bank summaries and workspace counts. Use `search_workspace` to search bank fields, questions, materials, insights, and visualizations. Search does not include attempts or review history. Use `get_question` and `get_artifact` to read one item and its bank revision.

Use these tools to change one item at a time:

- `create_question`, `update_question`, and `delete_question`
- `create_artifact`, `update_artifact`, and `delete_artifact`
- `set_pack_metadata` for the title, description, folder, or tags

A question can be multiple choice, true or false, or fill in the blank. A multiple-choice question needs 2 to 12 options and a valid correct option ID. A fill-in question needs 1 to 30 accepted answers. A bank needs 1 to 1,000 questions. It can contain up to 100 artifacts and 50 tags.

Each update to a bank needs its current `expectedRevision`. Read the bank first. If another change has advanced the revision, the server returns a conflict. Read the current bank and make the intended change again. Do not send a stale full bank to replace newer content.

The embedded `app_mutate` tool requires `expectedOwner` to match the current account.

Every write that accepts `operationId` needs a new ID for a new change. Keep the same ID only when you retry that change. The server returns the saved result for a repeated ID. `unpublish_pack` accepts no operation ID. The embedded app tool `app_unpublish` also accepts no operation ID.

`duplicate_pack` makes a private copy with new question and artifact IDs. It does not copy learner history. Bank-level tools are also available: `create_pack`, `update_pack`, `append_questions`, `save_artifacts`, and `delete_pack`. `create_pack` saves a new bank. The other tools use `expectedRevision` when they replace or extend an existing bank. `get_pack` reads a bank. Its optional `offset` and `limit` page through questions.

## Run study sessions and review cards

Use `start_attempt` to save a session. Its options are `STANDARD`, `BATCH`, `SURVIVAL`, or `TIME_RUSH`, plus `shuffle`, `retention`, and `mixed` settings. The server saves a copy of the questions in the session. Later bank edits do not change that copy.

For `BATCH`, set `retention` to false. Choose a `batchSize` from 1 to 100. The default is 10. A smaller bank uses its available questions. Use `update_batch_draft` to record numbered answers in any order. Use the displayed letter for each multiple-choice answer. Use a Boolean or text value for the other question types. Clarify ambiguous dictated answers. Use `submit_batch` once the learner asks to submit all answers. Active batch results include the displayed options and saved drafts.

For the other modes, use `answer_attempt` with an option ID, a Boolean, or text, as required by the question. The server checks the answer. Then call `advance_attempt` to move to the next question. Call `finish_attempt` to end an active session. These writes need the session's current `expectedRevision` and a new `operationId` for each change. A completed session cannot be changed.

Use `get_attempt` to read answers and score. Use `list_attempts` or `get_progress` to read session results. `delete_attempt` hides a session by adding a tombstone. Its historical record is not rewritten.

Use `list_srs` to read scheduled cards and review events. `dueOnly` filters cards that are due now. `review_card` records a rating from 0 (forgot) to 3 (easy). A review event cannot be edited. Use `delete_review` to remove one event, or `reset_srs` to remove review events for a bank or one question. These deletions add tombstones so later sync does not restore the removed data.

## Practice recall from slides

Attach the presentation to ChatGPT. The website opens ChatGPT and copies the request. The embedded panel sends the request directly.

1. Check the slides and ask whether to group them by slide or topic. Request a clearer image or PDF if labels are unreadable.
2. Call `start_brain_dump` with neutral prompts and reference points linked to actual slide numbers. Present one prompt at a time.
3. Use `record_recall` to save the initial answer. Optionally ask one neutral follow-up and record the response separately.
4. Call `review_recall` with one assessment per reference point. Accept accurate paraphrases. Use the returned slide references. Mark outside context separately.
5. Use `list_brain_dumps` and `get_brain_dump` to resume. Use `retry_recall` to repeat a reviewed unit.
6. On request, use `create_pack` or `append_questions` to turn selected gaps into practice questions. The learner can open the resulting bank as flashcards.

Noodl stores private structured sessions under the connected account. The slide file stays in the ChatGPT conversation. Bank publication excludes recall sessions.

## Set preferences and design

Call `get_preferences` or `get_design` before making a change. Then call `update_preferences`, `update_design`, `reset_preferences`, or `reset_design`. Each write needs the current `expectedRevision` and a new `operationId`.

Design fields include a theme and six color tokens. Radius ranges from 0 to 32. Font scale ranges from 0.85 to 1.35. Content width ranges from 640 to 1,800. Other fields select density, card layout, and reduced motion. Colors use six-digit hexadecimal values. Set a color to `null` to remove its override. A reset restores defaults. Changes apply to the signed-in user's interface after sync. They do not change application code.

## Import, export, and sharing

`import_pack` accepts a JSON string up to 1 MB. The value must describe a valid bank. Questions must have valid answer keys. An export without answers is for distribution. It cannot provide automatic scoring after import.

`export_pack` creates a JSON, CSV, HTML, or PDF file for one bank. By default, it includes answer keys. Set `includeAnswers` to `false` to omit keys and, where present, explanations, hints, and key points. JSON pack exports include the title, description, tags, and questions. They omit the folder and artifacts. Use `export_workspace` for a backup of saved workspace records. `get_export` can return file content. PDF content is base64. The download URL works only for a request that has the user's account identity. The server limits the stored output body to 1.5 MB after it converts the body string to UTF-8 bytes. For a PDF, this measures the base64 text, not the decoded PDF bytes.

`export_workspace` creates a private JSON backup. It includes banks, attempts, review events, and preferences. `list_exports` lists saved output files. `delete_export` removes one.

`publish_pack` saves a public content snapshot. The snapshot excludes attempts, submitted learner responses, and review history. Its ID contains the owner's ID and the source bank ID. The snapshot includes question answer keys and artifacts. Anyone who can browse publications can read the correct answers. Do not publish a bank if its answer keys must remain private. A published snapshot does not track later edits to the source bank. Publish again to replace it. `unpublish_pack` removes your snapshot. `copy_publication` creates a private copy with new question and artifact IDs. The copy has no learner history.

## Tool groups

The server lists these runtime tools. `app_*` tools support the embedded interface and are not extra user capabilities.

| Group | Tool names |
| --- | --- |
| Discovery and content | `get_capabilities`, `get_workspace`, `search_workspace`, `get_question`, `create_question`, `update_question`, `delete_question`, `get_artifact`, `create_artifact`, `update_artifact`, `delete_artifact`, `set_pack_metadata`, `duplicate_pack` |
| Study and review | `list_attempts`, `get_attempt`, `start_attempt`, `answer_attempt`, `advance_attempt`, `finish_attempt`, `delete_attempt`, `open_attempt`, `list_srs`, `review_card`, `delete_review`, `reset_srs` |
| Interface | `open_view`, `get_preferences`, `update_preferences`, `reset_preferences`, `get_design`, `update_design`, `reset_design` |
| Files | `export_pack`, `export_workspace`, `list_exports`, `get_export`, `delete_export`, `import_pack` |
| Bank-level content and sharing tools | `create_pack`, `update_pack`, `append_questions`, `save_artifacts`, `list_packs`, `get_pack`, `open_pack`, `get_progress`, `delete_pack`, `publish_pack`, `browse_publications`, `copy_publication`, `unpublish_pack` |
| Embedded app support | `app_identity`, `app_snapshot`, `app_mutate`, `app_publications`, `app_publish`, `app_unpublish`, `app_copy_publication`, `app_get_preferences`, `app_update_preferences` |

## Errors and retries

An MCP tool error is returned with `isError: true` and a text message. A successful tool result includes structured content. Common errors include:

- `CONFLICT` or “Revision changed”: the record changed after it was read. Read it again and review the intended update.
- `INVALID`: a field, ID, answer, or operation is invalid. Correct the input before retrying.
- “Not found”: the record does not exist in this account or has been deleted.

If the server does not receive a signed-in user identity, it rejects the MCP request before it runs a tool.

The exact message can give more detail. A repeated `operationId` returns the stored result for that operation. If a request may have succeeded but its response was lost, retry it with the same ID. Do not reuse that ID for different input.

## Repository skills and plugin contents

The repository contains design skills under `.agents/skills/`. `AGENTS.md` tells coding agents when to use them. They guide work on this repository. They are not runtime MCP tools, do not run on the production server, and do not grant access to accounts or data.

The installed plugin package checked for this repository contained `.app.json` and `.codex-plugin/plugin.json`. It contained no skill files. Its `defaultPrompt` field was `null`. The tools listed above come from the server code in this repository. They do not prove that a particular ChatGPT installation has connected or loaded the plugin.

## Comics and visual design

Read `get_comic_guide` for the comic schema and workflow. Comics use existing artifact CRUD with `kind: comic`. Clarify the user brief before design, inspect actual output, correct issues, save, then read back. Incomplete checks must remain draft. The visual-learning plugin skill carries these instructions into supported hosts. See [Comics](COMICS.md).
