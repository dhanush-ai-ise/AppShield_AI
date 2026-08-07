"use client";
import { LucideIcon } from "lucide-react";
import { MODULE_SCORE_CARD } from "@/lib/messages";

function riskLevel(score: number) {
  if (score < 40) return { label: MODULE_SCORE_CARD.riskLabels.low, color: "#22c55e" };
  if (score < 60) return { label: MODULE_SCORE_CARD.riskLabels.moderate, color: "#f59e0b" };
  return { label: MODULE_SCORE_CARD.riskLabels.high, color: "#ef4444" };
}

export default function ModuleScoreCard({
  title,
  icon: Icon,
  percent,
  detail,
}: {
  title: string;
  icon: LucideIcon;
  percent: number; // 0-100
  detail: string;
}) {
  const { label, color } = riskLevel(percent);
  const circumference = 2 * Math.PI * 26;
  const progress = (percent / 100) * circumference;

  return (
    <div className="panel p-4 flex flex-col items-center text-center">
      <div className="flex items-center gap-1.5 self-start text-xs text-slate-600 mb-3">
        <Icon size={13} />
        {title}
      </div>
      <div className="relative w-16 h-16">
        <svg width={64} height={64} viewBox="0 0 64 64" className="-rotate-90">
          <circle cx={32} cy={32} r={26} strokeWidth={6} className="risk-ring-track" fill="none" />
          <circle
            cx={32}
            cy={32}
            r={26}
            strokeWidth={6}
            stroke={color}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-slate-900">
          {percent}%
        </div>
      </div>
      <div className="text-xs font-semibold mt-2" style={{ color }}>
        {label}
      </div>
      <div className="text-[11px] text-slate-500 mt-0.5">{detail}</div>
      <button className="mt-3 w-full text-[11px] py-1.5 rounded-md border border-bg-border text-slate-700 hover:text-slate-900 hover:border-brand/50 transition-colors">
        {MODULE_SCORE_CARD.viewDetails}
      </button>
    </div>
  );
}
