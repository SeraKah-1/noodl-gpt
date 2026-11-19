# HTTP interface

## Contract source

Inspect `handleRequest` in `src/server/index.ts` before you change a route. Inspect `src/server/exports.ts` for downloads. Inspect `src/client/index.ts` for the current caller.

The route prefix is `/api/`. The Worker also serves JSON-RPC requests at `/mcp`. The application sends same-origin requests. There is no general cross-origin API configuration.

## Identity and request handling

The hosting proxy supplies `oai-authenticated-user-id`. The application also reads optional name and email headers. A missing user ID causes HTTP 401, except for the database health check.

Do not send a user ID in the request body to select an account. Do not use caller-supplied identity headers in production. The Worker requires the trusted hosting boundary described in [Security](SECURITY.md).

For non-MCP write requests, a supplied `Origin` must match the request URL origin. A mismatch causes HTTP 403. The absence of an `Origin` is not rejected by this check.

The body reader limits `request.text().length` to 8,000,000 JavaScript string units. This is not an exact byte limit. It then parses JSON.

## Routes

| Method | Path | Input | Result |
| --- | --- | --- | --- |
| GET | `/api/health` | None | Database readiness; 503 if the binding is missing |
| GET | `/api/me` | None | Account ID, name, optional email |
| GET | `/api/snapshot` | None | Packs, attempts, reviews, preferences, time cursor |
| POST | `/api/mutate` | `{expectedOwner: string, operations: Operation[]}` | `{results: MutationResult[]}` |
| GET | `/api/preferences` | None | Current preferences and revision |
| PATCH | `/api/preferences` | Operation ID, expected revision, patch | Updated preferences |
| GET | `/api/publications` | None | Publication summaries |
| POST | `/api/publications` | Pack ID, expected revision, operation ID | Saved publication |
| POST | `/api/publications/:id/copy` | Operation ID | New private bank |
| DELETE | `/api/publications/:id` | None | `{ok: true}` after owner-scoped deletion |
| GET | `/api/exports/:id` | None | Owner-protected output file |
| POST | `/mcp` | JSON-RPC request | MCP response or notification acknowledgement |

The health handler checks `records` and `pack_versions`. It does not verify every table, account session, or external service. Sites can still require sign-in before a request reaches this handler.

## Mutation input

`Operation` is defined in `src/shared/types.ts`. Current kinds are `pack.put`, `pack.delete`, `attempt.put`, and `review.add`.

```json
{
  "operations": [
    {
      "id": "unique-operation-id",
      "kind": "pack.put",
      "entityId": "new-bank-id",
      "expectedRevision": 0,
      "createdAt": "2026-11-16T00:00:00.000Z",
      "payload": {
        "title": "Example",
        "questions": [
          {
            "id": "q1",
            "type": "TRUE_FALSE",
            "text": "A triangle has three sides.",
            "correctBoolean": true,
            "explanation": "A triangle is a polygon with three sides.",
            "difficulty": "Easy"
          }
        ]
      }
    }
  ]
}
```

The batch accepts at most 50 operations. It executes them in order. It is not one transaction across all operations. Each result has its own `ok` value. HTTP 200 alone does not mean every mutation succeeded.

A versioned update uses the revision returned by the latest read. A retry of the same operation keeps the same operation ID. A new logical change requires a new operation ID.

## Errors

The outer handler returns `{error: string}` for request failures. A missing identity returns 401. A rejected origin returns 403. An unmatched API route returns 404. Other failures normally return 400 unless a handler specifies another status.

Send the signed-in workspace ID as `expectedOwner` in mutation batches. The server compares it with the authenticated identity before applying any operations. The optional `X-Noodl-Owner` header also checks the active workspace on other account requests. It does not authenticate the caller. A mismatched owner returns HTTP 401. Reload an older open client to get the new mutation format.

JSON request bodies larger than 8 MiB return HTTP 413. The client keeps rejected operations for review and continues syncing changes on other records.

Mutation failures return `ok: false` inside `results`. Codes include `CONFLICT`, `INVALID`, and `NOT_FOUND`. Read each result before you remove an outbox entry. Inspect `mutate` and `LocalStore.acknowledge` for the actual handling.

MCP tool failures use `isError: true` with text content. They do not use the HTTP mutation result wrapper. Notifications without a JSON-RPC ID receive HTTP 202. `GET /mcp` returns 405.

## Downloads

An export must first be created through an export tool. The returned download URL identifies the saved output. Downloads require the account identity. They return `no-store`, attachment disposition, a restrictive content policy, and `nosniff`.

See [ChatGPT control](CHATGPT_CONTROL.md) for export operations. See [Data model](DATA_MODEL.md) for record fields.

## Anonymous publication catalog

`GET /api/public/catalog` returns publication summaries. `GET /api/public/catalog/:id` returns a published content snapshot, including answer keys. Neither route exposes private banks or learning history. Other account endpoints and MCP require identity.
