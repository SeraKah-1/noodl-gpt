# Architecture

## Runtime parts

Noodl has a React client, shared domain code, an authenticated server worker, a D1 database, and an MCP interface. The client entry point is `src/main.tsx`. The main interface and view state are in `src/App.tsx`. Classic navigation, practice setup, and bank selection components live in `src/ui/classic/`; reusable study views are in `src/ui/Study.tsx` and `src/ui/Tools.tsx`.

`src/shared/` defines the record types, validation rules, preference rules, and study logic. Both the browser client and server import this code. `src/client/` holds the account client, IndexedDB store, and ChatGPT host bridge. `src/server/` handles HTTP routes, MCP tools, database writes, preferences, and exports. `scripts/build-worker.mjs` bundles the client assets and server worker. It also creates the service worker and copies the migration into the build output.

The deployed worker receives a D1 binding and serves both the application and its API. The same worker serves the MCP endpoint at `/mcp`. Its `ui://noodl/workspace` resource returns the application HTML for an embedded ChatGPT panel. It also serves `/api/me`, `/api/snapshot`, `/api/mutate`, preferences, publications, and export routes. The source for these routes is `src/server/index.ts`; the bundle setup is in `scripts/build-worker.mjs`.

## Request and trust boundaries

For website use, `NoodlClient` sends same-origin HTTP requests with same-origin credentials. For embedded use, it maps selected API operations to MCP app tools such as `app_identity`, `app_snapshot`, and `app_mutate`. It uses the host bridge in `src/client/bridge.ts`. Content and learning logic do not run in ChatGPT's host. The application or server runs them; the host supplies authenticated identity and invokes tools.

The server reads the account ID, name, and optional email from the `oai-authenticated-user-*` request headers. Requests without an account ID receive an authentication error. The worker assumes a trusted Sites layer sets these headers. The code does not validate a session token itself. Do not expose the worker without a trusted proxy that sets or sanitizes these headers. For non-MCP write requests, the worker rejects a supplied `Origin` that differs from the request URL's origin. See `src/server/index.ts`.

The account ID scopes private records, operation IDs, and preference rows. Most server reads include `owner_id` in the query. Publication browsing reads the shared `publications` table; publish and unpublish operations also check the owner. A publication contains a content snapshot. It does not include attempt or review history. See `src/server/index.ts` and `drizzle/0000_initial.sql`.

## Data flow

The client reads an account snapshot from the server and stores its records in IndexedDB. On a write, `LocalStore.enqueue` updates the local record and adds an operation to the outbox in one IndexedDB transaction. The client sends pending operations to `/api/mutate`, acknowledges each result, and then reads a new server snapshot. It also syncs workspace preferences through `/api/preferences`. See `src/client/index.ts` and `src/client/store.ts`.

Operations carry a unique `operationId` and, for packs and attempts, an expected revision. The server stores operation results to make retries idempotent. It checks revisions before replacing a record. A conflict remains in the local outbox until the user resolves it. Pack resolution can use the server record or save the local copy under a new ID. See `src/server/index.ts` and `src/client/store.ts`.

The server snapshot returns all pack, attempt, and review records for the account, plus preferences and a time-based cursor. The client skips a snapshot older than its saved cursor, preserves records with pending local operations, and removes cached records absent from a newer snapshot. The cursor is a timestamp, not a database change sequence. See `src/server/index.ts` and `src/client/store.ts`.

## Study and record lifecycle

`src/shared/engine.ts` creates sessions from question banks. A session stores a copy of each question, its source pack and question IDs, an occurrence ID, and the source pack revision. Shuffle, mixed question types, and retention repeats are applied when the session is created. Answer, advance, finish, score, and spaced-repetition replay logic also live in this module.

The server verifies new session question snapshots against saved pack revisions. It verifies answer correctness and ordered answer history. A session's question items, options, pack ID, pack revision, and creation time cannot change after creation. Existing answers cannot change. Completed sessions are immutable. These checks preserve historical results when a pack changes. See `src/server/index.ts` and `src/shared/engine.ts`.

Reviews are stored as events. The client derives current review cards by replaying these events in timestamp and ID order. A rating does not update a card row. Deleted sessions and reviews use tombstones so that a later sync does not restore them. See `src/shared/engine.ts` and `src/server/control.ts`.

## Offline and account behavior

The service worker caches the application shell and static files. It bypasses API, MCP, and sign-in requests. It can cache remote `/vision/` assets after a successful fetch. The client stores account records and pending operations in IndexedDB, so cached records can be read and edited offline after local account data exists. New content from ChatGPT, publication browsing, and server sync require a connection. See `scripts/build-worker.mjs`, `src/client/store.ts`, and `src/client/index.ts`.

The “save offline” action sets a `downloaded` flag on the local pack record. The sync path already caches all pack records returned in the account snapshot. The flag does not download a separate pack file. Logout marks the saved local profile as locked and clears account data from in-memory UI state. It does not erase or encrypt IndexedDB records. The browser profile remains a security boundary. See `src/client/store.ts` and `src/client/index.ts`.

## Exports

The server creates JSON, CSV, HTML, or PDF pack files and a JSON workspace export. It stores each generated output as an `export` record and returns a same-origin download URL. The download route checks the authenticated owner. Pack exports can omit answer keys and explanations. Workspace exports include private pack, attempt, review, and preference records. See `src/server/exports.ts`.

## Sources

This document describes the current implementation in `src/`, `drizzle/`, `migrations/`, and `scripts/`. It does not claim formal ASD-STE100 compliance.

## Guest website access

Anonymous website visitors enter a browser-local guest workspace after `/api/me` returns 401. The login screen also offers guest entry. `LocalStore.saveGuest` saves records without an outbox. `NoodlClient.sync` skips guest accounts. Guest settings are acknowledged locally. The public catalog supplies published banks; JSON input uses the shared validator. Guest and authenticated records remain in separate account partitions. The ChatGPT panel continues to require host authentication.
