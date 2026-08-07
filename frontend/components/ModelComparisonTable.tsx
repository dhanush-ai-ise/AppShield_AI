"use client";
import clsx from "clsx";
import { ModelBenchmarkEntry } from "@/lib/types";

const MODEL_LABELS: Record<string, string> = {
  random_forest: "Random Forest",
  extra_trees: "Extra Trees",
  xgboost: "XGBoost",
  lightgbm: "LightGBM",
  catboost: "CatBoost",
  voting_ensemble: "Voting Ensemble",
  stacking_ensemble: "Stacking Ensemble",
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
          <tr className="text-left text-slate-500 text-xs border-b border-bg-border">
            <th className="py-2 pr-4 font-medium">Model</th>
            <th className="py-2 pr-4 font-medium">Accuracy</th>
            <th className="py-2 pr-4 font-medium">Precision</th>
            <th className="py-2 pr-4 font-medium">Recall</th>
            <th className="py-2 pr-4 font-medium">F1-Score</th>
            <th className="py-2 pr-4 font-medium">ROC AUC</th>
            <th className="py-2 pr-4 font-medium">Inference Time</th>
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
                  "border-b border-bg-border/60",
                  isSelected && "bg-brand/5"
                )}
              >
                <td className={clsx("py-2.5 pr-4 font-medium", isSelected ? "text-brand-light" : "text-slate-900")}>
                  {MODEL_LABELS[key] || key}
                  {isBest && (
                    <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-brand/20 text-brand-light">
                      Best
                    </span>
                  )}
                </td>
                <td className="py-2.5 pr-4 text-slate-700">{m.accuracy}%</td>
                <td className="py-2.5 pr-4 text-slate-700">{m.precision}%</td>
                <td className="py-2.5 pr-4 text-slate-700">{m.recall}%</td>
                <td className="py-2.5 pr-4 text-emerald-600 font-medium">{m.f1_score}%</td>
                <td className="py-2.5 pr-4 text-slate-700">{m.roc_auc}</td>
                <td className="py-2.5 pr-4 text-slate-700">
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
