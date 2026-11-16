# Noodl — ChatGPT Study Workspace

Turunan Noodl MIT yang memisahkan pembuatan konten dari pengalaman belajar. ChatGPT mengirim soal terstruktur melalui MCP; website dan panel interaktif memakai bank/progres yang sama. Tidak ada API key AI, pemrosesan file sumber, prompt editor, atau panggilan provider AI.

## Menjalankan dan memeriksa

Node 24+, `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, `npm run audit:production`.

`npm run dev` melayani UI Vite. Backend produksi memakai Worker dan D1 Sites; UI lokal tanpa backend akan menampilkan login, bukan identitas palsu. Tes server memakai SQLite nyata dengan adapter D1. Paket produksi berada di `dist/server/index.js` dan manifest/migrasi di `dist/`.

## Fitur

Bank/folder/pencarian, kuis tiga tipe dan tiga mode, mixed/retention, snapshot resume, flashcards, SRS, statistik nyata, Mix Room, peta konsep lokal, materi/insight/visualisasi dari ChatGPT, JSON/CSV/PDF, tema, pemisahan akun, publikasi salinan, offline PWA, tutor handoff, dan kontrol kamera opsional. Tidak ada multiplayer. Kamera memproses gambar di perangkat; aset model diunduh pertama kali, lalu disimpan cache website untuk pemakaian offline.

## Integrasi dan data

- HTTP: `/api/me`, `/api/snapshot`, `/api/mutate`, `/api/publications`.
- MCP: `/mcp`, discovery, tools dan resource `ui://noodl/workspace`.
- Server mengambil identitas dari header tepercaya Sites; jangan mengekspos Worker langsung tanpa proxy autentikasi yang membersihkan header pengguna.
- IDB dipisahkan per akun, local write + outbox atomik, ID operasi unik, konflik revisi eksplisit, logout mengunci cache. Browser pribadi tetap diperlukan; partisi akun bukan enkripsi disk.
- Upaya belajar menyimpan soal, urutan opsi, dan occurrence ID unik. Review SRS dihitung deterministik berdasarkan waktu peristiwa dan ID. Jam perangkat yang keliru dapat memengaruhi jadwal; offline membutuhkan kepercayaan pada jam perangkat.
- Sesi yang sama diedit dari dua perangkat memunculkan konflik. Progres tidak diam-diam ditimpa.
- Publikasi adalah snapshot konten tanpa jawaban/progres pribadi; penerima mendapat ID baru.
- Offline berlaku pada website/PWA setelah shell dan bank tersimpan. ChatGPT, pembuatan konten baru, dan publikasi memerlukan internet.

## Batas verifikasi

Tes otomatis memeriksa logika, akun, SQLite, sync, replay, dan kontrak MCP. Verifikasi interaksi browser, kamera, dan panel di ChatGPT memerlukan host yang tersedia. Reminder browser bekerja selama aplikasi aktif; tidak menjanjikan pengiriman saat aplikasi ditutup. Bahasa utama Indonesia; sebagian label alat belajar masih Indonesia saat navigasi dipilih Inggris.

Audit upstream: [docs/UPSTREAM_AUDIT.md](docs/UPSTREAM_AUDIT.md). Sumber asli: https://github.com/SeraKah-1/noodl pada ec8342b85213dd7c00b11f367298ee4df8ccb3b7. Pemberitahuan MIT asli dipertahankan dalam LICENSE.
