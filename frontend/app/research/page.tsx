"use client";
import { useEffect, useState } from "react";
import { RefreshCw, BrainCircuit, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import RiskGauge from "@/components/RiskGauge";
import ModelComparisonTable from "@/components/ModelComparisonTable";
import { api } from "@/lib/api";
import { BenchmarkResponse } from "@/lib/types";
import { RESEARCH } from "@/lib/messages";

const DEMO_BENCHMARK: BenchmarkResponse = {
  best_model: "stacking_ensemble",
  results: {
    lightgbm: { accuracy: 97.42, precision: 97.21, recall: 97.6, f1_score: 97.4, roc_auc: 0.99, training_time_s: 23.45, inference_time_s: 0.38 },
    xgboost: { accuracy: 96.31, precision: 96.05, recall: 96.4, f1_score: 96.22, roc_auc: 0.98, training_time_s: 31.12, inference_time_s: 0.62 },
    catboost: { accuracy: 96.28, precision: 96.03, recall: 96.3, f1_score: 96.16, roc_auc: 0.98, training_time_s: 28.73, inference_time_s: 0.55 },
    random_forest: { accuracy: 94.21, precision: 93.7, recall: 94.8, f1_score: 94.24, roc_auc: 0.96, training_time_s: 12.31, inference_time_s: 0.45 },
    extra_trees: { accuracy: 93.54, precision: 93.01, recall: 93.8, f1_score: 93.4, roc_auc: 0.95, training_time_s: 9.87, inference_time_s: 0.41 },
    voting_ensemble: { accuracy: 97.91, precision: 97.74, recall: 98.01, f1_score: 97.87, roc_auc: 0.99, training_time_s: null, inference_time_s: 0.71 },
    stacking_ensemble: { accuracy: 98.43, precision: 98.21, recall: 98.5, f1_score: 98.35, roc_auc: 0.99, training_time_s: null, inference_time_s: 0.89 },
  },
};

// Demo confusion matrix
const CONFUSION_MATRIX = [
  [492, 7, 1],
  [3, 463, 14],
  [0, 12, 479],
];

export default function ResearchModePage() {
  const router = useRouter();
  const [benchmark, setBenchmark] = useState<BenchmarkResponse>(DEMO_BENCHMARK);
  const [training, setTraining] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getBenchmark()
      .then((r) => {
        setBenchmark(r);
        setIsLive(true);
      })
      .catch(() => {});
  }, []);

  async function handleTrain() {
    setError(null);
    setTraining(true);
    try {
      await api.trainModels();
      const poll = setInterval(async () => {
        const status = await api.trainingStatus();
        if (status.status === "done") {
          clearInterval(poll);
          setTraining(false);
          const r = await api.getBenchmark();
          setBenchmark(r);
          setIsLive(true);
        } else if (status.status === "failed") {
          clearInterval(poll);
          setTraining(false);
        }
      }, 3000);
    } catch (e: any) {
      if (String(e?.message || "").includes("401")) {
        api.logoutAdmin();
        router.push("/login?next=/research");
      } else {
        setError(e.message || "Training failed.");
      }
      setTraining(false);
    }
  }

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 min-h-screen">
        <Topbar title={RESEARCH.title} subtitle={RESEARCH.subtitle} />

        <div className="px-8 py-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">{!isLive && RESEARCH.demoNote}</p>
              {error ? <p className="text-xs text-red-500 mt-2">{error}</p> : null}
            </div>
            <button
              onClick={handleTrain}
              disabled={training}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-brand to-brand-dark text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {training ? <RefreshCw size={15} className="animate-spin" /> : null}
              {training ? RESEARCH.trainButton.training : RESEARCH.trainButton.default}
            </button>
          </div>

          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-4 space-y-5">
              <div className="panel p-5 flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <img
                    src="https://play-lh.googleusercontent.com/bYtqbOcTYOlgc6gqZ2rwb8lptHuwlNE75zYJu6Bn076-hTmvd96HH-6vS0YUAAJXoJNc"
                    alt="App icon"
                    className="w-11 h-11 rounded-xl object-cover bg-bg-panel2 border border-bg-border"
                  />
                  <div>
                    <div className="text-sm font-semibold text-slate-900">WhatsApp Messenger</div>
                    <div className="text-[11px] text-slate-500">From Play Store</div>
                  </div>
                </div>
              </div>
              <div className="panel p-5 flex items-center gap-4">
                <RiskGauge score={82} size={110} />
                <div>
                  <div className="text-xl font-bold text-red-500">High Risk</div>
                  <p className="text-xs text-slate-500 mt-1">This application is likely <span className="text-slate-900 font-medium">Fraudulent</span></p>
                  <div className="mt-2 text-[11px] text-slate-500">Confidence Score: <span className="text-slate-900">96.3%</span></div>
                </div>
              </div>
            </div>

            <div id="comparison" className="col-span-5 panel p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">{RESEARCH.comparison}</h3>
              <ModelComparisonTable results={benchmark.results} bestModel={benchmark.best_model} />
            </div>

            <div className="col-span-3 space-y-5">
              <div className="panel p-5">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">{RESEARCH.quickSummary}</h3>
                <div className="space-y-2 text-[11px]">
                  {[
                    { label: "Permission Risk", value: "87%", color: "red-500" },
                    { label: "Review Risk", value: "74%", color: "red-500" },
                    { label: "APK Static Risk", value: "90%", color: "red-500" },
                    { label: "Icon Similarity", value: "93%", color: "red-500" },
                    { label: "Certificate Risk", value: "88%", color: "red-500" },
                    { label: "Metadata Risk", value: "62%", color: "amber-500" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <span className="text-slate-500">{item.label}</span>
                      <span className={`text-${item.color} font-medium`}>{item.value}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-bg-border flex justify-between text-xs">
                  <span className="text-slate-500">{RESEARCH.overallRiskScore}</span>
                  <span className="text-red-500 font-semibold">82 / 100</span>
                </div>
              </div>
            </div>
          </div>

          <div id="benchmark" className="grid grid-cols-12 gap-5">
            <div className="col-span-4 panel p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-900">{RESEARCH.performanceRadar}</h3>
                <button className="text-xs text-slate-600 hover:text-slate-900">{RESEARCH.allMetrics}</button>
              </div>
              <div className="h-48 flex items-center justify-center text-xs text-slate-500">
                {/* Radar chart placeholder */}
                <div className="text-center">
                  <BrainCircuit size={32} className="mx-auto mb-2 text-slate-600" />
                  {RESEARCH.radarPlaceholder}
                </div>
              </div>
            </div>

            <div className="col-span-4 panel p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-900">{RESEARCH.rocCurve}</h3>
                <button className="text-xs text-slate-600 hover:text-slate-900">{RESEARCH.allMetrics}</button>
              </div>
              <div className="h-48 flex items-center justify-center text-xs text-slate-500">
                {/* ROC curve placeholder */}
                <div className="text-center">
                  <BrainCircuit size={32} className="mx-auto mb-2 text-slate-600" />
                  {RESEARCH.rocPlaceholder}
                </div>
              </div>
            </div>

            <div className="col-span-4 panel p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-900">{RESEARCH.confusionMatrix.titlePrefix} {benchmark.best_model.replace(/_/g, " ")})</h3>
                <button className="text-xs text-brand-light flex items-center gap-1 hover:underline">
                  {RESEARCH.confusionMatrix.viewFullExplanation}
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2 text-[10px] text-center">
                <div></div>
                <div className="text-slate-500 font-medium">Safe</div>
                <div className="text-slate-500 font-medium">Suspicious</div>
                <div className="text-slate-500 font-medium">Fraudulent</div>

                <div className="text-slate-500 font-medium pt-2">Safe</div>
                <div className="p-2 rounded bg-emerald-500/20 text-emerald-500 font-medium border border-emerald-500/30">{CONFUSION_MATRIX[0][0]}</div>
                <div className="p-2 rounded bg-bg-panel2 text-slate-700 border border-bg-border">{CONFUSION_MATRIX[0][1]}</div>
                <div className="p-2 rounded bg-bg-panel2 text-slate-700 border border-bg-border">{CONFUSION_MATRIX[0][2]}</div>

                <div className="text-slate-500 font-medium pt-2">Suspicious</div>
                <div className="p-2 rounded bg-bg-panel2 text-slate-700 border border-bg-border">{CONFUSION_MATRIX[1][0]}</div>
                <div className="p-2 rounded bg-emerald-500/20 text-emerald-500 font-medium border border-emerald-500/30">{CONFUSION_MATRIX[1][1]}</div>
                <div className="p-2 rounded bg-bg-panel2 text-slate-700 border border-bg-border">{CONFUSION_MATRIX[1][2]}</div>

                <div className="text-slate-500 font-medium pt-2">Fraudulent</div>
                <div className="p-2 rounded bg-bg-panel2 text-slate-700 border border-bg-border">{CONFUSION_MATRIX[2][0]}</div>
                <div className="p-2 rounded bg-bg-panel2 text-slate-700 border border-bg-border">{CONFUSION_MATRIX[2][1]}</div>
                <div className="p-2 rounded bg-emerald-500/20 text-emerald-500 font-medium border border-emerald-500/30">{CONFUSION_MATRIX[2][2]}</div>

                <div></div>
                <div className="text-[9px] text-slate-500 mt-2">Precision: 98.43%</div>
                <div className="text-[9px] text-slate-500 mt-2">Recall: 98.50%</div>
                <div className="text-[9px] text-slate-500 mt-2">F1-Score: 98.35%</div>
              </div>
            </div>
          </div>

          <div id="training" className="grid grid-cols-12 gap-5">
            <div className="col-span-12 panel p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">{RESEARCH.modelInsights.title}</h3>
              <div className="grid grid-cols-4 gap-4 text-[11px]">
                <div>
                  <p className="text-slate-500 mb-1">{RESEARCH.modelInsights.bestOverallModel}</p>
                  <p className="text-brand-light font-semibold text-sm">{benchmark.best_model.replace(/_/g, " ")}</p>
                  <p className="text-slate-700 mt-1">{benchmark.results[benchmark.best_model].accuracy}% Accuracy</p>
                </div>
                <div>
                  <p className="text-slate-500 mb-1">{RESEARCH.modelInsights.whyThisModel}</p>
                  <ul className="space-y-1 text-slate-700">
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 size={12} className="text-emerald-500" />
                      {RESEARCH.modelInsights.reasons.highestAccuracy}
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 size={12} className="text-emerald-500" />
                      {RESEARCH.modelInsights.reasons.bestGeneralization}
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 size={12} className="text-emerald-500" />
                      {RESEARCH.modelInsights.reasons.robustPerformance}
                    </li>
                  </ul>
                </div>
                <div>
                  <p className="text-slate-500 mb-1">{RESEARCH.modelInsights.whenToUseOthers}</p>
                  <ul className="space-y-1 text-slate-700">
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 size={12} className="text-emerald-500" />
                      {RESEARCH.modelInsights.reasons.randomForest}
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 size={12} className="text-emerald-500" />
                      {RESEARCH.modelInsights.reasons.xgboost}
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 size={12} className="text-emerald-500" />
                      {RESEARCH.modelInsights.reasons.catboost}
                    </li>
                  </ul>
                </div>
                <div>
                  <p className="text-slate-500 mb-1">{RESEARCH.modelInsights.recommendation}</p>
                  <p className="text-slate-700">{RESEARCH.modelInsights.reasons.stackingEnsemble}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
