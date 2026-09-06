"use client";
import clsx from "clsx";
import { ModelBenchmarkEntry } from "@/lib/types";

const MODEL_LABELS: Record<string, string> = {
  random_forest: "Random Forest",
  xgboost: "XGBoost",
  lightgbm: "LightGBM",
  catboost: "CatBoost",
};

export default function ModelComparisonTable({
  results,
  bestModel,
  highlight,
}: {
  results: Record<string, ModelBenchmarkEntry>;
  bestModel: string;
  highlight?: string;
}) {
  const rows = Object.entries(results);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-400 text-xs uppercase tracking-wider border-b border-slate-200/80">
            <th className="py-3 pr-4 font-extrabold">Model</th>
            <th className="py-3 pr-4 font-extrabold">Accuracy</th>
            <th className="py-3 pr-4 font-extrabold">Precision</th>
            <th className="py-3 pr-4 font-extrabold">Recall</th>
            <th className="py-3 pr-4 font-extrabold">F1-Score</th>
            <th className="py-3 pr-4 font-extrabold">ROC AUC</th>
            <th className="py-3 pr-4 font-extrabold">Inference Time</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([key, m]) => {
            const isBest = key === bestModel;
            const isSelected = key === highlight;
            return (
              <tr
                key={key}
                className={clsx(
                  "border-b border-slate-100 transition-colors",
                  isSelected ? "clay-inset-active" : "hover:bg-slate-50/80"
                )}
              >
                <td className={clsx("py-3 pr-4 font-extrabold", isSelected ? "text-violet-700" : "text-slate-900")}>
                  {MODEL_LABELS[key] || key}
                  {isBest && (
                    <span className="ml-2.5 clay-badge-purple text-[10px] font-extrabold px-2.5 py-0.5">
                      Production Best
                    </span>
                  )}
                </td>
                <td className="py-3 pr-4 font-bold text-slate-800">{m.accuracy}%</td>
                <td className="py-3 pr-4 font-bold text-slate-800">{m.precision}%</td>
                <td className="py-3 pr-4 font-bold text-slate-800">{m.recall}%</td>
                <td className="py-3 pr-4 font-extrabold text-emerald-600">{m.f1_score}%</td>
                <td className="py-3 pr-4 font-bold text-slate-800">{m.roc_auc}</td>
                <td className="py-3 pr-4 font-semibold text-slate-600">
                  {m.inference_time_s != null ? `${m.inference_time_s}s` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
