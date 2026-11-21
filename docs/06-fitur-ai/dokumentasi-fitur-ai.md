# Dokumentasi Fitur AI Ayomi

Disusun mengikuti lima poin wajib dari *Technical Requirement*:
1. use case dan alasannya;
2. model dan alasan pemilihannya;
3. sumber dan jenis data;
4. input dan output;
5. evaluasi, batasan, dan risiko.

Ditambah bagian keamanan integrasi, penanganan kondisi, dan Responsible AI.

**Isi folder ini:**

| Lokasi | Isi |
| --- | --- |
| `dokumentasi-fitur-ai.md` (halaman ini) | Dokumentasi semua fitur AI |
| [`notebooks/foto-fokus-anak-yolo11n-seg.ipynb`](notebooks/foto-fokus-anak-yolo11n-seg.ipynb) | Pelatihan, evaluasi, dan deploy model Foto Fokus Anak (Google Colab) |
| [`notebooks/incident-triage-indobert.ipynb`](notebooks/incident-triage-indobert.ipynb) | Data sintetis, fine-tune IndoBERT, kalibrasi, dan evaluasi triage |
| [`notebooks/safety-score-legal-verification.ipynb`](notebooks/safety-score-legal-verification.ipynb) | Eksperimen rubrik Safety Score dan verifikasi dokumen |
| [`notebooks/safety-score-ocr-awal.ipynb`](notebooks/safety-score-ocr-awal.ipynb) | Pipeline awal OCR untuk validasi legalitas daycare (Oktober 2026, dari repository tim `blacurly/cut-meutia`) |
| [`spesimen-dokumen/`](spesimen-dokumen/README.md) | 16 dokumen legal **fiktif** beserta kunci jawaban, untuk menguji OCR dan Safety Score |

Kode setiap layanan model ada di repository terpisah, masing-masing dengan README yang menjelaskan model, data, cara menjalankan, dan evaluasinya:
- [`ayomi-cv-api`](https://github.com/taworld-star/ayomi-cv-api): Foto Fokus Anak;
- [`ayomi-ocr-api`](https://github.com/taworld-star/ayomi-ocr-api): OCR dokumen legal;
- [`ayomi-triage-api`](https://github.com/taworld-star/ayomi-triage-api): triage urgensi insiden.

## 0. Ringkasan

| Fitur | Use case (brief) | Model / mesin | Tempat di alur produk | Status production |
| --- | --- | --- | --- | --- |
| **Foto Fokus Anak** *(fitur AI utama)* | **Computer Vision** | YOLO11n-seg (Ultralytics, open source, pre-trained COCO), di-fine-tune ke kelas `anak`/`dewasa` | Pengasuh mengunggah foto catatan harian → Orang Tua menerima versi fokus anaknya | Aktif (layanan `ayomi-cv-api`; diuji di production 21 November 2026) |
| Penilaian Urgensi Insiden | **Predictive ML** / klasifikasi | Mesin aturan rubrik `draf-1` v2. IndoBERT (`indobenchmark/indobert-base-p1`, MIT) di-fine-tune sebagai eksperimen, belum lulus | Setiap laporan insiden baru | Aktif (mesin aturan, Dokploy) |
| Baca Dokumen Legalitas | **Computer Vision** (OCR) + model bahasa | RapidOCR PP-OCRv5 Latin (open source) + Qwen (`qwen/qwen3.8-27b`, open-weight) via Groq | Admin memverifikasi dokumen → bukti Safety Score | Aktif (Dokploy + Groq) |
| Draf Catatan Harian | Generatif pendukung | Qwen (`qwen/qwen3.8-27b`) via Groq | Pengasuh menulis catatan harian | Aktif (Groq) |
| Urutan rekomendasi pencarian | **Recommendation System** (rule-based weighted scoring) | Rumus berbobot di server | Katalog `/pencarian` | Aktif |

**Kenapa AI dibutuhkan** (dihubungkan ke problem statement di PRD):
- **Privasi foto anak.** PRD 2.1: "Orang tua membutuhkan kepastian laporan harian anak yang transparan tanpa melanggar privasi anak lain."
  - Foto harian adalah kabar yang paling dinantikan, tetapi foto kelompok membocorkan wajah anak lain. Memburamkan secara manual tidak mungkin dilakukan pengasuh untuk setiap foto. **CV memungkinkan foto dibagikan tanpa melanggar privasi anak lain.**
- **Respons insiden.** PRD 3.2: orang tua ingin "prioritas respons yang jelas"; persona Bu Fiqo mengeluhkan "respon laporan lambat".
  - Laporan insiden ditulis cepat dalam kondisi panik, dan urgensi yang dipilih pelapor bisa terlalu rendah. **Klasifikasi teks memberi lapisan pengaman kedua** yang hanya bisa menaikkan urgensi.
- **Legalitas.** PRD 2.1: orang tua "tidak memiliki tolok ukur keselamatan … dan verifikasi legalitas resmi day care yang terstandarisasi." Admin harus membaca banyak dokumen. **OCR mempercepat pemeriksaan dan menandai ketidakcocokan**, tetapi keputusan tetap di tangan Admin.
- **Beban pengasuh.** PRD 2.1: pengelola "kesulitan … membuat catatan harian secara manual". Draf AI dari catatan singkat mengurangi beban itu, dan pengasuh tetap meninjau isinya.

---

## 1. Foto Fokus Anak (Computer Vision, fitur AI utama)

| Poin | Isi |
| --- | --- |
| Masalah | Foto kegiatan di daycare hampir selalu berisi beberapa anak dan orang dewasa. Mengirim foto apa adanya membagikan wajah anak lain tanpa izin orang tuanya |
| Model | **YOLO11n-seg** (Ultralytics, lisensi AGPL-3.0, sehingga kode layanan yang memakainya ikut dibuka di repository `ayomi-cv-api`), pre-trained COCO, di-fine-tune menjadi 2 kelas: `anak` dan `dewasa`. Dipilih karena ringan (nano) untuk CPU server, memberi **mask segmentasi** (bukan sekadar kotak) sehingga pemburaman rapi, dan ekosistemnya mudah di-deploy |
| Data | **Open Images V7** (Google, lisensi CC BY 4.0 untuk anotasi), mask segmentasi berlabel Boy/Girl (→ anak) dan Man/Woman (→ dewasa), diunduh dengan FiftyOne. Hanya gambar yang **semua** orangnya punya mask berlabel umur yang dipakai. **Train 2.747, validasi 338, uji 300 gambar.** Foto suasana daycare (data domain): **0**, jadi model yang berjalan adalah hasil tahap 1 (`focus-yolo11n-seg-v1-20261111`) |
| Input | Foto JPG/PNG/WebP ≤ 4 MB (tipe dicek dari byte file), lalu polygon anak target yang dipilih pengasuh |
| Output | `/segment`: daftar orang dengan kelas, **confidence**, polygon, dan anak yang disarankan. `/render`: JPEG dengan anak target tajam, sedangkan latar dan orang lain diburamkan atau dipixelate |
| Penyimpanan | Foto asli di bucket privat `logbook-originals`, **dihapus setelah varian ditinjau**. Varian per anak di `logbook-masked`. Metadata di tabel `attachments`, `attachment_variants`, dan `ai_jobs` (lihat ERD) |
| Akses | Orang Tua hanya mendapat signed URL 5 menit untuk varian anaknya sendiri (RLS + kebijakan storage) |
| Penanganan kondisi | Loading saat deteksi dan render. **Tidak ada orang terdeteksi** → "Tidak ada orang terdeteksi. Ganti foto." **Keyakinan rendah** → peringatan "Sebagian deteksi kurang yakin…". Berkas salah → ditolak. Layanan mati → `503 MODEL_UNAVAILABLE`. Batas 30 foto per menit |
| Evaluasi | Set uji 300 foto Open Images (1.142 anak), tidak dipakai untuk training. Metrik meniru kejadian di aplikasi (notebook Sel 7 dan 13); hasil lengkap di tabel di bawah |
| Batasan | Model belum dilatih dengan foto suasana daycare. Siluet orang yang menempel atau bertumpuk dengan anak target bisa ikut tajam (kebocoran 62%). Usia ditebak dari penampilan, tanpa pengenalan wajah. Remaja atau orang dewasa bertubuh kecil bisa salah kelas. Pengasuh **wajib meninjau** sebelum foto terkirim |
| Bias | Kelompok yang perlu diuji: warna kulit, pencahayaan redup, hijab atau penutup kepala, anak sebagian tertutup, kerumunan. **Belum diuji**: evaluasi per kelompok di notebook (Sel 14) membutuhkan foto daycare berizin, dan data itu belum ada. Sampai diuji, pengamannya adalah tinjauan wajib oleh pengasuh |

**Hasil evaluasi Foto Fokus Anak** (set uji 300 foto, 1.142 anak; `metrics.json` di repo model Hugging Face):

| Metrik | Arti | YOLO11n-seg COCO (tanpa training) | Model Ayomi | Target |
| --- | --- | --- | --- | --- |
| Anak bisa difokuskan (`target_found`) | Siluet prediksi cocok dengan siluet asli (IoU ≥ 0,5) | 92,7% | 90,8% | ≥ 95% |
| Kerapian siluet (`target_iou`) | Rata-rata IoU siluet anak | 0,80 | 0,78 | ≥ 0,85 |
| Ketepatan kelas (`class_acc`) | Membedakan anak dan dewasa | tidak bisa (COCO hanya "person") | **97,5%** | setinggi mungkin |
| Deteksi orang palsu (`false_people`) | Deteksi tanpa pasangan orang asli | 738 | **565** | serendah mungkin |
| Kebocoran (`leak_rate`) | % foto berisi > 1 orang yang masih menyisakan > 5% tubuh orang lain tajam | 64% | 62% | serendah mungkin |

**Kesimpulan:** fine-tune menambah kemampuan membedakan anak dan dewasa (97,5%) dan mengurangi deteksi palsu 23%, tetapi kemampuan menemukan dan merapikan siluet anak sedikit di bawah model dasar dan belum mencapai target. Karena kebocoran masih tinggi, **pengasuh wajib meninjau dan menyetujui** setiap versi fokus; tidak ada foto yang dikirim otomatis. Langkah berikutnya adalah tahap 2 dengan foto daycare berizin (notebook Sel 9–12).


## 2. Penilaian Urgensi Insiden (klasifikasi teks)

| Poin | Isi |
| --- | --- |
| Masalah | Laporan ditulis cepat dan urgensi pelapor bisa terlalu rendah. Kasus darurat tidak boleh menunggu |
| Mesin di production | **Mesin aturan rubrik `draf-1` v2** (`ayomi-triage-api`, FastAPI, Dokploy). Membaca normalisasi bahasa informal dan salah ketik, negasi ("tidak muntah"), pengandaian, serta mengabaikan perintah di dalam laporan |
| Model eksperimen | **IndoBERT** `indobenchmark/indobert-base-p1` (IndoNLU, MIT), di-fine-tune di Colab menjadi 4 kelas ordinal dengan threshold terkalibrasi. **Belum dipasang** karena belum lulus target keselamatan |
| Data | Train: ±3.400 laporan **sintetis** dari 38 skenario rubrik. Kalibrasi dan test: `test_manual.csv`, 204 laporan fiktif tulisan LLM dengan gaya beragam (⅓ kalibrasi, ⅔ test = 136). **Bukan laporan pengasuh sungguhan** |
| Input | Uraian, fakta yang diamati, pertolongan pertama, urgensi pelapor, usia anak dalam bulan (**tanpa nama dan tanggal lahir**), rujukan rubrik |
| Output (kontrak v1) | Urgensi usulan (`low`/`medium`/`high`/`emergency` atau abstain), alasan, **kutipan kalimat dari laporan**, informasi yang kurang, aksi operasional |
| Aturan sistem | Urgensi efektif = **max(pelapor, AI)**. AI hanya menaikkan, tidak berlaku lagi setelah override Pengelola, dan setiap kenaikan dicatat serta memicu notifikasi kedua |
| Penanganan kondisi | Pelapor tidak menunggu AI (`after()`). Kegagalan hanya dicatat di `ai_jobs`. Laporan pendek → abstain. Kutipan palsu ditolak database (`ai_evidence_mismatch`). Batas nilai ulang 10 per menit |

**Hasil evaluasi** (136 laporan test, 19 November 2026):

| | macro F1 | Recall darurat | Under-triage | Darurat dinilai rendah/sedang | Over-triage |
| --- | --- | --- | --- | --- | --- |
| IndoBERT | 0,548 | 0,53 | 17% | 2,2% | 29% |
| Mesin aturan v2 | 0,750 | 0,72 | 16,2% | 2,2% | 8,8% |
| Pelapor saja | 0,787 | 0,81 | 13,2% | 0 | 8,1% |
| **Sistem max(pelapor, aturan v2)** | **0,803** | **0,91** | **3,7%** | **0** | 16,2% |

Target keselamatan:
- **Recall darurat ≥ 0,95: belum tercapai** (0,91).
- **Under-triage ≤ 5%: tercapai** (3,7%).
- **Darurat dinilai rendah/sedang = 0: tercapai**.

Evaluasi tambahan: 3.420 laporan sintetis (recall darurat 1,0, tetapi ini hanya kecocokan template, bukan akurasi) dan 15/15 uji regresi.

**Analisis kesalahan** (pola yang masih terlewat): leher terlilit tali dengan wajah ungu, tertinggal di mobil, bintik ungu pada kulit, demam disertai mengigau, dan dehidrasi berat.

**Batasan:**
- Data uji adalah tulisan LLM.
- 136 laporan terlalu sedikit untuk angka yang presisi.
- Rubrik belum disahkan mentor.
- Penilaian ini **bukan diagnosis medis**.

## 3. Baca Dokumen Legalitas (OCR + model bahasa)

| Poin | Isi |
| --- | --- |
| Model | **RapidOCR** (PP-OCRv5 Latin, Apache-2.0, `ayomi-ocr-api`). PDF yang punya lapisan teks dibaca tanpa OCR. Lalu **Qwen** via Groq untuk memetakan teks ke isian kontrak `legal_verification` |
| Data | Dokumen spesimen **fiktif** buatan tim (3 daycare × 5 jenis dokumen, dengan kunci jawaban). Tidak memakai dokumen daycare sungguhan |
| Input | Berkas dokumen yang diunggah Pengelola (PDF/JPG/PNG ≤ 15 MB) + isian Pengelola (nomor, tanggal) |
| Output | Isian usulan (nomor, penerbit, tanggal terbit dan berlaku, nama, alamat) dengan **kutipan per halaman**, isian yang hilang, masalah (kedaluwarsa, nomor berbeda, nama tidak ditemukan, kalimat perintah ke AI), dan kualitas scan |
| Pengaman | Hash SHA-256 berkas harus sama dengan catatan unggahan (`409 SOURCE_CHANGED`). Kutipan dan nilai harus ada di teks OCR; jika tidak, isian dikosongkan. Hanya Admin yang bisa mencatat hasilnya. Batas 6 per menit |
| Evaluasi | 19 November 2026, pada dokumen spesimen: **tidak ada nilai salah yang lolos**, isian yang tidak terbaca dikosongkan, waktu baca 2–33 detik per dokumen. Ketepatan OCR per isian (21 November 2026) ada di tabel di bawah |
| Batasan | Scan buram atau miring menurunkan kualitas. Kuota gratis Groq bisa habis (`RATE_LIMITED`). Keputusan tetap di tangan Admin |

**Ketepatan OCR per isian** (layanan OCR production, 21 November 2026, 16 berkas spesimen fiktif: 15 PDF dan 1 hasil scan JPG, semua dibaca dengan OCR; alat: `ayomi-ocr-api/tools/evaluate.py`):

| Isian | Terbaca tepat |
| --- | --- |
| Nomor dokumen | 10/10 |
| Nama lembaga | 16/16 |
| Penerbit | 16/16 |
| Tanggal terbit | 13/13 |
| Tanggal berlaku | 10/10 |
| Alamat | 15/16 |
| **Total** | **80/81 (99%)** |

Waktu OCR 3,4–14,1 detik per dokumen; yang paling lama adalah sertifikat staf 3–5 halaman. Satu isian yang terlewat adalah alamat pada registrasi usaha Pelangi Biru.

## 4. Draf Catatan Harian (Logbook Drafter)

| Poin | Isi |
| --- | --- |
| Model | `qwen/qwen3.8-27b` via Groq, prompt `logbook-draft-v2`. Dipilih setelah dibandingkan dengan `openai/gpt-oss-120b` pada catatan makan, tidur, dan bermain, serta uji *prompt injection*: semua fakta terpakai, ±0,5–1,5 detik, dan instruksi di dalam catatan diabaikan |
| Input | Catatan pengasuh (maksimal 30 fakta, satu per baris) + detail makan dan tidur, dibaca dari database (bukan dari browser) |
| Output | Judul dan isi untuk Orang Tua, dengan indeks fakta yang dipakai. Tidak boleh menambah fakta |
| Pengaman | Hanya pengasuh yang **sedang ditugaskan**. Fakta harus berasal dari catatan (diperiksa server). Batas 10 per menit. Job dicatat di `ai_jobs` |
| UI | Tombol **Buat draf AI**, loading, usulan berlabel AI, **Pakai draf ini** atau **Buang**. Pengasuh tetap mengedit sebelum mengirim |
| Evaluasi | Uji manual pada catatan makan, tidur, dan bermain, ditambah uji *prompt injection*: semua fakta terpakai, tidak ada fakta tambahan, instruksi di dalam catatan diabaikan. Ini uji manual, belum evaluasi berbasis dataset. Server juga menolak draf yang memakai indeks fakta di luar catatan |

## 5. Rekomendasi pencarian (rule-based)

Skor dihitung di `lib/daycare-directory.js` (`recommendationScore`):
- daycare **mitra Ayomi** (terverifikasi): skor 100;
- daycare katalog: legalitas (terdaftar 20, sedang ditinjau 5) + rating × 2 + jumlah fasilitas (maksimal 6) × 0,5.

**Pengguna baru** (belum punya riwayat) tetap mendapat urutan dari skor ini. Rekomendasi belum dipersonalisasi per akun. Ini bisa ditulis sebagai rencana ke depan.

## 6. Keamanan integrasi AI

- Semua AI dipanggil dari **Route Handler**. Logika ada di `lib/ai` dan `lib/api`, dan kunci hanya di env server Vercel.
- **Validasi input:** tipe file dari byte, batas ukuran, field terlarang ditolak (`extra="forbid"` di layanan). **Batas frekuensi per akun** dihitung per instance server (catatan: belum global).
- **Validasi output:** kontrak JSON v1. Kutipan atau fakta harus ada di sumber (`EVIDENCE_MISMATCH`).
- **Hanya pengguna yang login dan berwenang** yang bisa memakai AI, dengan peran dicek di server dan database.

## 7. Responsible AI

| Prinsip | Penerapan di Ayomi |
| --- | --- |
| Transparansi | Label "Dibuat AI" atau nama mesin di setiap hasil. Panel triage menampilkan alasan dan kutipan |
| Human-in-the-loop | Draf catatan, versi fokus foto, usulan OCR, dan urgensi AI semuanya usulan. Manusia yang memutuskan dan bisa menolak atau override |
| Keselamatan | Triage hanya boleh **menaikkan**. Notifikasi awal tidak menunggu AI. Gagal → kembali ke penilaian manusia |
| Privasi | Tanpa pengenalan wajah. Foto asli dihapus setelah ditinjau. Data minimal ke AI (usia dalam bulan, tanpa nama). Dokumen spesimen fiktif |
| Bias | Diuji: gaya bahasa informal, salah ketik, dan negasi pada triage (data LLM). Foto Fokus per kelompok **belum diuji** (lihat bagian 1) |
| Bukan nasihat profesional | Triage dan Safety Score adalah **prioritas operasional**, bukan diagnosis medis atau sertifikasi hukum |
