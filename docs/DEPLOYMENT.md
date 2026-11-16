# Deployment

The production target is the existing OpenAI Sites project. Its configuration is in `.openai/hosting.json`. Keep the configured `project_id` unchanged when you build or push source. The manifest enables MCP and names the D1 binding `DB`. It does not configure R2.

## Prepare the package

Use Node.js 24 or newer. From the repository root, run:

```sh
npm ci
npm run typecheck
npm test
npm run build
```

Review the generated files before you package them. The Worker build writes `dist/server/index.js` and copies `.openai/hosting.json` and SQL files to `dist/`. The Sites archive must keep the paths below relative to the repository root. In particular, keep the `dist/` prefix on the Worker bundle. Do not create the archive from inside `dist/`.

From the repository root, create and inspect the archive:

```sh
tar -czf /tmp/noodl-deploy.tar.gz .openai/hosting.json dist/server/index.js drizzle migrations
tar -tzf /tmp/noodl-deploy.tar.gz
```

The archive must contain:

- `dist/server/index.js` for the bundled Worker, with `dist/` in its path.
- `.openai/hosting.json` at the archive root for the existing Sites project settings.
- `drizzle/0000_initial.sql` and `drizzle/meta/_journal.json` at the archive root. Sites uses these files to apply hosting migrations.
- `migrations/0001_initial.sql` at the archive root as the migration reference used by the local tests and Worker smoke check.

The command above packages the Worker, manifest, and migration files required by this workflow. The Worker bundle includes the built client assets. The `dist/.openai/hosting.json` and `dist/migrations/` copies are build outputs; they do not replace the root manifest and migration paths in the archive.

The Worker expects a D1 database binding named `DB`. Sites applies hosting migrations from the packaged `drizzle/` directory and journal. Confirm that the platform reports successful migration and deployment. Do not apply the same migration a second time by hand.

## Push source to Sites

There are separate source destinations. A GitHub push updates the GitHub repository. `scripts/push-source.mjs` pushes to the Sites source remote; it does not push to GitHub. It reads one JSON object from standard input. The object needs a `remote_url` field. It can also include `branch` and `token`. The script defaults the branch to `main`.

Run it from the repository root:

```sh
node scripts/push-source.mjs
```

After the script prints its readiness message, enter the JSON object on one line. Do not put credentials in a file, command history, or this document. The script disables terminal echo when standard input is a terminal. It initializes a Git repository if needed, commits the current files, sets or updates the `sites` remote, and pushes `HEAD` to the selected branch. It prints the commit ID after a successful push.

The script only pushes source. It does not run `npm run build`, package the archive, save a Site version, apply D1 migrations, or deploy. Build and review first. Push to GitHub separately if the project uses GitHub. For a Sites release, use the authorized Sites workflow to open or update the source, package the archive, save a version, and deploy that version to the existing project. Keep its project ID and audience. Do not invent or substitute a shell deployment command.

## First deployment and verification

Before the first release, confirm that the existing Sites project still uses the project ID in `.openai/hosting.json`, that the D1 binding is named `DB`, and that the initial schema exists in that database. Do not create a replacement project to resolve a routine build or migration issue.

After publication, use read-only checks first: open the supported host, confirm authentication, check `/api/health`, load an account snapshot, and confirm that MCP can list its tools. Do not create or change data in a real user account as a deployment check. If a write check is required, use a disposable test account and a disposable pack, and remove the pack after the check. The local Worker smoke check does not establish that the deployed host, identity headers, or live D1 configuration work.

The Worker trusts the authentication headers supplied by Sites. Do not expose it directly or route traffic through a proxy that lets callers forge those headers.
