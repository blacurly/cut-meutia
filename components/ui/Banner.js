import { Info, Sparkles, TriangleAlert } from "lucide-react";
import Button from "./Button";

const types = {
  info: { icon: Info, className: "bg-[#eef6f8] text-[#285d6b]" },
  warning: { icon: TriangleAlert, className: "bg-[#fff8e8] text-[#806000]" },
  ai: { icon: Sparkles, className: "bg-[#edf8f4] text-[#17634d]" },
};

export default function Banner({ title, description, ctaText, onCtaClick, type = "info" }) {
  const config = types[type] || types.info;
  const Icon = config.icon;
  return (
    <div className={`flex gap-3 rounded-2xl p-4 ${config.className}`} role="status">
      <Icon className="mt-0.5 shrink-0" size={20} />
      <div className="flex-1">
        <h3 className="font-bold">{title}</h3>
        <p className="mt-1 text-sm opacity-90">{description}</p>
        {ctaText && <Button variant="ghost" size="sm" onClick={onCtaClick}>{ctaText}</Button>}
      </div>
    </div>
  );
}
