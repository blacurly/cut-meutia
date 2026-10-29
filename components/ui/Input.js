"use client";

import { useId } from "react";
import { cn } from "./utils";

export default function Input({
  type = "text",
  value,
  onChange,
  placeholder,
  icon,
  iconPosition = "left",
  disabled = false,
  error,
  id,
  className,
  endAdornment,
  prefix,
  "aria-describedby": describedBy,
  ...props
}) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const errorId = `${inputId}-error`;
  const shared = {
    ...props,
    id: inputId,
    value,
    onChange,
    placeholder,
    disabled,
    "aria-invalid": Boolean(error),
    "aria-describedby": [describedBy, error ? errorId : null].filter(Boolean).join(" ") || undefined,
    className: cn(
      "w-full min-w-0 rounded-xl border bg-white px-4 py-3 text-sm text-[#1a2e35] outline-none transition placeholder:text-[#829099] focus:border-[#2a9d8f] focus:ring-2 focus:ring-[#2a9d8f]/15 disabled:bg-slate-100",
      icon && (iconPosition === "left" ? "pl-11" : "pr-11"),
      prefix && "pl-20",
      endAdornment && "pr-12",
      error ? "border-[#e76f51]" : "border-slate-300",
      className,
    ),
  };
  return (
    <div>
      <div className="relative">
        {icon && <span aria-hidden="true" className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-[#71818b] ${iconPosition === "left" ? "left-3" : "right-3"}`}>{icon}</span>}
        {prefix && <span aria-hidden="true" className="pointer-events-none absolute top-1/2 left-10 -translate-y-1/2 border-r border-slate-200 pr-2 text-xs font-medium text-[#556670]">{prefix}</span>}
        {type === "textarea" ? <textarea {...shared} rows={4} /> : <input {...shared} type={type} />}
        {endAdornment && <span className="absolute top-1/2 right-2 -translate-y-1/2">{endAdornment}</span>}
      </div>
      {error && <p id={errorId} className="mt-1.5 text-xs leading-5 text-[#b14731]">{error}</p>}
    </div>
  );
}
