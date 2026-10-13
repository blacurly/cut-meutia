import Card from "./Card";

export default function ProgressBarWithCard({ label, value, color = "#2a9d8f", subtitle }) {
  const safeValue = Math.min(100, Math.max(0, value));
  return (
    <Card color="white">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-semibold text-[#264653]">{label}</span>
        <span className="text-lg font-bold text-[#173b3f]">{safeValue}%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e7efec]" role="progressbar" aria-valuenow={safeValue} aria-valuemin="0" aria-valuemax="100">
        <div className="h-full rounded-full transition-all" style={{ width: `${safeValue}%`, backgroundColor: color }} />
      </div>
      {subtitle && <p className="mt-2 text-xs text-[#60706d]">{subtitle}</p>}
    </Card>
  );
}
