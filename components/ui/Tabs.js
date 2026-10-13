"use client";

export default function Tabs({ tabs, activeTab, onChange }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-[#d8e3e0]" role="tablist">
      {tabs.map((tab) => (
        <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} onClick={() => onChange(tab.id)} className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${activeTab === tab.id ? "border-[#2a9d8f] text-[#17634d]" : "border-transparent text-[#77908a] hover:text-[#264653]"}`}>
          {tab.label}
        </button>
      ))}
    </div>
  );
}
