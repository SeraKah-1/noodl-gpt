# Testing

Run commands from the repository root. Install dependencies first with `npm ci`.

## Automated checks

Run the type check:

```sh
npm run typecheck
```

Run the test suite:

```sh
npm test
```

The tests use Node's built-in SQLite module and a D1-style adapter. They cover domain rules, account separation, revision conflicts, offline storage and sync, server routes, MCP tools, exports, preferences, and output escaping. They use disposable in-memory data. They do not connect to a live D1 database or ChatGPT.

Build the client and Worker, then run the bundled Worker smoke check:

```sh
npm run build
```

The build script checks TypeScript, builds the Vite client, bundles the Worker, and runs `scripts/verify-worker.mjs`. The smoke check imports the built Worker, creates an in-memory SQLite database from the initial migration, calls `/api/health`, creates a pack through MCP, creates a PDF export, and checks the PDF signature. It checks the built bundle with a test identity. It does not test platform authentication, deployed D1, browser rendering, the ChatGPT panel, camera input, or offline behavior in a real browser.

Run the production dependency audit separately:

```sh
npm run audit:production
```

This asks npm to check production dependencies for high severity vulnerabilities. It is not part of `npm run build`.

## Manual checks

Use these checks when you have access to the relevant host:

1. Open the deployed app through its supported host. Confirm that the host provides the signed-in user identity.
2. If you need to check writes, use a disposable test account to create a pack, reload the app, and confirm that the pack remains available to that account.
3. Open the ChatGPT panel and confirm that it connects to MCP and opens the workspace.
4. In a browser, save the app and one pack, then test offline use. Test camera features separately because they need browser permissions and model downloads.

These checks are not covered by the automated suite. Use read-only checks on production by default. If a live write check is required, use a disposable test account and pack, then remove the pack. Do not write test data to a real user account. Record the host, account type, browser, and result when you perform these checks. Do not treat a successful local build or Worker smoke check as evidence that the live host works.
