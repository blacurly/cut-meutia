"use client";

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
  ...props
}) {
  const shared = {
    value,
    onChange,
    placeholder,
    disabled,
    "aria-invalid": Boolean(error),
    className: cn(
      "w-full rounded-xl border bg-white px-4 py-3 text-sm text-[#173b3f] outline-none transition placeholder:text-[#91a29e] focus:border-[#2a9d8f] focus:ring-2 focus:ring-[#2a9d8f]/20 disabled:bg-[#f1f4f3]",
      icon && (iconPosition === "left" ? "pl-11" : "pr-11"),
      error ? "border-red-400" : "border-[#d8e3e0]",
    ),
    ...props,
  };
  return (
    <div>
      <div className="relative">
        {icon && <span className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-[#77908a] ${iconPosition === "left" ? "left-3" : "right-3"}`}>{icon}</span>}
        {type === "textarea" ? <textarea {...shared} rows={4} /> : <input {...shared} type={type} />}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
