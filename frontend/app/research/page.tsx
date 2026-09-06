"use client";
import { useEffect, useState } from "react";
import { RefreshCw, BrainCircuit, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import RiskGauge from "@/components/RiskGauge";
import ModelComparisonTable from "@/components/ModelComparisonTable";
import { api } from "@/lib/api";
import { BenchmarkResponse, ScanResult } from "@/lib/types";
import { RESEARCH } from "@/lib/messages";

const DEMO_BENCHMARK: BenchmarkResponse = {
  best_model: "lightgbm",
  results: {
    lightgbm: { accuracy: 97.42, precision: 97.21, recall: 97.6, f1_score: 97.4, roc_auc: 0.99, training_time_s: 23.45, inference_time_s: 0.38 },
    xgboost: { accuracy: 96.31, precision: 96.05, recall: 96.4, f1_score: 96.22, roc_auc: 0.98, training_time_s: 31.12, inference_time_s: 0.62 },
    catboost: { accuracy: 96.28, precision: 96.03, recall: 96.3, f1_score: 96.16, roc_auc: 0.98, training_time_s: 28.73, inference_time_s: 0.55 },
    random_forest: { accuracy: 94.21, precision: 93.7, recall: 94.8, f1_score: 94.24, roc_auc: 0.96, training_time_s: 12.31, inference_time_s: 0.45 },
  },
};

export default function ResearchModePage() {
  const router = useRouter();
  const [benchmark, setBenchmark] = useState<BenchmarkResponse>(DEMO_BENCHMARK);
  const [latestScan, setLatestScan] = useState<ScanResult | null>(null);
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

    // Try last scan in sessionStorage first
    const currentUsername = api.adminUsername() || "admin";
    if (typeof window !== "undefined") {
      try {
        const lastScanRaw = sessionStorage.getItem("appshield_last_scan");
        if (lastScanRaw) {
          const parsed = JSON.parse(lastScanRaw);
          if (parsed && (!parsed.user_email || parsed.user_email === currentUsername)) {
            setLatestScan(parsed);
          }
        }
      } catch {}
    }

    api
      .scanHistory(1)
      .then((r) => {
        if (r?.scans?.length) setLatestScan(r.scans[0]);
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

  const bestModelKey = benchmark?.best_model || "lightgbm";
  const bestModelResult = benchmark?.results?.[bestModelKey];
  const confusionMatrix = bestModelResult?.confusion_matrix || [
    [100, 0, 0],
    [1, 99, 0],
    [0, 0, 100],
  ];
  const precisionLabel = bestModelResult?.precision != null ? `Prec: ${bestModelResult.precision.toFixed(1)}%` : "Prec: N/A";
  const recallLabel = bestModelResult?.recall != null ? `Rec: ${bestModelResult.recall.toFixed(1)}%` : "Rec: N/A";
  const f1Label = bestModelResult?.f1_score != null ? `F1: ${bestModelResult.f1_score.toFixed(1)}%` : "F1: N/A";

  const activeAppName = latestScan?.app_name || (isLive ? "No Scan Selected" : "Demo Reference");
  const activeIcon = latestScan?.app_icon;
  const activeRisk = latestScan?.overall_risk_score ?? 0;
  const activePred = latestScan?.prediction || "Safe";
  const activeConf = latestScan?.confidence ?? (latestScan ? 100 : 0);

  const riskColorClass = activeRisk >= 70 ? "text-red-500" : activeRisk >= 40 ? "text-amber-500" : "text-emerald-500";
  const riskTitle = activeRisk >= 70 ? "High Risk" : activeRisk >= 40 ? "Moderate Risk" : "Low Risk";

  const moduleScoresList = latestScan?.module_scores
    ? Object.values(latestScan.module_scores).map((m) => {
        const valPct = Math.round(m.score * 100);
        const color = m.score >= 0.7 ? "text-red-500" : m.score >= 0.4 ? "text-amber-500" : "text-emerald-500";
        const labelNames: Record<string, string> = {
          permission_analysis: "Permission Risk",
          review_analysis: "Review Risk",
          apk_static_analysis: "APK Static Risk",
          icon_similarity: "Icon Similarity",
          certificate_analysis: "Certificate Risk",
          metadata_analysis: "Metadata Risk",
          developer_reputation: "Developer Risk",
        };
        return {
          label: labelNames[m.module] || m.module.replace(/_/g, " "),
          value: `${valPct}%`,
          color,
        };
      })
    : [
        { label: "Permission Risk", value: "—", color: "text-slate-400" },
        { label: "Review Risk", value: "—", color: "text-slate-400" },
        { label: "APK Static Risk", value: "—", color: "text-slate-400" },
        { label: "Icon Similarity", value: "—", color: "text-slate-400" },
        { label: "Certificate Risk", value: "—", color: "text-slate-400" },
        { label: "Metadata Risk", value: "—", color: "text-slate-400" },
      ];

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 min-h-screen">
        <Topbar title={RESEARCH.title} subtitle={RESEARCH.subtitle} />

        <div className="px-8 py-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">{!isLive && RESEARCH.demoNote}</p>
              {error ? <p className="ag-error mt-2">{error}</p> : null}
            </div>
            <button
              onClick={handleTrain}
              disabled={training}
              className="clay-btn-purple px-5 py-3 text-xs font-extrabold flex items-center gap-2 shadow-lg disabled:opacity-50"
            >
              {training ? <RefreshCw size={16} className="animate-spin" /> : null}
              {training ? RESEARCH.trainButton.training : RESEARCH.trainButton.default}
            </button>
          </div>

          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-4 space-y-5">
              <div className="panel p-5 flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <img
                    src={activeIcon}
                    alt="App icon"
                    className="w-12 h-12 rounded-2xl object-cover border border-white shadow-sm"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                  <div>
                    <div className="text-base font-extrabold text-slate-900">{activeAppName}</div>
                    <div className="text-[11px] font-semibold text-slate-500">Active Backend Scan</div>
                  </div>
                </div>
              </div>
              <div className="panel p-5 flex items-center gap-5">
                <RiskGauge score={activeRisk} size={110} />
                <div>
                  <div className={`text-xl font-extrabold ${riskColorClass}`}>{riskTitle}</div>
                  <p className="text-xs font-medium text-slate-500 mt-1">This application is likely <span className="text-slate-900 font-bold">{activePred}</span></p>
                  <div className="mt-2 text-[11px] font-semibold text-slate-500">Confidence Score: <span className="text-slate-900 font-extrabold">{activeConf}%</span></div>
                </div>
              </div>
            </div>

            <div id="comparison" className="col-span-5 panel p-6">
              <h3 className="text-base font-extrabold text-slate-900 mb-4">{RESEARCH.comparison}</h3>
              <ModelComparisonTable results={benchmark.results} bestModel={benchmark.best_model} />
            </div>

            <div className="col-span-3 space-y-5">
              <div className="panel p-6">
                <h3 className="text-base font-extrabold text-slate-900 mb-3.5">{RESEARCH.quickSummary}</h3>
                <div className="space-y-2.5 text-[11px]">
                  {moduleScoresList.map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <span className="font-semibold text-slate-500">{item.label}</span>
                      <span className={`${item.color} font-extrabold`}>{item.value}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between text-xs">
                  <span className="font-extrabold text-slate-500">{RESEARCH.overallRiskScore}</span>
                  <span className={`${riskColorClass} font-extrabold`}>{activeRisk} / 100</span>
                </div>
              </div>
            </div>
          </div>

          <div id="benchmark" className="grid grid-cols-12 gap-5">
            <div className="col-span-4 panel p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-extrabold text-slate-900">{RESEARCH.performanceRadar}</h3>
                <button className="clay-btn-soft px-3 py-1 text-[11px] font-bold text-slate-600 hover:text-slate-900">{RESEARCH.allMetrics}</button>
              </div>
              <div className="h-48 flex items-center justify-center text-xs text-slate-500">
                <div className="text-center">
                  <BrainCircuit size={36} className="mx-auto mb-2 text-violet-500" />
                  {RESEARCH.radarPlaceholder}
                </div>
              </div>
            </div>

            <div className="col-span-4 panel p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-extrabold text-slate-900">{RESEARCH.rocCurve}</h3>
                <button className="clay-btn-soft px-3 py-1 text-[11px] font-bold text-slate-600 hover:text-slate-900">{RESEARCH.allMetrics}</button>
              </div>
              <div className="h-48 flex items-center justify-center text-xs text-slate-500">
                <div className="text-center">
                  <BrainCircuit size={36} className="mx-auto mb-2 text-violet-500" />
                  {RESEARCH.rocPlaceholder}
                </div>
              </div>
            </div>

            <div className="col-span-4 panel p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-extrabold text-slate-900 truncate">{RESEARCH.confusionMatrix.titlePrefix} {benchmark.best_model.replace(/_/g, " ")})</h3>
                <button className="text-xs font-bold text-violet-600 flex items-center gap-1 hover:underline shrink-0">
                  {RESEARCH.confusionMatrix.viewFullExplanation}
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2 text-[10px] text-center">
                <div></div>
                <div className="text-slate-400 font-extrabold uppercase">Safe</div>
                <div className="text-slate-400 font-extrabold uppercase">Susp.</div>
                <div className="text-slate-400 font-extrabold uppercase">Fraud</div>

                <div className="text-slate-500 font-extrabold pt-2">Safe</div>
                <div className="p-2.5 rounded-xl clay-badge-green font-extrabold">{confusionMatrix[0]?.[0] ?? 0}</div>
                <div className="p-2.5 rounded-xl clay-inset text-slate-700 font-bold">{confusionMatrix[0]?.[1] ?? 0}</div>
                <div className="p-2.5 rounded-xl clay-inset text-slate-700 font-bold">{confusionMatrix[0]?.[2] ?? 0}</div>

                <div className="text-slate-500 font-extrabold pt-2">Susp.</div>
                <div className="p-2.5 rounded-xl clay-inset text-slate-700 font-bold">{confusionMatrix[1]?.[0] ?? 0}</div>
                <div className="p-2.5 rounded-xl clay-badge-yellow font-extrabold">{confusionMatrix[1]?.[1] ?? 0}</div>
                <div className="p-2.5 rounded-xl clay-inset text-slate-700 font-bold">{confusionMatrix[1]?.[2] ?? 0}</div>

                <div className="text-slate-500 font-extrabold pt-2">Fraud</div>
                <div className="p-2.5 rounded-xl clay-inset text-slate-700 font-bold">{confusionMatrix[2]?.[0] ?? 0}</div>
                <div className="p-2.5 rounded-xl clay-inset text-slate-700 font-bold">{confusionMatrix[2]?.[1] ?? 0}</div>
                <div className="p-2.5 rounded-xl clay-badge-red font-extrabold">{confusionMatrix[2]?.[2] ?? 0}</div>

                <div></div>
                <div className="text-[9px] font-extrabold text-slate-500 mt-2">{precisionLabel}</div>
                <div className="text-[9px] font-extrabold text-slate-500 mt-2">{recallLabel}</div>
                <div className="text-[9px] font-extrabold text-slate-500 mt-2">{f1Label}</div>
              </div>
            </div>
          </div>

          <div id="training" className="grid grid-cols-12 gap-5">
            <div className="col-span-12 panel p-6">
              <h3 className="text-base font-extrabold text-slate-900 mb-4">{RESEARCH.modelInsights.title}</h3>
              <div className="grid grid-cols-4 gap-5 text-[11px]">
                <div className="clay-inset p-4">
                  <p className="text-slate-500 font-semibold mb-1">{RESEARCH.modelInsights.bestOverallModel}</p>
                  <p className="text-violet-700 font-extrabold text-base">{benchmark.best_model.replace(/_/g, " ")}</p>
                  <p className="text-slate-700 font-bold mt-1">{benchmark.results[benchmark.best_model].accuracy}% Accuracy</p>
                </div>
                <div className="clay-inset p-4">
                  <p className="text-slate-500 font-semibold mb-2">{RESEARCH.modelInsights.whyThisModel}</p>
                  <ul className="space-y-1.5 text-slate-700 font-medium">
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 size={13} className="text-emerald-500" />
                      {RESEARCH.modelInsights.reasons.highestAccuracy}
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 size={13} className="text-emerald-500" />
                      {RESEARCH.modelInsights.reasons.bestGeneralization}
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 size={13} className="text-emerald-500" />
                      {RESEARCH.modelInsights.reasons.robustPerformance}
                    </li>
                  </ul>
                </div>
                <div className="clay-inset p-4">
                  <p className="text-slate-500 font-semibold mb-2">{RESEARCH.modelInsights.whenToUseOthers}</p>
                  <ul className="space-y-1.5 text-slate-700 font-medium">
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 size={13} className="text-emerald-500" />
                      {RESEARCH.modelInsights.reasons.randomForest}
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 size={13} className="text-emerald-500" />
                      {RESEARCH.modelInsights.reasons.xgboost}
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 size={13} className="text-emerald-500" />
                      {RESEARCH.modelInsights.reasons.catboost}
                    </li>
                  </ul>
                </div>
                <div className="clay-inset p-4">
                  <p className="text-slate-500 font-semibold mb-1">{RESEARCH.modelInsights.recommendation}</p>
                  <p className="text-slate-700 font-medium leading-relaxed">{RESEARCH.modelInsights.reasons.stackingEnsemble}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
