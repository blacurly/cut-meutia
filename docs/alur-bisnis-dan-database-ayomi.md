# Ayomi — Alur Bisnis dan Spesifikasi Database v1

Pembaruan 5 November 2026: [keputusan kerja MVP dan kontrak AI](./keputusan-mvp-dan-kontrak-ai-v1.md) menetapkan default operasional serta kontrak integrasi terbaru. [SQL 60 tabel](../database/001_create_tables.sql) sudah tersedia; keterangan kondisi implementasi bertanggal 2 November di bawah merupakan catatan historis, bukan verifikasi kondisi Supabase saat ini.

**Project:** PEREMPUAN INOVASI · Kelompok Cut Meutia  
**Tanggal:** 2 November 2026  
**Cakupan:** MVP daycare harian, empat role, database PostgreSQL/Supabase.  
**Status dokumen:** baseline struktur untuk implementasi; belum menjadi migration SQL dan belum diterapkan ke database.

Dokumen tunggal ini menyatukan aturan bisnis terbaru dengan kondisi aplikasi yang ada. Kata **target** berarti perilaku yang harus dibangun, bukan fitur yang sudah berfungsi di production. Struktur tabel, relasi, tipe data, dan batas keamanan ditetapkan di sini sebagai rancangan v1. Keputusan operasional yang belum diberikan pemilik produk tetap ditandai **belum final**; nilainya tidak boleh ditebak saat migration atau integrasi dibuat.

Urutan acuan: keputusan bisnis terbaru dari pemilik produk → dokumen ini → [Hallmark](./brief/hallmark.md) dan [PRD awal](./brief/prd-ayomi.md). Jika berbeda, aturan terbaru yang berlaku. Asumsi teknis yang ditambahkan dokumen ini disebutkan secara eksplisit.

## 1. Kondisi sistem yang benar-benar tersedia

Pemeriksaan sumber dilakukan terhadap [autentikasi](../lib/auth.js), [domain Parent](../lib/parent.js), [domain Pengelola](../lib/caregiver.js), [domain Admin](../lib/admin.js), [provider demo](../components/features/ParentDemoProvider.js), [dependensi aplikasi](../package.json), serta [folder database](../database/). Penjelasan halaman sebelumnya tersedia di [frontend Parent](./frontend-parent.md) dan [frontend portal](./frontend-portals.md).

| Area | Implementasi saat ini | Target berdasarkan keputusan terbaru |
| --- | --- | --- |
| Akun | Role frontend `parent`, `caregiver`, `admin`; aktivasi demo lokal | Supabase Auth; role `parent`, `manager`, `caregiver`, `admin`; izin diverifikasi server/database |
| Penyimpanan | State demo di browser; belum menjadi database bersama | PostgreSQL dengan foreign key, transaksi, RLS, Storage privat, audit |
| Katalog | Landing, pencarian, detail, komparasi tersedia dengan data contoh | Katalog publik hanya menampilkan profil, harga, ulasan, dan hasil verifikasi yang boleh dipublikasikan |
| Enrollment | Pengajuan dan simulasi persetujuan; ada status `active` | Tujuh status resmi; pembayaran, masa berlaku, check-in, dan pickup menjadi alur terpisah yang saling terkait |
| Pengelola | Satu portal mencampur tugas Manager dan Caregiver | Manager mengelola bisnis; Caregiver menjalankan pengasuhan sesuai penugasan |
| Layanan/harga | Contoh paket dan label harga belum seluruhnya mengikuti MVP harian | Hanya layanan harian; harga berversi dan disetujui Admin |
| Logbook | Draf dan publikasi narasi lokal; belum menjamin 1–3 foto per aktivitas | Aktivitas per anak, foto, pembatasan perubahan, urgent acknowledgement, dan pipeline masking |
| Insiden | Parent dapat mengirim laporan demo; status lokal berbeda | Insiden operasional dibuat Caregiver; Parent membuat komplain/keluhan terkait, dengan status tersendiri |
| Review | Review dan balasan demo | Kelayakan setelah pickup, moderasi versi, balasan Manager, izin revisi setelah penyelesaian masalah |
| Admin | Dashboard, simulasi verifikasi legal, insiden, status daycare | Pengawasan lintas daycare, komplain, transaksi, refund, payout, sanksi, dan audit permanen |
| AI | Contoh skor/narasi dan simulasi pemeriksaan | Pemrosesan server; input, output, model, versi, status gagal, dan keputusan manusia tercatat |
| Keuangan/pickup | Belum merupakan alur gateway atau bukti penyerahan nyata | Webhook terverifikasi, pencatatan pembayaran, verifikasi penjemput, refund, dan payout |

**Kesimpulan implementasi:** halaman demo dapat digunakan untuk presentasi UI. Keberadaan halaman tidak membuktikan autentikasi, AI, keamanan akses, pembayaran, atau penyimpanan permanen sudah diimplementasikan. Folder database saat diperiksa belum berisi migration SQL.

## 2. Batas MVP dan keputusan dasar

1. Empat role aplikasi: Parent, Manager, Caregiver, Admin. Front office/staf senior bukan role kelima; untuk MVP menggunakan akun Caregiver dengan delegasi yang sesuai.
2. Parent mendaftar sendiri. Admin mengundang Manager. Manager mengundang Caregiver. Akun Admin disediakan tim Ayomi melalui proses server yang terbatas.
3. Satu akun Parent digunakan bersama oleh orang tua/wali pada MVP dan dapat memiliki banyak anak. Identitas wali/penjemput bukan akun Parent tambahan.
4. Satu Manager utama per daycare. Setiap akun staf tetap individual agar tindakan dapat ditelusuri.
5. Layanan hanya harian. Layanan mingguan/bulanan, Caregiver mandiri, dan pembagian payout ke Caregiver tidak masuk MVP.
6. Parent membayar melalui gateway Ayomi. Istilah yang digunakan adalah **dana tertahan sebelum payout**; dokumen ini tidak menetapkan status hukum escrow.
7. Data contoh dan localStorage bukan sumber data production. Jangan memindahkan akun, status verifikasi, skor, pembayaran, atau insiden demo menjadi data operasional nyata.
8. Pilihan teknis v1: satu `users.role` per akun; dukungan satu akun dengan beberapa role ditunda. Keanggotaan daycare dibuat eksplisit agar data tidak bergantung pada ID daycare yang ditulis tetap di frontend.

## 3. Hak akses dan navigasi

### 3.1 Akses sebelum login

Pengunjung boleh membuka splash, katalog, pencarian wilayah, detail daycare, hasil verifikasi publik, ulasan yang disetujui, dan komparasi. Login dibutuhkan saat mengajukan enrollment, menyimpan data anak, membayar, atau membuka data pribadi. Daftar akun tidak otomatis memberikan hak Manager, Caregiver, atau Admin.

Pintu masuk Daycare tetap satu. Parameter seperti `?role=caregiver` hanya menentukan tampilan formulir; setelah autentikasi, server membaca role dan keanggotaan yang sah untuk menentukan dashboard. Mengubah URL, localStorage, atau metadata yang dikirim pengguna tidak boleh menaikkan hak akses.

| Aktor | Boleh | Tidak boleh |
| --- | --- | --- |
| Parent | Anak sendiri; enrollment; pembayaran sendiri; logbook dan insiden anak sendiri lintas daycare; izin pickup; komplain; review yang memenuhi syarat | Data anak Parent lain; menyetujui enrollment; menerbitkan logbook Caregiver; mengubah keputusan Admin |
| Manager | Daycare sendiri; keputusan enrollment; staf dan penugasan; data operasional yang diizinkan; koreksi teks laporan; pickup; balasan review; pengajuan perubahan legal/harga/rekening | Daycare lain; menimpa foto laporan terkirim; menyetujui dokumen/harga/rekening sendiri; mengubah role menjadi Admin |
| Caregiver | Anak yang ditugaskan; kesehatan selama penugasan berlaku; draf/pengiriman aktivitas; laporan lama buatan sendiri; membuat insiden; usulan koreksi kesehatan | Riwayat/lampiran insiden; riwayat pickup; rekening; dokumen legal; balasan review; data kesehatan setelah penugasan berakhir |
| Admin | Pengawasan lintas daycare; keputusan legal/harga/rekening; komplain; sanksi; refund/payout; audit | Menghapus jejak historis; memalsukan hasil AI/gateway; mengganti bukti yang telah final |

Status akun dan keanggotaan diperiksa pada setiap permintaan. Caregiver yang dinonaktifkan tidak dapat masuk untuk melihat laporan lama; hak membaca laporan sendiri setelah penugasan berakhir hanya berlaku selama akunnya masih aktif.

### 3.2 Delegasi sementara

Izin yang boleh diberikan: `manage_caregivers`, `manage_assignments`, `manage_daily_reports`, `confirm_pickup`. Manager memberikan periode mulai/akhir dan dapat mencabut lebih awal; pencabutan dini adalah pilihan teknis v1 yang dicatat di audit.

Izin tidak berlaku sebelum waktu mulai, setelah waktu akhir, setelah dicabut, atau ketika pemberi/penerima bukan anggota aktif daycare. Penerima tidak boleh menerbitkan delegasi baru. Rekening payout, legal, harga/pengaturan utama, dan delegasi tetap milik Manager.

**Batas penting:** `confirm_pickup` memberi akses pada data minimum untuk penyerahan yang sedang diproses, bukan daftar riwayat pickup. `manage_daily_reports` tidak memberi akses riwayat insiden atau seluruh profil kesehatan. Hak Caregiver tidak boleh berubah menjadi hak Manager secara menyeluruh karena satu delegasi.

### 3.3 Hubungan dengan halaman yang tersedia

| Halaman/route saat ini | Peran dalam alur target |
| --- | --- |
| `/welcome`, `/`, `/pencarian`, `/detail/[id]`, `/bandingkan`, `/bandingkan/hasil` | Akses publik; data publik terkurasi |
| `/masuk`, `/daftar` | Auth nyata; pendaftaran mandiri hanya Parent; penerimaan undangan staf melalui alur terpisah |
| `/pendaftaran-anak`, `/status-pendaftaran` | Pengajuan, keputusan, instruksi pembayaran, expired, dan penyelesaian |
| `/beranda`, `/profil`, `/catatan-harian`, `/notifikasi` | Area Parent setelah login; anak dan data dipilih berdasarkan kepemilikan |
| `/laporan` | Daftar insiden anak dan acknowledgement; form keluhan Parent masuk modul komplain |
| `/ulasan` | Review setelah layanan selesai dan pickup terkonfirmasi |
| `/pengelola` beserta pendaftaran/profil/dokumen/ulasan | Mayoritas merupakan area Manager; akses perlu dipisahkan dari Caregiver |
| `/pengelola/laporan-harian` dan `/pengelola/laporan-harian/tambah` | Dapat dipakai Manager/Caregiver dengan data dan aksi sesuai izin |
| `/admin`, `/admin/verifikasi-legal`, `/admin/insiden`, `/admin/daycare` | Dasar portal Admin; perlu ditambah komplain, keuangan, moderasi, dan undangan |

Halaman pembayaran, pickup, penugasan, delegasi, komplain lengkap, dan keuangan belum dinyatakan selesai. Pemilihan URL tambahan mengikuti struktur route yang tersedia saat implementasi; dokumen ini tidak membuat folder aplikasi baru.

## 4. Alur bisnis operasional

### 4.1 Onboarding daycare dan akun staf

1. Admin membuat daycare berstatus belum aktif dan mengundang calon Manager. Undangan menyimpan hash token, role yang ditetapkan server, daycare tujuan, masa berlaku, dan pengundang.
2. Penerima menerima undangan melalui Supabase Auth. Server memverifikasi token, identitas penerima, status undangan, dan role sebelum membuat keanggotaan.
3. Manager melengkapi profil umum, mengirim dokumen legal, harga layanan harian, dan rekening payout.
4. Legal, harga, dan rekening memiliki keputusan terpisah. Dokumen atau harga yang masih ditinjau tidak menggantikan versi yang sudah disetujui.
5. Admin mengaktifkan daycare yang memenuhi persyaratan. Syarat aktivasi lengkap masih memerlukan persetujuan pemilik produk; UI tidak boleh menyebut terverifikasi hanya karena Manager mengunggah berkas.
6. Manager mengundang Caregiver, memverifikasi, lalu mengaktifkan keanggotaannya. Undangan tidak memberikan akses ke data anak sebelum aktivasi dan penugasan.

### 4.2 Parent menemukan daycare dan mengajukan enrollment

Alur: **katalog → pencarian/filter → detail dan skor → komparasi opsional → login/daftar → pilih/tambah anak → pilih layanan harian dan tanggal → persetujuan akses → kirim pengajuan → status pendaftaran**.

Parent melihat rincian harga layanan, biaya administrasi Ayomi, dan total. Data yang ditampilkan saat checkout berasal dari versi harga yang disetujui, bukan angka yang dikirim browser. Ketentuan persetujuan dicatat beserta versi teks dan waktu pengajuan.

Antrean pengajuan untuk Manager hanya menampilkan kode pengajuan, tanggal layanan, pilihan layanan, dan status. **Sebelum disetujui, nama, tanggal lahir, foto, kesehatan, dan identitas anak tidak boleh dikembalikan API kepada daycare.** Pemeriksaan kelayakan usia dan kapasitas dilakukan server tanpa mengungkap detail anak.

### 4.3 Definisi status enrollment dan keputusan v1

Nilai database: `pending`, `pending_payment`, `approved`, `rejected`, `completed`, `cancelled`, `expired`.

Untuk menghilangkan ambiguitas antara “diterima Manager” dan “sudah aktif”, rancangan teknis v1 membedakannya:

- `manager_decision` adalah `undecided`, `accepted`, atau `rejected`.
- `approved` berarti enrollment telah memenuhi persetujuan, pembayaran, dan syarat aktivasi. Ini adalah **enrollment aktif** untuk constraint satu anak satu enrollment.
- Anak benar-benar berada di daycare ditandai `checked_in_at`; tidak dibuat status enrollment tambahan bernama `active`.
- `completed` hanya setelah penyerahan anak berhasil diverifikasi dan dikonfirmasi.
- Penerimaan administratif Manager dapat dicatat saat enrollment masih `pending`, tanpa membuka data anak.

**Pilihan operasional v1 yang perlu disahkan sebelum migration dikunci:** pembayaran baru dibuka setelah anak tidak memiliki enrollment `approved` atau checkout `pending_payment` lain. Pengajuan lain boleh tetap `pending` dengan keputusan `accepted` dan alasan tertahan. Dengan pendekatan ini, pembayaran tidak dipungut untuk enrollment yang belum bisa diaktifkan. Konsekuensinya, MVP tidak mendukung beberapa reservasi masa depan berstatus `approved` untuk satu anak sekaligus. Jika produk menghendaki itu, definisi aktif dan constraint harus diganti dengan aturan periode/kehadiran sebelum implementasi.

| Dari → ke | Pelaku/pemicu | Syarat dan perubahan atomik |
| --- | --- | --- |
| Baru → `pending` | Parent | Anak milik Parent aktif; tanggal/layanan valid; consent tersimpan |
| `pending` → `pending_payment` | Manager menerima, atau sistem melanjutkan penerimaan yang tertahan | `manager_decision=accepted`; kapasitas tersedia; tidak ada enrollment aktif/checkout lain; simpan harga dan batas pembayaran |
| `pending` → `rejected` | Manager | Alasan wajib; tidak memberi akses data anak; notifikasi Parent |
| `pending` → `cancelled` | Parent | Masih pending saat row dikunci; simpan alasan/waktu |
| `pending_payment` → `approved` | Webhook pembayaran yang valid | Pembayaran cocok, tepat waktu, jumlah benar, belum pernah diterapkan; syarat aktivasi diperiksa ulang |
| `pending_payment` → `expired` | Job server | Batas pembayaran lewat; lepas reservasi kapasitas; pertahankan status expired |
| `approved` → `completed` | Manager atau penerima delegasi pickup | Sudah check-in; pickup terverifikasi; bukti lengkap; simpan pickup dan penyelesaian bersama |
| `approved` → `cancelled` | Admin | Layanan belum dimulai; keputusan pembatalan dan keputusan refund dicatat terpisah |

Status terminal tidak dibuka kembali. Pembayaran yang datang setelah expired, jumlah tidak sesuai, pembayaran ganda, atau konflik status masuk peninjauan Admin; tidak mengaktifkan enrollment secara otomatis. Tidak ada tombol Parent untuk membatalkan langsung pada `pending_payment` atau `approved` karena aturan yang sudah diputuskan hanya mengizinkan pembatalan mandiri saat pending.

Pengajuan untuk tanggal yang sudah lewat dan anak tidak hadir memerlukan kebijakan no-show. Jangan otomatis menyelesaikan enrollment, memotong dana, atau membuat pickup fiktif. Tahan untuk penanganan Manager/Admin sampai kebijakannya ditetapkan.

### 4.4 Pembayaran, refund, dan payout

1. Saat checkout dibuka, server membuat tagihan (`charges`) berisi snapshot harga layanan, biaya Admin Parent, komisi daycare, serta total. Versi aturan dan angka yang digunakan disimpan.
2. Setiap percobaan gateway menjadi satu `transactions`. Beberapa percobaan boleh mengarah ke tagihan yang sama; kegagalan tidak menimpa percobaan sebelumnya.
3. Callback dari browser bukan bukti pembayaran. Server menerima webhook, memverifikasi asal/tanda tangan sesuai provider, mencatat event unik, lalu memprosesnya dalam transaksi database.
4. Pembayaran sah diterapkan sekali pada tagihan. Pembayaran sukses tambahan tetap dicatat tetapi ditandai untuk pemeriksaan pembayaran ganda.
5. Dana yang telah dibayar belum menjadi payout tersedia. Setelah pickup dan penyelesaian, server menghitung kewajiban daycare menggunakan snapshot, refund, serta penahanan yang masih aktif.
6. Admin dapat menahan payout karena sengketa. Payout hanya ke rekening daycare yang disetujui; penerima dan rekening disalin sebagai snapshot saat payout dibuat.
7. Refund hanya berdasarkan keputusan Admin; simpan nominal, alasan, sumber transaksi, dan status provider. Keputusan menolak refund juga disimpan, bukan dihilangkan karena tidak ada transfer dana.
8. Biaya terlambat dibuat sebagai tagihan tambahan yang terhubung ke enrollment. Tagihan awal yang sudah dibayar tidak diubah. Tarif dan persetujuan penagihannya perlu kebijakan final.

**Pemisahan wajib:** biaya administrasi yang dibayar Parent berbeda dari komisi yang dibebankan kepada daycare. Persentase, dasar perhitungan, pembulatan, biaya gateway, pajak, dan penanggung biayanya belum diputuskan. Semua harus diparameterkan dan di-snapshot; jangan menyimpulkan komisi sama dengan biaya Admin.

### 4.5 Penugasan dan perubahan kesehatan

Manager menugaskan satu atau beberapa Caregiver pada enrollment anak dengan periode/shift yang jelas. Akses kesehatan memerlukan akun aktif, keanggotaan aktif, enrollment `approved`, dan waktu penugasan yang sedang berlaku. Penugasan yang akan datang tidak langsung memberikan akses kesehatan.

Parent memperbarui kesehatan anak tanpa persetujuan Manager. Satu transaksi menyimpan nilai terbaru, riwayat perubahan, dan event notifikasi ke Manager serta Caregiver yang sedang berhak. Notifikasi cukup menyebut ada perubahan; rincian kesehatan dibuka melalui aplikasi dengan pemeriksaan izin kembali.

Caregiver membuat usulan koreksi. Parent menerima/menolak; penerimaan baru mengubah profil kesehatan melalui alur yang sama. Setelah penugasan/enrollment berakhir, daycare tidak memperoleh akses ke kesehatan terkini; daycare tetap memiliki riwayat operasionalnya sendiri sesuai aturan.

### 4.6 Aktivitas harian dan urgent logbook

1. Satu daily report mewakili satu enrollment pada satu tanggal lokal daycare. Satu report berisi banyak aktivitas; setiap aktivitas dikirim sendiri saat selesai.
2. Caregiver membuat draf untuk anak yang ditugaskan. Bantuan AI menghasilkan draf yang bisa ditinjau; AI tidak bertindak sebagai Caregiver.
3. Aktivitas normal wajib memiliki 1–3 foto yang telah melalui pemrosesan privasi dan pemeriksaan kelayakan publikasi. Tidak ada video untuk aktivitas normal.
4. Sebelum dikirim, pembuat boleh mengubah/menghapus draf dan foto. Setelah dikirim, Caregiver tidak dapat mengubah atau menghapusnya.
5. Manager boleh mengoreksi teks dengan alasan; teks sebelum/sesudah, aktor, dan waktu disimpan. Foto tidak boleh diganti atau dihapus.
6. Aktivitas urgent dapat dikirim tanpa foto. Parent dan Manager langsung diberi notifikasi tanpa menunggu AI atau unggahan. Foto dapat ditambahkan kemudian melalui aksi khusus; tidak boleh mengganti bukti yang sudah ada.
7. Parent melihat semua aktivitas. Aktivitas makan dan tidur selalu menghasilkan notifikasi khusus dengan detail terstruktur; aktivitas urgent selalu menghasilkan notifikasi urgent.

Untuk aktivitas kelompok, server membuat aktivitas per anak. File sumber boleh diproses bersama secara internal, tetapi keluaran yang dibagikan harus sesuai anak/audiens; akses Parent satu anak tidak boleh membuka wajah atau identitas anak lain. Status “masked” hanya diberikan setelah proses berhasil, bukan dari centang frontend.

**Waktu urgent:** Manager harus mengonfirmasi review dalam 3 menit. Setelah batas itu, kirim reminder dan eskalasi ke Admin. Parent menekan “Saya Sudah Membaca”; selama belum, reminder setiap 3 menit. Setelah 3 menit belum dibaca, kanal WhatsApp/SMS juga digunakan sesuai konfigurasi provider. Kegagalan pengiriman dicoba ulang maksimal 2 kali setelah percobaan pertama; kegagalan akhir memberi notifikasi Admin. Status terkirim, dibaca di aplikasi, dan konfirmasi review Manager adalah tiga fakta berbeda.

### 4.7 Insiden dan triage

1. Caregiver membuat satu laporan per kejadian untuk anak dalam tanggung jawabnya. Pertolongan pertama tidak menunggu formulir, media, atau AI.
2. Simpan penilaian urgensi Caregiver, kejadian, tindakan awal, waktu, dan enrollment. Parent dan Manager langsung diberi notifikasi untuk setiap insiden.
3. Laporan darurat boleh tanpa media. Setelah pembuatan, Caregiver hanya memperoleh tanda terima dan kemampuan unggah tambahan yang terbatas pada laporan tersebut; tidak memperoleh daftar/detail riwayat atau akses unduh lampiran.
4. AI menganalisis asinkron. Simpan hasil, alasan, rekomendasi, model, dan waktu terpisah dari penilaian Caregiver. Jika gagal, penanganan tetap berjalan menggunakan penilaian manusia.
5. Urgensi awal final adalah tingkat tertinggi dari Caregiver dan AI yang sudah tersedia. Manager dapat mengubah dengan alasan dan log; penilaian awal tidak ditimpa. Hasil AI yang datang belakangan tidak diam-diam menimpa override Manager; tandai kebutuhan review ulang.
6. Status hanya `new → in_progress → resolved`; Manager/Admin yang mengubah, bukan AI. Penanganan yang langsung selesai tetap mencatat perpindahan melalui `in_progress` dalam transaksi yang sama.
7. `resolved` tidak dibuka kembali. Kejadian baru menjadi laporan baru; `related_incident_id` dapat menghubungkan keduanya.
8. Parent menekan “Saya Sudah Menerima Informasi”. Ini tidak menyelesaikan insiden. Hanya satu reminder acknowledgement insiden; intervalnya belum ditentukan.
9. Parent dapat membuat komplain dari insiden. Komplain tidak mengganti status insiden. Caregiver pelapor tidak menerima notifikasi perubahan status.

Skala teknis yang dipilih untuk triage insiden v1: `low < medium < high < emergency`. Label demo `critical` dipetakan ke `emergency` hanya untuk penyesuaian kode, bukan migrasi otomatis data contoh. Definisi klinis/operasional tiap tingkat harus disahkan tim; AI bukan penentu pertolongan pertama.

### 4.8 Pickup dan penyelesaian layanan

Parent menentukan wali/penjemput: nama, nomor telepon, hubungan, atau izin sekali pakai untuk enrollment tertentu. Saat penjemput datang, Manager/front office memverifikasi orang dan izin yang berlaku.

Jika gagal, simpan percobaan gagal; anak tidak diserahkan. Jika berhasil, simpan identitas penjemput sebagai snapshot, foto, waktu, staf yang mengonfirmasi, serta izin yang dipakai. Dalam satu transaksi, konsumsi izin sekali pakai, catat handover berhasil, dan ubah enrollment menjadi completed. Parent diberi notifikasi. Payout menjadi layak diperiksa, tidak langsung dianggap sudah ditransfer.

Riwayat pickup tersedia untuk Parent dan Manager. Caregiver biasa tidak dapat membaca riwayat tersebut, termasuk setelah melakukan tugas lain pada anak yang sama. Petugas dengan delegasi pickup hanya menggunakan layar aksi penyerahan yang dibatasi server.

### 4.9 Review dan balasan

Parent boleh membuat review apabila memiliki enrollment completed dengan pickup terverifikasi di daycare tersebut. Satu Parent memiliki satu review aktif per daycare, meskipun beberapa anak pernah menggunakan layanan. Rating 1–5 dan teks; tanpa foto.

Setiap perubahan menjadi versi baru. Publik hanya membaca versi yang disetujui. Versi lama yang sudah disetujui tetap menjadi versi publik sampai pengganti disetujui, kecuali Admin menariknya dengan alasan. Konten bermasalah ditahan untuk Admin; kegagalan AI tidak dianggap lolos moderasi.

Revisi oleh Parent memerlukan izin Admin yang terkait penyelesaian masalah; izin berlaku untuk satu pengajuan revisi, dicatat pada review dan audit. Manager membuat/mengedit draf Smart Reply lalu mengirimnya untuk moderasi. Caregiver tidak membalas review. Ringkasan AI menggunakan hanya versi review publik dan menyimpan daftar sumber/versinya.

### 4.10 Komplain, investigasi, dan sanksi

Parent atau Manager mewakili daycare membuat komplain. Kategori: `payment`, `daycare_service`, `caregiver_conduct`, `child_safety`, `account_access`, `other`. Prioritas: `low`, `medium`, `high`, `emergency`; antrean diurutkan prioritas tertinggi, lalu waktu pengajuan paling lama.

| Status/transisi | Aturan |
| --- | --- |
| `new → in_progress` | Admin mengambil penanganan; assignment tercatat |
| `in_progress ↔ waiting_for_response` | Admin meminta informasi dan melanjutkan saat diterima |
| `in_progress → waiting_for_confirmation` | Admin mengajukan hasil penyelesaian; tenggat 72 jam dimulai |
| `waiting_for_confirmation → in_progress` | Pengaju menolak hasil dengan alasan |
| `waiting_for_confirmation → resolved` | Pengaju menyetujui hasil; simpan acknowledgement |
| `resolved → closed` | Admin menutup kasus |
| `waiting_for_confirmation → closed` | Job: tidak ada respons setelah 72 jam; alasan auto-close wajib |

Aturan konfirmasi yang sudah diputuskan menyebut Parent. Untuk komplain yang diajukan daycare, rancangan v1 menggunakan Manager pengaju sebagai pihak konfirmasi; keputusan ini perlu disahkan. Tenggat 72 jam tidak berlaku pada seluruh status, dan direset ketika proposal penyelesaian baru benar-benar diajukan.

Admin dapat mengambil alih/memindahkan kasus tanpa Admin Lead, dengan riwayat. Investigasi dapat merujuk komplain dan/atau insiden. Sanksi memiliki bukti, alasan, objek, pelaku, waktu, masa berlaku, dan pencabutan. Pembekuan akun/daycare dan penahanan refund/payout merupakan tindakan terpisah yang masing-masing tercatat. Jangan menganggap sanksi otomatis memindahkan atau menghapus dana.

### 4.11 Statistik Admin

Metrik utama hanya: jumlah insiden per urgensi final, jumlah komplain per daycare, serta jumlah daycare aktif/tidak aktif. Total Parent dan jumlah sanksi tidak menjadi kartu statistik utama. Statistik penyelesaian insiden dan rincian status komplain tidak menjadi metrik yang diminta.

Pilihan query v1: filter periode menggunakan waktu kejadian insiden dan waktu pengajuan komplain; daycare aktif/tidak aktif merupakan snapshot saat query. Daycare suspended dihitung sebagai tidak aktif dengan label yang dijelaskan. Rentang tanggal dan zona tampilan harus terlihat. Definisi periode laporan perlu disahkan sebelum dashboard production ditetapkan.

## 5. Konvensi database yang digunakan

- Semua tabel aplikasi menggunakan primary key `id uuid`, default `gen_random_uuid()`, kecuali `users.id` mengikuti `auth.users.id`. Penamaan `user_id`/`daycare_id` pada dokumen lama dinormalisasi sebagai foreign key ke `users.id`/`daycares.id`.
- Semua tabel mempunyai `created_at timestamptz NOT NULL DEFAULT now()`. Tabel yang dapat diperbarui juga mempunyai `updated_at timestamptz NOT NULL`; server/trigger yang mengisinya. Tabel peristiwa, versi final, dan log bersifat append-only, tanpa mengubah entri lama.
- Dalam kamus berikut, `?` berarti nullable; kolom tanpa `?` wajib saat baris dibuat. `FK` selalu menyebut tabel tujuan. Kolom yang baru terisi setelah transisi diberi `?` dan diwajibkan melalui pemeriksaan transisi.
- `text{a,b}` berarti `text` dengan `CHECK` daftar nilai, bukan teks bebas. UUID relasi adalah `uuid`; nilai waktu adalah `timestamptz`, tanggal layanan `date`.
- Uang menggunakan `bigint` satuan rupiah, `currency char(3)='IDR'`, nonnegatif. Persentase menggunakan `numeric(7,4)` dengan rentang 0–100; tidak memakai float. Formula pembulatan belum diputuskan dan harus berversi.
- Waktu disimpan sebagai timestamp bertimezone. Daycare menyimpan zona IANA seperti `Asia/Jakarta`, `Asia/Makassar`, atau `Asia/Jayapura`; tanggal layanan dihitung dari zona daycare, bukan offset tetap frontend.
- `jsonb` hanya untuk snapshot, hasil AI/provider yang sudah disaring, atau rincian terstruktur yang bervariasi. Role, status, FK, nominal, dan waktu yang dipakai untuk keputusan harus berupa kolom terketik.
- FK riwayat menggunakan `ON DELETE RESTRICT/NO ACTION`. Tidak ada cascade dari pengguna/anak/daycare ke enrollment, bukti, laporan, atau transaksi. Akun dinonaktifkan/soft-delete; penghapusan Auth secara fisik memerlukan prosedur retensi terpisah.
- `users.id → auth.users.id` memakai `ON DELETE RESTRICT` pada rancangan ini agar penghapusan akun tidak menghapus identitas pelaku historis. Ini pilihan aplikasi, berbeda dari contoh profile sederhana yang dapat menggunakan cascade. Referensi integrasi identitas: [Supabase User Management](https://supabase.com/docs/guides/auth/managing-user-data).
- Snapshot identitas anak, kesehatan, bukti, dan data rekening bukan data publik. Snapshot tidak boleh menjadi jalan untuk melewati pencabutan akses.

## 6. Kamus tabel fisik v1

Rancangan ini terdiri atas **60 tabel aplikasi**. Tabel bawaan `auth.users` dan `storage.objects` tidak dihitung. Tabel dengan isi historis dipisahkan bila mempunyai aturan akses atau integritas berbeda; beberapa tabel konseptual digabung secara eksplisit pada bagian 7.

### A. Identitas, daycare, delegasi, dan layanan — 9 tabel

| No. / tabel | Kolom bisnis selain kolom umum | Constraint/aturan utama |
| --- | --- | --- |
| 01 `users` | `id FK auth.users`; `role text{parent,manager,caregiver,admin}`; `full_name text`; `phone text?`; `status text{active,inactive,suspended}`; `deleted_at timestamptz?` | Role/status hanya server berwenang; tidak menyimpan password atau JWT. Email login dikelola Auth. Identitas pembuat tidak dihapus fisik pada MVP. |
| 02 `daycares` | `slug text`; `name text`; `description text`; `address text`; `province_code text`; `city_code text`; `district_code text`; `postal_code text?`; `timezone text`; `contact_phone text`; `latitude numeric(9,6)?`; `longitude numeric(9,6)?`; `facilities jsonb`; `opening_hours jsonb`; `public_gallery jsonb`; `commission_category_code text?`; `daily_capacity integer`; `status text{inactive,active,suspended}`; `main_manager_id FK users?`; `deleted_at timestamptz?` | Slug unik; kapasitas >0; koordinat valid; daycare aktif wajib memiliki Manager utama aktif. Galeri hanya path foto fasilitas publik yang disetujui; kategori komisi harus berasal dari konfigurasi approved. Data kontak publik dipisahkan dari kontak akun pribadi. |
| 03 `daycare_members` | `daycare_id FK daycares`; `user_id FK users`; `member_role text{manager,caregiver}`; `status text{invited,pending_verification,active,inactive}`; `verified_by FK users?`; `verified_at timestamptz?`; `joined_at timestamptz?`; `ended_at timestamptz?` | Unik `(daycare_id,user_id)`; role cocok dengan users; maksimal satu Manager aktif per daycare. Keanggotaan yang dinonaktifkan dipertahankan. |
| 04 `staff_invitations` | `daycare_id FK daycares`; `email text`; `invited_role text{manager,caregiver}`; `token_hash text`; `invited_by FK users`; `expires_at timestamptz`; `accepted_by FK users?`; `accepted_at timestamptz?`; `revoked_at timestamptz?` | Hash unik, token mentah tidak disimpan; penerimaan sekali; role dan daycare tidak diambil dari formulir penerima. Akun Admin tidak dibuat melalui undangan ini. |
| 05 `daycare_delegations` | `daycare_id FK daycares`; `grantor_id FK users`; `grantee_id FK users`; `starts_at timestamptz`; `ends_at timestamptz`; `reason text`; `revoked_at timestamptz?`; `revoked_by FK users?`; `revocation_reason text?` | Mulai < akhir; pemberi Manager utama; penerima anggota aktif daycare sama; tidak boleh memberi kepada diri sendiri atau mendelegasikan ulang. |
| 06 `delegation_permissions` | `delegation_id FK daycare_delegations`; `permission text{manage_caregivers,manage_assignments,manage_daily_reports,confirm_pickup}` | Unik `(delegation_id,permission)`; tidak ada wildcard `all`. |
| 07 `service_offerings` | `daycare_id FK daycares`; `name text`; `service_type text{daily}`; `description text`; `min_age_months integer`; `max_age_months integer`; `is_active boolean`; `published_price_id FK service_price_versions?` | Usia minimum ≥0 dan ≤ maksimum; satu harga publik harus milik layanan yang sama dan approved. |
| 08 `service_price_versions` | `offering_id FK service_offerings`; `version integer`; `service_amount bigint`; `currency char(3)`; `late_pickup_terms jsonb`; `status text{draft,pending,approved,rejected,superseded}`; `proposed_by FK users`; `decided_by FK users?`; `decided_at timestamptz?`; `decision_reason text?`; `effective_from timestamptz?` | Unik `(offering_id,version)`; nominal ≥0; Admin menyetujui. Versi yang pernah digunakan checkout tidak dapat diubah. Biaya keterlambatan tanpa kebijakan yang disetujui tidak ditagihkan. |
| 09 `system_settings` | `key text`; `version integer`; `value jsonb`; `status text{draft,approved,retired}`; `effective_from timestamptz?`; `approved_by FK users?`; `approved_at timestamptz?`; `reason text` | Unik `(key,version)`; hanya server membaca kebijakan sensitif. Konfigurasi belum disetujui tidak boleh menjadi default tersembunyi. Secrets provider tidak disimpan di tabel ini. |

`main_manager_id` dan keanggotaan Manager harus konsisten melalui constraint trigger yang dicek pada akhir transaksi; unique index saja hanya menjamin “maksimal satu”, bukan “daycare aktif wajib punya satu”. Perpindahan Manager dilakukan atomik.

### B. Anak, kesehatan, dan penugasan — 5 tabel

| No. / tabel | Kolom bisnis | Constraint/aturan utama |
| --- | --- | --- |
| 10 `children` | `parent_id FK users`; `full_name text`; `birth_date date`; `gender text?`; `general_notes text?`; `status text{active,inactive}`; `deleted_at timestamptz?` | Parent role parent; tanggal lahir divalidasi server; soft delete tidak menghapus riwayat. Tidak menyimpan kesehatan di `general_notes`. |
| 11 `child_health_profiles` | `child_id FK children`; `allergies text`; `medical_history text`; `special_needs text`; `medication_notes text`; `version integer`; `updated_by FK users` | Unik child_id; data sensitif dipisahkan dari children; versi naik pada setiap perubahan; hanya Parent pemilik mengubah melalui RPC. |
| 12 `child_health_change_logs` | `child_id FK children`; `from_version integer`; `to_version integer`; `before_data jsonb`; `after_data jsonb`; `changed_by FK users`; `reason text?` | Append-only; riwayat kesehatan tetap sensitif, bukan audit publik; akses historis daycare tidak otomatis mencakup tabel ini. |
| 13 `child_health_correction_requests` | `child_id FK children`; `enrollment_id FK enrollments`; `proposed_by FK users`; `proposed_changes jsonb`; `reason text`; `status text{pending,accepted,rejected}`; `decided_by FK users?`; `decided_at timestamptz?`; `decision_note text?`; `base_health_version integer` | Pengusul sedang ditugaskan; Parent pemilik memutuskan; konflik versi harus ditinjau, tidak menimpa perubahan Parent yang lebih baru. |
| 14 `caregiver_assignments` | `enrollment_id FK enrollments`; `caregiver_id FK users`; `assigned_by FK users`; `starts_at timestamptz`; `ends_at timestamptz`; `ended_early_at timestamptz?`; `end_reason text?` | Anak/daycare diturunkan dari enrollment; mulai < akhir; caregiver anggota aktif daycare yang sama. Banyak Caregiver/shift per enrollment diperbolehkan. |

### C. Enrollment, consent, dan pickup — 5 tabel

| No. / tabel | Kolom bisnis | Constraint/aturan utama |
| --- | --- | --- |
| 15 `enrollments` | `child_id FK children`; `parent_id FK users`; `daycare_id FK daycares`; `offering_id FK service_offerings`; `price_version_id FK service_price_versions?`; `service_date date`; `status text{pending,pending_payment,approved,rejected,completed,cancelled,expired}`; `manager_decision text{undecided,accepted,rejected}`; `decided_by FK users?`; `decided_at timestamptz?`; `decision_reason text?`; `activation_block_reason text?`; `payment_deadline timestamptz?`; `approved_at timestamptz?`; `checked_in_at timestamptz?`; `checked_in_by FK users?`; `completed_at timestamptz?`; `cancelled_at timestamptz?`; `child_snapshot jsonb?`; `version integer` | Parent cocok dengan anak; layanan milik daycare; snapshot anak nonkesehatan hanya dapat dibaca daycare setelah approved. Status/payment/check-in hanya RPC server. Unik satu pending_payment/approved per anak sesuai pilihan v1. |
| 16 `enrollment_status_logs` | `enrollment_id FK enrollments`; `from_status text?`; `to_status text`; `actor_id FK users?`; `actor_type text{user,system,gateway}`; `reason text`; `request_id text` | Append-only; setiap transisi tercatat; actor null hanya untuk sistem/gateway yang terautentikasi. |
| 17 `enrollment_consents` | `enrollment_id FK enrollments`; `parent_id FK users`; `policy_version text`; `scope jsonb`; `wording_snapshot text`; `accepted_at timestamptz`; `revoked_at timestamptz?` | Consent pengajuan tersimpan eksplisit sebagai bukti produk; tidak mengklaim telah memenuhi seluruh kewajiban hukum. Pencabutan akses operasional setelah enrollment berakhir. |
| 18 `authorized_pickups` | `child_id FK children`; `created_by FK users`; `enrollment_id FK enrollments?`; `name text`; `phone text`; `relationship text`; `permission_type text{standing,one_time}`; `valid_from timestamptz`; `valid_until timestamptz?`; `revoked_at timestamptz?`; `consumed_at timestamptz?` | Parent pemilik membuat; sekali pakai wajib terikat enrollment dan mempunyai batas waktu; konsumsi sekali dalam transaksi pickup. |
| 19 `pickup_records` | `enrollment_id FK enrollments`; `authorization_id FK authorized_pickups?`; `collector_snapshot jsonb`; `verification_status text{failed,verified}`; `verification_note text`; `confirmed_by FK users`; `verified_at timestamptz`; `handed_over_at timestamptz?`; `late_minutes integer`; `request_id text` | Hanya verified boleh handover; foto wajib sebelum berhasil; maksimal satu pickup berhasil per enrollment; percobaan gagal tetap tersimpan; request_id unik untuk idempotensi. |

Parent/wali terdaftar juga memiliki `authorized_pickups`, sehingga foto profil akun atau pengetahuan nama saja bukan bukti izin. Snapshot penjemput memuat data minimum yang diperlukan untuk bukti, bukan salinan dokumen identitas berlebihan.

### D. Logbook dan media — 6 tabel

| No. / tabel | Kolom bisnis | Constraint/aturan utama |
| --- | --- | --- |
| 20 `daily_reports` | `enrollment_id FK enrollments`; `report_date date`; `created_by FK users` | Unik `(enrollment_id,report_date)`; satu anak/daycare ditentukan enrollment; tanggal berada pada layanan yang relevan. |
| 21 `daily_report_activities` | `report_id FK daily_reports`; `caregiver_id FK users`; `activity_type text{play,learning,interaction,meal,sleep,other}`; `title text`; `body text`; `occurred_at timestamptz`; `details jsonb`; `status text{draft,sent}`; `is_urgent boolean`; `urgent_reason text?`; `sent_at timestamptz?`; `draft_ai_job_id FK ai_jobs?`; `version integer`; `deleted_at timestamptz?` | Urgent wajib alasan; meal details memuat makanan/kondisi/porsi habis; sleep memuat mulai/akhir/kondisi bangun; normal sent wajib 1–3 foto siap bagi. Hapus hanya draft. |
| 22 `attachments` | `activity_id FK daily_report_activities?`; `incident_id FK incident_reports?`; `pickup_id FK pickup_records?`; `document_id FK daycare_documents?`; `payout_change_id FK payout_account_change_requests?`; `complaint_id FK complaints?`; `investigation_id FK investigations?`; `sanction_id FK account_sanctions?`; `uploaded_by FK users`; `bucket text`; `object_path text`; `mime_type text`; `byte_size bigint`; `sha256 text`; `status text{uploading,quarantined,processing,ready,rejected}`; `uploaded_at timestamptz?` | CHECK tepat satu owner FK terisi; unik bucket/path; status ready bukan berarti otomatis publik. Foto/video hanya sesuai jenis owner; laporan normal hanya image. File asli selalu privat. |
| 23 `attachment_variants` | `attachment_id FK attachments`; `variant_type text{masked,thumbnail}`; `audience_child_id FK children?`; `bucket text`; `object_path text`; `sha256 text`; `status text{processing,ready,failed}`; `ai_job_id FK ai_jobs?`; `reviewed_by FK users?`; `reviewed_at timestamptz?` | Varian logbook untuk Parent wajib child_id yang cocok dengan aktivitas; tidak menggunakan satu varian terbuka untuk semua Parent. Path unik; varian final tidak ditimpa. |
| 24 `report_change_logs` | `activity_id FK daily_report_activities`; `changed_by FK users`; `before_title text`; `after_title text`; `before_body text`; `after_body text`; `reason text`; `from_version integer`; `to_version integer` | Append-only; koreksi teks oleh Manager atau delegasi daily report yang berlaku; tidak mengubah foto, waktu, urgensi, atau penulis. |
| 25 `activity_acknowledgements` | `activity_id FK daily_report_activities`; `user_id FK users`; `ack_type text{manager_review,parent_read}`; `acknowledged_at timestamptz` | Unik `(activity_id,ack_type)` karena satu akun Parent dan satu Manager utama; aktor harus berwenang pada jenis ack. Delegasi review boleh mewakili Manager dengan actor asli tetap tercatat. |

### E. Insiden — 5 tabel

| No. / tabel | Kolom bisnis | Constraint/aturan utama |
| --- | --- | --- |
| 26 `incident_reports` | `enrollment_id FK enrollments`; `reported_by FK users`; `occurred_at timestamptz`; `description text`; `first_aid text`; `caregiver_urgency text{low,medium,high,emergency}`; `caregiver_reason text`; `effective_urgency text{low,medium,high,emergency}`; `urgency_source text{caregiver,ai_max,manager_override}`; `needs_urgency_review boolean`; `status text{new,in_progress,resolved}`; `related_incident_id FK incident_reports?`; `resolved_at timestamptz?`; `version integer`; `submission_key text` | submission_key unik mencegah pengiriman ulang jaringan menjadi kejadian ganda; bukan unique berdasarkan waktu/deskripsi. Relasi insiden bukan diri sendiri dan harus dalam scope anak/daycare yang diizinkan. |
| 27 `incident_ai_analyses` | `incident_id FK incident_reports`; `ai_job_id FK ai_jobs`; `urgency text{low,medium,high,emergency}`; `reason text`; `recommendations text`; `analyzed_at timestamptz`; `input_version integer` | Append-only; hasil berbeda karena retry/reanalisis tidak menimpa sebelumnya. Unik ai_job_id; hasil gagal berada di ai_jobs tanpa hasil urgensi palsu. |
| 28 `incident_urgency_change_logs` | `incident_id FK incident_reports`; `old_urgency text`; `new_urgency text`; `source text{ai_max,manager_override}`; `actor_id FK users?`; `analysis_id FK incident_ai_analyses?`; `reason text` | Manager wajib actor/reason; perubahan otomatis wajib analysis_id; penilaian Caregiver awal immutable. |
| 29 `incident_status_logs` | `incident_id FK incident_reports`; `from_status text?`; `to_status text`; `actor_id FK users`; `reason text` | Hanya Manager/Admin; resolved terminal; setiap transisi tercatat. |
| 30 `incident_parent_acknowledgements` | `incident_id FK incident_reports`; `parent_id FK users`; `acknowledged_at timestamptz` | Unik incident_id untuk model satu Parent pemilik; tidak mengubah incident status. |

### F. Review dan balasan — 4 tabel

| No. / tabel | Kolom bisnis | Constraint/aturan utama |
| --- | --- | --- |
| 31 `reviews` | `parent_id FK users`; `daycare_id FK daycares`; `qualifying_enrollment_id FK enrollments`; `published_version_id FK review_versions?`; `revision_allowed_by FK users?`; `revision_complaint_id FK complaints?`; `revision_granted_at timestamptz?`; `revision_used_at timestamptz?`; `withdrawn_at timestamptz?` | Unik `(parent_id,daycare_id)` sebagai review kanonis; qualification completed + pickup. Revisi butuh grant Admin terkait masalah yang selesai. |
| 32 `review_versions` | `review_id FK reviews`; `version integer`; `rating smallint`; `body text`; `moderation_status text{pending,held,approved,rejected}`; `ai_job_id FK ai_jobs?`; `moderated_by FK users?`; `moderated_at timestamptz?`; `moderation_reason text?` | Unik `(review_id,version)`; rating 1–5; teks immutable setelah diajukan; perubahan keputusan moderasi diaudit. published_version wajib versi approved milik review ini. |
| 33 `review_replies` | `review_id FK reviews`; `manager_id FK users`; `published_version_id FK review_reply_versions?` | Unik review_id; author Manager daycare yang direview; mengganti Manager tidak mengubah identitas balasan historis. |
| 34 `review_reply_versions` | `reply_id FK review_replies`; `version integer`; `body text`; `status text{draft,pending,held,approved,rejected}`; `draft_ai_job_id FK ai_jobs?`; `moderation_ai_job_id FK ai_jobs?`; `submitted_by FK users`; `moderated_by FK users?`; `moderated_at timestamptz?`; `moderation_reason text?` | Unik `(reply_id,version)`; hanya draft boleh diedit; publik hanya approved; AI Smart Reply tidak otomatis dipublikasikan. |

### G. Legal dan Safety Score — 3 tabel

| No. / tabel | Kolom bisnis | Constraint/aturan utama |
| --- | --- | --- |
| 35 `daycare_documents` | `daycare_id FK daycares`; `document_type text`; `version integer`; `document_number text?`; `issuer text?`; `valid_from date?`; `expires_on date?`; `submitted_by FK users`; `status text{draft,pending,approved,rejected,superseded}`; `supersedes_id FK daycare_documents?`; `published_at timestamptz?` | Unik `(daycare_id,document_type,version)`; berkas di attachments; dokumen permanen boleh tanpa expires_on; keputusan/metadata verifikasi berversi. |
| 36 `daycare_verifications` | `document_id FK daycare_documents`; `ai_job_id FK ai_jobs?`; `ocr_result jsonb?`; `analysis_result jsonb?`; `decision text{pending,approved,revision_required,rejected}`; `reviewed_by FK users?`; `reviewed_at timestamptz?`; `reason text?`; `verified_fields jsonb?` | Setiap proses/keputusan final dipertahankan; Admin memutuskan; OCR tidak sama dengan verifikasi legal manusia. |
| 37 `daycare_safety_scores` | `daycare_id FK daycares`; `ai_job_id FK ai_jobs`; `score numeric(5,2)`; `formula_version text`; `input_snapshot jsonb`; `explanation jsonb`; `status text{pending_review,published,rejected,superseded}`; `reviewed_by FK users?`; `reviewed_at timestamptz?`; `published_at timestamptz?` | Skala tampilan v1 0–100; formula/bobot belum disetujui. Hanya satu skor published per daycare; histori tetap ada; publik mendapat ringkasan tanpa dokumen mentah. |

### H. Keuangan — 11 tabel

| No. / tabel | Kolom bisnis | Constraint/aturan utama |
| --- | --- | --- |
| 38 `charges` | `enrollment_id FK enrollments`; `charge_type text{service,late_pickup}`; `price_version_id FK service_price_versions?`; `commission_rule_id FK commission_rules?`; `policy_snapshot jsonb`; `service_amount bigint`; `parent_admin_fee bigint`; `total_amount bigint`; `daycare_commission_amount bigint`; `currency char(3)`; `status text{open,paid,expired,cancelled}`; `due_at timestamptz`; `paid_transaction_id FK transactions?` | total = service_amount + parent_admin_fee pada model v1; seluruh nilai nonnegatif, komisi ≤ service_amount. Satu tagihan service per enrollment; tagihan keterlambatan terpisah. Harga/aturan wajib terisi sebelum checkout. |
| 39 `transactions` | `charge_id FK charges`; `provider text`; `provider_transaction_id text?`; `idempotency_key text`; `method text{va,qris,ewallet}`; `amount bigint`; `currency char(3)`; `status text{created,pending,succeeded,failed,expired}`; `reconciliation_status text{normal,needs_review,reviewed}`; `reconciliation_reason text?`; `paid_at timestamptz?`; `expires_at timestamptz?` | Unik idempotency_key dan `(provider,provider_transaction_id)` bila ID ada; succeeded berarti provider sukses, belum tentu diterapkan ke enrollment. Status tidak boleh mundur akibat webhook terlambat. |
| 40 `payment_details` | `transaction_id FK transactions`; `method_details jsonb`; `provider_fee_amount bigint?`; `provider_receipt_reference text?` | Unik transaction_id; hanya metadata yang perlu ditampilkan, misalnya VA dan batas waktu. Tidak menyimpan credential, token pembayaran rahasia, atau data kartu. |
| 41 `payment_webhook_events` | `provider text`; `event_id text`; `resource_kind text{payment,refund,payout}`; `provider_resource_id text`; `transaction_id FK transactions?`; `refund_id FK refunds?`; `payout_id FK payouts?`; `payload_digest text`; `sanitized_payload jsonb`; `verified_at timestamptz`; `processing_status text{received,processed,failed,needs_review}`; `processed_at timestamptz?`; `error_code text?` | Unik `(provider,event_id)`; handler mencatat event terverifikasi sebelum penerapan; reference FK boleh belum diketahui ketika event datang lebih awal. |
| 42 `commission_rules` | `name text`; `version integer`; `daycare_id FK daycares?`; `offering_id FK service_offerings?`; `category_code text?`; `percentage numeric(7,4)`; `calculation_base text{service_amount}`; `rounding_policy text`; `effective_from timestamptz`; `effective_until timestamptz?`; `approved_by FK users`; `approved_at timestamptz` | Persentase 0–100; satu scope daycare/offering/category dipilih, atau semua null untuk default yang disetujui. Prioritas aturan eksplisit: offering → daycare → kategori → default. Tidak boleh ada periode tumpang tindih pada scope yang sama. |
| 43 `payouts` | `daycare_id FK daycares`; `payout_account_id FK daycare_payout_accounts`; `account_snapshot jsonb`; `amount bigint`; `currency char(3)`; `status text{draft,held,approved,processing,paid,failed,cancelled}`; `approved_by FK users?`; `approved_at timestamptz?`; `provider text?`; `provider_reference text?`; `idempotency_key text`; `paid_at timestamptz?` | Nominal >0 sebelum pengajuan; tujuan daycare saja; account_snapshot sensitif; nominal cocok jumlah payout_items; proses provider idempotent. |
| 44 `payout_items` | `payout_id FK payouts`; `charge_id FK charges`; `gross_amount bigint`; `commission_amount bigint`; `refund_deduction bigint`; `other_deduction bigint`; `net_amount bigint`; `calculation_snapshot jsonb`; `reservation_status text{reserved,released,paid}` | net = gross − komisi − refund − potongan lain, net ≥0; satu charge hanya boleh punya satu item reserved/paid; item payout gagal tetap reserved sampai dibatalkan eksplisit. |
| 45 `refunds` | `transaction_id FK transactions`; `complaint_id FK complaints?`; `requested_by FK users`; `decision text{pending,full,partial,none}`; `amount bigint`; `reason text`; `decided_by FK users?`; `decided_at timestamptz?`; `status text{requested,approved,rejected,processing,succeeded,failed}`; `provider_reference text?`; `idempotency_key text`; `completed_at timestamptz?` | none → amount 0/rejected; full/partial → amount >0; total refund disetujui/diproses/berhasil ≤ pembayaran; hanya Admin memutuskan. Refund setelah payout membutuhkan rekonsiliasi terpisah, tidak mengubah payout historis. |
| 46 `daycare_payout_accounts` | `daycare_id FK daycares`; `bank_code text`; `account_number_ciphertext text`; `account_last4 text`; `account_holder text`; `status text{active,inactive}`; `approved_by FK users`; `approved_at timestamptz`; `activated_at timestamptz`; `deactivated_at timestamptz?` | Maksimal satu active per daycare; rekening final immutable; enkripsi aplikasi dengan kunci server terkelola, bukan kunci dalam tabel/browser. |
| 47 `payout_account_change_requests` | `daycare_id FK daycares`; `requested_by FK users`; `current_account_id FK daycare_payout_accounts?`; `proposed_bank_code text`; `proposed_number_ciphertext text`; `proposed_last4 text`; `proposed_holder text`; `status text{pending,approved,rejected}`; `reviewed_by FK users?`; `reviewed_at timestamptz?`; `reason text?`; `result_account_id FK daycare_payout_accounts?` | Bukti kepemilikan di attachments; Admin approve atomik menonaktifkan rekening lama dan membuat rekening baru. Rejected tidak mengganti rekening aktif. |
| 48 `financial_holds` | `daycare_id FK daycares?`; `transaction_id FK transactions?`; `refund_id FK refunds?`; `payout_id FK payouts?`; `hold_type text{payout,refund,settlement}`; `complaint_id FK complaints?`; `imposed_by FK users`; `reason text`; `released_by FK users?`; `released_at timestamptz?`; `release_reason text?` | Tepat satu objek utama; hold aktif sampai dilepas; setiap proses pencairan memeriksa hold di tingkat daycare dan objek terkait. |

Kategori komisi menggunakan `daycares.commission_category_code`; kolom tetap null sampai daftar kategori disahkan. Sebelum itu aturan komisi berkategori tidak dapat dipilih. Tabel ini bukan general ledger akuntansi. Sebelum memproses uang sungguhan, integrasi provider dan rekonsiliasi saldo wajib dituntaskan; jangan menganggap penjumlahan tabel menggantikan pembukuan/provider settlement.

### I. Komplain dan investigasi — 4 tabel

| No. / tabel | Kolom bisnis | Constraint/aturan utama |
| --- | --- | --- |
| 49 `complaints` | `submitted_by FK users`; `daycare_id FK daycares?`; `enrollment_id FK enrollments?`; `incident_id FK incident_reports?`; `category text{payment,daycare_service,caregiver_conduct,child_safety,account_access,other}`; `priority text{low,medium,high,emergency}`; `subject text`; `description text`; `status text{new,in_progress,waiting_for_response,waiting_for_confirmation,resolved,closed}`; `assigned_admin_id FK users?`; `resolution_text text?`; `confirmation_requested_at timestamptz?`; `confirmation_due_at timestamptz?`; `confirmed_by FK users?`; `confirmed_at timestamptz?`; `closed_at timestamptz?`; `closure_reason text?`; `version integer` | Relasi opsional harus konsisten; akun/akses dapat tanpa daycare. Pengaju hanya mengaitkan enrollment/insiden yang boleh diakses. Membuat komplain tidak mengubah status insiden. |
| 50 `complaint_assignments` | `complaint_id FK complaints`; `from_admin_id FK users?`; `to_admin_id FK users`; `changed_by FK users`; `reason text` | Append-only; perubahan assignment dan assigned_admin_id dilakukan bersama; tidak memerlukan Admin Lead. |
| 51 `complaint_status_logs` | `complaint_id FK complaints`; `from_status text?`; `to_status text`; `actor_id FK users?`; `actor_type text{user,system}`; `reason text`; `response_text text?` | Append-only; penolakan/konfirmasi pengaju dicatat di sini; auto-close menyebut tenggat dan alasan. |
| 52 `investigations` | `complaint_id FK complaints?`; `incident_id FK incident_reports?`; `assigned_admin_id FK users`; `status text{open,in_progress,completed}`; `scope text`; `findings text?`; `recommendation text?`; `completed_at timestamptz?` | Minimal satu sumber; bukti di attachments; catatan internal hanya Admin, bukan otomatis dibagikan ke pengaju. |

### J. Notifikasi, audit, sanksi, dan AI — 8 tabel

| No. / tabel | Kolom bisnis | Constraint/aturan utama |
| --- | --- | --- |
| 53 `notifications` | `recipient_id FK users`; `event_type text`; `enrollment_id FK enrollments?`; `activity_id FK daily_report_activities?`; `incident_id FK incident_reports?`; `complaint_id FK complaints?`; `document_id FK daycare_documents?`; `health_change_id FK child_health_change_logs?`; `title text`; `body text`; `priority text{normal,urgent}`; `deduplication_key text`; `available_at timestamptz` | Per penerima; key unik; target divalidasi sesuai event. Isi tidak memuat kesehatan/foto/nomor rekening sensitif. Ini juga outbox yang dibuat dalam transaksi bisnis. |
| 54 `notification_receipts` | `notification_id FK notifications`; `user_id FK users`; `seen_at timestamptz?`; `read_at timestamptz?` | Unik notification_id; user = recipient; membaca notifikasi bukan acknowledgement urgent/insiden. |
| 55 `notification_reminders` | `notification_id FK notifications`; `reminder_kind text{manager_urgent_review,parent_urgent_read,parent_incident_ack,legal_expiry}`; `sequence integer`; `due_at timestamptz`; `status text{scheduled,claimed,sent,cancelled,failed}`; `claimed_at timestamptz?`; `lease_until timestamptz?`; `sent_at timestamptz?`; `deduplication_key text` | Key unik; job memeriksa acknowledgement dan izin lagi sebelum kirim; lease mendukung worker yang mati; hanya satu reminder insiden per penerima/insiden. |
| 56 `notification_delivery_logs` | `notification_id FK notifications`; `reminder_id FK notification_reminders?`; `channel text{in_app,email,whatsapp,sms}`; `attempt_number smallint`; `status text{queued,sending,sent,delivered,failed}`; `provider_reference text?`; `attempted_at timestamptz?`; `delivered_at timestamptz?`; `next_retry_at timestamptz?`; `error_code text?`; `delivery_key text` | Key unik mengikat notification/reminder/channel/attempt; urgent maksimal 3 percobaan total per pengiriman kanal. Log provider tidak berisi token atau payload sensitif penuh. |
| 57 `audit_logs` | `actor_id FK users?`; `actor_type text{user,system,gateway,ai}`; `action text`; `entity_type text`; `entity_id uuid`; `daycare_id FK daycares?`; `reason text?`; `before_summary jsonb?`; `after_summary jsonb?`; `request_id text`; `actor_label_snapshot text` | Append-only; audit bukan sumber FK bisnis. Snapshot disaring; tidak menyalin seluruh kesehatan, secrets, atau file asli. Identitas pembuat historis dipertahankan sesuai kebijakan retensi. |
| 58 `account_sanctions` | `target_user_id FK users?`; `target_daycare_id FK daycares?`; `investigation_id FK investigations?`; `sanction_type text{freeze,block}`; `reason text`; `imposed_by FK users`; `starts_at timestamptz`; `ends_at timestamptz?`; `revoked_by FK users?`; `revoked_at timestamptz?`; `revocation_reason text?` | Tepat satu target; bukti wajib terhubung; block tanpa tanggal akhir tetap dapat dicabut Admin dengan audit. Status akun efektif suspended; tidak menambah role/status akun baru bernama blocked. |
| 59 `ai_jobs` | `feature text{legal_verification,safety_score,review_moderation,review_summary,smart_reply,logbook_draft,privacy_masking,incident_triage}`; `daycare_id FK daycares?`; `document_id FK daycare_documents?`; `review_version_id FK review_versions?`; `reply_version_id FK review_reply_versions?`; `activity_id FK daily_report_activities?`; `attachment_id FK attachments?`; `incident_id FK incident_reports?`; `provider text`; `model text`; `model_version text`; `prompt_version text`; `input_version text`; `input_snapshot jsonb`; `output jsonb?`; `status text{queued,running,succeeded,failed,cancelled}`; `attempt_number integer`; `retry_of_id FK ai_jobs?`; `error_code text?`; `requested_by FK users?`; `started_at timestamptz?`; `finished_at timestamptz?`; `idempotency_key text` | Key unik; relasi target diwajibkan sesuai feature, bukan FK bebas tanpa validasi. Versi sumber wajib cocok sebelum hasil diterapkan; AI tidak boleh menulis status enrollment/insiden atau transaksi. |
| 60 `admin_actions` | `admin_id FK users`; `action_type text`; `audit_log_id FK audit_logs`; `complaint_id FK complaints?`; `investigation_id FK investigations?`; `decision_summary text`; `executed_at timestamptz` | Catatan keputusan Admin untuk kebutuhan pengawasan, bukan duplikasi seluruh before/after audit. Unik audit_log_id; tidak memberikan jalan mengeksekusi aksi lewat INSERT langsung. |

Kolom status dan daftar nilai tambahan yang memakai `text` pada log harus divalidasi terhadap status entitas terkait. Nilai `actor_type=system` bukan sesuatu yang boleh dipilih client untuk melewati pengecekan aktor.

## 7. Relasi inti dan pemetaan tabel konseptual

### 7.1 Relasi utama

| Relasi | Kardinalitas dan jalur FK |
| --- | --- |
| Auth → profil aplikasi | `auth.users.id → users.id`, 1:1 |
| Parent → anak | `users → children.parent_id`, 1:N |
| Pengguna ↔ daycare | M:N melalui daycare_members; satu Manager utama per daycare |
| Anak → enrollment | `children → enrollments.child_id`, 1:N; satu checkout/enrollment aktif sesuai aturan v1 |
| Daycare → enrollment | `daycares → enrollments.daycare_id`, 1:N |
| Enrollment ↔ Caregiver | M:N melalui caregiver_assignments; anak/daycare diturunkan dari enrollment |
| Enrollment → daily report → aktivitas | 1:N → 1:N; satu report per tanggal layanan |
| Aktivitas → foto → varian | 1:N → 1:N; 1–3 foto untuk aktivitas normal terkirim |
| Enrollment → insiden | 1:N; insiden → analisis/status/urgency log masing-masing 1:N |
| Enrollment → pickup | 1:N percobaan, maksimal satu berhasil |
| Enrollment → tagihan → transaksi | 1:N → 1:N; satu pembayaran diterapkan untuk tiap tagihan |
| Daycare → payout → payout items | 1:N → 1:N; item mengacu tagihan yang layak dibayarkan |
| Parent + daycare → review → versi | Satu review kanonis per pasangan; banyak versi |
| Insiden → komplain | 1:N opsional; keduanya memiliki siklus status berbeda |

### 7.2 Penyederhanaan dari daftar konseptual pengguna

| Nama konseptual | Keputusan fisik v1 |
| --- | --- |
| `daily_report_attachments`, `incident_attachments` | Digabung ke `attachments` dengan FK pemilik eksklusif; hasil masking di `attachment_variants`. RLS tetap berbeda menurut pemilik. |
| `review_ai_analyses` | Disimpan di `ai_jobs` untuk feature moderasi/summary/reply; versi review menjadi FK sumber; keputusan publikasi tetap di tabel review version. |
| `incident_notifications` | `notifications` dengan incident_id dan event_type; pengiriman/receipt/reminder memakai tabel umum. |
| `report_change_logs`, `child_health_change_logs` | Tetap terpisah karena kesehatan lebih sensitif dan aturan koreksi berbeda. |
| `incident_ai_analyses` | Tetap terpisah untuk hasil triage terketik dan dapat dibandingkan; execution metadata di ai_jobs. |
| `admin_actions` dan `audit_logs` | Keduanya dipertahankan: keputusan operasional Admin vs log perubahan teknis append-only. |
| Tabel persetujuan/data wali | Consent disimpan di enrollment_consents; child_guardians ditunda; authorized_pickups menyimpan izin penjemput MVP. |
| Kebutuhan tambahan | staff_invitations, service/price versions, health profiles/correction requests, charges, webhook events, payout items, financial holds, acknowledgement, review versions, settings, AI jobs. |

Tidak dibuat tabel saldo yang dapat diedit manual oleh pengguna. Ringkasan pendapatan, komisi, refund, dan payout berasal dari fakta transaksi/tagihan yang konsisten dan hasil rekonsiliasi.

## 8. Constraint, index, dan transaksi wajib

### 8.1 Constraint lintas tabel

1. Anak pada enrollment harus milik parent_id yang tercatat; service dan price version harus milik daycare/layanan yang sama. Gunakan composite FK bila memungkinkan, ditambah trigger/RPC untuk syarat status.
2. Caregiver assignment, laporan, incident, pickup, dan complaint terkait harus berada pada enrollment/daycare yang sama. Jangan hanya memeriksa UUID “ada”.
3. Referensi published version harus menunjuk versi approved milik objek itu sendiri. Referensi melingkar seperti reviews ↔ review_versions ditambahkan dengan `ALTER TABLE` setelah kedua tabel ada.
4. Kapasitas dan syarat usia divalidasi server. Pilihan kapasitas v1 adalah kuota booking harian per daycare; seluruh layanan memakai kuota yang sama. Booking pending belum memakai kuota; pending_payment/approved/completed pada tanggal tersebut memakainya; expired/cancelled/rejected tidak.
5. Banyak pengajuan pending untuk daycare/tanggal sama dari anak yang sama dicegah. Pengajuan ulang setelah rejected/cancelled tetap boleh menjadi baris baru.
6. Total media, kepemilikan varian, status pemrosesan, dan kelayakan pengiriman diperiksa dalam transaksi submit. `CHECK` biasa tidak dapat menghitung baris foto di tabel lain; gunakan trigger dan RPC yang mengunci aktivitas.
7. Urgensi yang diturunkan AI, immutable fields laporan terkirim, transisi terminal, perubahan rekening, serta jumlah refund/payout harus dilindungi pada database, bukan hanya tombol UI.

Default status yang aman: daycare `inactive`, keanggotaan staf `pending_verification`, enrollment `pending` dengan decision `undecided`, aktivitas `draft`, review `pending`, dokumen/harga `draft`, insiden/komplain `new`, transaksi `created`, dan AI job `queued`. Akun Parent aktif hanya sesudah alur Auth/konfirmasi yang dikonfigurasi selesai; akun staf tidak mendapat akses hanya karena profil users sudah terbentuk. Waktu keputusan, pelaku keputusan, alasan penolakan/koreksi, dan waktu terminal diwajibkan dengan CHECK/trigger pada transisi terkait. Counter versi mulai 1 dan selalu positif; byte_size serta late_minutes nonnegatif. Attachment aktivitas, termasuk foto susulan urgent, hanya menerima gambar; video hanya diizinkan untuk bukti insiden sesuai konfigurasi ukuran/format.

### 8.2 Contoh index yang menjadi kontrak migration

Contoh berikut merupakan spesifikasi, **bukan SQL yang sudah dieksekusi**. Migration lengkap tetap harus membuat tabel, CHECK, fungsi, RLS, grants, dan test.

```sql
-- Pilihan v1: satu proses checkout/enrollment aktif per anak.
CREATE UNIQUE INDEX enrollment_one_live_per_child
ON public.enrollments (child_id)
WHERE status IN ('pending_payment', 'approved');

CREATE UNIQUE INDEX enrollment_pending_request_unique
ON public.enrollments (child_id, daycare_id, service_date)
WHERE status = 'pending';

CREATE UNIQUE INDEX daycare_one_active_manager
ON public.daycare_members (daycare_id)
WHERE member_role = 'manager' AND status = 'active';

CREATE UNIQUE INDEX pickup_one_success_per_enrollment
ON public.pickup_records (enrollment_id)
WHERE verification_status = 'verified' AND handed_over_at IS NOT NULL;

CREATE UNIQUE INDEX payout_one_live_item_per_charge
ON public.payout_items (charge_id)
WHERE reservation_status IN ('reserved', 'paid');

CREATE UNIQUE INDEX daycare_one_active_payout_account
ON public.daycare_payout_accounts (daycare_id)
WHERE status = 'active';

CREATE UNIQUE INDEX daycare_one_published_safety_score
ON public.daycare_safety_scores (daycare_id)
WHERE status = 'published';
```

Partial unique index digunakan untuk keunikan hanya pada status tertentu. Jangan memakai `now()` dalam predicate untuk “delegasi yang masih aktif”; masa berlaku dievaluasi saat otorisasi. Penjelasan mekanisme index: [PostgreSQL Partial Indexes](https://www.postgresql.org/docs/current/indexes-partial.html).

Index baca yang perlu disediakan: seluruh FK yang sering di-join; `enrollments(daycare_id,service_date,status)`, `enrollments(parent_id,created_at DESC)`, `caregiver_assignments(caregiver_id,starts_at,ends_at)`, `daily_report_activities(report_id,occurred_at)`, `incident_reports(enrollment_id,occurred_at)`, `complaints(priority,created_at)`, `notifications(recipient_id,created_at DESC)`, `notification_reminders(status,due_at)`, `audit_logs(entity_type,entity_id,created_at)`.

Prioritas komplain adalah urutan bisnis, bukan alfabet. Gunakan ekspresi CASE/rank untuk `emergency=4, high=3, medium=2, low=1` pada query dan index ekspresi yang sesuai jika diperlukan.

### 8.3 Operasi yang harus atomik dan idempotent

| Operasi | Baris yang dikunci/perubahan satu transaksi |
| --- | --- |
| Membuka checkout | Kunci anak dan daycare, baca ulang kapasitas serta enrollment aktif, pilih harga/config approved, buat tagihan, ubah status, simpan log/outbox |
| Webhook sukses | Dedup event, kunci anak/enrollment/tagihan/transaksi; cocokkan nominal/status/deadline; terapkan sekali; buat log/outbox |
| Expiry pembayaran | Kunci enrollment/tagihan; cek apakah sudah dibayar; ubah expired hanya jika masih memenuhi syarat; balapan webhook tidak boleh menghasilkan dua keputusan |
| Mengubah kesehatan | Kunci versi profil; simpan profil+history+notifikasi penerima yang berhak |
| Mengirim aktivitas | Kunci aktivitas/attachment; validasi 1–3 foto atau pengecualian urgent; kunci snapshot; buat notifikasi dan jadwal |
| Pickup | Kunci anak/enrollment/izin; validasi staf dan bukti; konsumsi izin; simpan handover; complete enrollment; notifikasi |
| Approve rekening | Kunci daycare dan request; buat rekening disetujui; nonaktifkan yang lama; audit |
| Refund/payout | Kunci sumber pembayaran/tagihan; cek aggregate yang sudah dialokasikan dan financial holds; reservasi nominal; kirim ke provider setelah commit |
| Konfirmasi komplain | Kunci complaint; bandingkan versi/status/deadline; simpan respons atau auto-close, tidak keduanya |

Panggilan jaringan gateway/AI tidak dilakukan saat transaksi database menunggu lama. Simpan pekerjaan/outbox dahulu, commit, kemudian worker memanggil layanan dengan idempotency key. Tetapkan urutan lock yang konsisten untuk mengurangi deadlock; retry transaksi hanya untuk kegagalan yang aman diulang.

## 9. RLS, akses API, dan Storage

### 9.1 Prinsip keamanan

Semua tabel aplikasi yang terekspos Data API harus memakai RLS, grants minimum, dan kebijakan berdasarkan `auth.uid()`, role server, keanggotaan, enrollment, penugasan, serta waktu. RLS membatasi baris; ia tidak otomatis menyembunyikan kolom kesehatan dalam sebuah baris. Karena itu kesehatan dipisahkan, dan antrean enrollment menggunakan proyeksi data terbatas. Metadata pengguna yang dapat diedit client tidak menjadi sumber role. Referensi: [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).

Server mengambil identitas sesi yang terverifikasi; `parent_id`, `caregiver_id`, dan `admin_id` tidak dipercaya dari body request. Kunci service-role/provider hanya di server. Jika service-role digunakan, API tetap wajib melakukan otorisasi eksplisit karena role tersebut dapat melewati RLS. Status akun dicek di database agar penonaktifan tidak bergantung pada masa berlaku JWT.

Tidak ada policy umum “semua caregiver bisa SELECT data daycare”. Semua tabel memiliki default deny. Views publik hanya berisi kolom aman; bila menggunakan `security_invoker` gunakan versi PostgreSQL yang mendukungnya dan uji grants/RLS underlying tables. Alternatif endpoint server/proyeksi khusus tidak boleh membocorkan akses tabel mentah.

### 9.2 Matriks operasi database

`R` = baca terbatas; `W` = perubahan melalui operasi terkontrol; `—` = tidak boleh. Tidak ada DELETE langsung untuk data final/historis. “Admin W” tetap berarti mengikuti state machine, alasan, dan audit.

| Kelompok | Publik | Parent | Manager | Caregiver | Admin/worker |
| --- | --- | --- | --- | --- | --- |
| Profil/harga/score/review yang dipublikasikan | R proyeksi | R | R | R | W keputusan publikasi |
| users/members/invitations/delegations | — | R/W profil sendiri terbatas | R/W scope daycare sesuai kewenangan | R diri sendiri; W hanya delegasi yang sah | W role/status/undangan Manager |
| children | — | R/W sendiri | R setelah approved untuk daycare sendiri | R minimum saat assignment berlaku | R pengawasan |
| health profiles/history/corrections | — | R/W sendiri | R kesehatan terkini saat enrollment approved; bukan histori lintas daycare | R terkini saat ditugaskan; W usulan koreksi | R pengawasan; histori terbatas |
| enrollment/consent | — | R sendiri; W pengajuan/cancel pending | R antrean tersanitasi sebelum approved; W keputusan; R riwayat operasional sendiri | R minimum assignment saja | W transisi administratif yang sah |
| assignments | — | R penugasan anak sendiri | R/W daycare sendiri | R penugasan sendiri | R/W pengawasan |
| pickup/izin | — | R/W izin anak sendiri; R riwayat | R/W daycare sendiri | —; delegasi hanya aksi pickup saat ini | R pengawasan |
| daily reports/activities/change logs | — | R aktivitas terkirim anak sendiri | R daycare sendiri; W koreksi teks beralasan | W draft/kirim saat ditugaskan; R laporan lama buatan sendiri | R pengawasan |
| incident/lampiran/triage/status | — | R anak sendiri; W acknowledgement | R daycare sendiri; W status/override urgensi | W create dan unggah terbatas; **tanpa SELECT riwayat/lampiran** | R; W status oleh Admin/hasil analisis oleh worker |
| review dan versi | R versi approved | R sendiri; W jika eligible/izin revisi | R publik; W balasan daycare sendiri | R publik | W moderasi |
| legal/rekening/harga belum publik | — | — | R/W pengajuan daycare sendiri | — | R/W keputusan; worker AI sesuai tugas |
| charges/payment/refund/payout/holds | — | R pembayaran/refund sendiri | R ringkasan keuangan daycare sendiri | — | W melalui prosedur keuangan |
| complaints/assignment/status | — | R/W komplain sendiri dan respons | R/W komplain daycare sebagai pengaju; bagian yang dibagikan Admin | — | R/W seluruh kasus |
| investigations/sanctions/audit/admin_actions | — | R pemberitahuan keputusan yang ditujukan kepadanya melalui proyeksi | R keputusan terkait melalui proyeksi | R pemberitahuan keputusan sendiri melalui proyeksi | R/W terkontrol; audit append-only |
| notifications/receipts/reminders/delivery | — | R notifikasi sendiri; W receipt | Sama | Sama, tanpa notifikasi status insiden | Worker jadwal/pengiriman; Admin ringkasan kegagalan |
| ai_jobs/system_settings/webhook events | — | — | — | — | Server/worker; Admin hanya output/config yang relevan |

Saat enrollment selesai, Manager membaca laporan/insiden/pickup/transaksi milik daycare itu, bukan profil kesehatan terbaru atau riwayat daycare sebelumnya. Caregiver tetap hanya laporan yang dibuatnya; attachment yang boleh dibaca mengikuti laporan itu dan hasil privasi yang sesuai, tidak otomatis termasuk media sensitif lainnya.

RPC `SECURITY DEFINER`, jika diperlukan, mempunyai `search_path` terkunci, nama schema eksplisit, grants execute terbatas, serta pemeriksaan aktor/tenant pada setiap jalur. Cabut execute default dari public untuk fungsi istimewa. Helper role jangan menimbulkan rekursi RLS pada tabel users.

### 9.3 Penyimpanan berkas

| Bucket logis | Isi | Akses |
| --- | --- | --- |
| `daycare-public` | Foto fasilitas yang telah diizinkan untuk katalog | Publik; tidak berisi bukti anak, dokumen legal mentah, atau rekening |
| `logbook-originals` | Foto asli aktivitas | Privat; hanya proses yang berwenang dan peninjau sesuai kebijakan asli yang belum final |
| `logbook-masked` | Hasil pemrosesan per anak/audiens | Privat; Parent pemilik dan staf yang berhak |
| `incident-evidence` | Foto/video insiden | Privat; Parent pemilik, Manager daycare, Admin; bukan Caregiver pelapor |
| `pickup-evidence` | Foto penjemput | Privat; Parent/Manager/Admin sesuai scope |
| `daycare-documents` | Izin legal dan bukti rekening | Privat; Manager pemilik/Admin/worker yang sesuai |
| `case-evidence` | Bukti komplain, investigasi, sanksi | Privat; berdasarkan kasus; bukti investigasi internal hanya Admin |

Bucket privat dapat menggunakan policy Storage dan unduhan terautentikasi atau signed URL yang berumur pendek. Jangan menyimpan signed URL sebagai identitas file; simpan bucket/path. Pembatasan MIME/ukuran diterapkan sebelum proses dan isi file divalidasi server. Referensi: [Supabase Storage Buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals).

Signed URL yang sudah diberikan tetap berisiko digunakan sampai kedaluwarsa. Untuk data yang harus dicabut segera setelah penugasan selesai, gunakan endpoint unduh terautentikasi yang memeriksa hak pada setiap akses, atau kebijakan token yang disahkan; jangan menjanjikan pencabutan seketika dengan URL jangka panjang. Detail masa berlaku token: [Supabase Private Downloads](https://supabase.com/docs/guides/storage/serving/downloads).

Upload insiden oleh Caregiver menggunakan izin unggah bertarget dan sekali pakai yang diterbitkan server setelah pemeriksaan. Token hanya mengizinkan unggah ke objek laporan tertentu, tidak list/read/delete. Endpoint pembuatan mengembalikan tanda terima minimal, bukan `SELECT` seluruh insiden. Parent tidak dapat mengubah path file untuk membaca tenant lain.

## 10. AI pipeline dan pekerjaan terjadwal

### 10.1 Kontrak AI

Alur umum: **input terotorisasi → ai_jobs → pemrosesan → hasil tersimpan → validasi skema/versi → keputusan manusia sesuai modul → publikasi bila diizinkan**.

| Fitur | Input | Hasil dan pemisahan tanggung jawab |
| --- | --- | --- |
| Legal verification | Dokumen privat dan metadata | OCR/analisis; Admin menentukan keputusan verifikasi |
| Safety Score | Data sumber terverifikasi dan versi formula | Skor + alasan + provenance; publikasi setelah review yang ditetapkan v1 |
| Review moderation/summary | Versi review/balasan; summary hanya konten approved | Status rekomendasi, alasan moderasi, ringkasan berversi; konten held menunggu Admin |
| Smart Reply | Review dan konteks aman daycare | Draf balasan; Manager menyunting/mengirim; tetap dimoderasi |
| Logbook drafter | Fakta aktivitas yang diberikan Caregiver | Draf; Caregiver memeriksa sebelum mengirim. Tidak mengarang kejadian yang tidak diamati |
| Privacy masking | Foto privat dan konteks audiens | Varian foto, status proses, pemeriksaan; hasil gagal tidak dibagikan ke Parent |
| Incident triage | Laporan dan penilaian Caregiver | Urgensi/rekomendasi terpisah; notifikasi darurat tidak menunggu AI; AI tidak mengubah status insiden |

Pilihan v1 menggunakan tinjauan Caregiver sebelum kirim draf, dan masking sebelum foto dibagikan. Detail penyimpanan foto asli, metode masking, pemeriksaan manusia, model, retry AI, serta retensinya masih perlu disahkan. Tidak semua fungsi gambar harus diasumsikan tersedia langsung dari satu model Gemini; adapter dan pembuktian teknis ditetapkan saat integrasi.

### 10.2 Pekerjaan server yang harus ada

| Job | Pemicu/aturan |
| --- | --- |
| Pembayaran expired | payment_deadline; idempotent; balapan webhook dilindungi lock |
| Urgent Manager | sent_at + 3 menit, jika belum ada manager_review: reminder dan eskalasi Admin |
| Urgent Parent | sent_at + 3 menit lalu kelipatan 3 menit selama belum ack; kanal eksternal mulai batas pertama |
| Retry pengiriman urgent | Maksimal 2 retry setelah attempt pertama; jangan membuat rangkaian retry baru karena worker mengulang pekerjaan yang sama |
| Reminder insiden | Sekali jika Parent belum ack; interval konfigurasi wajib diisi sebelum fitur aktif |
| Legal expiry | Berdasarkan expires_on; jarak pengingat configurable, tidak ditebak |
| Komplain auto-close | 72 jam sejak permintaan konfirmasi yang masih berlaku; berhenti bila pengaju merespons |
| AI queue/retry | Versi input dan idempotensi diperiksa; retry limit/backoff belum final |
| Rekonsiliasi gateway | Cocokkan payment/refund/payout dengan provider; event hilang/tertunda masuk pemeriksaan |

Gunakan worker/penjadwal persisten dengan klaim pekerjaan dan lease, bukan `setTimeout` di browser atau server request. Delegasi tetap berakhir secara otorisasi pada timestamp walaupun worker pengingat mati. Worker membaca acknowledgement terbaru sebelum mengirim, dan Admin diberi visibilitas kegagalan delivery. Nilai batas total reminder urgent, penghentian saat insiden selesai, serta pilihan WA vs SMS masih perlu kebijakan agar tidak terjadi pengiriman tanpa batas yang tidak terkendali.

## 11. Hal yang belum final dan tidak boleh diisi sembarang

| Keputusan | Struktur yang sudah disediakan | Yang harus disahkan sebelum fitur production |
| --- | --- | --- |
| Definisi enrollment aktif | Status + decision + check-in terpisah; partial unique v1 | Setuju dengan satu approved/checkout, atau dukungan reservasi masa depan berdasarkan periode; titik membuka data anak setelah approved |
| Batas pembayaran | payment_deadline, due_at, settings version | Durasi, cutoff layanan, toleransi webhook tertunda, dan no-show |
| Kapasitas | daily_capacity dan lock booking | Kuota harian vs kapasitas serentak/shift; perubahan kapasitas setelah booking |
| Komisi/biaya | commission_rules, charges snapshots | Tarif/kategori, dasar, pembulatan, biaya Admin, gateway, pajak, dan penanggung biaya |
| Gateway dan dana tertahan | payment/refund/payout records | Provider/metode, mekanisme settlement, istilah dan kewajiban legal; jangan klaim escrow |
| Refund/ganda | refunds, reconciliation, financial_holds | Kriteria penuh/sebagian/none, SLA, keputusan ganda, refund setelah payout dan sumber dananya |
| Biaya keterlambatan | price terms + charge tambahan | Tarif, persetujuan Parent, pengukuran keterlambatan, penyelesaian bila belum dibayar |
| Delegasi | Per permission + periode + revocation | Pengesahan tindakan pickup tanpa histori; koreksi laporan/review urgent melalui delegasi; batas staf senior |
| Incident triage | Dua penilaian + override + log | Definisi skala urgensi dan eskalasi operasional; siapa mengunggah media susulan setelah penugasan berakhir |
| AI Safety Score | Formula version dan input snapshot | Bobot/formula, sumber, kriteria review/publikasi, efek dokumen expired pada skor/status daycare |
| AI draft/masking | Job, original, varian, status | Kelayakan model, proses review, penyimpanan/akses asli, gagal masking, format/ukuran media, retensi |
| AI review/reply | Versi, moderasi, grant revisi | Threshold/rule moderasi, appeal, siapa boleh mencabut publikasi, detail izin revisi |
| Notifikasi urgent | 3 menit; maksimal 2 retry; delivery log | Provider, WA/SMS/fallback, backoff, batas total reminder dan kondisi penghentian |
| Reminder insiden/legal | Jadwal configurable | Interval reminder insiden dan hari pengingat sebelum dokumen expired |
| Akun/retensi | Soft delete, restrict FK, actor snapshot | Retensi identitas Caregiver yang keluar, anonymization, penghapusan Auth, semua kategori media/log |
| Wali dan consent | Satu Parent, authorized_pickups, consent record | Wording/bukti consent, verifikasi wali, kebutuhan child_guardians di fase berikutnya |
| Komplain Daycare | submitted_by + confirmation fields | Apakah Manager pengaju menjadi pihak konfirmasi seperti Parent; akses balasan/bukti kasus |
| Statistik | Query berbasis periode dan snapshot | Zona, rentang default, definisi jumlah dan cakupan daycare nonaktif |
| Keamanan operasional | RLS matrix, private storage, audit | Retensi, akses darurat, kunci enkripsi, grants aktual, pengujian kebocoran per tabel |

Nilai 3 menit, maksimal 2 retry, dan 72 jam berasal dari keputusan pengguna. Nilai lain yang belum diputuskan tidak diisi menggunakan angka contoh. Jika konfigurasi wajib belum approved, endpoint yang bergantung padanya mengembalikan “fitur belum dikonfigurasi”, bukan berjalan memakai default tersembunyi.

## 12. Urutan implementasi ke project

1. **Tetapkan keputusan pengunci.** Sahkan interpretasi enrollment/akses sebelum approval, kategori biaya, dan baseline keamanan. Database dapat dibangun bertahap, tetapi pembayaran nyata tidak diaktifkan sebelum kebijakan/provider siap.
2. **Migration fondasi.** Gunakan [folder database yang tersedia](../database/): users, daycare, members/invitations, children/health, services/prices/settings. Buat FK/check/index/RLS dan seed referensi yang sah. Jangan menggunakan data demo sebagai data produksi.
3. **Auth dan pemisahan role.** Gunakan [folder integrasi Supabase yang tersedia](../lib/supabase/) dan [services](../services/). Pisahkan Manager/Caregiver pada portal pengelola, ganti flag demo dengan sesi terverifikasi, uji akses langsung URL/API.
4. **Enrollment, transaksi, pickup.** Bangun RPC dan integrasi gateway sandbox, expiry, check-in, izin penjemput, dan bukti penyelesaian. Uji konflik kapasitas dan pembayaran ganda sebelum menghubungkan dashboard ke uang nyata.
5. **Penugasan dan logbook.** Hubungkan data anak per assignment, aktivitas per anak, upload privat, masking, koreksi teks, dan urgent acknowledgement.
6. **Insiden/komplain/notifikasi.** Bangun create-only Caregiver, triage asinkron, status log, Parent ack, eskalasi, worker reminder, dan konfirmasi 72 jam.
7. **Legal/review/keuangan/Admin.** Hubungkan verifikasi, harga, moderasi, rekening, refund/payout/holds, sanksi, dan statistik yang sudah dipilih.
8. **Pengujian dan cutover.** Jalankan RLS dan concurrency tests, uji Storage, rekonsiliasi provider, rollback migration, serta pemisahan mode demo. Baru nyatakan modul selesai setelah data dan izin bekerja pada backend.

Pembuatan migration SQL, provisioning Supabase, perubahan UI, integrasi provider, serta penerapan database merupakan tahap berikutnya. Penyusunan dokumen ini tidak menjalankan tindakan tersebut.

## 13. Kriteria penerimaan database dan alur

- Pengunjung mendapat katalog publik tetapi tidak bisa membaca children, enrollment mentah, kesehatan, pickup, atau dokumen privat.
- Parent A tidak dapat membaca/mengubah data Parent B dengan mengganti UUID, query, request body, path Storage, atau URL halaman.
- Role Manager/Caregiver/Admin tidak dapat diperoleh dari signup publik, query parameter, user metadata, atau localStorage.
- Manager melihat antrean pending tanpa identitas/data anak; sesudah approved hanya scope daycare sendiri; tidak memperoleh riwayat daycare lama.
- Caregiver kehilangan akses kesehatan tepat saat assignment berakhir/dicabut; tetap hanya dapat membaca laporan lama yang dibuat sendiri jika akun aktif.
- Caregiver dapat melaporkan insiden dan unggah susulan melalui izin terbatas, tetapi tidak dapat list/read/download insiden atau riwayat pickup.
- Delegasi tidak dapat diperpanjang/didelegasikan ulang oleh penerima; izin otomatis tidak berlaku setelah ends_at walaupun worker mati.
- Dua checkout bersamaan untuk anak yang sama tidak sama-sama berhasil; dua booking terakhir untuk satu slot tidak melebihi kapasitas.
- Pembayaran browser palsu, webhook duplikat/out-of-order, nominal berbeda, pembayaran setelah expired, dan pembayaran sukses ganda tidak menggandakan aktivasi atau saldo payout.
- Normal logbook dengan 0 atau >3 foto ditolak; urgent tanpa foto diterima; gagal masking tidak membocorkan foto asli; laporan terkirim tidak bisa dihapus/diganti foto.
- Koreksi teks menyimpan alasan dan versi lama; AI tidak menimpa edit yang lebih baru atau override urgensi Manager.
- Reminder berhenti setelah ack, tidak terkirim ganda saat worker retry, dan gagal delivery urgent berhenti setelah total 3 attempt serta mengeskalasi Admin.
- Pickup gagal tidak menyelesaikan enrollment; izin sekali pakai tidak bisa dipakai dua kali; pickup berhasil, completion, dan konsumsi izin konsisten dalam satu transaksi.
- Review sebelum completed/pickup ditolak; satu review aktif per Parent/daycare; pending/held review atau reply tidak tampil publik.
- Komplain dan insiden tidak saling menutup; resolved incident tidak dibuka ulang; konfirmasi Parent dan job 72 jam tidak dapat sama-sama menang.
- Penggantian rekening yang ditolak mempertahankan rekening lama; payout memakai snapshot rekening disetujui dan tidak menggandakan alokasi tagihan.
- Penahanan payout/refund diperiksa server; jumlah refund tidak melebihi transaksi; perubahan jumlah tagihan yang sudah dibayar ditolak.
- Soft delete anak/staf tidak memutus laporan atau audit; data audit, log kesehatan, dan input/output AI tidak bocor melalui endpoint umum.
- Semua pengujian memakai sesi role nyata dengan RLS, bukan hanya service-role atau tombol tersembunyi di UI.

## 14. Penjelasan untuk Mini Demo Day 2

Ayomi menghubungkan Parent, Manager, Caregiver, dan Admin melalui layanan daycare harian. Parent menemukan daycare, mengajukan anak, membayar setelah diterima, memantau aktivitas/insiden, dan menyelesaikan layanan melalui pickup terverifikasi. Manager mengelola operasional; Caregiver melaporkan pengasuhan berdasarkan penugasan; Admin memverifikasi, menangani sengketa, dan mengawasi platform. Database menghubungkan users, children, daycares, enrollments, caregiver_assignments, daily_reports, dan daily_report_activities; tabel pendukung menjaga bukti, keuangan, AI, notifikasi, dan audit. Supabase Auth dan RLS membatasi akses berdasarkan identitas, daycare, anak, status enrollment, serta waktu penugasan. **Saat ini UI dan alur demo tersedia; database dan pipeline production dalam dokumen ini adalah rancangan implementasi, bukan klaim sudah berjalan.**
