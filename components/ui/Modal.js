"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "./utils";

const sizes = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl" };

export default function Modal({ open, onClose, size = "md", title, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      <button aria-label="Tutup modal" className="absolute inset-0 bg-[#173b3f]/50" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby={title ? "modal-title" : undefined} className={cn("relative w-full rounded-2xl bg-white p-6 shadow-xl", sizes[size] || sizes.md)}>
        <button type="button" onClick={onClose} aria-label="Tutup" className="absolute right-4 top-4 rounded-lg p-1 text-[#60706d] hover:bg-[#eef6f4]">
          <X size={20} />
        </button>
        {title && <h2 id="modal-title" className="mb-5 pr-8 text-xl font-bold text-[#173b3f]">{title}</h2>}
        {children}
      </div>
    </div>
  );
}
