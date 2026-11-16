# Audit upstream Noodl

**Cakupan:** audit statis pada upstream `main`, commit `ec8342b85213dd7c00b11f367298ee4df8ccb3b7`. Catatan ini merangkum temuan dari pembacaan kode; temuan tidak direproduksi sebagai bug runtime.

## Status upstream

- Pada pemeriksaan sebelumnya tidak ditemukan issue GitHub atau pull request yang terbuka.
- Run CI historis terbaru yang dirujuk: [GitHub Actions run 32492360318](https://github.com/SeraKah-1/noodl/actions/runs/32492360318). Types, tests, dan build lulus; `npm audit` gagal karena kerentanan tingkat tinggi pada `brace-expansion`.

## Temuan kode

| Area | Temuan statis | Dampak yang mungkin |
| --- | --- | --- |
| `services/storageKeys.ts` | Kunci penyimpanan akun bersifat global, bukan terisolasi per akun. | Data lokal dapat tercampur saat akun berbeda memakai perangkat yang sama. |
| `syncService.ts:618` | Penulisan antrean sinkronisasi dapat menimpa antrean yang sudah ada. | Perubahan yang menunggu sinkronisasi berisiko hilang. |
| `App.tsx:584` | Urutan yang dipakai untuk melanjutkan sesi tampak keliru. | Resume dapat membuka posisi yang tidak sesuai. |
| `answerEvaluation.ts:2` | Normalisasi jawaban menghapus tanda negatif. | Jawaban numerik negatif dapat dinilai salah atau berubah makna. |
| `FlashcardScreen.tsx:128` | Pembacaan jawaban hanya memakai `options`. | Format data tanpa properti itu mungkin tidak ditampilkan dengan benar. |
| `ResultScreen.tsx:168` | Metrik hasil tampak berupa nilai tetap (80/75/60/90). | Hasil yang ditampilkan mungkin tidak mencerminkan performa sesi. |
| `MaterialOverview.tsx:61` | Pengaitan topik menggunakan indeks yang dapat tidak cocok. | Materi dapat dikaitkan ke topik yang salah. |
| `questionTransformer.ts:12,55` | Asumsi format bercampur; transformasi juga menulis ulang “vitamin D”. | Konten atau istilah dapat berubah secara tak terduga saat transformasi. |
| `quizImportValidation.ts:28` | Ada risiko ID duplikat; opsi juga difilter berdasarkan indeks. | Impor dapat menerima identitas bentrok atau mengubah susunan/isi opsi. |
| `storageService.ts:428` | Kegagalan ditelan tanpa diteruskan secara jelas. | Pemanggil dapat menganggap operasi penyimpanan berhasil. |
| `NeuroSyncReview.tsx:25` | Status `processing` tampak dapat tertinggal. | Antarmuka dapat terus menunjukkan proses yang tidak selesai. |

## Batasan

Dokumen roadmap di README bukan bukti bahwa temuan di atas telah terjadi saat aplikasi berjalan. Audit ini mencatat indikasi dari kode pada commit yang disebutkan; verifikasi perilaku, tingkat keparahan operasional, dan status perbaikan memerlukan pemeriksaan atau reproduksi lanjutan pada upstream terkait.
