"use client";
/* eslint-disable @next/next/no-img-element -- local blob URL */

// Pick a photo, let the CV service find the people (POST /api/ai/focus/segment),
// and choose the child to keep in focus. Calls onReady({ blob, polygon }).
import { useEffect, useState } from "react";
import { Camera, Image as ImageIcon } from "lucide-react";
import { apiSend } from "@/lib/client-api";
import { ErrorNote, Loading } from "./ui";
import p from "@/components/features/Parent.module.css";
import f from "@/components/features/FocusPhoto.module.css";

const MAX_SIDE = 1600;

async function shrink(file) {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", 0.88));
  return { blob, url: URL.createObjectURL(blob), width: canvas.width, height: canvas.height };
}

export default function PhotoTargetPicker({ onReady, disabled }) {
  const [photo, setPhoto] = useState(null);
  const [segment, setSegment] = useState(null);
  const [target, setTarget] = useState(null);
  const [state, setState] = useState({ busy: false, error: null });
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url); }, [photo]);

  async function choose(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setSegment(null); setTarget(null);
    try {
      const prepared = await shrink(file);
      setPhoto(prepared);
      setState({ busy: true, error: null });
      const form = new FormData();
      form.append("file", prepared.blob, "foto.jpg");
      const data = await apiSend("/api/ai/focus/segment", { form });
      setSegment(data); setTarget(data.suggested_target_id);
      setState({ busy: false, error: null });
    } catch (error) {
      setState({ busy: false, error: error.message === "encode" || error.name === "InvalidStateError" || error.name === "EncodingError" ? "Foto tidak dapat dibaca. Gunakan JPG, PNG, atau WebP (foto HEIC iPhone: atur Kamera ke Paling Kompatibel)." : error });
    }
  }

  const people = segment?.people ?? [];
  const chosen = people.find(person => person.id === target);
  return <div className={p.stack} style={{ gap: 10 }}>
    <div className={p.row}>
      {/* capture="environment" opens the phone's rear camera directly. */}
      <label className={p.button} style={{ cursor: "pointer" }}>
        <Camera size={16} />{photo ? "Ambil foto lagi" : "Ambil foto"}
        <input type="file" accept="image/*" capture="environment" onChange={choose} hidden disabled={disabled} />
      </label>
      <label className={`${p.button} ${p.secondary}`} style={{ cursor: "pointer" }}>
        <ImageIcon size={16} />Pilih dari galeri
        <input type="file" accept="image/*" onChange={choose} hidden disabled={disabled} />
      </label>
    </div>
    <p className={p.small}>Foto dikecilkan ke {MAX_SIDE} px dan data lokasi (EXIF) dibuang sebelum dikirim. AI lalu menandai setiap orang di foto.</p>
    {state.busy && <Loading label="AI mencari anak di foto…" />}
    <ErrorNote error={state.error} />
    {photo && segment && <>
      <p className={p.small}>{people.length === 0 ? "Tidak ada orang terdeteksi. Ganti foto." : "Ketuk siluet anak yang ingin difokuskan (hijau = anak, oranye = dewasa)."}</p>
      <div className={f.stage}>
        <img src={photo.url} alt="Foto kegiatan" width={photo.width} height={photo.height} />
        <svg className={f.overlay} viewBox={`0 0 ${segment.image_size.width} ${segment.image_size.height}`} preserveAspectRatio="none">
          {people.map(person => <polygon key={person.id} points={person.polygon.map(([x, y]) => `${x},${y}`).join(" ")}
            className={`${f.shape} ${person.class === "anak" ? f.child : f.adult} ${target === person.id ? f.selected : ""}`}
            role="button" tabIndex={0} aria-pressed={target === person.id} aria-label={`${person.class} ${person.id + 1}`}
            onClick={() => setTarget(person.id)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setTarget(person.id); } }} />)}
        </svg>
      </div>
      <button type="button" className={p.button} disabled={!chosen || disabled} onClick={() => onReady({ blob: photo.blob, polygon: chosen.polygon })}>Unggah & buat versi fokus</button>
    </>}
  </div>;
}
