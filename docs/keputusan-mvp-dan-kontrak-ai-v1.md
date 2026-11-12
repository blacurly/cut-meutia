# Ayomi — keputusan kerja MVP dan kontrak AI v1

Tanggal: 5 November 2026. Pemakai: Annisa (database), Sustri (frontend), backend, dan AI.

**Status:** baseline implementasi MVP yang direkomendasikan. Aturan dari keputusan pengguna dipertahankan; nilai baru di bawah adalah keputusan sementara MVP untuk memungkinkan pengerjaan paralel, bukan klaim sudah disetujui seluruh tim atau memenuhi seluruh kewajiban hukum. Schema/payload dapat dipakai untuk mock sekarang. Kebijakan komersial, persetujuan, dan retensi harus disahkan penanggung jawab sebelum menerima uang/data anak nyata.

Kontrak mesin: [JSON Schema dan contoh delapan pekerjaan AI](./kontrak-ai-mvp-v1.json). Acuan struktur: [SQL 60 tabel](../database/001_create_tables.sql). Penjelasan metode/evaluasi: [pipeline AI](./pipeline-ai-ayomi.md). [Notebook Safety Score](./safety-score-legal-verification.ipynb) adalah eksperimen; adapter notebook perlu mengikuti kontrak ini sebelum diintegrasikan.

Dokumen ini mengunci pilihan untuk implementasi v1, tanpa menjalankan migrasi atau mengubah data Supabase. Dokumen lama tetap menjadi riwayat. Bila berbeda, gunakan keputusan terbaru pemilik produk, lalu kontrak v1 ini, lalu rancangan sebelumnya. Perubahan breaking berikutnya harus menaikkan versi kontrak; perubahan bobot, tarif, dan durasi menggunakan konfigurasi berversi, bukan mengganti struktur tabel.

## 1. Ringkasan keputusan

| Area | Keputusan kerja MVP v1 | Dasar |
| --- | --- | --- |
| Kapasitas | Per daycare per tanggal lokal, semua layanan berbagi kuota | Default baru |
| Reservasi slot | Saat Manager menerima **dan** enrollment menjadi pending_payment; pending belum menahan slot | Memperjelas baseline |
| Pembayaran | Midtrans Snap sandbox; VA, QRIS, e-wallet yang aktif di akun | Default provider baru; aktivasi produksi terpisah |
| Deadline | Maksimal 2 jam sejak checkout dibuka, tidak melewati jam mulai layanan | Default baru |
| Expired | Otomatis expired; slot dilepas; pembayaran terlambat masuk rekonsiliasi | Baseline + detail |
| Pembatalan | Parent langsung hanya saat pending; setelah itu permintaan ditangani Admin | Keputusan pengguna |
| Refund sebelum layanan | Default penuh termasuk biaya Admin; tetap diputuskan Admin dan dicatat | Default MVP baru |
| No-show | Tidak completed; Admin menutup sebagai cancelled/no_show, default refund penuh untuk MVP | Default baru |
| Payout | Setelah completed + pickup sah, tunggu 24 jam, tanpa hold, disetujui Admin | Baseline + jeda baru |
| Consent | Eksplisit, terpisah per tujuan, berversi; publikasi/promosi anak dimatikan pada MVP | Memperjelas baseline |
| Kesehatan | Parent mengubah langsung; Manager dan Caregiver berwenang diberi pembaruan | Keputusan pengguna |
| Delegasi | Empat izin yang sudah ada; ada mulai/akhir; dapat dicabut; tidak berantai | Keputusan pengguna |
| Masking | Semua wajah ditutup pada MVP; original/varian privat terpisah; wajib review | Default teknis baru |
| AI | Model menghasilkan analisis/draf; perubahan bisnis dilakukan server sesuai aturan | Keputusan pengguna |
| Safety Score | AI mengusulkan kriteria; kode menghitung bobot; Admin memverifikasi/publikasi | Default teknis v1 |

## 2. Enrollment, kapasitas, pembayaran

### 2.1 Reservasi dan status

- MVP hanya layanan satu hari penuh; tidak membagi kuota per shift/layanan. Pengajuan baru paling cepat untuk tanggal besok menurut timezone daycare. Pemesanan hari yang sama ditunda.
- `daycares.daily_capacity` adalah kapasitas dasar. Kapasitas tanggal tertentu tidak boleh dikurangi di bawah reservasi/anak yang sudah diterima. Jadwal tutup divalidasi dari opening_hours; kalender kapasitas khusus ditunda.
- Kapasitas terpakai untuk tanggal tersebut = pending_payment yang belum kedaluwarsa + approved + completed. Pending, rejected, cancelled, expired tidak dihitung. Completed tetap menghabiskan kuota layanan harian tanggal itu.
- Manager menerima pengajuan dalam transaksi: lock baris daycare dan anak dalam urutan tetap → bersihkan checkout kedaluwarsa → cek kuota/anak → buat tagihan/snapshot → pending_payment. Jangan memakai pola cek di browser lalu INSERT terpisah.
- `manager_decision=accepted` belum tentu mendapat slot. Jika anak masih punya checkout/approved lain, pengajuan tetap pending dengan `activation_block_reason`. Tidak ditagih dan tidak membuka data anak ke daycare.
- Satu anak maksimal satu pending_payment atau approved secara global untuk MVP. Beberapa pengajuan pending diperbolehkan. Konsekuensi: belum mendukung beberapa booking masa depan yang sudah dibayar untuk anak yang sama; ini sengaja dipertahankan agar konsisten dengan baseline satu enrollment aktif.
- `approved` baru setelah pembayaran yang sah; check-in memakai checked_in_at. Manager baru mendapat data anak setelah approved, bukan saat menekan Terima.
- Check-in tidak membuat status baru. Completed hanya lewat pickup sah sesudah check-in. Expired/cancelled/rejected/completed terminal.

### 2.2 Checkout dan rekonsiliasi

`payment_deadline = min(checkout_opened_at + 2 jam, service_starts_at)`; reject pembukaan checkout jika hasilnya tidak di masa depan. UI menunjukkan deadline sebenarnya, termasuk jika kurang dari dua jam. Jam mulai/akhir layanan dan timezone disalin sebagai snapshot saat checkout, sehingga perubahan jadwal daycare tidak mengubah transaksi lama.

Worker memeriksa expired setiap satu menit. Walau worker terlambat, endpoint pembayaran dan penghitungan kuota tetap memeriksa deadline server. Expiry provider disetel sedekat mungkin dengan deadline Ayomi; aturan Ayomi tetap berlaku jika provider tidak mendukung batas persis.

Gunakan Midtrans Snap sandbox untuk integrasi awal. Provider mengirim perubahan melalui webhook; redirect sukses dari browser bukan bukti pembayaran. Verifikasi webhook dan bila perlu status melalui server provider; cocokkan order ID, mata uang, nominal, status, serta waktu pembayaran. Simpan event unik sebelum menerapkan. [Snap](https://docs.midtrans.com/docs/snap), [Webhook Midtrans](https://docs.midtrans.com/docs/https-notification-webhooks)

Pembayaran sukses setelah enrollment expired, pembayaran ganda, nominal salah, atau webhook terlambat setelah slot dilepas masuk `reconciliation_status=needs_review`. Jangan membuka ulang enrollment terminal. Admin memutuskan refund; uang tersebut tidak masuk payout otomatis. Satu charge mempunyai beberapa payment attempts, tetapi hanya satu transaksi yang diterapkan.

### 2.3 Pembatalan, no-show, keterlambatan, payout

| Kondisi | Keputusan default MVP |
| --- | --- |
| Pending dibatalkan Parent | Cancelled langsung; tidak ada charge dibayar |
| Pending payment ingin dibatalkan | Parent membuat permintaan; Admin membatalkan checkout yang belum dibayar melalui proses terkunci dan gateway, lalu cancelled; alternatif menunggu expired. Tidak ada tombol mutasi langsung oleh Parent |
| Sudah membayar, belum mulai/check-in | Admin membatalkan dan menyetujui refund penuh. Default tidak memotong biaya Admin Parent; biaya gateway yang tidak kembali ditanggung platform untuk MVP |
| Daycare membatalkan/tidak dapat melayani | Refund penuh oleh Admin; bukti dan alasan wajib |
| Layanan sudah dimulai | Tidak ada refund otomatis. Admin dapat memutuskan full/partial/none atas komplain/bukti; alasan dan nominal disimpan |
| No-show | Pada mulai + 60 menit, Manager menghubungi Parent. Setelah jam akhir layanan tanpa check-in dan setelah pemeriksaan, Admin menetapkan cancelled dengan alasan no_show. Default MVP refund penuh; tidak membuat pickup/kehadiran palsu |
| Pickup terlambat | Grace 15 menit. Setelah itu unit = ceil((late_minutes − 15)/15). Tarif per unit berasal dari versi harga approved; default MVP Rp0 sampai tarif daycare disetujui dan diberitahukan sebelum checkout |
| Payout | Eligible pada completed_at + 24 jam, pickup sah, rekonsiliasi selesai, tanpa hold aktif. Admin menyetujui; status paid hanya setelah bukti transfer/konfirmasi provider |

Pembayaran biaya keterlambatan adalah charge terpisah. Anak tidak ditahan karena pembayaran belum selesai. Kapasitas tidak boleh didaur ulang pada hari yang sama hanya karena pickup lebih awal.

Refund tetap tindakan Admin. Untuk metode yang tidak mendukung refund API, gunakan pengembalian manual terverifikasi dengan referensi transfer; jangan menandai succeeded ketika baru mengajukan. Midtrans memiliki pembatasan metode/aktivasi refund, jadi satu mekanisme refund otomatis tidak boleh diasumsikan berlaku pada semua VA/e-wallet. [Dokumentasi refund](https://docs.midtrans.com/reference/refund-transaction)

Midtrans menerima pembayaran; pencairan provider ke merchant berbeda dari payout Ayomi ke daycare. V1 belum mengasumsikan split settlement/escrow. Payout daycare dapat dioperasikan manual oleh Admin setelah rekonsiliasi; integrasi disbursement adalah tahap terpisah. Mode produksi menunggu validasi akun merchant, model bisnis, pengelolaan dana, dan dukungan provider. Sandbox memakai simulator resmi, bukan pembayaran uang sungguhan. [Sandbox Midtrans](https://docs.midtrans.com/docs/testing-payment-on-sandbox)

Komisi dan biaya Admin pada sandbox v1 ditetapkan eksplisit 0, bukan fallback diam-diam. Harga daycare tetap berasal dari price version approved. Sebelum uang nyata, tarif komersial wajib menjadi system_settings/commission_rules approved; checkout harus ditolak bila konfigurasi wajib belum disahkan. Mengganti angka konfigurasi tidak memerlukan tabel baru.

## 3. Consent dan kesehatan anak

### 3.1 Jenis persetujuan

Simpan satu record `enrollment_consents` per tujuan dan versi. `scope` memuat `kind`, `policy_version`, `purposes`, `processors`, dan `media_channels` bila relevan; wording_snapshot menyimpan teks yang benar-benar diterima. Server menentukan Parent, enrollment, accepted_at; browser tidak boleh mengubah record historis.

| Kind | Wajib/opsional dan perilaku |
| --- | --- |
| service_terms | Wajib: harga, jadwal, refund/no-show, pickup, ketentuan layanan |
| child_operational_data | Wajib: pemrosesan identitas anak, kontak darurat, informasi kesehatan relevan, dan akses daycare sesuai enrollment/assignment |
| private_documentation | Wajib untuk flow aplikasi MVP yang mensyaratkan 1–3 foto normal: dokumentasi privat, masking lokal/worker, serta bukti pickup. Jelaskan sebelum pengajuan; jika ditolak, jangan berpura-pura consent diterima atau membuat enrollment melalui flow tersebut |
| external_ai_assistance | Opsional: pemrosesan teks yang diminimalkan oleh provider AI. Jika ditolak, logbook ditulis manual dan triage manusia tetap berjalan. Tidak boleh menghalangi pertolongan atau notifikasi |
| public_marketing | Nonaktif pada MVP; default tidak disetujui. Publikasi/promosi foto/video anak tidak dibundel dengan dokumentasi privat |

Aktivitas normal tidak memakai video. Insiden boleh mempunyai media jika diperlukan; akses dan retensinya terpisah. Tidak ada penggunaan data anak untuk melatih model pada MVP. Pendaftaran daycare/legal oleh Manager mempunyai dasar dan pemberitahuan pemrosesan dokumen organisasi tersendiri, tidak menumpang consent Parent.

Perubahan material tujuan, penerima data, retensi, atau kebijakan meminta persetujuan versi baru sebelum pemrosesan baru. Perbaikan ejaan cukup notifikasi dan version history. Perubahan tarif tidak berlaku surut pada booking yang sudah dikunci. Consent baru tidak mengganti record lama.

Parent dapat menarik consent AI/marketing tanpa mengakhiri layanan. Alur normal pencabutan akses operasional dilakukan bersama penutupan enrollment; permintaan hak penghapusan/penarikan tetap harus dapat diterima dan ditinjau, bukan diblokir sampai pengguna menyetujui kebijakan baru. Penanganan anak yang sedang dititipkan harus dialihkan secara aman; akses historis dibatasi dasar dan tujuan yang masih sah.

UU PDP mengatur data anak/kesehatan sebagai data spesifik, persetujuan orang tua/wali untuk pemrosesan data anak, dan bukti persetujuan. Karena itu rancangan lama yang hanya menganggap consent implisit diperjelas menjadi record eksplisit. Angka retensi dalam dokumen ini adalah kebijakan produk usulan, bukan masa retensi yang diklaim diwajibkan UU. [UU 27/2022, Pasal 4, 22–25](https://jdih.komdigi.go.id/produk_hukum/view/id/832/t/crc32/)

### 3.2 Data kesehatan dan siapa yang mengakses

Wajib diisi sebagai jawaban, tetapi tidak wajib memiliki penyakit: alergi, kondisi/riwayat medis yang relevan untuk pengasuhan, kebutuhan khusus, dan catatan obat yang sedang digunakan. Setiap bagian dapat bernilai “tidak ada” atau “belum diketahui”; jangan otomatis mengubah kosong menjadi “tidak ada”. Kontak darurat minimal satu nama/hubungan/telepon. Detail obat adalah informasi Parent, bukan instruksi pemberian obat otomatis dari AI.

- Parent pemilik membaca/mengubah profil dan melihat riwayat anak sendiri. Perubahan langsung tersimpan, version bertambah, history tercatat, notifikasi dibuat atomik.
- Manager daycare sendiri membaca data relevan hanya setelah enrollment approved dan selama akses operasional berlaku. Tidak mengubah data kesehatan.
- Caregiver membaca hanya jika akun/keanggotaan aktif, enrollment approved, dan assignment sedang berlaku. Selesai assignment: akses kesehatan termasuk snapshot sensitif dicabut. Caregiver mengajukan koreksi; Parent memutuskan.
- Admin mempunyai akses pengawasan dengan audit dan tujuan yang jelas. Tidak menyalin data kesehatan ke log umum.
- Daycare baru tidak melihat riwayat daycare sebelumnya. Setelah layanan berakhir, daycare mempertahankan riwayat operasionalnya sendiri sesuai retensi, bukan akses profil kesehatan terkini.
- Perubahan tidak menunggu persetujuan Manager. Manager/Caregiver menerima notifikasi tanpa isi kesehatan sensitif; isi dibuka melalui endpoint yang memeriksa hak lagi.

## 4. Delegasi serta akses media

Delegasi hanya dari Manager utama ke anggota aktif daycare yang sama, dengan starts_at < ends_at. MVP memakai batas maksimal tujuh hari per delegasi; dapat diperbarui lewat delegasi baru atau dicabut lebih awal, semuanya diaudit. Delegasi berakhir otomatis berdasarkan waktu server dan status anggota, bukan hanya job yang mengubah flag.

Izin tetap persis: `manage_caregivers`, `manage_assignments`, `manage_daily_reports`, `confirm_pickup`. Tidak ada delegasi legal, rekening, harga/pengaturan utama, moderasi balasan, perubahan status/urgensi insiden, atau delegasi lanjutan. Caregiver tetap boleh membuat insiden tanpa izin tambahan, tetapi tidak membaca riwayat/lampirannya.

`confirm_pickup` membuka data minimum untuk penyerahan yang sedang diproses, bukan riwayat pickup. `manage_daily_reports` boleh review/koreksi teks beralasan; tidak mengubah foto yang sudah dikirim atau memberi akses seluruh kesehatan.

| Jenis media | Akses original | Akses Parent |
| --- | --- | --- |
| Foto aktivitas | Pembuat untuk draft/pemeriksaan saat berwenang; Manager daycare; Admin; worker sesuai job | Hanya varian masked yang ready dan sesuai audience_child_id |
| Bukti insiden | Parent anak terkait, Manager daycare, Admin; Caregiver hanya upload terbatas tanpa read riwayat | Melalui endpoint bukti anak sendiri; jika memuat pihak lain, redaksi dahulu atau review manual, tidak mengirim original yang membocorkan anak lain |
| Foto pickup | Parent terkait, Manager, Admin; petugas delegasi hanya proses pickup saat itu | Bukti penyerahan anak sendiri sesuai izin |
| Dokumen legal/rekening | Manager daycare, Admin, worker legal sesuai kebutuhan | Tidak mendapat dokumen mentah |

Original dan varian berada di bucket privat dan object path berbeda. URL unduh baru dibuat setelah otorisasi, TTL 60 detik; jangan simpan URL bertanda tangan di database. Masking v1 menutup seluruh wajah, tidak melakukan face recognition. Pemroses gambar lokal/worker, bukan Gemini image generation. Tidak ada wajah terdeteksi tetap memerlukan pemeriksaan manusia. Identitas pada papan/seragam harus ditutup manual bila terlewat.

Hasil masking dianggap `processing` sampai pemeriksaan Caregiver/Manager selesai; saat disetujui isi reviewed_by/reviewed_at lalu ready. Jika gagal, original tidak menjadi fallback. Aktivitas normal menunggu 1–3 foto ready; urgent langsung berjalan tanpa foto. Lampiran susulan urgent tetap melewati masking. Penghapusan terjadwal berdasarkan retensi berbeda dari tindakan pengguna menghapus/mengganti bukti.

## 5. Kontrak bersama AI

### 5.1 Feature, envelope, dan batas kepercayaan

Empat fitur produk menghasilkan delapan jenis job yang **sudah cocok** dengan CHECK `ai_jobs.feature`:

`legal_verification`, `safety_score`, `incident_triage`, `logbook_draft`, `privacy_masking`, `review_moderation`, `smart_reply`, `review_summary`.

OCR memakai `legal_verification`, bukan enum baru `ocr`. Moderasi review dan reply memakai feature yang sama, dengan FK target yang berbeda. Review Summary tetap masuk kontrak walau tidak disebut pada daftar terakhir agar fitur produk kedua lengkap.

Browser → endpoint backend mengirim feature, source_id, input_version, request_key. Backend membaca sumber dari DB setelah memeriksa role/ownership/assignment; backend membentuk input worker dari JSON Schema. Jangan menerima role, daycare_id, hasil skor, path Storage, atau policy pilihan browser sebagai otoritas.

Worker → adapter model mengirim hanya bahan minimum, instruksi versi tetap, dan schema output model. Tidak mengirim ID akun/nama anak, seluruh riwayat medis, token, secret, atau signed URL. Referensi internal pada kontrak digunakan worker untuk memetakan hasil; tidak semuanya perlu dikirim provider.

JSON Schema dan contoh input/output lengkap untuk masing-masing feature ada pada [kontrak mesin](./kontrak-ai-mvp-v1.json). Semua properti yang tercantum required; unknown memakai null atau array kosong sesuai schema, bukan string “N/A”. UUID berbentuk UUID, timestamp RFC3339 bertimezone, tanggal YYYY-MM-DD. input_version envelope string; nomor versi domain di payload tetap integer. Hash sumber dibentuk server.

Job status untuk frontend: queued/running/succeeded/failed/cancelled; review_state: not_required/pending/approved/rejected; application_state: not_applied/applied/stale. Dua state terakhir bukan tambahan enum ai_jobs.status: diturunkan dari tabel domain dan metadata hasil. Succeeded bukan berarti approved/published. Result pada status endpoint hanya proyeksi yang diizinkan untuk role tersebut. Caregiver pembuat insiden tidak diberi analisis/riwayat melalui job endpoint.

### 5.2 Status, retry, timeout

- Satu row `ai_jobs` = satu attempt. Attempt 1 queued → running → succeeded/failed/cancelled. Tidak menimpa row gagal menjadi sukses.
- Retry membuat row baru, `retry_of_id` menunjuk job pertama, attempt_number 2/3. Maksimal tiga attempt total untuk satu permintaan logis. Root tidak pernah mempunyai retry_of_id.
- Request logis dideduplikasi dari feature + source ID/version/hash + contract version + model requested + prompt/policy/formula version. `idempotency_key = logical_key + ':attempt:' + attempt_number`. Repeated POST tidak membuat job berbayar baru.
- Retry otomatis hanya timeout, koneksi terputus, 429, dan 5xx: jeda 5 detik lalu 20 detik + jitter 0–3 detik; hormati Retry-After hingga batas operasional yang ditentukan worker. Timeout request provider 60 detik, task OCR/masking 120 detik, feature teks 60 detik. Konfigurasi hosting harus mendukungnya atau gunakan worker terpisah.
- Lease task 180 detik dengan heartbeat 30 detik; token claim harus masih cocok saat hasil diterapkan. Worker mati ditandai failed/WORKER_LOST setelah lease habis, lalu retry sesuai batas. Hasil dari worker lama tidak boleh diterapkan.
- Input invalid/izin gagal tidak membuat model call; 400/403. 401 provider, model tak ditemukan, safety block, JSON/schema invalid, bukti palsu/tidak cocok: failed, tanpa retry otomatis. Perbaikan input/prompt memicu permintaan versi baru; bukan fallback jawaban karangan.
- Kode error tetap: INPUT_INVALID, ACCESS_DENIED, CONSENT_REQUIRED, PROVIDER_AUTH, MODEL_UNAVAILABLE, RATE_LIMITED, PROVIDER_TIMEOUT, PROVIDER_UNAVAILABLE, SAFETY_BLOCKED, OUTPUT_INVALID, EVIDENCE_MISMATCH, WORKER_LOST, SOURCE_CHANGED, CANCELLED_BY_USER.
- Jika versi sumber berubah sebelum jalan: cancelled/SOURCE_CHANGED. Jika hasil valid datang sesudah sumber berubah: simpan succeeded dengan application_state stale dan jangan terapkan. Recheck izin saat apply/download.
- Hasil AI yang menolak menyimpulkan karena bukti kurang adalah **succeeded dengan abstain**, bukan error provider. Score/urgency boleh null pada kontrak; jangan memaksa nilai database palsu.
- Kegagalan akhir: kirim notifikasi tugas ke pihak berwenang; triage/logbook urgent berjalan dengan penilaian manusia; masking tidak membuka foto; moderasi tetap tertahan; legal/skor belum dipublikasikan.

State job, claim, transisi domain, dan notifikasi dibuat dengan transaksi/idempotensi. Panggilan jaringan tidak berjalan sambil menahan transaksi database. Pembatalan tidak menjamin request provider yang telanjur berjalan tidak ditagih.

## 6. Kontrak per feature

### 6.1 OCR / legal_verification

**Trigger:** Manager submit dokumen versi baru; Admin meminta analisis ulang. Upload yang belum disubmit tidak otomatis diproses.

**Input:** document_id/version/type; attachment ID/hash/MIME; identitas daycare yang diharapkan; as_of. Worker mengambil PDF/JPG/PNG privat. Batas MVP 5 MiB, 20 halaman, satu dokumen utama per job; pendukung dinilai lewat verifikasi terpisah.

**Output:** fields dokumen (jenis, nama lembaga, nomor, penerbit, tanggal terbit/akhir, alamat, validity_type), evidence per field (source_id/page/quote), missing_fields, issues, requires_human_verification=true. Tanggal tidak terbaca null; permanent perlu bukti, bukan sekadar expires_on kosong.

**Validasi/manusia:** server memeriksa format/tanggal/sumber; Admin membandingkan asli dan sumber penerbit. OCR tidak menetapkan approved, dokumen asli, atau legalitas. Admin mengisi verified_fields dan decision pending/approved/revision_required/rejected. Perubahan field oleh Admin disimpan dengan alasan.

**DB:** ai_jobs.document_id; daycare_verifications.ocr_result/analysis_result/verified_fields; dokumen dan attachments; audit. Keputusan final dipertahankan; pengajuan baru tidak menimpa versi publik lama sampai disetujui.

### 6.2 Safety Score

**Trigger:** hasil verifikasi Admin berubah, bukti kedaluwarsa/dicabut, atau formula approved berubah. Tidak berjalan setiap detail daycare dibuka.

**Input:** daycare_id, as_of, formula_version, rubric empat komponen, dan verified_sources berisi ID/versi verifikasi, waktu review/masa berlaku, fakta, referensi bukti. Klaim profil Manager tidak dianggap verified_sources.

**Output model:** tepat empat criteria dengan id legal/sop/staff/facility, status pass/partial/fail/unknown, reason, evidence. **Output worker:** tambah score, coverage, formula_version, blockers, requires_admin_review=true. score dan coverage dihitung ulang server, tidak dipercaya dari LLM.

Formula kerja: `40×legal + 25×sop + 20×staff + 15×facility`; pass=1, partial=0.5, fail=0. coverage = jumlah bobot komponen yang diketahui /100. Jika satu komponen unknown: score=null. Jika legal tidak pass atau bukti wajib kedaluwarsa: tahan publikasi. Tidak memasukkan rating bintang/jumlah insiden mentah ke skor.

Rubrik komponen mengikuti definisi pada notebook sebagai draft; model dapat dipakai eksperimen sekarang. Formula baru boleh approved setelah penanggung jawab menetapkan daftar bukti/checklist, masa berlaku inspeksi, dan rule pass/partial/fail. Hingga itu, publik menampilkan “Belum dinilai”, bukan skor demonstrasi. Bentuk kontrak dan tabel tidak menunggu pengesahan bobot.

**Manusia/DB:** Admin memverifikasi keputusan kriteria dan mengesahkan publikasi. Simpan snapshot formula/bukti/skor/penjelasan di daycare_safety_scores, analisis di ai_jobs.output. Score null hanya di job; jangan insert 0 ke tabel score NOT NULL. Expiry/dispute menghilangkan skor sebagai skor terkini dan mengantre review ulang; histori retained. Skor menilai bukti pada suatu waktu, bukan sertifikasi keselamatan.

### 6.3 Incident Triage

**Trigger:** laporan sudah tersimpan dan event notifikasi awal sudah dicatat. Pemrosesan AI tidak menjadi syarat submit, pertolongan pertama, atau pengiriman notifikasi. Reanalisis eksplisit memakai versi baru.

**Input:** ID/versi insiden, waktu, deskripsi, observed_facts, tindakan yang sudah dilakukan, urgensi Caregiver, SOP approved. Usia dalam bulan hanya jika relevan; tanpa nama, tanggal lahir, seluruh kesehatan, atau media untuk MVP. Jika consent AI tidak ada, gunakan alur manusia.

**Output:** urgency low/medium/high/emergency atau null (abstain), reason, evidence_quotes, sop_refs, missing_information, operational_actions dari allowlist, needs_human_review=true. Tidak ada diagnosis/dosis atau instruksi medis generatif.

**Apply:** gunakan max(Caregiver, AI) bila hasil valid dan belum ada override Manager. Jika AI null/gagal, pertahankan manusia dan tandai review. Manager override membutuhkan alasan/history. Hasil terlambat tidak menimpa override atau membuka resolved kembali. Status new/in_progress/resolved hanya Manager/Admin. Safety block tidak dianggap insiden low.

**DB:** incident_ai_analyses untuk urgency non-null; abstain/error tetap pada ai_jobs; incident_urgency_change_logs; needs_urgency_review; notifikasi. Caregiver tidak memperoleh riwayat/lampiran/hasil triage melalui job. Parent/Manager mendapat notifikasi setiap insiden; reminder Parent satu kali setelah 3 menit belum acknowledgement. Ini terpisah dari reminder urgent logbook berulang.

### 6.4 Logbook Drafter

**Trigger:** Caregiver berwenang menekan Buat draf AI pada aktivitas draft tersimpan. Tidak berjalan setiap ketikan. Tidak diperlukan untuk aktivitas urgent.

**Input:** activity_id/version, activity_type, occurred_at, timezone, observed_facts; meal mencakup food/portion_consumed/observed_condition; sleep mencakup started_at/ended_at/condition_after. Enam jenis tetap play/learning/interaction/meal/sleep/other. Tanpa foto atau profil kesehatan untuk generasi teks.

**Output:** title (maks 120), body (maks 1500), missing_fields, used_fact_indices, requires_caregiver_review=true. Durasi tidur dihitung kode; AI tidak mengganti waktu atau menyimpulkan emosi/diagnosis.

**Manusia/DB:** Caregiver meninjau/mengedit lalu kirim. ai_jobs.activity_id/output menyimpan draf; teks terpilih baru dimasukkan ke daily_report_activities melalui aksi pengguna dengan pengecekan version. Jangan menimpa draft yang sudah diedit selama menunggu AI. Laporan sent immutable bagi Caregiver; Manager koreksi teks beralasan. Fallback adalah form manual, bukan blok layanan.

### 6.5 Privacy Masking

**Trigger:** upload foto aktivitas selesai dan valid. Saat original diganti di draft, gunakan hash baru dan job baru; original sent tidak boleh diganti.

**Input:** attachment_id/source_sha256, activity_id, audience_child_id, input_version, policy_version, mask_policy=all_faces, source_object internal. Browser tidak memilih object path bebas. Worker menjalankan detektor wajah dan penyuntingan piksel; bukan model Gemini.

**Output:** attachment/hash/audiens, ukuran gambar orientasi normal, faces_detected, masks dalam koordinat piksel, variant bucket/path/hash/MIME, quality_flags, requires_human_review=true. Output path/hash berasal worker, bukan LLM. Box harus di dalam ukuran gambar; manual box boleh ditambahkan.

**Manusia/DB:** original pada attachments; hasil pada attachment_variants. `processing` sampai review pembuat/Manager, lalu ready beserta reviewer/waktu. Detektor nol wajah tetap ditinjau. Thumbnail diturunkan dari varian yang aman, bukan original. Parent hanya menerima varian ready milik anaknya. Tidak ada fallback original. Masking gagal → ulang sesuai kebijakan/manual, atau kirim urgent tanpa media bila memang urgent.

### 6.6 Review Moderation

**Trigger:** Parent submit versi review atau Manager submit versi balasan; termasuk balasan AI yang telah diedit. Edit draft belum memicu publikasi.

**Input:** target_kind review/reply, target_version_id, input_version, body, rating (1–5 untuk review; null untuk reply), moderation_policy_version. Maks body 4000 karakter. Parent harus memenuhi completed + pickup, satu review kanonis per Parent/daycare.

**Output:** recommendation allow/hold, categories spam/personal_data/harassment/threat/other_policy_risk, evidence_quotes, reason, policy_version. Tidak ada reject permanen otomatis. Sentimen negatif dan keluhan keselamatan wajar tidak boleh dianggap pelanggaran.

**Manusia/DB:** allow + lolos validasi server → approved tanpa review manusia rutin; hold atau kegagalan akhir → held dan Admin memutuskan approved/rejected dengan alasan. State versi pending/held/approved/rejected terpisah dari state job. AI tidak mengubah rating. `ai_jobs` mengisi tepat satu FK review_version_id/reply_version_id. Hasil moderasi berada di output, keputusan/reviewer pada versi domain. Kolom moderation_reason sudah tersedia pada review_versions dan review_reply_versions; tidak perlu menambah kolom alasan baru.

### 6.7 Smart Reply

**Trigger:** Manager daycare meminta saran untuk review publik. Caregiver tidak boleh mengakses fitur.

**Input:** review_version_id/input_version, review_body/rating, fakta daycare terverifikasi, approved_reply_policies, language=id. Tanpa nama/data kesehatan anak.

**Output:** draft maks 1500 karakter, source_review_version_id, policy_refs, questions_for_manager, requires_manager_review=true. Dilarang menambah janji refund, hasil investigasi, atau SLA yang tidak didukung.

**Manusia/DB:** Manager menyunting/mengirim; versi final tetap melalui review_moderation. Simpan ai_jobs output dan draft_ai_job_id pada review_reply_versions. Untuk job, buat draft versi terlebih dahulu, sehingga reply_version_id sudah tersedia. Mengubah draft saat AI berjalan membuat hasil lama stale. Input_version draft dapat memakai hash body + source_review_version_id karena nomor version domain adalah versi balasan, bukan counter ketikan.

### 6.8 Review Summary

**Trigger:** sumber review publik berubah; debounce 60 detik; minimal lima review publik. Di bawah itu tampilkan ulasan individual tanpa ringkasan.

**Input:** daycare_id, source_set_hash, language=id, versi review yang sedang dipublikasikan (ID/rating/body). Batas satu batch 500 review; jika lebih, worker membagi batch dan tetap mempertahankan sumber. Rating/count seluruh dataset dihitung kode, bukan dari subset model.

**Output:** claims dengan text/kind/source_version_ids, limitations, source_set_hash. Setiap klaim harus didukung sumber valid. Server memastikan jumlah/proporsi disebut benar; AI tidak mengubah minoritas menjadi “semua orang tua”.

**Manusia/DB:** auto tampil setelah validasi sumber/fakta, tanpa approval rutin; jika validasi gagal, tidak tampil dan masuk review Admin. Cache tersimpan pada ai_jobs.output. Penarikan review segera menginvalidasi cache lama. Rating bintang dihitung dari satu published_version approved per review kanonis yang tidak withdrawn. Tidak ada review berarti “Belum ada ulasan”, bukan 0/5.

## 7. Retensi yang dipakai sebagai default MVP

Durasi berikut adalah **default konfigurasi produk untuk pengembangan**, bukan klaim batas hukum. Sebelum data nyata: validasi tujuan/dasar pemrosesan, perjanjian provider, dan kebutuhan bukti. Permintaan hak yang sah dapat mempersingkat; kebutuhan bukti yang sah dapat menahan penghapusan melalui hold yang beralasan. Jangan menunda desain retensi sampai semua data menumpuk.

| Data | Default dan awal hitung |
| --- | --- |
| File upload draft yatim | 24 jam sejak upload jika tidak terikat submission/hold |
| Foto original aktivitas normal | 90 hari sejak aktivitas dikirim |
| Foto masked/thumbnail aktivitas | 365 hari sejak aktivitas dikirim |
| Teks aktivitas final/koreksi | 2 tahun sejak layanan selesai |
| Media insiden/pickup dan laporan insiden | 2 tahun sejak layanan selesai atau kasus terkait closed, pilih yang lebih akhir |
| Profil kesehatan dan riwayat perubahannya | Selama anak aktif; purge/redaksi 90 hari setelah anak dinonaktifkan dan semua enrollment berakhir, pilih peristiwa yang lebih akhir |
| Dokumen legal dan verifikasi final | Selama versi berlaku/digunakan + 2 tahun setelah superseded/expired, pilih yang lebih akhir |
| Riwayat Safety Score | 2 tahun sejak superseded; jangan mempertahankan salinan dokumen mentah di skor |
| Review/balasan publik | Selama dipublikasikan; versi tak publik/draft 90 hari sejak diganti/ditolak, kecuali sengketa |
| Prompt/input snapshot sensitif AI | 7 hari sejak attempt terminal; simpan referensi/hash/versi minimum lebih lama bila diperlukan |
| Output AI sementara | 30 hari sejak terminal; hasil yang dipakai disalin terkurasi ke tabel domain dan ikut retensi domain |
| Metadata job dan audit non-sensitif | 2 tahun sejak kejadian; tanpa payload kesehatan/media |
| Consent | Selama pemrosesan terkait berlangsung + 2 tahun sesudahnya untuk bukti; review kebutuhan hukum sebelum purge |
| Notifikasi body / delivery metadata | 90 hari / 180 hari sejak pengiriman |
| Transaksi, payout, refund, bukti finansial minimum | Default rencana 10 tahun sejak tutup tahun transaksi; perlu validasi kewajiban badan usaha sebelum produksi, bukan retensi foto/rekam anak 10 tahun |
| Backup | Jendela 30 hari sebagai target operasional; sesuaikan kemampuan paket backup yang dipilih |

Retensi AI tidak menghapus hasil legal/triage yang telah menjadi catatan domain; hasil itu mengikuti retensi domain. Ringkasan review dapat diregenerasi ketika cache berumur 30 hari, tanpa menyimpan salinan review sensitif tak terbatas.

Purge worker setiap hari. Soft delete berbeda dari penghapusan payload: hapus objek Storage/varian yang jatuh tempo, redaksi isi JSON sensitif dan data domain yang wajib dihapus, tetapi pertahankan ID/hash/status minimal untuk relasi/audit yang beralasan. FK RESTRICT berarti jangan menghapus row job yang masih dirujuk; `output` boleh null, `input_snapshot` tetap objek minimal dengan penanda redacted. Logbook/media final yang masih dalam periode retensi tidak boleh dihapus oleh pengguna.

Retensi hold bukan financial_holds. Hold bukti memerlukan alasan, aktor, scope, waktu dibuat, dan jadwal tinjau; review setiap 90 hari, bukan simpan tanpa batas tanpa alasan. Setelah restore backup, jalankan ulang daftar purge/revocation sebelum membuka akses. Signed URL 60 detik tidak menggantikan penghapusan objek. Retensi aplikasi tidak otomatis menghapus salinan provider; gunakan pengaturan/kontrak provider yang sesuai.

Gemini unpaid tidak digunakan untuk data pribadi/sensitif nyata. Kunci ada di environment server dan logging tidak mengirim data privat untuk pelatihan. Penggunaan API berbayar tetap memerlukan minimisasi dan review pemrosesan, bukan otomatis berarti zero retention. [Ketentuan Gemini](https://ai.google.dev/gemini-api/terms)

## 8. Pemetaan ringkas untuk database

| Feature | FK job | Hasil domain | Keputusan manusia |
| --- | --- | --- | --- |
| legal_verification | document_id | daycare_verifications | decision/reviewed_by/reviewed_at/reason/verified_fields |
| safety_score | daycare_id | daycare_safety_scores hanya jika score non-null | status/reviewed_by/reviewed_at/published_at |
| incident_triage | incident_id | incident_ai_analyses hanya jika urgency non-null; urgency logs | incident_urgency_change_logs dan kebutuhan review |
| logbook_draft | activity_id | aktivitas setelah dipilih/disunting | actor + version + audit/koreksi |
| privacy_masking | attachment_id, activity_id | attachment_variants | reviewed_by/reviewed_at + ready |
| review_moderation | tepat satu review_version_id/reply_version_id | versi review/reply | status/moderated_by/moderated_at/reason |
| smart_reply | reply_version_id | review_reply_versions draft | Manager submit lalu moderasi |
| review_summary | daycare_id | ai_jobs.output terkurasi/cache | validasi otomatis; Admin bila gagal/ditarik |

`model_version` SQL NOT NULL: simpan versi aktual jika diberikan; gunakan literal `not_reported` bila tidak diberikan, dengan requested model terpisah di model. Jangan mengarang nomor versi. Privacy worker memakai provider/model/version detektor/pemroses sebenarnya. `prompt_version` untuk CV diisi versi pipeline; bukan pura-pura memanggil LLM.

Execution metadata (token/latensi/kontrak/error yang disanitasi), review/application metadata, dan hasil feature berada dalam envelope JSONB output. Final domain fields jangan hanya disembunyikan dalam JSON bila diperlukan untuk RLS/status/constraint. Schema JSON worker tidak berarti client mendapat SELECT seluruh ai_jobs.

## 9. Perubahan minimum atas SQL 60 tabel

Jangan menjalankan ulang CREATE TABLE, foundation, atau verify lama. Buat **migrasi ALTER terpisah setelah review Annisa**. Daftar berikut adalah pekerjaan implementasi, belum diterapkan oleh dokumen ini:

1. **Job:** tambahkan `available_at timestamptz NOT NULL DEFAULT now()`, `lease_expires_at timestamptz NULL`, `lease_token uuid NULL`, dan `applied_at timestamptz NULL`. Index antrean status/available_at; unique retry root+attempt; trigger/server memeriksa root attempt 1 dan batas 3. Application/review state diproyeksikan dari domain/envelope, tidak mengganti lima status job.
2. **Retensi media:** tambah `retention_until timestamptz`, `purged_at timestamptz`, `retention_hold_reason text NULL` pada attachments dan attachment_variants. Hold aktor/waktu/review dicatat audit. Variant mengikuti hold sumber. Storage policy memeriksa purged_at; tidak menganggap object path berarti objek masih ada.
3. **Snapshot jadwal:** tambah `service_starts_at`, `service_ends_at`, `service_timezone` nullable pada enrollments, wajib terisi saat pending_payment melalui transisi. Simpan kebijakan harga/refund/grace/fee di charges.policy_snapshot yang sudah ada.
4. **Kesehatan/kontak:** tambah `emergency_contacts jsonb NOT NULL DEFAULT '[]'` pada children, validasi minimal satu sebelum enrollment. Field kesehatan text tetap digunakan, dengan “tidak ada/belum diketahui” eksplisit; form membedakannya.
5. **Uniqueness anak:** index saat ini hanya approved. Ubah agar mencakup pending_payment dan approved setelah audit data; jangan memakai now() pada predicate unique index. Expiry harus mengubah state sebelum anak membuka checkout lain.
6. **Snapshot/purge health:** tambah penanda redaksi/purge yang sesuai pada profil/history kesehatan; jangan meninggalkan salinan kesehatan di child_snapshot/audit/input_snapshot. Histori operasional yang diperlukan menyimpan hanya fakta minimum per kejadian.
7. **Moderasi review/reply:** gunakan kolom status, moderated_by, moderated_at, dan moderation_reason yang sudah ada; tidak memerlukan penambahan kolom. Tambahkan validasi agar keputusan manusia dan otomatis dapat dibedakan melalui audit/job serta versi kebijakan.
8. **Konfigurasi:** system_settings menyimpan versi approved untuk payment window, service cutoff, no-show, refund, late pickup, retensi, moderation policy, rubric, dan consent wording. Tidak membuat tabel baru hanya untuk setiap parameter.
9. **Integritas:** tambahkan RPC/trigger/RLS untuk claim/apply job, reservasi kapasitas, batas satu checkout, review/consent, immutability, dan cakupan FK lintas daycare. PK/FK dan RLS enabled pada CREATE TABLE belum menjalankan aturan-aturan tersebut.

Jumlah tabel aplikasi dapat tetap 60 dengan penambahan kolom/indeks di atas. Jika tim memilih audit checklist fasilitas/staf yang kompleks atau kalender kuota per tanggal, itu perlu desain tambahan; tidak disamarkan sebagai sudah tersedia pada SQL.

## 10. Pembagian kerja paralel dan kriteria selesai

| Penanggung jawab | Dapat dikerjakan sekarang | Bukti selesai |
| --- | --- | --- |
| Annisa / database | Review migrasi minimum, RLS, transaksi, retention fields, constraints | Tes isolasi dua Parent/dua daycare; race kapasitas; tidak ada privilege escalation |
| Backend | Endpoint submit/status terotorisasi, job worker, webhook sandbox, version check | Duplicate request tidak membuat efek ganda; expired/late payment benar |
| AI | Implementasi adapter delapan feature terhadap schema/fixtures, dataset evaluasi | Validasi schema + bukti; fail/abstain; regression model sebelum integrasi |
| Sustri / frontend | Mock JSON dari kontrak; loading/error/held/insufficient evidence; UI review | Tidak menyamakan succeeded dengan approved; tidak membuka raw output privat |

**Kamis 5 November — setup yang dikerjakan tim:** buat API key pada akun Google AI Studio milik project, simpan GEMINI_API_KEY dan model ID di environment server; jangan dikirim ke chat/commit atau NEXT_PUBLIC. Tes satu request sintetis; catat model/status/latensi, bukan key. Untuk masking, tes worker lokal dengan foto sintetis/berizin. Akun Google/key tidak dibuat dan panggilan provider tidak dijalankan dalam penyusunan dokumen ini karena tidak ada akses akun/key yang disediakan.

Urutan integrasi: fixtures tervalidasi → satu request sintetis → adapter + worker → storage/domain → UI review → RLS/tes failure → uji terbatas. Notebook tidak dijalankan dari request web. Next.js memanggil adapter Gemini atau worker; Python service hanya ditambahkan jika diperlukan oleh runtime model/CV.

Kriteria kontrak selesai: delapan pasangan input/output lolos schema; contoh null/abstain ditangani; state job/review/application dipisahkan; retry maksimal tiga; stale result tidak diterapkan; original foto tidak bocor; notifikasi insiden tetap berjalan tanpa AI; bukti consent dan purge bisa ditelusuri. JSON Schema tidak menggantikan pemeriksaan semantik/RLS.

Tidak perlu menunggu meeting untuk membangun mock, adapter, dan migrasi draft. Penanggung jawab tetap perlu mengesahkan empat kelompok sebelum produksi: tarif/refund/no-show dan pengelolaan dana, wording consent/retensi, rubrik bukti Safety Score, serta SOP prioritas insiden. Sampai disahkan, gunakan sandbox/data sintetis dan skor tidak dipublikasikan. Kontrak antarmodul tetap dapat dibekukan sekarang agar perubahan kebijakan cukup menjadi versi konfigurasi.
