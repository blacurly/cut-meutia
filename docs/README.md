# Dokumentasi Final Project Ayomi

Dokumentasi disusun mengikuti deliverable di panduan teknis. Satu folder untuk setiap deliverable.

| No | Deliverable | Isi | Mulai dari |
| --- | --- | --- | --- |
| 1 | **BRD/PRD** | PRD v1.3: rencana produk (v1.2) dan perubahan saat implementasi, termasuk kebutuhan fitur AI | [`01-prd/prd-ayomi.md`](01-prd/prd-ayomi.md) |
| 2 | **User Story, User Flow, Prototype** | Persona dan 30 user story dengan kriteria penerimaan; arsitektur, alur per peran, dan alur fitur AI (diagram Mermaid); tautan prototype | [`02-user-story-flow-prototype/`](02-user-story-flow-prototype/) |
| 3 | **ERD / Schema Diagram** | 66 tabel dan 194 relasi dari skema Supabase production: 3 diagram inti, 13 diagram per domain, file DBML untuk dbdiagram.io, dan gambar PNG | [`03-erd/erd.md`](03-erd/erd.md) |
| 4 | **Script SQL dan Seed Data** | Urutan menjalankan skema, migrasi, dan seed; sumber data katalog 104 daycare | [`04-database/README.md`](04-database/README.md) |
| 5 | **API Documentation** | OpenAPI 3.1 + Swagger UI untuk 86 route / 117 metode, termasuk endpoint AI dengan contoh request dan response | [`05-api/README.md`](05-api/README.md), lalu buka [`05-api/swagger.html`](05-api/swagger.html) |
| 6 | **Dokumentasi Fitur AI** | Use case dan alasannya, model, data, input/output, evaluasi, batasan, risiko, dan Responsible AI; notebook pelatihan; dokumen spesimen fiktif | [`06-fitur-ai/dokumentasi-fitur-ai.md`](06-fitur-ai/dokumentasi-fitur-ai.md) |
| – | **Pengujian (UAT)** | 113 skenario di semua peran, keterlacakan ke PRD, dan masukan peserta | [`07-pengujian/UAT-ayomi.md`](07-pengujian/UAT-ayomi.md) |

**Tautan utama:**
- Website: https://project-ayomi-cut-meutia.vercel.app
- README aplikasi (cara menjalankan dan ringkasan fitur AI): [`../README.md`](../README.md)
- Repository aplikasi: https://github.com/taworld-star/Project-Ayomi_Cut_Meutia
- Repository layanan AI (masing-masing dengan README model, data, API, dan evaluasi):
  - Foto Fokus Anak: https://github.com/taworld-star/ayomi-cv-api
  - OCR dokumen legal: https://github.com/taworld-star/ayomi-ocr-api
  - Triage urgensi insiden: https://github.com/taworld-star/ayomi-triage-api

**Melihat diagram Mermaid:** GitHub menampilkannya langsung. Di VS Code, pasang ekstensi *Markdown Preview Mermaid Support*. Gambar PNG ERD ada di `03-erd/gambar/`.

**Membuat ulang dokumentasi dari kode:** `npm run docs:api` (OpenAPI dan Swagger UI) dan `npm run docs:erd` (ERD per domain dan DBML).
