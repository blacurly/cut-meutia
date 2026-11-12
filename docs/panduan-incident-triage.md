# Panduan pengerjaan: Incident Urgency Triage (fitur AI kedua)

Notebook: [incident-triage-indobert.ipynb](./incident-triage-indobert.ipynb). Kontrak: `incident_triage` di [kontrak AI v1](./kontrak-ai-mvp-v1.json). Kerangka API: [ai-api.md](./ai-api.md).

## 1. Ringkasan keputusan

| Hal | Keputusan |
| --- | --- |
| Fitur | Usulan **prioritas operasional** laporan insiden: `low`, `medium`, `high`, `emergency` |
| Use case Technical Requirement | Predictive ML (klasifikasi ordinal) |
| Model | `indobenchmark/indobert-base-p1` (open source, pre-trained bahasa Indonesia), di-fine-tune di Google Colab |
| Pembanding | Aturan kata kunci dan TF-IDF + Logistic Regression |
| Serving | Hugging Face Space (FastAPI, `POST /triage`), dipanggil server Ayomi dengan token |
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
| 1 | Jalankan notebook **Sesi A** (Sel 1–10, ±30 menit) | Pipeline terbukti berjalan dengan data sintetis |
| 2–3 | Tulis `test_manual.csv` (200 laporan) dan `label_ganda.csv` | Data test manusia |
| 3 | Hitung kappa (Sel 5). Jika < 0,6, perjelas rubrik lalu labeli ulang bagian yang diperdebatkan | Rubrik `v1` disahkan |
| 4 | Opsional: tulis `parafrase.csv` untuk kategori yang lemah | Train lebih beragam |
| 4–5 | Jalankan **Sesi B** (Sel 1–16) | Model, metrik, dan Space |
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

Saat rubrik berubah, naikkan versinya (misalnya `draf-1` menjadi `v1`), lalu samakan `RUBRIC_VERSION` di Sel 2 notebook dan label skenario di Sel 4.

## 4. Menyiapkan data

> **Keputusan tim (12 November 2026): data sintetis saja.** Notebook berjalan dengan `SYNTHETIC_ONLY = True`. File `test_manual.csv` dan `label_ganda.csv` (bagian 4.2–4.3) **tidak wajib**. Yang tetap dikerjakan:
> - rubrik bagian 3 dibahas dan disahkan mentor;
> - uji regresi Sel 10 lolos semua;
> - opsional: `parafrase.csv` (bagian 4.4), untuk menambah variasi gaya bahasa.
>
> Konsekuensinya, angka evaluasi berasal dari variasi kalimat sintetis yang tidak dipakai training, bukan dari laporan nyata. Hal ini **wajib** ditulis sebagai batasan (bagian 7). Bagian 4.2–4.3 tetap disimpan sebagai cara meningkatkan kualitas di masa depan.

Semua file diletakkan di `MyDrive/ayomi-triage/data/`, dalam format CSV UTF-8. Paling mudah membuatnya di Google Sheets, lalu memilih **File → Download → CSV**.

### 4.1 Data sintetis (otomatis)

Notebook (Sel 4) membuat ±3.400 laporan dari 38 skenario yang mengikuti rubrik. Jenis variasinya:
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

Kolomnya `description`, `label_a`, dan `label_b`. Isinya boleh campuran: 200 laporan test ditambah 100 laporan sintetis yang diambil dari output Sel 4.

Dua orang melabeli **secara terpisah, tanpa melihat jawaban satu sama lain**, dengan berpedoman pada rubrik bagian 3.

Notebook menghitung tingkat kesepakatan dan Cohen's kappa:

| Kappa | Arti | Tindakan |
| --- | --- | --- |
| ≥ 0,8 | Sangat baik | Lanjut |
| 0,6–0,8 | Cukup | Diskusikan laporan yang labelnya berbeda, lalu sepakati label final untuk `test_manual.csv` |
| < 0,6 | Rubrik belum jelas | Perjelas rubrik dengan contoh, lalu labeli ulang. **Jangan melatih model dulu** |

### 4.4 Parafrase: `parafrase.csv` (opsional, ±300 baris)

Formatnya sama dengan `test_manual.csv`. Isinya variasi laporan untuk menambah keragaman train, terutama untuk kategori atau gaya yang lemah di analisis bias (Sel 10).

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
3. **Sesi A:** jalankan Sel 1–10. Hasilnya membuktikan pipeline berjalan; angkanya belum boleh dilaporkan.
4. Upload `test_manual.csv`, `label_ganda.csv`, dan opsional `parafrase.csv` ke folder `data/`. Jika `parafrase.csv` ditambahkan, hapus file `models/indobert-triage/SELESAI`.
5. **Sesi B:** jalankan Sel 1–16.

## 6. Kriteria lulus sebelum integrasi

Semua kriteria diukur pada **test manual**. Dalam mode data sintetis saja, kriteria diukur pada **test sintetis**, yaitu variasi kalimat yang tidak dipakai training. Notebook mencetak `ready_for_integration` dan `evaluation_data` di Sel 12.

| Kriteria | Target |
| --- | --- |
| Kappa antar-pelabel | ≥ 0,6 (tidak berlaku dalam mode data sintetis saja) |
| `recall_emergency` | ≥ 0,95 |
| `under_triage` | ≤ 5% |
| `severe_under` (emergency dinilai low atau medium) | 0 |
| Uji regresi (Sel 10) | Semua ✅ |
| `macro_f1` | Lebih tinggi dari kedua baseline |
| Hasil API sama dengan notebook (Sel 16) | `True` |

**Jika belum lulus:**
1. Lihat contoh under-triage (Sel 10) dan analisis bias.
2. Tambah skenario atau parafrase untuk pola yang gagal.
3. Latih ulang.

**Jangan melonggarkan target keselamatan supaya lulus.** Lebih baik fitur ditunda daripada laporan darurat dinilai rendah. Aturan `max` memang membuat sistem tetap aman, tetapi AI yang lemah tidak memberi manfaat.

## 7. Yang dicatat di laporan atau dokumentasi

- **Data:** sumber, jumlah per sumber, cara pembuatan, dan kappa.
- **Hasil evaluasi:** tabel hasil Sel 9 (baseline vs IndoBERT, dan pelapor saja vs sistem `max`) beserta confusion matrix.
- **Analisis bias** per gaya tulisan, panjang laporan, dan sumber data. Selisih antara hasil test sintetis dan test manual **wajib** dilaporkan.
- **Batasan:**
  - **training dan evaluasi hanya memakai data sintetis** dari bank skenario. Angka evaluasi mengukur generalisasi pada kalimat buatan yang belum pernah dilihat model, bukan akurasi pada laporan nyata;
  - laporan sangat singkat dinilai abstain;
  - istilah daerah yang jarang dan laporan dengan beberapa kejadian bisa salah dinilai;
  - model tidak menggantikan penilaian Pengelola maupun tenaga kesehatan.
- **Lisensi:** IndoBERT (IndoNLU, MIT). Data tidak dipublikasikan.

## 8. Integrasi ke Ayomi (setelah lulus)

Bagian ini masih rencana dan belum ada kodenya di project. Database live sudah memiliki tabel dan kolom yang dibutuhkan:
- `incident_ai_analyses`;
- `incident_reports.effective_urgency`, `urgency_source` (`caregiver` / `ai_max` / `manager_override`), dan `needs_urgency_review`;
- `incident_urgency_change_logs`.

1. **Variabel server** (Vercel dan `.env.local`, tanpa awalan `NEXT_PUBLIC_`): `TRIAGE_API_URL` dan `TRIAGE_API_TOKEN`.
2. **Adapter provider** baru di `lib/ai/providers/`, yang memanggil `POST /triage` dengan input kontrak, lalu mengembalikan `result` sebagai output. Semua validasi kontrak di `lib/ai/run.js` dan pemeriksaan di `FEATURES.incident_triage.check` tetap berjalan, misalnya kutipan harus ada di laporan dan rujukan SOP harus dikenal.
3. **Pemicu:** setelah `POST /api/incidents` berhasil dan notifikasi awal tercatat, jalankan triage di belakang layar dengan `after()` dari `next/server`, supaya respons ke pelapor tidak menunggu.
4. **Penyimpanan:**
   - simpan hasil ke `ai_jobs` dan `incident_ai_analyses`;
   - jika `max(pelapor, AI)` lebih tinggi dan belum ada override Pengelola, perbarui `effective_urgency`, set `urgency_source = 'ai_max'`, tulis log perubahan, dan kirim notifikasi kedua ke Pengelola;
   - **jangan pernah menurunkan urgensi**.
5. **SOP:** simpan rubrik bagian 3 sebagai rujukan SOP dengan id `triage-low`, `triage-medium`, `triage-high`, `triage-emergency`, dan `incident-workflow`, lalu kirim di `sop_references`.
6. **UI Pengelola:**
   - badge "Dinaikkan AI" beserta alasan dan kutipan;
   - penanda "Dibuat AI";
   - tombol override dengan alasan wajib;
   - jika `urgency = null`, tampilkan "AI tidak menilai, informasi kurang" beserta daftar `missing_information`.
7. **Kegagalan** (timeout, Space tidur, error): hanya dicatat di `ai_jobs`. Insiden tetap berjalan dengan urgensi pelapor, tanpa pesan error untuk pelapor.

## 9. Checklist

- [ ] Rubrik `draf-1` dibahas tim dan dikirim ke mentor
- [ ] Rubrik disahkan (`v1`) dan `RUBRIC_VERSION` diperbarui
- [ ] Notebook Sel 1–12 berjalan dengan `SYNTHETIC_ONLY = True`: kriteria lulus bagian 6 terpenuhi (`ready_for_integration = True`)
- [ ] (Opsional) `parafrase.csv` untuk kategori yang lemah di analisis bias
- [ ] API berjalan di VM Oracle (`triage.<ip>.sslip.io`), uji API lolos (200/401/422/413, hasil sama dengan notebook)
- [ ] Hasil evaluasi, bias, dan batasan ditulis di dokumentasi
- [ ] Integrasi backend dan UI (bagian 8)
