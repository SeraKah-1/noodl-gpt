# Known limitations

This page describes current product limits. A limit is not evidence of a defect.

## ChatGPT and MCP

- The MCP server gets the account identity from trusted Sites headers. The repository does not implement a separate login flow for direct Worker access.
- `get_capabilities` reports version `2.1.0`. The MCP `initialize` reply reports server version `1.0.0` and protocol version `2025-11-25`. These fields describe different contracts. Clients should use `get_capabilities` for the Noodl tool contract.
- The tool names, behavior, and availability depend on the deployed Worker and the ChatGPT connection. Repository code alone does not prove a plugin is connected in a given account.
- Plugin version `1.1.0` includes `skills/noodl-visual-learning/SKILL.md` for clarification and visual review. Its App binding and `defaultPrompt: null` are unchanged. Repository skills under `.agents/skills/` are for coding work. They do not run as server features. Plugin instructions guide the host; they cannot prove that a model performed a visual check.
- The server does not accept source file uploads, call AI providers, expose API keys, execute arbitrary SQL or shell commands, or edit its own source code. ChatGPT must produce content and send it through a structured tool.
- Each bank must contain at least one question. It can contain at most 1,000 questions, 100 artifacts, and 50 tags. Each question allows up to 12 options or 30 accepted fill-in answers.
- Tool pages default to 50 records and allow at most 100. The server checks request body size with JavaScript string length, not encoded byte length. `import_pack` also checks JSON string length. The limits are 8 million and 1 million JavaScript string units. An output limit is 1.5 million UTF-8 bytes of the stored body string. PDF bodies are base64 text, so this limit includes base64 overhead.

## Files and media

- The export tools create JSON, CSV, HTML, and PDF. They do not upload source documents or extract content from a file.
- PDF output is stored as base64 for MCP content reads. Large PDFs can be awkward to pass through a chat response. A saved output also has an account-protected download URL.
- Pack exports can omit answer keys. Without answer keys, an imported bank cannot score those questions automatically. JSON pack exports include title, description, tags, and questions. They omit folder and artifacts. Workspace backups are separate and include private learning records.
- Comic artifacts store validated JSON in the text content field; see [Comics](COMICS.md). Other artifacts store text. A visualization is self-contained HTML shown in a sandboxed frame. The frame has no network access and no access to the parent page. External libraries, external images, and other remote assets are not available there. Inline scripts and data or blob images can be used.
- The embedded ChatGPT interface does not provide camera controls. The website supports optional camera input. The camera feature uses local device processing, and its model files may need an initial download.

## Learning records and sync

- A study session stores a snapshot of its questions. Editing a bank does not update saved sessions. Completed sessions are immutable. Delete a session to remove it from the visible history.
- A review event is immutable. Delete events or reset review history to change the schedule. Deleted sessions and review events use tombstones so offline data does not restore them.
- Two devices can edit the same record. The server rejects a stale revision. The user must read the newer record and decide how to apply the intended change.
- The browser stores offline data per account, but account separation is not disk encryption. A private browser profile is needed on a shared device. Offline work syncs when the service is available.
- Review schedules use event times. An incorrect device clock can affect scheduling while offline.
- A public publication is a snapshot. Its ID contains the owner's ID and source bank ID. It includes correct answer keys and artifacts, but excludes attempts, submitted learner responses, and review history. Unpublishing removes the current listing; it cannot retract a copy that someone already made.
- Browser reminders work while the application is active. They do not promise delivery after the application closes.

## Verification scope

Automated repository tests cover server and client logic, storage, validation, sync, and file generation. A live ChatGPT connection, deployed Sites headers, browser behavior, camera hardware, and visual behavior in a particular host require that host and device. A test that uses a local database does not prove a production deployment is configured correctly.

## Guest access

Guests can create, sync, study, and publish banks without an account. Private guest data uses a browser cookie. Clearing cookies or switching browsers loses access to that guest workspace. Local-only guests can activate server storage to copy their existing banks once. Older local progress remains available in the local workspace. MCP requires ChatGPT sign-in. Public links and catalog access require a public Site audience.

[Supabase Storage](SUPABASE.md) is optional. It backs up bank content to a private bucket once configured. Live records and public sharing use D1.

Comic review flags are creator reports. Schema validation cannot prove factual correctness, actual user confirmation, or visual inspection. Image transfer from ChatGPT is not automatic.
