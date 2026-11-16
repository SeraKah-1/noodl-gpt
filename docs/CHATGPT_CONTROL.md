# Kontrol Noodl dari ChatGPT

Plugin Sites yang sama sekarang menyediakan operasi konten, latihan, desain, dan output. Semua operasi memakai akun ChatGPT yang sedang terautentikasi. Koneksi berhasil diuji melalui tool `list_packs` pada plugin yang terpasang.

## Permintaan yang bisa diberikan

- “Buat 20 soal, lalu ubah soal nomor 3 tanpa mengubah soal lain.”
- “Cari materi yang menyebut kalium, perbaiki pembahasannya, lalu hapus visualisasi lama.”
- “Mulai sesi Survival dari bank ini dan buka tampilannya.”
- “Jawab soal aktif dengan opsi ini, lanjut, lalu tampilkan hasil dan topik yang lemah.”
- “Hapus riwayat sesi itu dan reset pengulangan soal ini.”
- “Ubah tema ke paper, aksen hijau, radius 8, layout daftar, dan kurangi animasi.”
- “Ekspor PDF dengan jawaban serta CSV tanpa jawaban.”
- “Terima JSON soal ini sebagai bank baru.”

## Pola pemanggilan

1. Panggil `get_capabilities` untuk mengetahui kontrak input/output; `list_packs` atau `search_workspace` untuk menemukan ID.
2. Baca record sebelum mengubahnya. Kirim `expectedRevision` yang baru dibaca serta `operationId` unik untuk setiap perubahan logis. Gunakan ulang ID operasi yang sama hanya untuk retry operasi yang sama.
3. Ubah satu soal melalui `create_question`, `update_question`, `delete_question`; materi/insight/simulasi melalui `create_artifact`, `update_artifact`, `delete_artifact`. Metadata bank memakai `set_pack_metadata`; seluruh bank tetap mendukung create/update/delete/duplicate/publish/copy.
4. Gunakan `start_attempt`, `answer_attempt`, `advance_attempt`, `finish_attempt`, `get_attempt`, `list_attempts`, `delete_attempt` untuk latihan dan riwayat. `open_attempt` membuka sesi nyata. Soal dalam sesi adalah snapshot, sehingga edit bank tidak mengubah hasil historis.
5. `list_srs`, `review_card`, `delete_review`, dan `reset_srs` mengelola pengulangan. Penghapusan meninggalkan tombstone untuk mencegah data lama hidup kembali saat perangkat offline tersambung.
6. Baca `get_design`/`get_preferences`, lalu gunakan `update_design`/`update_preferences`. Desain menerima token warna hex, radius, density, fontScale, contentWidth, cardLayout dan reduceMotion. Nilai warna `null` menghapus override. Reset mengembalikan default. Perubahan terlihat pada website/panel saat sinkronisasi; tidak perlu deploy kode lagi.
7. `export_pack` membuat JSON, CSV, HTML atau PDF. `export_workspace` membuat backup JSON privat. `list_exports`/`get_export` membaca hasil, `delete_export` menghapusnya. `get_export(includeContent:true)` mengembalikan teks atau base64 PDF. URL download memerlukan akses akun ke Site.
8. `import_pack` menerima JSON terstruktur dengan kunci jawaban yang valid. JSON yang sengaja diekspor tanpa kunci cocok untuk distribusi latihan, bukan import sebagai bank bernilai otomatis.

## Batas yang disengaja

Akses lengkap berlaku untuk data dan konfigurasi workspace milik pengguna. Kredensial, akun orang lain, SQL bebas, shell server, dan kode sumber aplikasi tidak diekspos sebagai tool runtime. Perubahan struktur aplikasi di luar token desain dilakukan melalui repo ini dengan agen coding. HTML simulasi tetap terisolasi dari aplikasi dan jaringan.

Bank tetap harus memiliki sedikitnya satu soal; hapus bank jika seluruh isinya memang tidak diperlukan. Sesi selesai serta peristiwa SRS historis tidak ditulis ulang: koreksi konten melalui bank atau hapus/reset riwayat terkait. Input sumber file dan API provider AI lama tetap dipangkas; pembuatan konten dilakukan lewat ChatGPT.

## Skill untuk pengembangan repo

Skill desain terpasang pada `.agents/skills/` dan otomatis dirujuk `AGENTS.md`. Ini panduan bagi agen pengembang repo, bukan instalasi Python/script ke server produksi atau akses ekstra ke akun lain. Sumber, versi commit, dan lisensi dicatat dalam [DESIGN_SKILLS.md](DESIGN_SKILLS.md).

## Verifikasi

Tes SQLite/IndexedDB memeriksa CRUD, akun, tombstone, retry, konflik revisi, preferensi offline, token berbahaya, input JSON dan keluaran nyata termasuk PDF. Build Worker dan audit dependensi dijalankan sebelum publikasi. Pengujian kamera/peramban visual memerlukan host browser yang tersedia.
