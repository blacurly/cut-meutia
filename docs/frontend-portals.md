# Portal Pengelola dan Administrator

Implementasi frontend mengikuti [Hallmark](./brief/hallmark.md), terutama halaman 3.8–3.12 dan Universal Navbar, serta [PRD](./brief/prd-ayomi.md). Portal memakai provider dan penyimpanan demo yang sama dengan alur Orang Tua.

## Cara mencoba tanpa database

1. Jalankan task **Ayomi: dev** atau `npm run dev`, lalu gunakan origin yang sama, misalnya `http://127.0.0.1:3000`.
2. Buka `/pengelola`, tekan **Coba mode demo Pengelola**.
3. Jika belum memiliki pengajuan di Kasih Bunda, tekan **Tambahkan data contoh pengelola**. Ini menambahkan satu anak aktif dan satu pengajuan menunggu tanpa menghapus data sebelumnya. Dibutuhkan dua slot contoh tersisa; tindakan hanya dilakukan sekali.
4. Buka pengajuan, tinjau detail, kemudian setujui atau tolak dengan alasan. Persetujuan mencadangkan slot. Aktivasi tetap dikonfirmasi dari `/status-pendaftaran` pada demo Orang Tua.
5. Buat logbook untuk anak aktif, simpan sebagai draf atau tinjau lalu publikasikan. Lihat `/catatan-harian` pada anak dan tanggal yang sama. Draf tidak tampil di sana.
6. Buat laporan atau ulasan di sisi Orang Tua, lalu tanggapi melalui dashboard atau halaman ulasan Pengelola. Balasan terlihat pada browser yang sama, termasuk antartab.
7. Catat metadata dokumen contoh di `/pengelola/dokumen`.
8. Buka `/admin`, tekan **Coba mode demo Administrator**. Metadata dokumen tadi masuk ke antrean verifikasi; simpan keputusan dan baca hasilnya kembali dari Pengelola.
9. Tinjau laporan Orang Tua dari `/admin/insiden`. Catatan administrator juga tampil pada laporan Orang Tua dan Pengelola.

Tautan demo tersedia pada halaman masuk masing-masing peran. Keluar dari demo Pengelola/Admin hanya menonaktifkan mode peran tersebut dan mempertahankan data. Reset semua data dari profil Orang Tua menghapus seluruh namespace demo. Keluar dan menghapus sesi Orang Tua juga mereset data demo sesuai perilaku yang sudah ada.

## Halaman Pengelola

| Rute | Isi dan interaksi |
| --- | --- |
| `/pengelola` | Sidebar teal, metrik dinamis, skor contoh, pengajuan tertunda, anak aktif, akses cepat logbook, serta tindak lanjut laporan pada bagian `#laporan` |
| `/pengelola/pendaftaran` | Pencarian nama, filter status, tabel, modal detail, persetujuan dengan reservasi slot, penolakan dengan catatan |
| `/pengelola/laporan-harian` | Filter tanggal/anak/status, daftar draf dan publikasi, melanjutkan atau menghapus draf dengan konfirmasi |
| `/pengelola/laporan-harian/tambah` | Multi-pilih anak aktif, waktu WIB, pratinjau foto sementara, templat narasi, simpan draf dan persetujuan publikasi |
| `/pengelola/ulasan` | Dua ulasan contoh serta ulasan lokal, distribusi bintang, filter belum/sudah dibalas, templat tanggapan dan penyimpanan balasan |
| `/pengelola/dokumen` | Pemilihan berkas dan validasi, metadata manual, riwayat dokumen serta hasil keputusan admin demo |
| `/pengelola/profil` | Pratinjau draf profil bisnis, fasilitas, kapasitas contoh, identitas dan akses katalog fixture |
| `/pengelola/profil/edit` | Validasi nama, telepon, alamat, jam layanan, deskripsi dan pilihan fasilitas; simpan lokal |

Portal Pengelola dibatasi pada **Daycare Kasih Bunda** untuk skenario demo. Data pengajuan daycare lain tidak muncul dan tidak dapat diputuskan melalui helper Pengelola. Tidak ada klaim pembatasan keamanan produksi dari kode client ini.

## Halaman Administrator

| Rute | Isi dan interaksi |
| --- | --- |
| `/admin` | Metrik dataset, antrean verifikasi, insiden prioritas, riwayat 20 tindakan terbaru |
| `/admin/verifikasi-legal` | Antrean metadata, filter keputusan, pratinjau ilustrasi dokumen dengan zoom/rotasi, koreksi metadata, keputusan setujui/perbaikan/tolak dan catatan wajib |
| `/admin/insiden` | Laporan lokal Orang Tua + tiga skenario admin mandiri; filter wilayah daycare/prioritas/status, rencana komunikasi, catatan penanganan dan penutupan kasus |
| `/admin/daycare` | Direktori administrasi dengan pencarian/provinsi/status, keputusan legalitas terakhir, simulasi pembatasan/pengaktifan dengan alasan |

Alias `/admin/verifikasi-izin` mengarah ke `/admin/verifikasi-legal`; `/admin/eskalasi-insiden` ke `/admin/insiden`.

Folder Pengelola yang tersedia dipakai kembali. Folder admin sebelumnya belum tersedia; hanya route group dan folder rute minimum ditambahkan di dalam aplikasi yang sama. Tidak ada proyek, database, atau folder fitur paralel baru.

## Alur yang terhubung

```text
Orang Tua mengajukan anak
  → Pengelola meninjau / menyetujui / menolak
  → Orang Tua membaca keputusan dan mengonfirmasi aktivasi
  → Pengelola menulis draf → meninjau → mempublikasikan narasi
  → Orang Tua melihat logbook anak yang dipilih

Orang Tua membuat laporan → Pengelola / Admin menindaklanjuti
  → Riwayat tanggapan tampil pada portal terkait

Pengelola mencatat metadata izin → Admin memberikan keputusan simulasi
  → Hasil dan alasan tampil pada dokumen Pengelola
```

## Batas implementasi

- Seluruh mode adalah demo eksplisit, bukan autentikasi atau otorisasi. Tidak ada akun admin produksi, login server, undangan admin, pembayaran, atau RLS yang dibuat.
- Sumber penyimpanan tetap `ayomi-parent-demo-v1`. Namespace `caregiver` dan `admin` dinormalisasi ketika membaca data lama; data Orang Tua yang valid tetap dipertahankan. Antartab bekerja pada browser/origin yang sama, bukan sinkronisasi lintas pengguna/perangkat. Operasi reservasi lokal bukan transaksi atomik server.
- Narasi dan smart reply menggunakan **templat**, bukan model AI. Distribusi ulasan memakai bintang yang ada, bukan analisis sentimen. Skor, verifikasi awal, dan statistik dataset adalah fixture.
- PRD mewajibkan tinjauan manusia sedangkan Hallmark menyebut auto-release 15 menit. Implementasi memilih publikasi setelah persetujuan eksplisit. Tidak ada timer auto-release.
- Foto logbook hanya memakai object URL sementara untuk pratinjau lokal; tidak dipersistenkan atau diterbitkan. Tampilan Orang Tua menyembunyikan foto karena deteksi wajah dan masking belum aktif. Publikasi hanya narasi.
- Berkas izin/bukti tidak diunggah. Dokumen izin menyimpan nama berkas dan metadata manual. Visual admin dibuat dari metadata dan diberi label **bukan salinan izin resmi**. OCR confidence tidak dikarang.
- Keputusan legalitas tidak mengubah skor AI atau verifikasi fixture publik. Profil bisnis adalah draf lokal; perubahan status administrasi admin tidak memblokir katalog atau pengajuan secara nyata.
- Kontak pengelola/orang tua di admin hanya menyimpan **rencana komunikasi**, bukan pesan terkirim atau panggilan. Prioritas insiden tetap manual; AI triage, eskalasi dan layanan darurat tidak terhubung.
- Tiga skenario insiden admin mandiri terpisah dari laporan keluarga agar tidak muncul sebagai laporan pribadi Orang Tua. Riwayat audit disimpan lokal maksimal 200 catatan; belum menjadi audit trail server.

## Verifikasi

```powershell
node --test lib/auth.test.mjs lib/parent.test.mjs lib/portals.test.mjs
npm run lint
npm run build
```

26 pengujian lulus, meliputi migrasi state, seed yang tidak menimpa data, batas daycare, kuota, draf/publikasi, anak aktif, tanggal, catatan admin/caregiver, keputusan legalitas, validasi berkas, serta pemisahan fixture dari perubahan lokal. Pengujian portal diulang setelah penambahan pemulihan tanggal logbook yang rusak dan tetap lulus. Build produksi berhasil menghasilkan seluruh rute portal.

Pengujian browser memakai konteks terpisah agar tidak mengubah data demo pengguna. Alur yang diverifikasi: persetujuan caregiver → aktivasi orang tua; draf tersembunyi → publikasi yang ditinjau → logbook orang tua; laporan orang tua → tanggapan caregiver → penutupan admin; metadata izin caregiver → keputusan admin → hasil caregiver; draf profil bisnis; ulasan dan balasan; serta status administrasi yang bertahan setelah reload. Alur pertama tidak menghasilkan error browser atau permintaan POST.

Pemeriksaan ukuran 320, 390, 768, dan 1440 px dilakukan pada dashboard caregiver, formulir logbook, dokumen, verifikasi admin, dan insiden admin. Overflow navbar ponsel yang ditemukan diperbaiki. Dashboard admin, tinggi navbar 64 px, serta buka/tutup menu dengan Escape juga diperiksa. Tabel memakai scroll horizontal di dalam pembungkusnya.

Implementasi utama: [domain caregiver](../lib/caregiver.js), [domain admin](../lib/admin.js), [pengujian portal](../lib/portals.test.mjs), [shell caregiver](../components/layout/CaregiverShell.js), [shell admin](../components/layout/AdminShell.js).
