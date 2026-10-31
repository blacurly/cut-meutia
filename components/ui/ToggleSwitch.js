"use client";

export default function ToggleSwitch({ checked, onChange, disabled = false, label = "Aktifkan pilihan" }) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 rounded-full p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2a9d8f] focus-visible:ring-offset-2 disabled:opacity-50 ${checked ? "bg-[#2a9d8f]" : "bg-[#b8c8c4]"}`}
    >
      <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  );
}
