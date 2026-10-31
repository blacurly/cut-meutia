"use client";

import { Star } from "lucide-react";

export default function StarRating({ rating, onChange, readonly = false, size = "md" }) {
  const iconSize = size === "sm" ? 16 : 22;
  return (
    <div className="inline-flex gap-1" role={readonly ? undefined : "radiogroup"} aria-label={`Rating ${rating} dari 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button key={star} type="button" role={readonly ? undefined : "radio"} aria-checked={readonly ? undefined : star === rating} tabIndex={readonly ? -1 : star === (rating || 1) ? 0 : -1} disabled={readonly} onClick={() => onChange?.(star)} onKeyDown={(event) => { const next = event.key === "ArrowRight" || event.key === "ArrowUp" ? Math.min(5, star + 1) : event.key === "ArrowLeft" || event.key === "ArrowDown" ? Math.max(1, star - 1) : event.key === "Home" ? 1 : event.key === "End" ? 5 : null; if (next) { event.preventDefault(); onChange?.(next); event.currentTarget.parentElement.querySelectorAll('button')[next - 1]?.focus(); } }} aria-label={`${star} bintang`} className={readonly ? "cursor-default" : "rounded p-1 transition-colors hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-[#2a9d8f]"}>
          <Star size={iconSize} fill={star <= rating ? "#e9c46a" : "none"} stroke={star <= rating ? "#b28a2e" : "#b8c8c4"} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
