"use client";
/* eslint-disable @next/next/no-img-element -- local blob/data URLs, not optimizable by next/image */

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { ApiRequestError } from "@/lib/api-client";
import { PageHeader, Panel } from "./ParentUI";
import { Feedback } from "./CaregiverUI";
import p from "./Parent.module.css";
import f from "./FocusPhoto.module.css";

// Same size the CV service works at, and small enough for the 4.5 MB body
// limit on Vercel. Re-encoding also drops EXIF (GPS) before upload.
const MAX_SIDE = 1600;
const CLASS_LABEL = { anak: "Anak", dewasa: "Dewasa" };
const FLAG_TEXT = {
  manual_review_required: "Wajib ditinjau sebelum dibagikan.",
  overlap_other_person: "Siluet anak target menempel dengan orang lain. Periksa apakah ada wajah lain yang masih terlihat.",
  multiple_children: "Ada lebih dari satu anak. Pastikan anak yang dipilih sudah benar.",
  low_confidence: "Sebagian deteksi kurang yakin. Periksa siluet dengan teliti.",
  no_person_found: "Tidak ada orang yang terdeteksi.",
  blurry: "Foto tampak buram.",
  small_image: "Resolusi foto kecil.",
};

async function postForm(path, form) {
  const response = await fetch(path, { method: "POST", body: form, credentials: "same-origin", cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiRequestError(payload.error || "Permintaan gagal.", response.status, payload.code);
  return payload;
}

async function shrink(file) {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  const blob = await new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", 0.88));
  return { blob, url: URL.createObjectURL(blob), width, height };
}

function errorText(error) {
  if (error instanceof ApiRequestError) {
    if (error.status === 401) return "Masuk dulu dengan akun Pengasuh, Pengelola, atau Admin.";
    if (error.code === "MODEL_UNAVAILABLE") return "Layanan Foto Fokus Anak belum diatur di server (CV_API_URL / CV_API_TOKEN).";
    if (["PROVIDER_UNAVAILABLE", "PROVIDER_TIMEOUT"].includes(error.code)) return "Layanan AI sedang tidak dapat dihubungi atau masih menyala. Coba lagi sebentar lagi.";
    return error.message;
  }
  return "Koneksi terputus. Periksa jaringan lalu coba lagi.";
}

const points = polygon => polygon.map(([x, y]) => `${x},${y}`).join(" ");

export default function FocusPhotoTrial() {
  const [photo, setPhoto] = useState(null);
  const [segment, setSegment] = useState(null);
  const [target, setTarget] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const input = useRef(null);

  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url); }, [photo]);

  function reset() {
    setPhoto(null); setSegment(null); setTarget(null); setResult(null); setError("");
    input.current?.click();
  }

  async function choose(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(""); setSegment(null); setTarget(null); setResult(null);
    let prepared;
    try {
      prepared = await shrink(file);
    } catch {
      setPhoto(null);
      setError("Foto tidak dapat dibaca. Gunakan JPG, PNG, atau WebP (foto HEIC iPhone ubah ke JPG dulu).");
      return;
    }
    setPhoto(prepared);
    setBusy("segment");
    try {
      const form = new FormData();
      form.append("file", prepared.blob, "foto.jpg");
      const data = await postForm("/api/ai/focus/segment", form);
      setSegment(data);
      setTarget(data.suggested_target_id);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy("");
    }
  }

  async function makeFocus() {
    const person = segment?.people.find(item => item.id === target);
    if (!person) return;
    setBusy("render"); setError(""); setResult(null);
    try {
      const form = new FormData();
      form.append("file", photo.blob, "foto.jpg");
      form.append("target_polygon", JSON.stringify(person.polygon));
      setResult(await postForm("/api/ai/focus/render", form));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy("");
    }
  }

  function pick(id) {
    if (busy) return;
    setTarget(id); setResult(null);
  }

  const people = segment?.people ?? [];
  const size = segment?.image_size ?? (photo && { width: photo.width, height: photo.height });
  const flags = (result?.quality_flags ?? segment?.quality_flags ?? []).filter(flag => FLAG_TEXT[flag]);

  return (
    <>
      <PageHeader eyebrow="UJI COBA AI · COMPUTER VISION" title="Foto Fokus Anak"
        description="Unggah satu foto kegiatan. AI menandai setiap orang, Anda memilih anak yang ingin difokuskan, lalu latar dan orang lain diburamkan." />
      <div className={p.stack}>
        <p className={p.notice}>
          Uji coba: foto hanya diproses, <strong>tidak disimpan</strong>. Gunakan foto dengan izin orang tua.
          Hasil AI wajib ditinjau sebelum dibagikan.
        </p>

        <Panel>
          <h2 className={p.sectionTitle}>1. Pilih foto</h2>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" onChange={choose} hidden />
          <div className={p.row} style={{ marginTop: 12 }}>
            <button type="button" className={p.button} onClick={() => input.current?.click()} disabled={Boolean(busy)}>
              <Camera size={16} />{photo ? "Ganti foto" : "Pilih foto"}
            </button>
            <span className={p.small}>JPG, PNG, atau WebP. Foto otomatis dikecilkan ke {MAX_SIDE} px dan data lokasi (EXIF) dibuang.</span>
          </div>
        </Panel>

        {photo && (
          <Panel>
            <h2 className={p.sectionTitle}>2. Pilih anak yang difokuskan</h2>
            <p className={p.muted}>
              {busy === "segment" ? "AI sedang mencari orang di foto…"
                : !segment ? "Deteksi belum berhasil."
                : people.length === 0 ? "Tidak ada orang terdeteksi. Foto ini sebaiknya dikirim tanpa fokus otomatis atau diganti."
                : segment.suggested_target_id !== null ? "Hanya ada satu anak, jadi sudah dipilih otomatis. Ketuk siluet lain untuk mengganti."
                : "Ketuk siluet anak yang ingin difokuskan."}
            </p>
            <div className={f.stage} style={{ marginTop: 12 }}>
              <img src={photo.url} alt="Foto yang diunggah" width={photo.width} height={photo.height} />
              {segment && size && (
                <svg className={f.overlay} viewBox={`0 0 ${size.width} ${size.height}`} preserveAspectRatio="none" aria-label="Siluet orang yang terdeteksi">
                  {people.map(person => (
                    <polygon key={person.id} points={points(person.polygon)} role="button" tabIndex={0}
                      aria-label={`${CLASS_LABEL[person.class]} ${person.id + 1}, keyakinan ${Math.round(person.confidence * 100)}%`}
                      aria-pressed={target === person.id}
                      className={`${f.shape} ${person.class === "anak" ? f.child : f.adult} ${target === person.id ? f.selected : ""}`}
                      onClick={() => pick(person.id)}
                      onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); pick(person.id); } }} />
                  ))}
                </svg>
              )}
              {busy === "segment" && <div className={f.dimmed}><span><Loader2 size={20} className={f.spin} /> Mendeteksi…</span></div>}
            </div>
            {people.length > 0 && (
              <div className={f.people} style={{ marginTop: 14 }}>
                {people.map(person => (
                  <button key={person.id} type="button" aria-pressed={target === person.id} onClick={() => pick(person.id)}
                    className={`${p.button} ${target === person.id ? "" : p.secondary}`} disabled={Boolean(busy)}>
                    {CLASS_LABEL[person.class]} {person.id + 1} · {Math.round(person.confidence * 100)}%
                  </button>
                ))}
              </div>
            )}
            {segment && (
              <div className={p.row} style={{ marginTop: 16 }}>
                <button type="button" className={p.button} onClick={makeFocus} disabled={target === null || Boolean(busy)}>
                  {busy === "render" ? <Loader2 size={16} className={f.spin} /> : <Sparkles size={16} />}
                  {busy === "render" ? "Membuat foto fokus…" : "Buat foto fokus"}
                </button>
                <span className={p.small}>
                  {people.length} orang terdeteksi · model {segment.model_version}{segment.latency_ms !== null ? ` · ${segment.latency_ms} ms` : ""}
                </span>
              </div>
            )}
          </Panel>
        )}

        <Feedback error={error} />

        {result && (
          <Panel>
            <div className={p.between}>
              <h2 className={p.sectionTitle}>3. Tinjau hasil</h2>
              <span className={p.badge}><Sparkles size={13} />Dibuat AI · wajib ditinjau</span>
            </div>
            <div className={f.compare} style={{ marginTop: 14 }}>
              <figure>
                <img src={photo.url} alt="Foto asli" width={photo.width} height={photo.height} />
                <figcaption>Asli (tidak pernah dikirim ke Orang Tua)</figcaption>
              </figure>
              <figure>
                <img src={`data:${result.image.mime_type};base64,${result.image.base64}`} alt="Foto fokus anak" width={result.image_size.width} height={result.image_size.height} />
                <figcaption>Versi untuk Orang Tua anak ini · {result.other_people_blurred} orang lain diburamkan</figcaption>
              </figure>
            </div>
            {flags.length > 0 && (
              <ul className={p.stack} style={{ gap: 6, marginTop: 14, paddingLeft: 18, listStyle: "disc" }}>
                {flags.map(flag => <li key={flag} className={p.small}>{FLAG_TEXT[flag]}</li>)}
              </ul>
            )}
            <div className={p.row} style={{ marginTop: 16 }}>
              <button type="button" className={`${p.button} ${p.secondary}`} onClick={reset}><RotateCcw size={16} />Coba foto lain</button>
              <span className={p.small}>model {result.model_version}{result.latency_ms !== null ? ` · ${result.latency_ms} ms` : ""}</span>
            </div>
          </Panel>
        )}
      </div>
    </>
  );
}
