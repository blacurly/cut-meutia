# Prototype

| Jenis | Tautan |
| --- | --- |
| **High-fidelity design (Figma)** | https://www.figma.com/design/rKHNinwrfNPStcZ0EZTqMd/Ayomi-Project?node-id=0-1&m=dev |
| **Prototype berjalan (website production)** | https://project-ayomi-cut-meutia.vercel.app |
| **Video demo produk (≤ 3 menit)** | https://youtu.be/9TdnSmbQ2FA?si=Z3dC31BFp773Lilp |

Website production adalah prototype yang sudah terhubung ke database Supabase dan semua fitur AI. Alur yang bisa dicoba per peran ada di [`user-flow.md`](user-flow.md), dan skenario ujinya di [`../07-pengujian/UAT-ayomi.md`](../07-pengujian/UAT-ayomi.md).

## Halaman utama

| Peran | Halaman | Fitur AI yang tampil |
| --- | --- | --- |
| Pengunjung | `/`, `/pencarian`, `/detail/{slug}`, `/bandingkan/hasil` | Safety Score di detail daycare; urutan rekomendasi di pencarian |
| Orang Tua | `/beranda`, `/pendaftaran-anak`, `/status-pendaftaran`, `/catatan-harian`, `/laporan`, `/ulasan`, `/notifikasi`, `/profil` | Foto versi fokus anak sendiri di catatan harian; urgensi insiden |
| Pengasuh | `/pengelola`, `/pengelola/laporan-harian/tambah`, `/pengelola/insiden`, `/pengelola/foto-fokus` | **Foto Fokus Anak**, **draf catatan AI**, triage insiden |
| Pengelola | `/pengelola/pendaftaran`, `/pengelola/staf`, `/pengelola/dokumen`, `/pengelola/profil/edit`, `/pengelola/ulasan` | Panel **Penilaian urgensi** insiden |
| Admin | `/admin`, `/admin/daycare`, `/admin/verifikasi-legal`, `/admin/insiden` | **Baca dokumen dengan AI** (OCR), penilaian Safety Score |

Semua hasil AI diberi label di tampilan, punya status loading, hasil kosong, dan pesan error, dan bisa ditinjau atau ditolak manusia.
