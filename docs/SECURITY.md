# Security

## Account access

The Worker takes the user ID, name, and email from `oai-authenticated-user-*` request headers. A trusted Sites proxy must set these headers and remove any values supplied by an untrusted caller. Do not expose the Worker directly unless an equivalent trusted authentication layer protects it. The application does not verify these headers with a separate token.

The server uses the user ID as the owner key for private records, mutations, preferences, attempts, review events, and exports. Database queries bind user input as values. The server validates tool arguments and validates questions, artifacts, banks, attempts, and review events before saving them. Mutating HTTP requests also check the `Origin` when a request provides one.

These controls depend on the deployment keeping the identity headers trustworthy. They do not make an incorrectly configured proxy safe.

## Writes and history

Versioned bank and preference writes require the revision the client read. Operation IDs make retries return the stored result. The server checks answer correctness and validates session snapshots against saved bank revisions. Completed sessions and review events cannot be rewritten through normal tools. Deletions use tombstones where offline sync could otherwise restore records.

These checks protect data consistency. They do not encrypt data in the database or browser storage. Browser account partitioning is not disk encryption. Use a private browser profile on a shared device.

## Publications and exports

Published banks are intentionally available to anonymous and signed-in publication browsers. A publication ID contains the owner's ID and source bank ID. The snapshot does not include profile fields, submitted learner responses, or review history. It does include question answer keys and artifacts. Treat the answers and owner ID in a publication ID as public. Unpublishing removes the listing, but cannot revoke copies already made.

Export records are scoped to their owner. Download routes require the authenticated identity and return `no-store` responses. Generated HTML exports escape bank text and use a restrictive content policy. Download responses use `nosniff` and a sandbox policy. CSV values beginning with formula characters are prefixed to reduce spreadsheet formula execution risk.

Visualization HTML runs in a sandboxed iframe. Its policy blocks network access, navigation to other frames, forms, objects, and base URL changes. It permits inline scripts and data or blob images for local interaction. Do not treat visualization code as trusted application code.

## Data limits

The server accepts structured content. It does not accept source file uploads, run user SQL or shell commands, or call an AI provider. These boundaries reduce the server operations exposed through MCP. They do not replace deployment security, dependency updates, backups, or access controls for the hosting account.

## Reporting a security issue

Do not include private learner data, credentials, or answer keys in a public issue. Contact the repository maintainer through the repository's private security reporting channel, if one is configured. This repository does not define a separate security response time.

## Guests

Public GET routes `/api/public/catalog` and `/api/public/catalog/:id` expose only publication summaries and saved publication content. Private records and all server writes still require trusted account identity. Guests use a separate browser-local identity and write no server records. Guest records have no sync outbox. Logging in selects a separate account partition; it does not upload guest records. Clearing browser storage removes guest progress.
