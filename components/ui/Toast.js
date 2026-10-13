"use client";

import { CheckCircle2, X, XCircle } from "lucide-react";

export default function Toast({ message, type = "success", open, onClose }) {
  if (!open) return null;
  const success = type === "success";
  return (
    <div role="alert" className={`fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${success ? "bg-[#17634d]" : "bg-[#b42318]"}`}>
      {success ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
      <span className="flex-1">{message}</span>
      <button type="button" aria-label="Tutup notifikasi" onClick={onClose}><X size={18} /></button>
    </div>
  );
}
