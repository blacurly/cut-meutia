"use client";

export default function Dropdown({ options, value, onChange, icon, placeholder = "Pilih opsi" }) {
  return (
    <div className="relative">
      {icon && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#77908a]">{icon}</span>}
      <select value={value} onChange={(event) => onChange(event.target.value)} className={`w-full appearance-none rounded-xl border border-[#d8e3e0] bg-white px-4 py-3 text-sm text-[#173b3f] outline-none focus:border-[#2a9d8f] focus:ring-2 focus:ring-[#2a9d8f]/20 ${icon ? "pl-10" : ""}`}>
        {!value && <option value="">{placeholder}</option>}
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#77908a]">⌄</span>
    </div>
  );
}
