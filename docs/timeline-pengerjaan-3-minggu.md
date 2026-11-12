# Timeline penyelesaian Ayomi — 4–24 November 2026

**Mulai:** Rabu, 4 November 2026.  
**Akhir pengerjaan:** Selasa, 24 November 2026.  
**Target rilis/presentasi hasil:** Rabu, 25 November 2026.  
**Durasi:** 21 hari kalender, terdiri dari 15 hari kerja dan 6 hari akhir pekan.  
**Status:** rencana estimasi; pekerjaan implementasi dalam jadwal ini belum dinyatakan selesai.

## 1. Target dan asumsi kapasitas

Target tiga minggu adalah MVP daycare harian yang dapat dijalankan dari awal sampai akhir: akun empat role, database permanen, izin akses, enrollment, pembayaran, pickup, logbook, insiden, ulasan, legalitas, komplain, keuangan, dan empat kelompok fitur AI. Setiap modul harus tersambung ke frontend serta mempunyai bukti pengujian.

Pemeriksaan 4 November menunjukkan commit terakhir `8ec44b5`. Frontend dan demo lokal sudah tersedia. Dependensi aplikasi belum memuat integrasi Supabase/Gemini, dan folder database belum mempunyai migration SQL. Build, lint, dan 26 tes lokal telah lulus pada pemeriksaan sebelumnya; hasil itu belum menguji backend yang akan dibangun.

Rencana ini **agresif dan bersyarat**, menggunakan asumsi sementara **empat orang teknis aktif**, masing-masing sekitar enam jam efektif per hari kerja: sekitar **360 jam-orang** selama 15 hari kerja. Jumlah anggota sebenarnya belum dikonfirmasi. Akhir pekan menjadi cadangan opsional, tidak dihitung dalam kapasitas tersebut dan tidak memuat peluncuran fitur kritis baru.

Pembagian sementara:

| Penanggung jawab | Fokus utama | Hasil yang dimiliki |
| --- | --- | --- |
| A — Backend data & akses | Schema, Supabase Auth, RLS, akun, keanggotaan, anak, kesehatan, penugasan, delegasi, legal/review | Migration, kebijakan akses, API/RPC, pengujian isolasi data |
| B — Backend operasional | Enrollment, gateway, pickup, laporan/insiden, notifikasi, komplain, refund/payout, audit | State machine, transaksi atomik, webhook, worker, pengujian konflik |
| C — AI & media | Integrasi Gemini, output terstruktur, pekerjaan AI, legal extraction, review/reply, drafter, masking, triage | Pipeline nyata, hasil tersimpan, evaluasi, retry/fallback, kontrol biaya |
| D — Frontend & integrasi | Menghubungkan UI, memisahkan Manager/Caregiver, formulir tambahan, error/loading state, pengujian pengguna, deploy | Alur empat role yang terhubung dan versi staging siap diuji |

Semua anggota menulis tes modulnya dan melakukan review silang. Penanggung jawab produk menyetujui aturan, kriteria penerimaan, dan hasil demo; tugas tersebut harus mempunyai nama pemilik pada hari pertama. D tidak menanggung seluruh pengujian sendirian.

Jika tim hanya satu atau dua orang, seluruh cakupan di atas tidak layak dijanjikan selesai dalam tiga minggu. Pada 4 November perlu dipilih pengurangan cakupan rilis pertama atau perpanjangan jadwal. Menambah jam kerja akhir pekan tidak dijadikan pengganti keputusan kapasitas.

## 2. Acuan dan ruang lingkup

Acuan utama: [alur bisnis dan spesifikasi database](./alur-bisnis-dan-database-ayomi.md), [frontend Parent](./frontend-parent.md), dan [portal Pengelola/Admin](./frontend-portals.md). Struktur 60 tabel dalam rancangan adalah baseline; tabel diterapkan bersama modul yang memakainya, dengan migration yang dapat diuji. Jumlah tabel bukan ukuran keberhasilan.

Gunakan [database](../database/), [integrasi Supabase](../lib/supabase/), [services](../services/), [API](../app/api/), serta komponen/route yang sudah tersedia. Hindari proyek backend atau struktur folder paralel tanpa kebutuhan yang jelas.

**Masuk target:** empat role; Parent mandiri dan undangan staf; pemisahan Manager/Caregiver; data anak/kesehatan dan histori; penugasan/delegasi; katalog harian dan harga disetujui; consent; enrollment; pembayaran gateway; pickup; logbook/foto; urgent acknowledgement/reminder; incident triage; ulasan/moderasi/balasan; legal/score; komplain/investigasi/sanksi; refund/payout/rekening; notifikasi dan audit; deployment serta dokumentasi.

**Tetap di luar MVP sesuai keputusan sebelumnya:** layanan mingguan/bulanan, Caregiver mandiri, pembagian payout kepada Caregiver, video pada aktivitas normal, dan akun multi-role. Tidak ada redesign besar pada tiga minggu ini. Penyempurnaan animasi dan analitik tambahan dikerjakan hanya setelah kriteria rilis utama terpenuhi.

Integrasi gateway dan WA/SMS dimulai dengan sandbox/nomor uji. Penggunaan uang sungguhan atau pengiriman eksternal umum memerlukan akses provider dan kebijakan yang disetujui. Jika akses live belum tersedia, hasil harus diberi status **siap uji sandbox**, bukan dinyatakan production lengkap.

## 3. Keputusan pengunci pada 4–5 November

| Keputusan/dependensi | Batas waktu | Pemilik | Dampak jika belum tersedia |
| --- | --- | --- | --- |
| Jumlah anggota, jam kerja, pembagian A–D, penanggung jawab produk | 4 Nov | Tim | Jadwal harus dihitung ulang bila kapasitas di bawah asumsi |
| Definisi enrollment aktif, akses data sebelum approval, kapasitas, no-show | 4 Nov | Produk + A/B | Constraint dan state machine belum dapat dikunci |
| Layanan/harga harian, batas pembayaran, komisi, biaya Admin, refund, biaya terlambat | 5 Nov | Produk + B | Alur pembayaran hanya bisa diuji dengan konfigurasi uji yang ditandai |
| Akses proyek Supabase, Vercel, Gemini dan anggaran pengujian | 4 Nov | Pemilik akun + A/C/D | Integrasi nyata tertunda; jangan mengganti dengan jawaban AI contoh tanpa label |
| Pilihan gateway, akun sandbox, webhook publik, proses aktivasi live | Mulai 4 Nov; cek 6 Nov | Pemilik akun + B | Target uang nyata berisiko walaupun kode selesai |
| Provider WA/SMS, nomor uji, template/persetujuan provider bila diperlukan | Mulai 4 Nov; cek 6 Nov | Pemilik akun + B | Reminder eksternal hanya dapat diuji pada kanal yang tersedia |
| Formula Safety Score, skala urgensi, moderasi, persetujuan manusia | 5 Nov | Produk + C | Model tidak boleh mengarang bobot atau ambang keputusan |
| Akses/retensi media asli, consent, batas ukuran file, fail-safe masking | 5 Nov | Produk + A/C | Foto tetap privat sampai alur pembagian aman tersedia |
| Pembatasan delegasi dan pihak konfirmasi komplain dari daycare | 5 Nov | Produk + A/B | API tidak boleh mengasumsikan semua Caregiver mempunyai hak Manager |

Nilai yang sudah disepakati tetap dipakai: acknowledgement Manager urgent 3 menit, reminder Parent urgent setiap 3 menit, maksimal dua retry setelah pengiriman pertama, dan auto-close komplain setelah 72 jam tanpa respons pada tahap konfirmasi. Interval lain dan batas penghentian reminder perlu diputuskan.

## 4. Jadwal harian 21 hari

Kolom hasil adalah bukti yang harus dapat diperlihatkan saat review. Tanggal merupakan target, bukan pengesahan bahwa modul aman sebelum tes selesai.

| Hari / tanggal | Backend A–B | AI C dan frontend D | Hasil yang harus terlihat |
| --- | --- | --- | --- |
| H01 · Rab, 4 Nov | Kunci keputusan inti; pecah backlog; rancangkan migration bertahap, kontrak API, matriks akses; buat lingkungan staging dan ajukan akses provider | C: uji koneksi Gemini, tetapkan kontrak hasil dan data evaluasi fiktif. D: deploy baseline, inventaris halaman yang harus tersambung | Backlog dengan pemilik/estimasi, akses dasar, staging baseline, keputusan pengunci tercatat |
| H02 · Kam, 5 Nov | A: users/Auth/roles/members/invitations, provisioning Admin, RLS awal. B: konfigurasi biaya/tagihan, kontrak gateway dan verifikasi webhook | C: adapter AI server, ai_jobs, output terstruktur, timeout dan batas pemakaian. D: login/logout/reset password dan pemisahan dashboard role | Login empat akun uji nyata; role tidak bisa dinaikkan dari browser; satu permintaan AI tersimpan di server |
| H03 · Jum, 6 Nov | A: daycare/layanan/harga, anak/kesehatan, consent, penugasan; uji Parent berbeda. B: enrollment pending/persetujuan, reservasi kapasitas, status logs, outbox notifikasi | C: prototipe drafter dan klasifikasi/moderasi review; buktikan pendekatan masking dengan foto uji yang diizinkan. D: katalog/profil anak/pengajuan memakai database | Data tersimpan setelah reload/perangkat berbeda; pengajuan Parent masuk antrean Manager dengan data minimum; keputusan kelayakan teknis masking |
| H04 · Sab, 7 Nov | Cadangan opsional: perbaiki migration/izin, review transaksi dan konflik kapasitas | Cadangan opsional: tes koneksi AI, invalid output, loading/error UI | Daftar temuan minggu pertama diperbarui; tidak ada kewajiban fitur baru |
| H05 · Min, 8 Nov | Cadangan opsional: verifikasi akses gateway/provider dan rapikan kontrak API | Cadangan opsional: siapkan skenario demo dan dataset uji | Kebutuhan untuk integrasi Senin tersedia; waktu ini boleh dipakai istirahat bila tidak ada blocker |
| H06 · Sen, 9 Nov | A: lengkapi penugasan/delegasi dan pembatasan kesehatan; harga terpublikasi. B: payment attempts, webhook terverifikasi/idempotent, expiry dan pembayaran ganda | C: drafter dan Smart Reply dengan review manusia; draft skema legal extraction. D: checkout/status enrollment, assignment/delegasi UI minimum | Enrollment dan pembayaran sandbox terhubung; duplikasi webhook tidak menggandakan aktivasi; hasil AI dapat ditinjau dan disimpan |
| H07 · Sel, 10 Nov | A: akses historis dan pencabutan izin. B: check-in, authorized pickup, foto bukti, completion atomik, aturan kelayakan payout | C: integrasi drafter/review ke data nyata staging; logging model/prompt/versi. D: flow Parent–Manager–Caregiver dan pickup | **Demo 1:** daftar → ajukan → diterima → bayar sandbox → check-in → pickup → completed. RLS dasar lulus |
| H08 · Rab, 11 Nov | A: private Storage, pemilik media, varian/audiens dan audit koreksi. B: daily reports/activities, urgent acknowledgement, scheduler/outbox/retry | C: pipeline masking + drafter; gagal proses tidak membuka foto asli. D: logbook dengan upload, draft, tinjau/kirim, notifikasi Parent | Aktivitas dengan foto diproses dan tampil sesuai pemilik; urgent teks dapat dikirim tanpa menunggu AI/media |
| H09 · Kam, 12 Nov | A: izin create-only insiden/media susulan dan akses histori. B: incident status/urgency logs, acknowledgement Parent, eskalasi urgent dan pengiriman kanal uji | C: incident triage, dua penilaian terpisah, review override; uji timeout/failure. D: formulir Caregiver, detail Parent/Manager/Admin, acknowledgement | Insiden dapat ditangani tanpa menunggu AI; hasil AI tersimpan terpisah; timer 3 menit dan retry diuji |
| H10 · Jum, 13 Nov | A: legal documents/version, verifikasi, harga dan review/reply moderation. B: complaint assignment/status, investigasi, kebijakan refund/payout dan account-change endpoint awal | C: ekstraksi legal, score dari formula disetujui, summary ulasan; semua kelompok AI terhubung minimal sekali. D: layar legal/ulasan/komplain dan keputusan Admin | **Empat kelompok AI berjalan di staging**; dokumen/review belum approved tidak dipublikasikan; komplain terpisah dari insiden |
| H11 · Sab, 14 Nov | Cadangan opsional: tes ulang akses media, integritas laporan final dan pekerjaan terjadwal | Cadangan opsional: evaluasi OCR, masking, triage, serta review dari dataset uji | Temuan keselamatan/privasi masuk daftar prioritas; pipeline gagal tetap terkendali |
| H12 · Min, 15 Nov | Cadangan opsional: perbaikan hasil evaluasi dan sinkronisasi schema/API | Cadangan opsional: ulang demo empat role dan cek tampilan mobile | Tidak menambah scope; waktu cadangan bila integrasi tertinggal |
| H13 · Sen, 16 Nov | A: finalisasi delegasi, rekening, sanksi dan histori. B: refund penuh/sebagian/none, payout items/holds, duplicate-payment review, complaint confirmation/auto-close | C: perbaiki hasil evaluasi, retry/version checks dan pembatasan data input. D: UI finansial, konfirmasi komplain, rekening dan sanksi | Admin dapat mengambil keputusan finansial sandbox beralasan; rekening ditolak tidak mengganti rekening lama; audit tercatat |
| H14 · Sel, 17 Nov | A/B: integrasi semua modul, statistik terpilih, rekonsiliasi gateway, legal expiry reminder; pastikan setiap schema/API masuk migration | C/D: demonstrasi empat fitur AI dengan error state dan human review; hilangkan ketergantungan fixture pada alur production | **Demo 2 / feature complete:** semua modul target terhubung, seluruh temuan terbuka dicatat; akhir penambahan fitur |
| H15 · Rab, 18 Nov | A/B: tes RLS lintas akun/daycare, akses setelah assignment berakhir, delegasi kedaluwarsa, Storage dan endpoint langsung | C: uji input berbahaya/tidak valid dan kebocoran data antarjob. D: jalankan alur E2E lintas browser/perangkat | Bukti pengujian akses; celah data/role menjadi blocker rilis |
| H16 · Kam, 19 Nov | A/B: uji concurrency, webhook berulang/terlambat, refund berlebih, payout ganda, izin pickup sekali pakai, scheduler restart | C: evaluasi AI pada kumpulan kasus tetap, waktu respons dan biaya; D: error/retry state saat jaringan gagal | Bukti alur gagal tidak merusak data; metrik AI dan daftar keterbatasan tersedia |
| H17 · Jum, 20 Nov | Semua: UAT bersama perwakilan empat role, perbaiki temuan, review migration/deploy dan keputusan produk | C/D: periksa bahasa, aksesibilitas dasar, mobile, hasil AI dan tindakan review | **UAT 1 selesai**; keputusan fitur siap/belum siap per modul, tanpa blocker kritis yang diabaikan |
| H18 · Sab, 21 Nov | Cadangan opsional: perbaikan temuan UAT yang sudah diprioritaskan | Cadangan opsional: regression pada bagian yang berubah | Buffer perbaikan; tidak menambah fitur |
| H19 · Min, 22 Nov | Cadangan opsional: review runbook, data uji, skenario rollback dan hasil backup/restore | Cadangan opsional: latihan demo dengan data fiktif | Bahan serah-terima siap untuk pemeriksaan Senin |
| H20 · Sen, 23 Nov | A/B: regression final; uji restore backup sesuai fasilitas yang tersedia; rehearsal migration; cek provider live, secrets dan monitoring | C/D: validasi versi model/prompt; build production; smoke test URL staging; UAT ulang fitur yang diperbaiki | **Release candidate** dengan commit/tag yang jelas, hasil tes, backup/restore teruji dan keputusan go/no-go |
| H21 · Sel, 24 Nov | Deploy sesuai keputusan go/no-go; migration terkontrol, smoke test empat role, webhook, job, pembacaan log dan rollback bila perlu | Bekukan perubahan selain hotfix; finalisasi panduan akun, operasi, demo lima menit dan known limitations | **Versi rilis atau pilot terbatas terverifikasi**, laporan hasil, akses dan dokumentasi diserahkan |

**25 November:** target presentasi/rilis resmi dari versi yang telah diverifikasi pada 24 November. Bila gerbang keamanan, data, pembayaran, atau media gagal, gunakan pilot terbatas dengan fitur bermasalah dinonaktifkan dan statusnya disebutkan; jangan menandainya sebagai production lengkap.

## 5. Jadwal khusus empat kelompok AI

Empat kelompok fitur mencakup beberapa pipeline, sehingga “API Gemini berhasil dipanggil” belum cukup sebagai kriteria selesai.

| Kelompok fitur | Pengerjaan awal | Integrasi paling lambat | Kriteria selesai |
| --- | --- | --- | --- |
| Instant Logbook Drafter & Privacy Masking | 4–6 Nov: fondasi, kontrak input, pembuktian pendekatan deteksi/blur; 9–11 Nov: integrasi | 11 Nov | Draf berdasarkan fakta yang diberikan, ditinjau Caregiver; foto asli privat; hasil masking terikat pemilik/audiens; kegagalan memblokir pembagian foto; teks urgent tetap dapat dikirim |
| Summary Ulasan & Smart Reply | 6–10 Nov: draf/moderasi; 13 Nov: summary/publikasi | 13 Nov | Summary memakai review approved; Manager dapat mengedit balasan; review/reply bermasalah ditahan; hasil model dan keputusan manusia tercatat |
| Safety Score & Legal Verification | 9–10 Nov: ekstraksi; 11–13 Nov: sumber verifikasi dan formula | 13 Nov | Metadata/hasil ekstraksi disimpan, Admin memverifikasi, formula berversi disetujui; score dapat ditelusuri ke input; dokumen buruk/expired tidak otomatis lolos |
| Incident Urgency Triage | 11–12 Nov: integrasi; 13 Nov: pengujian lintas role | 13 Nov | Urgensi Caregiver dan AI terpisah; aturan max dan override beralasan; AI tidak mengubah status kasus; notifikasi awal tidak menunggu analisis |

Pada 4–5 November tetapkan dataset uji kecil berlabel dan kriteria penerimaan bersama reviewer. Target awal per pipeline adalah sekumpulan kasus normal dan gagal yang dapat diulang; jumlah dan ambang hasil disepakati sebelum evaluasi, bukan dipilih setelah melihat hasil. Sampel kecil tidak menjadi dasar klaim akurasi umum atau “100% aman”.

Evaluasi formal 18–19 November mencakup:

- Ekstraksi: kolom yang cocok dengan label, informasi yang hilang, dan kemampuan menolak dokumen tidak terbaca.
- Drafter/Smart Reply: kesesuaian fakta, tambahan fakta yang tidak diberikan, bahasa, serta kebutuhan koreksi manusia.
- Triage: kesesuaian tingkat urgensi dan setiap kasus yang dinilai terlalu rendah; reviewer menilai seluruh kasus berisiko tinggi.
- Masking: wajah terlewat, variasi sudut/pencahayaan/jumlah wajah, akses ke file asli, serta kasus hasil gagal/meragukan yang harus ditahan.
- Semua pipeline: output invalid, timeout, rate limit, retry, input versi lama, audit, latency dan penggunaan biaya.

Gunakan API/model yang tersedia dan lolos uji, dengan model/prompt/version tersimpan. Pelatihan model dari nol tidak masuk estimasi ini. Masking memerlukan pipeline deteksi dan transformasi gambar yang dibuktikan bekerja; jangan menyamakan keluaran teks Gemini dengan foto yang sudah aman.

Gemini menyediakan structured output berbasis JSON Schema untuk membantu kontrak ekstraksi/klasifikasi. Tetap lakukan validasi bisnis pada server karena struktur JSON yang valid tidak membuktikan isi benar. Referensi: [Gemini structured outputs](https://ai.google.dev/gemini-api/docs/structured-output).

## 6. Dependensi dan urutan yang tidak boleh tertukar

| Jalur | Ketergantungan |
| --- | --- |
| Akses anak | Auth → role/membership → kepemilikan anak → enrollment disetujui → assignment → pembatasan kesehatan/media |
| Keuangan | Harga dan kebijakan disetujui → enrollment → tagihan → webhook → aktivasi → pickup → completion → eligibility payout/refund/holds |
| Logbook | Assignment → draft aktivitas → upload privat → proses masking → tinjau/kirim → logbook Parent |
| Insiden | Create terotorisasi → notifikasi langsung → analisis AI asinkron → review/status manusia → acknowledgement/history |
| Publikasi legal/ulasan | Input/version → analisis → keputusan sesuai aturan → hanya hasil disetujui masuk tampilan publik |
| Rilis | Migration/API/UI terhubung → tes akses dan transaksi → evaluasi AI → UAT → rehearsal/restore → go/no-go → deploy |

Pekerjaan AI dan frontend dapat memakai kontrak API/data fiktif saat backend sedang dibuat. Saat milestone diperiksa, bukti wajib berasal dari integrasi staging yang nyata. Data fiktif untuk pengujian boleh digunakan; respons model atau pembayaran tiruan harus tetap diberi label dan tidak dihitung sebagai integrasi yang selesai.

## 7. Infrastruktur dan integrasi yang harus disiapkan sejak awal

1. **Staging dan production:** konfigurasi terpisah; credential hanya server; data demo tidak otomatis masuk database operasional. Vercel Preview tidak boleh sembarang memakai database production.
2. **Auth dan RLS:** tes menggunakan sesi masing-masing role, bukan hanya service-role. Supabase menyediakan RLS untuk pembatasan akses baris; policy tetap harus ditulis dan diuji berdasarkan relasi aplikasi. Referensi: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
3. **Worker/penjadwal:** urgent memerlukan waktu 3 menit, sehingga pemilihan scheduler dilakukan 4–5 November. Vercel Hobby membatasi cron sekali per hari dan tidak cocok untuk kebutuhan ini. Evaluasi Supabase Cron dengan job persisten/dedup/retry atau fasilitas worker yang tersedia; uji ketepatan aktual, jangan menganggap cron memberi jaminan pengiriman tepat pada detik tertentu. Referensi: [Vercel Cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing), [Supabase Cron](https://supabase.com/docs/guides/cron).
4. **Media:** bucket privat, izin unggah/unduh, validasi ukuran/jenis, status proses, keluaran masking, serta pencabutan akses. Tidak ada link publik untuk foto anak atau bukti pickup/insiden.
5. **Gateway:** webhook sandbox dengan deduplication dan signature verification, rekonsiliasi status, serta pemisahan tagihan/payment attempts/refund/payout. Aktivasi live bergantung provider; tim tidak menjanjikan waktu persetujuan pihak luar.
6. **Notifikasi:** event/outbox tersimpan bersama transaksi bisnis. Worker mengirim, mencatat attempt, dan memeriksa acknowledgement terbaru sebelum reminder. Uji external channel menggunakan nomor yang diizinkan.
7. **Pemantauan:** error aplikasi, job gagal, penggunaan AI, webhook tertunda, serta tindakan Admin dapat diperiksa tanpa menyalin secrets/data kesehatan ke log umum.

## 8. Milestone dan keputusan ketika target meleset

| Tanggal | Gerbang penerimaan | Jika belum lolos |
| --- | --- | --- |
| 6 Nov | Auth/role, data anak terisolasi, pengajuan database, akses provider dan kelayakan masking terbukti | Prioritaskan fondasi; catat dampak jadwal; jangan memperluas modul di atas akses yang salah |
| 10 Nov | Demo 1 enrollment–payment sandbox–pickup lengkap; role dan kepemilikan aman | Hentikan penambahan fitur kosmetik; hitung ulang kapasitas untuk milestone 17 Nov |
| 13 Nov | Empat kelompok AI sudah terintegrasi ke staging, dengan status gagal dan review | Eskalasi risiko scope; pipeline yang belum tersambung tidak dianggap selesai hanya karena UI tersedia |
| 17 Nov | Seluruh modul target masuk staging; feature freeze | Pilih secara eksplisit: perpanjang jadwal atau rilis subset/pilot. Jangan menyembunyikan fitur yang tertinggal dalam label “selesai” |
| 20 Nov | UAT, akses sensitif, transaksi dan hasil AI dapat diterima | Blokir rilis fitur bermasalah; fokus perbaikan dan regression |
| 23 Nov | Release candidate, restore/rehearsal, provider dan monitoring siap | Tunda penggunaan nyata pada modul yang belum memenuhi syarat; demo tetap menggunakan data contoh |
| 24 Nov | Smoke test pascadeploy, dokumentasi dan pemilik operasi tersedia | Rollback atau nonaktifkan fitur gagal; catat status dan tanggal tindak lanjut |

Prioritas saat waktu menipis: pertahankan otorisasi, privasi media, integritas uang/data, dan alur utama. Yang dapat dipangkas dahulu adalah redesign, animasi, laporan tambahan, serta penyempurnaan nonkritis. Pembayaran live/WA-SMS live boleh tetap tertutup bila persetujuan provider belum ada, tetapi ini merupakan keterbatasan rilis yang diumumkan, bukan penyelesaian penuh.

## 9. Definisi selesai

Suatu fitur dinyatakan selesai bila API/database, UI, izin akses, kondisi gagal, dan pengujian telah tersambung; perubahan sudah di-review dan ada deployment staging yang dapat dicoba. Rilis keseluruhan memerlukan:

- Empat role bekerja dengan akun nyata dan hak yang berbeda; tidak ada kenaikan role dari parameter URL/localStorage.
- Data tetap ada lintas sesi/perangkat; reset demo tidak menghapus data backend.
- Parent hanya mengakses anak sendiri; Manager hanya daycare sendiri; Caregiver hanya penugasan dan laporan sendiri sesuai aturan; masa delegasi benar-benar diperiksa server.
- Enrollment, kapasitas, deadline pembayaran, webhook, pickup, refund, dan payout tidak ganda ketika request diulang atau terjadi bersamaan.
- Aktivitas terkirim dan bukti final tidak dapat ditimpa; koreksi beralasan dan perubahan penting mempunyai histori.
- Normal logbook mengikuti aturan foto; urgent tanpa foto tetap berjalan; foto gagal masking tidak dibagikan.
- Empat kelompok AI benar-benar memanggil layanan yang dipilih, menyimpan hasil/versi, memiliki human review sesuai aturan, dan lulus dataset uji yang disepakati.
- Insiden, komplain, acknowledgement dan status pengiriman tetap terpisah; reminder dan retry diuji terhadap restart serta acknowledgement yang datang bersamaan.
- Review/reply/legal/harga/rekening hanya dipublikasikan/diaktifkan melalui keputusan yang diizinkan.
- UAT tidak menyisakan bug kritis: kebocoran data, salah role, transaksi ganda, penyerahan anak tanpa verifikasi, kehilangan data, atau kegagalan alur utama tanpa pemulihan.
- Build, lint, unit/integration tests, tes RLS/Storage, E2E empat role, dan smoke test pascadeploy lulus; tes frontend lama saja tidak cukup.
- Tersedia migration, bukti backup/restore, langkah rollback, daftar konfigurasi, panduan tiap role, known limitations, serta pemilik pemantauan/dukungan setelah rilis.

## 10. Ritme kerja dan hasil serah-terima

Setiap hari kerja: sinkronisasi singkat untuk blocker, implementasi sesuai jalur A–D, review silang, integrasi ke staging, lalu pemeriksaan hasil yang dijadwalkan. Jangan menunggu akhir minggu untuk menggabungkan backend dan UI. Commit mengikuti perubahan yang utuh dan dapat ditinjau; push setelah pemeriksaan yang relevan, tanpa memasukkan secrets atau data pribadi.

Satu daftar kerja mencatat: modul, PIC, estimasi, dependensi, status, bukti tes, tautan perubahan, blocker dan keputusan produk. Review besar dilakukan 10, 17, 20, dan 23 November. Setelah 17 November, perubahan dibatasi pada perbaikan, keamanan, dokumentasi dan kebutuhan rilis yang sudah disepakati.

Paket akhir 24 November: URL aplikasi terverifikasi, versi kode/migration, akun uji per role, schema dan kebijakan akses, hasil evaluasi AI, bukti tes, konfigurasi deployment, runbook notifikasi/gateway/AI, panduan pengguna, naskah demo, daftar keterbatasan, dan pembagian tanggung jawab operasi. Credential diserahkan melalui mekanisme aman di luar dokumen/repository.

Jadwal ini memberi target penyelesaian yang dapat diperiksa. Kelayakan akhir tetap bergantung pada kapasitas tim yang dikonfirmasi, keputusan produk, akses provider, serta hasil pengujian; tanggal tidak menggantikan gerbang penerimaan.
