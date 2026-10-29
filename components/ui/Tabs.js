"use client";

import { useId } from "react";
import { cn } from "./utils";

export default function Tabs({ tabs, activeTab, onChange, variant = "underline", label = "Pilihan tab", idPrefix, panelId }) {
  const generatedId = useId();
  const prefix = idPrefix || generatedId;
  const pills = variant === "pills";

  function handleKeyDown(event, index) {
    let nextIndex;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = tabs.length - 1;
    else return;
    event.preventDefault();
    event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[nextIndex]?.focus();
    onChange(tabs[nextIndex].id);
  }

  return (
    <div className={cn("flex gap-1", pills ? "rounded-xl bg-slate-200/60 p-1" : "overflow-x-auto border-b border-[#d8e3e0]")} role="tablist" aria-label={label}>
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          id={`${prefix}-${tab.id}`}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={panelId || tab.panelId}
          tabIndex={activeTab === tab.id ? 0 : -1}
          onKeyDown={(event) => handleKeyDown(event, index)}
          onClick={() => onChange(tab.id)}
          className={cn(
            "inline-flex items-center justify-center gap-1.5 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a9d8f]",
            pills ? "min-h-11 min-w-0 flex-1 rounded-lg px-2 py-2 text-[11px] leading-4 sm:text-xs" : "whitespace-nowrap border-b-2 px-4 py-3 text-sm",
            pills
              ? activeTab === tab.id ? "bg-[#264653] text-white shadow-sm" : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
              : activeTab === tab.id ? "border-[#2a9d8f] text-[#17634d]" : "border-transparent text-[#77908a] hover:text-[#264653]",
          )}
        >
          {tab.icon}<span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
