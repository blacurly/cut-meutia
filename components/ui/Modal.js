"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "./utils";

const sizes = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl" };

export default function Modal({ open, onClose, size = "md", title, children, closeLabel = "Tutup" }) {
  const titleId = useId();
  const dialogRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key !== "Tab") return;
      const focusable = [...(dialogRef.current?.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') || [])]
        .filter((element) => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      <button type="button" tabIndex={-1} aria-label={closeLabel} className="absolute inset-0 bg-[#264653]/60" onClick={onClose} />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={title ? titleId : undefined} className={cn("relative max-h-[calc(100svh-3rem)] w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl", sizes[size] || sizes.md)}>
        <button ref={closeRef} type="button" onClick={onClose} aria-label={closeLabel} className="absolute top-3 right-3 flex size-9 items-center justify-center rounded-lg text-[#556670] hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-[#2a9d8f]">
          <X size={18} aria-hidden="true" />
        </button>
        {title && <h2 id={titleId} className="mb-5 pr-8 text-xl font-bold text-[#1a2e35]">{title}</h2>}
        {children}
      </div>
    </div>
  );
}
