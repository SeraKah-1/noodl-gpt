# Guest storage and Supabase

Use Noodl in a browser to create or edit a bank without a ChatGPT account. Open the bank menu and choose **Bagikan salinan**. Anyone can open the resulting link, copy the public bank, or start a quiz. Republishing updates the snapshot. **Cabut salinan berbagi** removes the public link.

The browser's guest cookie controls access to private guest records. D1 stores live banks, publications, and study progress. IndexedDB stores local drafts and an offline copy. If a guest workspace predates server storage, **Aktifkan penyimpanan guest** copies its local banks into the server workspace. Use **Buka ruang guest lokal** to view the prior local history.

## Provision the bucket with Supabase CLI

Run these commands from the repository root with Node.js 20 or later. Use the Supabase project chosen for Noodl.

```sh
npx --yes supabase@3.2.0 login
npx --yes supabase@3.2.0 link --project-ref YOUR_PROJECT_REF
npx --yes supabase@3.2.0 db push --remote --dry-run
npx --yes supabase@3.2.0 db push --remote
```

Check the dry run before applying it. It should include the Noodl backup bucket migration. If the remote project already has migrations that are absent from this checkout, reconcile the histories before applying a migration.

If this environment cannot connect to the Postgres pooler, use the CLI's remote SQL command:

```sh
npx --yes supabase@3.2.0 db query --remote --file supabase/migrations/20261119014530_create_noodl_backup_bucket.sql
```

This applies the bucket settings without recording the migration in CLI history. A later migration push can apply the same file safely.

The migration creates a private `noodl-backups` bucket restricted to JSON uploads up to 8 MiB. It accepts a bucket that already has the expected settings. If the same name has different settings, the migration stops for a review.

For local verification with Docker, run `npx --yes supabase@3.2.0 start`. The CLI applies the same migration locally. Run this query to check the bucket:

```sh
npx --yes supabase@3.2.0 db query --read-only \
  "select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'noodl-backups';"
```

## Connect the Noodl server

Use a server key for the linked project. The CLI can show project keys with `npx --yes supabase@3.2.0 projects api-keys --reveal`. Run it only in a private terminal. Set the following values in the Site's runtime environment and mark the key as a secret. Publish the Site with the updated runtime configuration, then verify with **Pengaturan → Cadangan Supabase**.

| Runtime variable | Value |
| --- | --- |
| `SUPABASE_URL` | The Supabase project URL, such as `https://your-project.supabase.co`. |
| `SUPABASE_STORAGE_BUCKET` | `noodl-backups`, the private bucket created by the migration. |
| `SUPABASE_SECRET_KEY` | A Supabase server secret key. A legacy `service_role` key also works. |

Keep the key in the Worker environment. It grants privileged project access. Use the authenticated Storage endpoint for reads. The Worker derives the path from the authorized workspace and does not accept client-supplied bucket names or paths.

## Back up and restore

**Cadangkan bank** saves the current synchronized banks and their artifacts. It replaces that workspace's previous backup. The file includes questions and answer keys. Personal progress, preferences, and public listings stay in the live workspace. Guest and signed-in workspaces each have their own backup.

Use **Unduh cadangan** to keep a copy before clearing browser site data. To restore, import that JSON from **Bank soal → Impor JSON**. The importer creates new bank copies. The backup limit is 8 MiB and 1,000 banks per workspace. Keep the original guest cookie to access a backup from the original workspace.
