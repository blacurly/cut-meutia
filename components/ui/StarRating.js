"use client";

import { Star } from "lucide-react";

export default function StarRating({ rating, onChange, readonly = false, size = "md" }) {
  const iconSize = size === "sm" ? 16 : 22;
  return (
    <div className="inline-flex gap-1" role={readonly ? undefined : "radiogroup"} aria-label={`Rating ${rating} dari 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button key={star} type="button" disabled={readonly} onClick={() => onChange?.(star)} aria-label={`${star} bintang`} className={readonly ? "cursor-default" : "transition-transform hover:scale-110"}>
          <Star size={iconSize} fill={star <= rating ? "#f4c95d" : "none"} stroke={star <= rating ? "#d9a928" : "#b8c8c4"} />
        </button>
      ))}
    </div>
  );
}
