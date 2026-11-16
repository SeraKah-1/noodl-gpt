# Development

Use Node.js 24 or newer. The test and Worker smoke scripts use Node's built-in SQLite module.

## First run

From the repository root, install the locked dependencies and start Vite:

```sh
npm ci
npm run dev
```

Open the local URL that Vite prints. Vite serves the interface. It does not start the production Worker, D1 database, or ChatGPT host.

## Local limits

The app needs a trusted user identity from the hosting platform. The local Vite server does not provide that identity or the `/api` and `/mcp` backend. The app can therefore show the sign-in or connection state in a normal browser. Do not add a fake identity header to make local access appear authenticated.

The ChatGPT panel also needs a ChatGPT host session. A local browser page cannot test the host connection. Use the automated tests for server behavior and a deployed or supported host session for end-to-end checks.

## Build

Run the checks and create the production package with:

```sh
npm run typecheck
npm test
npm run build
```

`npm run build` runs the type check, builds the Vite client, bundles the Worker, then runs the Worker smoke check. It writes the client to `dist/client/`, the Worker to `dist/server/index.js`, and copies the hosting manifest and `migrations/` SQL files into `dist/`. The hosting migration source remains in `drizzle/`, including `drizzle/meta/_journal.json`; the build script does not copy it.

Do not edit generated files in `dist/`. Change the source, manifest, or migration, then build again.

## Data and identity

The Worker expects a D1 binding named `DB`. The hosting platform supplies the trusted `oai-authenticated-user-id` header. The Worker uses this value to scope private data. Do not expose the Worker on a public route that lets a caller set this header.

The SQL schema is in `migrations/`. Tests create an in-memory SQLite database from `migrations/0001_initial.sql`. Use a separate local database setup if you need to inspect persistent D1 behavior; the Vite server does not create one.

## Example input

Use `examples/pack.input.json` to inspect the three question types. The file is a bank input. For `create_pack`, put its object in the `pack` argument. For `import_pack`, send its JSON text in the `json` argument. Supply a new operation ID for each logical write.

Validate the file without writing account data:

```sh
node --import tsx --input-type=module - <<'JS'
import { readFileSync } from 'node:fs';
import { validatePackInput } from './src/shared/validation.ts';
const input = JSON.parse(readFileSync('examples/pack.input.json', 'utf8'));
const bank = validatePackInput(input);
console.log(bank.questions.length);
JS
```

This command checks shared content validation. It does not call the deployed server or verify authentication.
