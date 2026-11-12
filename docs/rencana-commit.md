# Rencana commit bertahap Ayomi

Daftar ini disusun dari perubahan Git yang masih belum di-commit. Tidak ada staging, commit, atau push yang dijalankan saat membuat panduan ini.

Interval berikut adalah jadwal mulai sekarang, bukan rekonstruksi waktu pengerjaan atau perubahan timestamp Git. Selesaikan dan tinjau satu kelompok setiap sekitar 10 menit; jika belum siap, lanjutkan pemeriksaan sebelum commit.

Komponen autentikasi dan UI dasar sudah ada dalam riwayat commit sebelumnya. Jangan memasukkannya kembali jika tidak berubah. Urutan di bawah mempertimbangkan dependensi kode; tautan ke fitur yang belum dicatat baru lengkap setelah kelompok terkait selesai. Setiap snapshot antara belum diuji build secara terpisah.

## Cara menggunakan

1. Jalankan dari root proyek dengan PowerShell.
2. Periksa `git diff --cached --name-only` sebelum mulai. Jika sudah ada staging milik Anda, tinjau dan pisahkan dahulu agar tidak tercampur.
3. Jalankan blok kelompok yang waktunya tiba. Periksa hasil `git diff --cached --stat` dan `git diff --cached` sebelum menjalankan baris commit.
4. Gunakan waktu commit sebenarnya. Tidak perlu mengubah author date atau committer date.

Perintah menggunakan `git --literal-pathspecs add` agar folder `[id]` ditafsirkan secara literal. Semua path diberi kutip agar tanda kurung dan spasi aman di PowerShell.

## 1. Menit 10: Lengkapi aset merek dan rute autentikasi

Pesan commit: `fix: complete brand assets and authentication routes`.

Komponen AuthForm, AuthPage, AuthLayout, dan helper auth sudah tercatat pada commit sebelumnya. Kelompok ini melengkapi aset, stylesheet, dan rute yang belum tercatat.

Berkas:

- [app/favicon.ico](<../app/favicon.ico>)
- [app/icon.svg](<../app/icon.svg>)
- [app/globals.css](<../app/globals.css>)
- [components/ui/AyomiLogo.js](<../components/ui/AyomiLogo.js>)
- [public/fonts/OFL.txt](<../public/fonts/OFL.txt>)
- [public/fonts/PlusJakartaSans-Variable.ttf](<../public/fonts/PlusJakartaSans-Variable.ttf>)
- [public/images/ayomi-logo.png](<../public/images/ayomi-logo.png>)
- [public/images/ayomi-daycare.webp](<../public/images/ayomi-daycare.webp>)
- [components/layout/AuthLayout.module.css](<../components/layout/AuthLayout.module.css>)
- [app/(auth)/masuk/page.js](<../app/(auth)/masuk/page.js>)
- [app/(auth)/daftar/page.js](<../app/(auth)/daftar/page.js>)

```powershell
git --literal-pathspecs add -- 'app/favicon.ico'
git --literal-pathspecs add -- 'app/icon.svg'
git --literal-pathspecs add -- 'app/globals.css'
git --literal-pathspecs add -- 'components/ui/AyomiLogo.js'
git --literal-pathspecs add -- 'public/fonts/OFL.txt'
git --literal-pathspecs add -- 'public/fonts/PlusJakartaSans-Variable.ttf'
git --literal-pathspecs add -- 'public/images/ayomi-logo.png'
git --literal-pathspecs add -- 'public/images/ayomi-daycare.webp'
git --literal-pathspecs add -- 'components/layout/AuthLayout.module.css'
git --literal-pathspecs add -- 'app/(auth)/masuk/page.js'
git --literal-pathspecs add -- 'app/(auth)/daftar/page.js'
git diff --cached --stat
git diff --cached
# Setelah meninjau perubahan staged:
git commit -m 'fix: complete brand assets and authentication routes'
```

## 2. Menit 20: Fondasi data dan mode demo orang tua

Pesan commit: `feat: add parent demo data and local state`.

Fixture daycare, aturan pendaftaran, penyimpanan lokal, provider, dan komponen bersama dibutuhkan oleh halaman selanjutnya.

Berkas:

- [data/daycares.js](<../data/daycares.js>)
- [lib/parent.js](<../lib/parent.js>)
- [services/parent-demo-store.js](<../services/parent-demo-store.js>)
- [components/features/ParentDemoProvider.js](<../components/features/ParentDemoProvider.js>)
- [components/features/Parent.module.css](<../components/features/Parent.module.css>)
- [components/features/ParentUI.js](<../components/features/ParentUI.js>)

```powershell
git --literal-pathspecs add -- 'data/daycares.js'
git --literal-pathspecs add -- 'lib/parent.js'
git --literal-pathspecs add -- 'services/parent-demo-store.js'
git --literal-pathspecs add -- 'components/features/ParentDemoProvider.js'
git --literal-pathspecs add -- 'components/features/Parent.module.css'
git --literal-pathspecs add -- 'components/features/ParentUI.js'
git diff --cached --stat
git diff --cached
# Setelah meninjau perubahan staged:
git commit -m 'feat: add parent demo data and local state'
```

## 3. Menit 30: Universal Navbar dan kerangka halaman

Pesan commit: `feat: add universal navigation and parent shell`.

Integrasi provider dan navbar ke layout dilakukan bersama. Sebagian tautan baru mendapatkan halaman pada kelompok berikutnya.

Berkas:

- [components/layout/UniversalNavbar.js](<../components/layout/UniversalNavbar.js>)
- [components/layout/ParentShell.js](<../components/layout/ParentShell.js>)
- [components/layout/ParentShell.module.css](<../components/layout/ParentShell.module.css>)
- [app/layout.js](<../app/layout.js>)
- [components/layout/README.md](<../components/layout/README.md>)

```powershell
git --literal-pathspecs add -- 'components/layout/UniversalNavbar.js'
git --literal-pathspecs add -- 'components/layout/ParentShell.js'
git --literal-pathspecs add -- 'components/layout/ParentShell.module.css'
git --literal-pathspecs add -- 'app/layout.js'
git --literal-pathspecs add -- 'components/layout/README.md'
git diff --cached --stat
git diff --cached
# Setelah meninjau perubahan staged:
git commit -m 'feat: add universal navigation and parent shell'
```

## 4. Menit 40: Katalog publik, pencarian, dan splash

Pesan commit: `feat: add public daycare catalog and regional search`.

Halaman utama menjadi katalog; splash tetap di /welcome. Sertakan kedua ilustrasi yang dipakai kartu daycare.

Berkas:

- [public/images/daycare-room.webp](<../public/images/daycare-room.webp>)
- [public/images/daycare-garden.webp](<../public/images/daycare-garden.webp>)
- [components/features/PublicCatalog.js](<../components/features/PublicCatalog.js>)
- [components/features/DaycareSearch.js](<../components/features/DaycareSearch.js>)
- [app/page.js](<../app/page.js>)
- [app/(parent)/pencarian/page.js](<../app/(parent)/pencarian/page.js>)
- [app/welcome/page.js](<../app/welcome/page.js>)
- [components/features/welcome/WelcomeScreen.js](<../components/features/welcome/WelcomeScreen.js>)

```powershell
git --literal-pathspecs add -- 'public/images/daycare-room.webp'
git --literal-pathspecs add -- 'public/images/daycare-garden.webp'
git --literal-pathspecs add -- 'components/features/PublicCatalog.js'
git --literal-pathspecs add -- 'components/features/DaycareSearch.js'
git --literal-pathspecs add -- 'app/page.js'
git --literal-pathspecs add -- 'app/(parent)/pencarian/page.js'
git --literal-pathspecs add -- 'app/welcome/page.js'
git --literal-pathspecs add -- 'components/features/welcome/WelcomeScreen.js'
git diff --cached --stat
git diff --cached
# Setelah meninjau perubahan staged:
git commit -m 'feat: add public daycare catalog and regional search'
```

## 5. Menit 50: Detail daycare dan komparasi

Pesan commit: `feat: add daycare details and comparison`.

Detail, skor contoh, ulasan, galeri, halaman tidak ditemukan, dan tabel komparasi maksimal tiga daycare.

Berkas:

- [components/ui/StarRating.js](<../components/ui/StarRating.js>)
- [components/features/DaycareDetail.js](<../components/features/DaycareDetail.js>)
- [components/features/DaycareComparison.js](<../components/features/DaycareComparison.js>)
- [app/(parent)/detail/[id]/page.js](<../app/(parent)/detail/[id]/page.js>)
- [app/(parent)/detail/[id]/not-found.js](<../app/(parent)/detail/[id]/not-found.js>)
- [app/(parent)/bandingkan/page.js](<../app/(parent)/bandingkan/page.js>)
- [app/(parent)/bandingkan/hasil/page.js](<../app/(parent)/bandingkan/hasil/page.js>)

```powershell
git --literal-pathspecs add -- 'components/ui/StarRating.js'
git --literal-pathspecs add -- 'components/features/DaycareDetail.js'
git --literal-pathspecs add -- 'components/features/DaycareComparison.js'
git --literal-pathspecs add -- 'app/(parent)/detail/[id]/page.js'
git --literal-pathspecs add -- 'app/(parent)/detail/[id]/not-found.js'
git --literal-pathspecs add -- 'app/(parent)/bandingkan/page.js'
git --literal-pathspecs add -- 'app/(parent)/bandingkan/hasil/page.js'
git diff --cached --stat
git diff --cached
# Setelah meninjau perubahan staged:
git commit -m 'feat: add daycare details and comparison'
```

## 6. Menit 60: Pendaftaran anak dan status pengajuan

Pesan commit: `feat: add child enrollment and status simulation`.

Formulir demo serta transisi persetujuan, penolakan, pembatalan, dan aktivasi pengasuhan.

Berkas:

- [components/features/EnrollmentForm.js](<../components/features/EnrollmentForm.js>)
- [components/features/EnrollmentStatus.js](<../components/features/EnrollmentStatus.js>)
- [app/(parent)/pendaftaran-anak/page.js](<../app/(parent)/pendaftaran-anak/page.js>)
- [app/(parent)/status-pendaftaran/page.js](<../app/(parent)/status-pendaftaran/page.js>)

```powershell
git --literal-pathspecs add -- 'components/features/EnrollmentForm.js'
git --literal-pathspecs add -- 'components/features/EnrollmentStatus.js'
git --literal-pathspecs add -- 'app/(parent)/pendaftaran-anak/page.js'
git --literal-pathspecs add -- 'app/(parent)/status-pendaftaran/page.js'
git diff --cached --stat
git diff --cached
# Setelah meninjau perubahan staged:
git commit -m 'feat: add child enrollment and status simulation'
```

## 7. Menit 70: Dashboard dan logbook orang tua

Pesan commit: `feat: add parent dashboard and daily logbook`.

Ringkasan anak aktif dan timeline contoh dengan filter, reaksi, dan komentar.

Berkas:

- [components/features/ParentDashboard.js](<../components/features/ParentDashboard.js>)
- [components/features/ParentLogbook.js](<../components/features/ParentLogbook.js>)
- [app/(parent)/beranda/page.js](<../app/(parent)/beranda/page.js>)
- [app/(parent)/catatan-harian/page.js](<../app/(parent)/catatan-harian/page.js>)

```powershell
git --literal-pathspecs add -- 'components/features/ParentDashboard.js'
git --literal-pathspecs add -- 'components/features/ParentLogbook.js'
git --literal-pathspecs add -- 'app/(parent)/beranda/page.js'
git --literal-pathspecs add -- 'app/(parent)/catatan-harian/page.js'
git diff --cached --stat
git diff --cached
# Setelah meninjau perubahan staged:
git commit -m 'feat: add parent dashboard and daily logbook'
```

## 8. Menit 80: Laporan, profil, notifikasi, dan ulasan

Pesan commit: `feat: add parent reports and account pages`.

Pelaporan lokal dengan prioritas manual, pengelolaan profil/anak, notifikasi, serta ulasan.

Berkas:

- [components/features/ParentIncidents.js](<../components/features/ParentIncidents.js>)
- [components/features/ParentAccount.js](<../components/features/ParentAccount.js>)
- [components/ui/ToggleSwitch.js](<../components/ui/ToggleSwitch.js>)
- [app/(parent)/laporan/page.js](<../app/(parent)/laporan/page.js>)
- [app/(parent)/profil/page.js](<../app/(parent)/profil/page.js>)
- [app/(parent)/notifikasi/page.js](<../app/(parent)/notifikasi/page.js>)
- [app/(parent)/ulasan/page.js](<../app/(parent)/ulasan/page.js>)

```powershell
git --literal-pathspecs add -- 'components/features/ParentIncidents.js'
git --literal-pathspecs add -- 'components/features/ParentAccount.js'
git --literal-pathspecs add -- 'components/ui/ToggleSwitch.js'
git --literal-pathspecs add -- 'app/(parent)/laporan/page.js'
git --literal-pathspecs add -- 'app/(parent)/profil/page.js'
git --literal-pathspecs add -- 'app/(parent)/notifikasi/page.js'
git --literal-pathspecs add -- 'app/(parent)/ulasan/page.js'
git diff --cached --stat
git diff --cached
# Setelah meninjau perubahan staged:
git commit -m 'feat: add parent reports and account pages'
```

## 9. Menit 90: Pengujian, konfigurasi, dan panduan frontend

Pesan commit: `test: add parent flow tests and frontend documentation`.

Pengujian logika demo, redirect URL lama, task build/dev, dan dokumentasi. Jalankan pemeriksaan setelah seluruh kelompok fitur selesai.

Berkas:

- [lib/parent.test.mjs](<../lib/parent.test.mjs>)
- [next.config.mjs](<../next.config.mjs>)
- [.vscode/tasks.json](<../.vscode/tasks.json>)
- [docs/frontend-auth.md](<../docs/frontend-auth.md>)
- [docs/frontend-welcome.md](<../docs/frontend-welcome.md>)
- [docs/frontend-parent.md](<../docs/frontend-parent.md>)
- [docs/rencana-commit.md](<../docs/rencana-commit.md>)

```powershell
git --literal-pathspecs add -- 'lib/parent.test.mjs'
git --literal-pathspecs add -- 'next.config.mjs'
git --literal-pathspecs add -- '.vscode/tasks.json'
git --literal-pathspecs add -- 'docs/frontend-auth.md'
git --literal-pathspecs add -- 'docs/frontend-welcome.md'
git --literal-pathspecs add -- 'docs/frontend-parent.md'
git --literal-pathspecs add -- 'docs/rencana-commit.md'
git diff --cached --stat
git diff --cached
# Setelah meninjau perubahan staged:
git commit -m 'test: add parent flow tests and frontend documentation'
```

## 10. Menit 100: Dokumentasikan struktur dan spesifikasi proyek

Pesan commit: `docs: record project structure and product specifications`.

Berkas .gitkeep hanya mempertahankan struktur yang sudah disediakan; bukan implementasi API, database, atau portal caregiver. Yang berada dalam folder berisi kode sudah tidak diperlukan untuk mempertahankan folder, tetapi dapat tetap dicatat sesuai struktur awal.

Berkas:

- [README.md](<../README.md>)
- [brief/hallmark.md](./brief/hallmark.md)
- [brief/prd-ayomi.md](./brief/prd-ayomi.md)
- [app/(auth)/daftar/.gitkeep](<../app/(auth)/daftar/.gitkeep>)
- [app/(auth)/masuk/.gitkeep](<../app/(auth)/masuk/.gitkeep>)
- [app/(caregiver)/pengelola/dokumen/.gitkeep](<../app/(caregiver)/pengelola/dokumen/.gitkeep>)
- [app/(caregiver)/pengelola/laporan-harian/tambah/.gitkeep](<../app/(caregiver)/pengelola/laporan-harian/tambah/.gitkeep>)
- [app/(caregiver)/pengelola/pendaftaran/.gitkeep](<../app/(caregiver)/pengelola/pendaftaran/.gitkeep>)
- [app/(caregiver)/pengelola/profil/edit/.gitkeep](<../app/(caregiver)/pengelola/profil/edit/.gitkeep>)
- [app/(caregiver)/pengelola/ulasan/.gitkeep](<../app/(caregiver)/pengelola/ulasan/.gitkeep>)
- [app/(parent)/bandingkan/hasil/.gitkeep](<../app/(parent)/bandingkan/hasil/.gitkeep>)
- [app/(parent)/beranda/.gitkeep](<../app/(parent)/beranda/.gitkeep>)
- [app/(parent)/catatan-harian/.gitkeep](<../app/(parent)/catatan-harian/.gitkeep>)
- [app/(parent)/detail/[id]/.gitkeep](<../app/(parent)/detail/[id]/.gitkeep>)
- [app/(parent)/laporan/.gitkeep](<../app/(parent)/laporan/.gitkeep>)
- [app/(parent)/notifikasi/.gitkeep](<../app/(parent)/notifikasi/.gitkeep>)
- [app/(parent)/pencarian/.gitkeep](<../app/(parent)/pencarian/.gitkeep>)
- [app/(parent)/pendaftaran-anak/.gitkeep](<../app/(parent)/pendaftaran-anak/.gitkeep>)
- [app/(parent)/profil/.gitkeep](<../app/(parent)/profil/.gitkeep>)
- [app/(parent)/status-pendaftaran/.gitkeep](<../app/(parent)/status-pendaftaran/.gitkeep>)
- [app/(parent)/ulasan/.gitkeep](<../app/(parent)/ulasan/.gitkeep>)
- [app/api/ai/.gitkeep](<../app/api/ai/.gitkeep>)
- [app/api/auth/.gitkeep](<../app/api/auth/.gitkeep>)
- [app/api/daily-reports/.gitkeep](<../app/api/daily-reports/.gitkeep>)
- [app/api/daycares/.gitkeep](<../app/api/daycares/.gitkeep>)
- [app/api/enrollments/.gitkeep](<../app/api/enrollments/.gitkeep>)
- [app/api/incident-reports/.gitkeep](<../app/api/incident-reports/.gitkeep>)
- [components/features/.gitkeep](<../components/features/.gitkeep>)
- [database/.gitkeep](<../database/.gitkeep>)
- [lib/.gitkeep](<../lib/.gitkeep>)
- [lib/supabase/.gitkeep](<../lib/supabase/.gitkeep>)
- [services/.gitkeep](<../services/.gitkeep>)

```powershell
git --literal-pathspecs add -- 'README.md'
git add -- docs/brief/hallmark.md
git add -- docs/brief/prd-ayomi.md
git --literal-pathspecs add -- 'app/(auth)/daftar/.gitkeep'
git --literal-pathspecs add -- 'app/(auth)/masuk/.gitkeep'
git --literal-pathspecs add -- 'app/(caregiver)/pengelola/dokumen/.gitkeep'
git --literal-pathspecs add -- 'app/(caregiver)/pengelola/laporan-harian/tambah/.gitkeep'
git --literal-pathspecs add -- 'app/(caregiver)/pengelola/pendaftaran/.gitkeep'
git --literal-pathspecs add -- 'app/(caregiver)/pengelola/profil/edit/.gitkeep'
git --literal-pathspecs add -- 'app/(caregiver)/pengelola/ulasan/.gitkeep'
git --literal-pathspecs add -- 'app/(parent)/bandingkan/hasil/.gitkeep'
git --literal-pathspecs add -- 'app/(parent)/beranda/.gitkeep'
git --literal-pathspecs add -- 'app/(parent)/catatan-harian/.gitkeep'
git --literal-pathspecs add -- 'app/(parent)/detail/[id]/.gitkeep'
git --literal-pathspecs add -- 'app/(parent)/laporan/.gitkeep'
git --literal-pathspecs add -- 'app/(parent)/notifikasi/.gitkeep'
git --literal-pathspecs add -- 'app/(parent)/pencarian/.gitkeep'
git --literal-pathspecs add -- 'app/(parent)/pendaftaran-anak/.gitkeep'
git --literal-pathspecs add -- 'app/(parent)/profil/.gitkeep'
git --literal-pathspecs add -- 'app/(parent)/status-pendaftaran/.gitkeep'
git --literal-pathspecs add -- 'app/(parent)/ulasan/.gitkeep'
git --literal-pathspecs add -- 'app/api/ai/.gitkeep'
git --literal-pathspecs add -- 'app/api/auth/.gitkeep'
git --literal-pathspecs add -- 'app/api/daily-reports/.gitkeep'
git --literal-pathspecs add -- 'app/api/daycares/.gitkeep'
git --literal-pathspecs add -- 'app/api/enrollments/.gitkeep'
git --literal-pathspecs add -- 'app/api/incident-reports/.gitkeep'
git --literal-pathspecs add -- 'components/features/.gitkeep'
git --literal-pathspecs add -- 'database/.gitkeep'
git --literal-pathspecs add -- 'lib/.gitkeep'
git --literal-pathspecs add -- 'lib/supabase/.gitkeep'
git --literal-pathspecs add -- 'services/.gitkeep'
git diff --cached --stat
git diff --cached
# Setelah meninjau perubahan staged:
git commit -m 'docs: record project structure and product specifications'
```

## Pemeriksaan akhir

```powershell
node --test lib/auth.test.mjs lib/parent.test.mjs
npm run lint
npm run build
git status --short
```

Pengujian di atas memeriksa working tree saat dijalankan. Untuk menjamin setiap commit perantara mandiri, perlu menguji snapshot masing-masing secara terpisah; panduan ini tidak mengklaim hal tersebut sudah dilakukan.

## Berkas yang tidak dimasukkan otomatis

[brief/ringkasan-tugas-lama.txt](./brief/ringkasan-tugas-lama.txt) adalah ringkasan lama dengan tanggal 8 Oktober 2026. Tinjau relevansi isinya sebelum memasukkannya ke kelompok dokumentasi; saat ini sengaja tidak dimasukkan dalam perintah staging.

Gunakan daftar file eksplisit di atas agar setiap commit hanya memuat kelompok yang dipilih. Folder build dan dependensi serta berkas environment sudah diabaikan oleh konfigurasi Git proyek.

## Lanjutan: caregiver dan administrator

Kelompok di atas mencatat pekerjaan awal Orang Tua. Tambahan berikut untuk pekerjaan caregiver/admin setelahnya. Interval dihitung relatif dari awal sesi commit tambahan (10, 20, 30, 40, 50 menit), bukan timestamp historis. Tidak ada commit otomatis yang dijalankan.

Beberapa file bersama sudah disebut dalam kelompok awal. Jika belum di-commit, tinjau seluruh diff atau gunakan staging per bagian sebelum mengikuti tambahan ini. Jangan menjalankan daftar awal dan tambahan tanpa memeriksa staging. Build diuji pada hasil akhir gabungan, bukan setiap snapshot perantara.

### Tambahan 1 — menit 10: Fondasi data tiga peran

Pesan: `feat: add caregiver and admin demo workflows`.

- [data/caregiver.js](<../data/caregiver.js>)
- [data/admin.js](<../data/admin.js>)
- [lib/caregiver.js](<../lib/caregiver.js>)
- [lib/admin.js](<../lib/admin.js>)
- [lib/parent.js](<../lib/parent.js>)
- [lib/portals.test.mjs](<../lib/portals.test.mjs>)

### Tambahan 2 — menit 20: Halaman caregiver

Pesan: `feat: implement caregiver management pages`.

- [components/features/Caregiver.module.css](<../components/features/Caregiver.module.css>)
- [components/features/CaregiverUI.js](<../components/features/CaregiverUI.js>)
- [components/features/CaregiverDashboard.js](<../components/features/CaregiverDashboard.js>)
- [components/features/CaregiverEnrollments.js](<../components/features/CaregiverEnrollments.js>)
- [components/features/CaregiverLogbook.js](<../components/features/CaregiverLogbook.js>)
- [components/features/CaregiverReviews.js](<../components/features/CaregiverReviews.js>)
- [components/features/CaregiverBusiness.js](<../components/features/CaregiverBusiness.js>)
- [app/(caregiver)/pengelola/page.js](<../app/(caregiver)/pengelola/page.js>)
- [app/(caregiver)/pengelola/pendaftaran/page.js](<../app/(caregiver)/pengelola/pendaftaran/page.js>)
- [app/(caregiver)/pengelola/laporan-harian/page.js](<../app/(caregiver)/pengelola/laporan-harian/page.js>)
- [app/(caregiver)/pengelola/laporan-harian/tambah/page.js](<../app/(caregiver)/pengelola/laporan-harian/tambah/page.js>)
- [app/(caregiver)/pengelola/ulasan/page.js](<../app/(caregiver)/pengelola/ulasan/page.js>)
- [app/(caregiver)/pengelola/dokumen/page.js](<../app/(caregiver)/pengelola/dokumen/page.js>)
- [app/(caregiver)/pengelola/profil/page.js](<../app/(caregiver)/pengelola/profil/page.js>)
- [app/(caregiver)/pengelola/profil/edit/page.js](<../app/(caregiver)/pengelola/profil/edit/page.js>)

### Tambahan 3 — menit 30: Halaman administrator

Pesan: `feat: implement administrator oversight pages`.

- [components/features/AdminDashboard.js](<../components/features/AdminDashboard.js>)
- [components/features/AdminVerification.js](<../components/features/AdminVerification.js>)
- [components/features/AdminIncidents.js](<../components/features/AdminIncidents.js>)
- [components/features/AdminDaycares.js](<../components/features/AdminDaycares.js>)
- [app/(admin)/admin/page.js](<../app/(admin)/admin/page.js>)
- [app/(admin)/admin/verifikasi-legal/page.js](<../app/(admin)/admin/verifikasi-legal/page.js>)
- [app/(admin)/admin/insiden/page.js](<../app/(admin)/admin/insiden/page.js>)
- [app/(admin)/admin/daycare/page.js](<../app/(admin)/admin/daycare/page.js>)

### Tambahan 4 — menit 40: Navigasi dan integrasi antarperan

Pesan: `feat: connect parent caregiver and admin demo portals`.

- [components/layout/CaregiverNavigation.js](<../components/layout/CaregiverNavigation.js>)
- [components/layout/CaregiverShell.js](<../components/layout/CaregiverShell.js>)
- [components/layout/AdminNavigation.js](<../components/layout/AdminNavigation.js>)
- [components/layout/AdminShell.js](<../components/layout/AdminShell.js>)
- [components/layout/UniversalNavbar.js](<../components/layout/UniversalNavbar.js>)
- [components/layout/ParentShell.js](<../components/layout/ParentShell.js>)
- [components/features/AuthForm.js](<../components/features/AuthForm.js>)
- [components/features/ParentDashboard.js](<../components/features/ParentDashboard.js>)
- [components/features/ParentLogbook.js](<../components/features/ParentLogbook.js>)
- [components/features/ParentIncidents.js](<../components/features/ParentIncidents.js>)
- [components/features/ParentAccount.js](<../components/features/ParentAccount.js>)
- [components/features/EnrollmentStatus.js](<../components/features/EnrollmentStatus.js>)
- [components/features/DaycareDetail.js](<../components/features/DaycareDetail.js>)
- [next.config.mjs](<../next.config.mjs>)

### Tambahan 5 — menit 50: Panduan portal dan commit

Pesan: `docs: explain caregiver and administrator demo flows`.

- [docs/frontend-portals.md](<../docs/frontend-portals.md>)
- [docs/frontend-parent.md](<../docs/frontend-parent.md>)
- [docs/rencana-commit.md](<../docs/rencana-commit.md>)


