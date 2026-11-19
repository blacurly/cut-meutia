# Panduan pengerjaan: Incident Urgency Triage (fitur AI kedua)

Notebook: [incident-triage-indobert.ipynb](./incident-triage-indobert.ipynb). Kontrak: `incident_triage` di [kontrak AI v1](./kontrak-ai-mvp-v1.json). Kerangka API: [ai-api.md](./ai-api.md).

## 1. Ringkasan keputusan

| Hal | Keputusan |
| --- | --- |
| Fitur | Usulan **prioritas operasional** laporan insiden: `low`, `medium`, `high`, `emergency` |
| Use case Technical Requirement | Predictive ML (klasifikasi ordinal) |
| Model | `indobenchmark/indobert-base-p1` (open source, pre-trained bahasa Indonesia), di-fine-tune di Google Colab |
| Pembanding | Aturan kata kunci dan TF-IDF + Logistic Regression |
| Serving | Repo terpisah `ayomi-triage-api` (FastAPI, `POST /triage`) di Dokploy, dipanggil server Ayomi dengan token. Sebelum model lulus, layanan memakai mesin aturan rubrik dengan kontrak yang sama |
| Aturan aplikasi | `urgensi efektif = max(urgensi pelapor, usulan AI)`. AI hanya bisa **menaikkan** prioritas, dan Pengelola dapat override dengan alasan |

**Yang tidak dilakukan AI:** mendiagnosis, menyebut obat atau dosis, mengubah status insiden, atau menunda notifikasi. Notifikasi awal tetap terkirim tanpa menunggu AI. Jika AI gagal atau abstain, urgensi pelapor tetap dipakai.

**Komponen yang tidak dihasilkan model:** `reason`, `sop_refs`, `operational_actions`, dan `missing_information` disusun oleh kode. `evidence_quotes` adalah kalimat asli laporan, dipilih dengan teknik *occlusion*. Dengan cara ini, semua output bisa dicek ulang oleh server Ayomi.

## 2. Pembagian peran dan jadwal

| Peran | Tugas | Perkiraan beban |
| --- | --- | --- |
| **Pemilik fitur** (1 orang) | Menjalankan notebook, menjaga rubrik dan skenario, menulis laporan evaluasi | Sepanjang pengerjaan |
| **Penulis laporan** (2–3 orang) | Menulis 200 laporan test, opsional juga 300 parafrase | ±4–6 jam per orang |
| **Pelabel** (2 orang, boleh sama dengan penulis) | Melabeli 300 laporan secara terpisah untuk mengukur kesepakatan | ±2 jam per orang |
| **Mentor / pihak daycare** | Mengesahkan rubrik prioritas | 1 kali pertemuan |
| **Backend** | Integrasi ke Ayomi (bagian 8) | Setelah model lolos |

| Hari | Kegiatan | Hasil |
| --- | --- | --- |
| 1 | Bahas draf rubrik (bagian 3) dengan tim, kirim ke mentor | Rubrik `draf-1` |
| 1 | Jalankan notebook **Sesi A** (Sel 1–12, ±30 menit) | Pipeline terbukti berjalan dengan data sintetis |
| 2–3 | Tulis `test_manual.csv` (200 laporan) dan `label_ganda.csv` | Data test manusia |
| 3 | Hitung kappa (Sel 7). Jika < 0,6, perjelas rubrik lalu labeli ulang bagian yang diperdebatkan | Rubrik `v1` disahkan |
| 4 | Opsional: tulis `parafrase.csv` untuk kategori yang lemah | Train lebih beragam |
| 4–5 | Jalankan **Sesi B** (Sel 1–18) | Model, metrik, dan model terpasang di API |
| 5 | Periksa kriteria lulus (bagian 6) | Keputusan siap atau belum siap integrasi |
| 6+ | Integrasi backend dan UI | Fitur aktif di Ayomi |

## 3. Draf rubrik prioritas insiden (`draf-1`)

> **Status: DRAF.** Rubrik ini wajib ditinjau dan disahkan mentor atau pihak daycare sebelum dipakai di produksi. Rubrik ini menentukan **prioritas tindak lanjut operasional**, bukan pedoman medis. Penanganan medis tetap mengikuti SOP daycare dan arahan tenaga kesehatan.

| Level | Arti operasional | Contoh kejadian |
| --- | --- | --- |
| **emergency** | Ancaman langsung terhadap nyawa atau keselamatan anak. Pengelola dan pihak darurat dihubungi **segera** sesuai SOP | Tersedak dengan sulit bernapas atau membiru; tidak sadar atau tidak merespons; kejang; reaksi alergi dengan bengkak wajah/bibir atau sesak; anak tidak ditemukan; anak dijemput atau dibawa pihak yang tidak berwenang; menelan baterai kancing, magnet, obat, atau cairan kimia; benturan kepala diikuti muntah berulang, sangat mengantuk, atau bicara tidak jelas; perdarahan yang tidak berhenti; tenggelam atau terendam |
| **high** | Perlu perhatian Pengelola segera (target ≤ 15 menit) dan kabar ke orang tua secepatnya. Anak mungkin perlu dijemput atau diperiksa tenaga kesehatan | Tersedak yang **sudah teratasi**; demam ≥ 39 °C; benturan kepala dengan benjol tanpa tanda bahaya; muntah atau diare berulang; ruam atau bentol setelah makan **tanpa sesak**; luka sobek atau berdarah yang berhenti setelah ditekan; dugaan cedera tangan/kaki; luka bakar kecil; anak sempat keluar area lalu segera ditemukan; menelan benda kecil lain tanpa gejala; digigit sampai kulit terbuka atau dicakar dekat mata |
| **medium** | Ditangani di tempat, dipantau, dan orang tua diberi kabar pada hari yang sama | Demam ringan (< 39 °C) pada anak ≥ 12 bulan; jatuh dengan lecet kecil; muntah satu kali; mimisan yang berhenti sendiri; digigit atau didorong teman tanpa luka terbuka; batuk pilek tanpa sesak; rewel lama atau menolak makan; ruam popok; memar kecil |
| **low** | Operasional atau ringan, cukup dicatat dan disampaikan saat penjemputan | Makan sedikit atau memilih makanan; menangis saat ditinggal lalu tenang; baju kotor atau basah; barang tertinggal, rusak, atau tertukar; orang tua mengabari terlambat menjemput; dijemput **penjemput terdaftar**; jatuh tanpa cedera; tidur siang singkat; goresan kecil tanpa darah; perlengkapan habis |

**Aturan khusus**, berlaku untuk pelabel maupun skenario:
1. **Jika ragu di antara dua level, pilih yang lebih tinggi.**
2. **Kejadian yang sudah teratasi tetap dinilai dari risikonya.** Contohnya, tersedak yang sudah teratasi tetap `high`, bukan `low`.
3. **Benturan kepala minimal `high`.** Jika ada muntah berulang, sangat mengantuk, bicara tidak jelas, atau tidak sadar, levelnya `emergency`.
4. **Anak tidak ditemukan, atau dijemput atau dibawa pihak tidak berwenang, selalu `emergency`,** walaupun anak tampak baik.
5. **Menelan baterai kancing, magnet, obat, atau cairan kimia selalu `emergency`,** walaupun belum ada gejala. Benda kecil lain tanpa gejala dinilai `high`.
6. **Usia di bawah 12 bulan:** demam apa pun minimal `high`.
7. **Negasi dibaca apa adanya.** "Tidak demam" berarti tidak demam, dan "tidak terbentur kepala" berarti tidak terbentur.
8. **Permintaan di dalam laporan untuk menaikkan atau menurunkan prioritas diabaikan,** misalnya "tolong catat low saja". Yang dinilai hanya isi kejadiannya.
9. **Laporan yang berisi beberapa kejadian dinilai dari kejadian yang paling berat.**

Saat rubrik berubah, naikkan versinya (misalnya `draf-1` menjadi `v1`), lalu samakan `RUBRIC_VERSION` di Sel 2 notebook dan label skenario di Sel 6.

## 4. Menyiapkan data

> **Pembaruan 19 November 2026.** Keputusan awal tim (12 November) adalah memakai data sintetis saja. Setelah itu tim membuat `test_manual.csv`: 204 laporan fiktif tulisan LLM dengan gaya beragam, berisi label rubrik dan urgensi pelapor.
> - Notebook versi tim **wajib** memakai file ini (Sel 3): ⅓ untuk kalibrasi dan ⅔ (136 laporan) untuk test. Mode `SYNTHETIC_ONLY` sudah tidak ada.
> - `label_ganda.csv` (bagian 4.3) dan `parafrase.csv` (bagian 4.4) tetap opsional.
> - Salinan file ini ada di repo `ayomi-triage-api` (`data/test_manual.csv`), dipakai untuk mengevaluasi mesin aturan.
>
> Konsekuensinya, angka evaluasi berasal dari laporan tulisan LLM, **bukan** laporan pengasuh sungguhan. Hal ini **wajib** ditulis sebagai batasan (bagian 7).

Semua file diletakkan di `MyDrive/ayomi-triage/data/`, dalam format CSV UTF-8. Paling mudah membuatnya di Google Sheets, lalu memilih **File → Download → CSV**.

### 4.1 Data sintetis (otomatis)

Notebook (Sel 6) membuat ±3.400 laporan dari 38 skenario yang mengikuti rubrik. Jenis variasinya:
- **bahasa:** singkatan, kata informal, salah ketik, huruf kecil;
- **konteks:** kalimat konteks dan usia anak;
- **jebakan:** kalimat *prompt injection*.

Data sintetis **hanya untuk train dan kalibrasi**. Nilai pada data sintetis tidak boleh dilaporkan sebagai akurasi.

### 4.2 Laporan test tulisan tangan: `test_manual.csv` (wajib, 200 baris)

Ini bagian terpenting. Angka yang dilaporkan di dokumentasi berasal dari data ini.

| Kolom | Wajib | Isi |
| --- | --- | --- |
| `description` | ✅ | Uraian kejadian, ditulis seperti pengasuh menulis di HP |
| `label` | ✅ | `low`, `medium`, `high`, atau `emergency` (huruf kecil, bahasa Inggris) |
| `observed_facts` | | Fakta tambahan, dipisah tanda `\|`. Contoh: `lutut lecet\|tidak menangis` |
| `first_aid_already_done` | | Tindakan yang sudah dilakukan |
| `age_months` | | Usia anak dalam bulan (angka) |
| `caregiver_urgency` | | Urgensi yang menurut penulis akan dipilih pengasuh di form. Isi untuk semua baris atau kosongkan semuanya. Dipakai untuk mengukur manfaat aturan `max` |
| `penulis` | | Inisial penulis, untuk memeriksa variasi gaya |

**Komposisi yang dianjurkan:**

| Level | Jumlah |
| --- | --- |
| emergency | 40 |
| high | 50 |
| medium | 55 |
| low | 55 |

Dari 200 laporan, **minimal 40** sebaiknya merupakan kasus sulit:
- kalimat negasi;
- kejadian yang sudah teratasi;
- laporan sangat singkat atau sangat panjang;
- bahasa campur atau bahasa daerah;
- beberapa kejadian dalam satu laporan;
- kalimat yang meminta prioritas diturunkan.

**Aturan menulis:**
- **Jangan memakai nama asli anak**; ganti dengan `[ANAK]`. Jangan menulis alamat, nomor HP, atau nama daycare asli.
- **Jangan membuat laporan dengan bantuan AI** (ChatGPT, Gemini, dan sejenisnya). Test harus mencerminkan tulisan manusia.
- **Jangan menyalin kalimat dari skenario notebook**; tulis dengan kata-kata sendiri.
- **Bagi penulisan ke 2–3 orang** supaya gaya tulisannya beragam.
- Jika memungkinkan, minta 30–50 contoh laporan dari pengasuh daycare mitra. Tekankan bahwa laporan harus tanpa identitas, dan ceritanya boleh dikarang tetapi realistis.

Contoh isi:

| description | observed_facts | first_aid_already_done | age_months | label | caregiver_urgency |
| --- | --- | --- | --- | --- | --- |
| [ANAK] keselek anggur pas snack, mukanya merah trus agak biru, gak bisa nangis | bibir kebiruan | lagi ditepuk punggungnya sama bu R | 26 | emergency | high |
| td [ANAK] jatoh dr kursi, dahi kejedot lantai, benjol dikit, gak muntah | masih nangis\|mau minum | dikompres es | 34 | high | medium |
| [ANAK] gak mau makan sayur, nasinya cuma habis setengah | ceria | - | 40 | low | low |

### 4.3 Label ganda: `label_ganda.csv` (wajib, minimal 300 baris)

Kolomnya `description`, `label_a`, dan `label_b`. Isinya boleh campuran: 200 laporan test ditambah 100 laporan sintetis yang diambil dari output Sel 6.

Dua orang melabeli **secara terpisah, tanpa melihat jawaban satu sama lain**, dengan berpedoman pada rubrik bagian 3.

Notebook menghitung tingkat kesepakatan dan Cohen's kappa:

| Kappa | Arti | Tindakan |
| --- | --- | --- |
| ≥ 0,8 | Sangat baik | Lanjut |
| 0,6–0,8 | Cukup | Diskusikan laporan yang labelnya berbeda, lalu sepakati label final untuk `test_manual.csv` |
| < 0,6 | Rubrik belum jelas | Perjelas rubrik dengan contoh, lalu labeli ulang. **Jangan melatih model dulu** |

### 4.4 Parafrase: `parafrase.csv` (opsional, ±300 baris)

Formatnya sama dengan `test_manual.csv`. Isinya variasi laporan untuk menambah keragaman train, terutama untuk kategori atau gaya yang lemah di analisis bias (Sel 12).

Parafrase **boleh dibuat dengan bantuan LLM**, asalkan:
- setiap baris dibaca dan labelnya dicek manusia;
- **tidak ada satu pun yang sama dengan laporan test**. Notebook menolak data yang bocor.

Contoh prompt untuk LLM:

```
Tulis ulang laporan insiden daycare berikut dengan gaya pengasuh yang menulis cepat di HP
(boleh singkatan, salah ketik ringan, bahasa campur). Jangan menambah atau mengurangi fakta
kejadian, jangan menambah diagnosis. Ganti nama anak dengan [ANAK]. Buat 5 versi berbeda.
Laporan: "<laporan>"
```

## 5. Menjalankan notebook

1. Buka `docs/incident-triage-indobert.ipynb` di Colab (**File → Upload notebook**) dan pilih runtime **T4 GPU**.
2. Isi Colab Secrets:
   - `HF_TOKEN` dan `HF_READ_TOKEN` (boleh sama dengan fitur Foto Fokus Anak);
   - **`AYOMI_TRIAGE_TOKEN` baru**, berupa string acak minimal 32 karakter. Buat dengan `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`, dan jangan pakai kunci yang sama dengan `AYOMI_CV_TOKEN`.
3. Letakkan `test_manual.csv` di `MyDrive/ayomi-triage/data/`, atau unggah saat Sel 3 memintanya. Opsional: `label_ganda.csv` dan `parafrase.csv` di folder yang sama. Jika `parafrase.csv` ditambahkan, hapus file `models/indobert-triage/SELESAI` agar model dilatih ulang.
4. Jalankan Sel 1–15: training, evaluasi, lalu upload model ke repo privat.
5. Jalankan Sel 16–18 (pasang di API Dokploy, lalu uji) **hanya jika** `READY` di Sel 14 bernilai `True`.

## 6. Kriteria lulus sebelum integrasi

Semua kriteria diukur pada **test manual** (⅔ `test_manual.csv`, 136 laporan). Notebook mencetak `ready_for_integration` dan `evaluation_data` di Sel 14.

| Kriteria | Target |
| --- | --- |
| Kappa antar-pelabel | ≥ 0,6 (hanya jika `label_ganda.csv` ada) |
| `recall_emergency` | ≥ 0,95 |
| `under_triage` | ≤ 5% |
| `severe_under` (emergency dinilai low atau medium) | 0 |
| Uji regresi (Sel 12) | Semua ✅ |
| `macro_f1` | Lebih tinggi dari kedua baseline |
| Hasil API sama dengan notebook (Sel 18) | `True` |

**Jika belum lulus:**
1. Lihat contoh under-triage (Sel 12) dan analisis bias.
2. Tambah skenario atau parafrase untuk pola yang gagal.
3. Latih ulang.

**Hasil 19 November 2026** (136 laporan test yang sama):

| | `macro_f1` | `recall_emergency` | `under_triage` | `severe_under` | Uji regresi |
| --- | --- | --- | --- | --- | --- |
| IndoBERT (Colab tim) | 0,548 | 0,53 | 17% | 2,2% | 13/15 |
| Mesin aturan v2 (`ayomi-triage-api`) | 0,750 | 0,72 | 16,2% | 2,2% | 15/15 |
| Pelapor saja | 0,787 | 0,81 | 13,2% | 0 | — |
| Sistem `max(pelapor, aturan v2)` | 0,803 | 0,91 | 3,7% | 0 | — |

Keduanya **belum lulus**, jadi `MODEL_REPO` jangan diisi dan API tetap memakai mesin aturan. Rincian dan batasan angka mesin aturan ada di README repo `ayomi-triage-api`.

**Jangan melonggarkan target keselamatan supaya lulus.** Lebih baik fitur ditunda daripada laporan darurat dinilai rendah. Aturan `max` memang membuat sistem tetap aman, tetapi AI yang lemah tidak memberi manfaat.

## 7. Yang dicatat di laporan atau dokumentasi

- **Data:** sumber, jumlah per sumber, cara pembuatan, dan kappa.
- **Hasil evaluasi:** tabel hasil Sel 11 (baseline vs IndoBERT, dan pelapor saja vs sistem `max`) beserta confusion matrix.
- **Analisis bias** per gaya tulisan, panjang laporan, dan sumber data. Selisih antara hasil test sintetis dan test manual **wajib** dilaporkan.
- **Batasan:**
  - **training memakai data sintetis** dari bank skenario. Kalibrasi dan test memakai `test_manual.csv`, yaitu laporan fiktif tulisan LLM, **bukan** laporan pengasuh sungguhan, jadi angkanya bukan akurasi pada laporan nyata;
  - laporan sangat singkat dinilai abstain;
  - istilah daerah yang jarang dan laporan dengan beberapa kejadian bisa salah dinilai;
  - model tidak menggantikan penilaian Pengelola maupun tenaga kesehatan.
- **Lisensi:** IndoBERT (IndoNLU, MIT). Data tidak dipublikasikan.

## 8. Integrasi ke Ayomi (sudah dibuat, 19 November 2026)

Integrasi sudah ada di aplikasi dan di layanan `ayomi-triage-api`. Selama model belum lulus bagian 6, layanan memakai **mesin aturan rubrik draf-1** dengan kontrak yang sama, jadi memasang model nanti tidak mengubah aplikasi. Rinciannya ada di [ai-api.md](./ai-api.md) bagian "Incident Urgency Triage".

| Rencana | Wujudnya |
| --- | --- |
| Variabel server | `TRIAGE_API_URL` dan `TRIAGE_API_TOKEN` (Vercel dan `.env.local`, tanpa `NEXT_PUBLIC_`) |
| Adapter provider | `lib/ai/providers/triage-api.js`. Triage tidak pernah dikirim ke model bahasa `AI_*` |
| Pemicu | `after()` di `POST /api/incidents`, setelah laporan dan notifikasi awal tersimpan |
| Penyimpanan | Migrasi `20261120100000_incident_triage.sql`: `ai_jobs`, `incident_ai_analyses`, `max(pelapor, AI)` ditegakkan database, log perubahan, notifikasi kedua ke Pengelola dan Admin, tidak pernah menurunkan, dan tidak lagi setelah override |
| SOP | `TRIAGE_SOP_REFERENCES` di `lib/api/incident-triage.js` (`triage-low` … `triage-emergency`, `incident-workflow`) |
| UI Pengelola dan Admin | Panel **Penilaian urgensi** di daftar insiden: pelapor → dipakai, "dinaikkan otomatis oleh AI", usulan dengan kutipan, penanda "Dibuat AI" beserta mesinnya, abstain, riwayat, nilai ulang, dan override dengan alasan wajib |
| Kegagalan | Hanya dicatat di `ai_jobs`. Laporan tetap memakai urgensi pelapor |

**Memasang model setelah lulus:** jalankan Sel 14–15. Sel 14 menyimpan `triage_config.json` dan tidak lagi menimpa `config.json` model. Lalu ikuti Sel 16: isi `MODEL_REPO`, `HF_READ_TOKEN`, dan `TRIAGE_ENGINE=model` di Dokploy, redeploy, lalu jalankan Sel 17–18.

## 9. Checklist

- [ ] Rubrik `draf-1` dibahas tim dan dikirim ke mentor
- [ ] Rubrik disahkan (`v1`) dan `RUBRIC_VERSION` diperbarui
- [x] Notebook Sel 1–15 dijalankan tim di Colab dengan `test_manual.csv`, dan model diunggah ke repo privat (19 November 2026)
- [ ] Kriteria lulus bagian 6 terpenuhi (`ready_for_integration = True`). Hasil 19 November: belum lulus
- [ ] (Opsional) `parafrase.csv` untuk kategori yang lemah di analisis bias
- [x] API `ayomi-triage-api` dibuat (mesin aturan, uji 200/401/413/422 lolos). Deploy di Dokploy dilakukan pemilik server
- [ ] Model IndoBERT dipasang di API (`MODEL_REPO`), hasil API sama dengan notebook (Sel 18)
- [ ] Hasil evaluasi, bias, dan batasan ditulis di dokumentasi
- [x] Integrasi backend dan UI (bagian 8)
