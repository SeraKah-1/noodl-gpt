# Guest storage and Supabase

Use Noodl in a browser to create or edit a bank without a ChatGPT account. Open the bank menu and choose **Bagikan salinan**. Anyone can open the resulting link, copy the public bank, or start a quiz. Republishing updates the snapshot. **Cabut salinan berbagi** removes the public link.

The browser's guest cookie controls access to private guest records. D1 stores live banks, publications, and study progress. IndexedDB stores local drafts and an offline copy. If a guest workspace predates server storage, **Aktifkan penyimpanan guest** copies its local banks into the server workspace. Use **Buka ruang guest lokal** to view the prior local history.

## Connect Supabase Storage

An administrator needs a Supabase project and access to this Site's runtime settings.

1. In Supabase Storage, create a **private** bucket, for example `noodl-backups`. Allow JSON uploads up to 8 MiB.
2. Set the following values in the Site's runtime environment. Mark the key as a secret. For a different Worker host, use that host's server configuration.
3. Publish the Site with the updated runtime configuration.
4. Open **Pengaturan → Cadangan Supabase** in a browser. Save and download a backup to verify the connection.

| Runtime variable | Value |
| --- | --- |
| `SUPABASE_URL` | The Supabase project URL, such as `https://your-project.supabase.co`. |
| `SUPABASE_STORAGE_BUCKET` | The private bucket name. |
| `SUPABASE_SECRET_KEY` | A Supabase server secret key. A legacy `service_role` key also works. |

Keep the key in the Worker environment. It grants privileged project access. Use the authenticated Storage endpoint for reads. The Worker derives the path from the authorized workspace and does not accept client-supplied bucket names or paths.

## Back up and restore

**Cadangkan bank** saves the current synchronized banks and their artifacts. It replaces that workspace's previous backup. The file includes questions and answer keys. Personal progress, preferences, and public listings stay in the live workspace. Guest and signed-in workspaces each have their own backup.

Use **Unduh cadangan** to keep a copy before clearing browser site data. To restore, import that JSON from **Bank soal → Impor JSON**. The importer creates new bank copies. The backup limit is 8 MiB and 1,000 banks per workspace. Keep the original guest cookie to access a backup from the original workspace.
