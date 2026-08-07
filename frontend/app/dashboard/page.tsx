"use client";
import { useEffect, useState } from "react";
import {
  Play, Link2, Upload, Package, Hash, Share2, Download,
  KeyRound, MessageSquareWarning, Code2, ImageIcon, UserCheck,
  FileBadge2, Database, ChevronRight, AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import RiskGauge from "@/components/RiskGauge";
import ModuleScoreCard from "@/components/ModuleScoreCard";
import ModelComparisonTable from "@/components/ModelComparisonTable";
import RiskContributorsChart from "@/components/RiskContributorsChart";
import ScanHistoryChart from "@/components/ScanHistoryChart";
import { api } from "@/lib/api";
import { ScanResult, BenchmarkResponse, Prediction } from "@/lib/types";

function pct(v?: number): number {
  return Math.round((v ?? 0) * 100);
}

type RiskTone = {
  verdictLabel: string;
  accentTextClass: string;
  accentSoftClass: string;
  accentBadgeClass: string;
  recommendationText: string;
  recommendationItems: string[];
  recommendationIcon: "check" | "alert";
};

const MODULE_CARD_CONFIG = [
  { key: "permission_analysis", title: "Permission Analysis", icon: KeyRound },
  { key: "review_analysis", title: "Review Analysis", icon: MessageSquareWarning },
  { key: "apk_static_analysis", title: "APK Static Analysis", icon: Code2 },
  { key: "icon_similarity", title: "Icon Similarity", icon: ImageIcon },
  { key: "developer_reputation", title: "Developer Reputation", icon: UserCheck },
  { key: "certificate_analysis", title: "Certificate Analysis", icon: FileBadge2 },
  { key: "metadata_analysis", title: "Metadata Analysis", icon: Database },
] as const;

function getRiskTone(score: number, prediction: Prediction): RiskTone {
  const normalizedPrediction = prediction.toLowerCase();
  const isSafe = normalizedPrediction === "safe" || score < 40;
  const isSuspicious =
    normalizedPrediction === "suspicious" || (score >= 40 && score < 70);

  if (isSafe) {
    return {
      verdictLabel: "Low Risk",
      accentTextClass: "text-emerald-500",
      accentSoftClass: "from-emerald-50 to-emerald-100/60 border-emerald-200",
      accentBadgeClass: "bg-emerald-100 text-emerald-700",
      recommendationText:
        "This app appears to be safe. You can proceed, but it is still worth verifying the source before installing.",
      recommendationItems: [
        "Verify the app comes from the official source",
        "Check reviews, permissions, and recent updates",
        "Keep Play Protect or device security enabled",
      ],
      recommendationIcon: "check",
    };
  }

  if (isSuspicious) {
    return {
      verdictLabel: "Moderate Risk",
      accentTextClass: "text-amber-500",
      accentSoftClass: "from-amber-50 to-amber-100/60 border-amber-200",
      accentBadgeClass: "bg-amber-100 text-amber-700",
      recommendationText:
        "This app has suspicious indicators. Review the findings carefully before deciding to install it.",
      recommendationItems: [
        "Avoid installing unknown or unverified builds",
        "Verify the developer and package authenticity",
        "Compare with the official store listing first",
      ],
      recommendationIcon: "alert",
    };
  }

  return {
    verdictLabel: "High Risk",
    accentTextClass: "text-red-500",
    accentSoftClass: "from-red-50 to-red-100/60 border-red-200",
    accentBadgeClass: "bg-red-100 text-red-700",
    recommendationText:
      "This app is highly suspicious. We recommend not installing it unless you can independently verify it.",
    recommendationItems: [
      "Avoid installing unknown or unverified apps",
      "Verify developer authenticity before proceeding",
      "Look for the official version from trusted sources",
    ],
    recommendationIcon: "alert",
  };
}

function getPredictionBreakdown(prediction: Prediction, confidence: number) {
  const predictedValue = Math.max(0, Math.min(100, Math.round(confidence)));
  const remainder = 100 - predictedValue;
  const secondary = Math.floor(remainder / 2);
  const tertiary = remainder - secondary;
  const breakdown = {
    Fraudulent: 0,
    Suspicious: 0,
    Safe: 0,
  };

  if (prediction === "Fraudulent") {
    breakdown.Fraudulent = predictedValue;
    breakdown.Suspicious = secondary;
    breakdown.Safe = tertiary;
  } else if (prediction === "Suspicious") {
    breakdown.Suspicious = predictedValue;
    breakdown.Fraudulent = secondary;
    breakdown.Safe = tertiary;
  } else {
    breakdown.Safe = predictedValue;
    breakdown.Suspicious = secondary;
    breakdown.Fraudulent = tertiary;
  }

  return breakdown;
}

function getFlagLevelClass(level: string) {
  const normalizedLevel = level.toLowerCase();
  if (normalizedLevel.includes("moderate")) {
    return "bg-amber-100 text-amber-800";
  }
  if (normalizedLevel.includes("low") || normalizedLevel.includes("safe")) {
    return "bg-emerald-100 text-emerald-800";
  }
  return "bg-red-100 text-red-800";
}

// Demo fallback data
const DEMO_SCAN: ScanResult = {
  scan_id: "demo",
  app_name: "WhatsApp Messenger",
  package_name: "com.whatsapp",
  app_icon: "https://play-lh.googleusercontent.com/bYtqbOcTYOlgc6gqZ2rwb8lptHuwlNE75zYJu6Bn076-hTmvd96HH-6vS0YUAAJXoJNc",
  version: "2.24.11.78",
  developer: "WhatsApp LLC",
  category: "Communication",
  downloads: "5B+",
  rating: 4.2,
  size_mb: 86.7,
  scanned_at: "24 May 2025, 10:30 AM",
  overall_risk_score: 82,
  trust_score: 18,
  prediction: "Fraudulent",
  confidence: 96.3,
  model_used: "LightGBM",
  screenshots: [
    "https://picsum.photos/400/800?random=1",
    "https://picsum.photos/400/800?random=2",
    "https://picsum.photos/400/800?random=3",
    "https://picsum.photos/400/800?random=4",
    "https://picsum.photos/400/800?random=5",
  ],
  module_scores: {
    permission_analysis: { module: "permission_analysis", score: 0.87, reasons: ["23 / 26 permissions flagged"] },
    review_analysis: { module: "review_analysis", score: 0.74, reasons: ["65% fake reviews"] },
    apk_static_analysis: { module: "apk_static_analysis", score: 0.9, reasons: ["Suspicious patterns"] },
    icon_similarity: { module: "icon_similarity", score: 0.93, reasons: ["92% similar to WhatsApp"] },
    developer_reputation: { module: "developer_reputation", score: 0.48, reasons: ["New developer"] },
    certificate_analysis: { module: "certificate_analysis", score: 0.88, reasons: ["Untrusted certificate"] },
    metadata_analysis: { module: "metadata_analysis", score: 0.62, reasons: ["Some anomalies"] },
  },
  top_contributors: [
    { feature: "permission_risk", label: "Dangerous Permissions", impact_percent: 31 },
    { feature: "review_risk", label: "Fake / Spam Reviews", impact_percent: 22 },
    { feature: "icon_similarity_risk", label: "Icon Similarity", impact_percent: 18 },
    { feature: "certificate_risk", label: "Certificate Trust", impact_percent: 14 },
    { feature: "developer_risk", label: "Developer Reputation", impact_percent: 9 },
    { feature: "metadata_risk", label: "Metadata Anomalies", impact_percent: 6 },
  ],
  flag_reasons: [
    { module: "permission_analysis", reason: "Requests 23 dangerous permissions including SMS, Contacts, and Location.", level: "High Risk", score: 0.87 },
    { module: "review_analysis", reason: "65% of reviews are fake or spam based on our AI model.", level: "High Risk", score: 0.74 },
    { module: "icon_similarity", reason: "Icon is 92% similar to WhatsApp. Possible clone application.", level: "High Risk", score: 0.93 },
    { module: "certificate_analysis", reason: "App is signed with an untrusted certificate.", level: "High Risk", score: 0.88 },
  ],
};

const DEMO_BENCHMARK: BenchmarkResponse = {
  best_model: "stacking_ensemble",
  results: {
    random_forest: { accuracy: 94.21, precision: 93.7, recall: 94.8, f1_score: 94.24, roc_auc: 0.96, training_time_s: 12.31, inference_time_s: 0.45 },
    xgboost: { accuracy: 96.31, precision: 96.05, recall: 96.4, f1_score: 96.22, roc_auc: 0.98, training_time_s: 31.12, inference_time_s: 0.62 },
    lightgbm: { accuracy: 97.42, precision: 97.21, recall: 97.6, f1_score: 97.4, roc_auc: 0.99, training_time_s: 23.45, inference_time_s: 0.38 },
    catboost: { accuracy: 96.28, precision: 96.03, recall: 96.3, f1_score: 96.16, roc_auc: 0.98, training_time_s: 28.73, inference_time_s: 0.55 },
    voting_ensemble: { accuracy: 97.91, precision: 97.74, recall: 98.01, f1_score: 97.87, roc_auc: 0.99, training_time_s: null, inference_time_s: 0.71 },
    stacking_ensemble: { accuracy: 98.43, precision: 98.21, recall: 98.5, f1_score: 98.35, roc_auc: 0.99, training_time_s: null, inference_time_s: 0.89 },
  },
};

const HISTORY = [
  { date: "19 May", score: 50 },
  { date: "21 May", score: 74 },
  { date: "22 May", score: 60 },
  { date: "23 May", score: 79 },
  { date: "24 May", score: 82 },
];

export default function DashboardPage() {
  const [scan, setScan] = useState<ScanResult>(DEMO_SCAN);
  const [benchmark, setBenchmark] = useState<BenchmarkResponse>(DEMO_BENCHMARK);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    api
      .scanHistory(1)
      .then((r) => {
        if (r?.scans?.length) {
          setScan(r.scans[0]);
          setIsLive(true);
        }
      })
      .catch(() => {});
    api.getBenchmark().then(setBenchmark).catch(() => {});
  }, []);

  const riskTone = getRiskTone(scan.overall_risk_score, scan.prediction);
  const predictionBreakdown = getPredictionBreakdown(scan.prediction, scan.confidence);
  const selectedModelKey = scan.model_used.toLowerCase().replace(/\s+/g, "_");
  const isBestModel = selectedModelKey === benchmark.best_model;
  const moduleCards = MODULE_CARD_CONFIG.map((config) => {
    const moduleScore = scan.module_scores?.[config.key];
    if (!moduleScore) {
      return null;
    }

    return (
      <ModuleScoreCard
        key={config.key}
        title={config.title}
        icon={config.icon}
        percent={pct(moduleScore.score)}
        detail={moduleScore.reasons?.[0] ?? "No issues reported"}
      />
    );
  }).filter(Boolean);

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 min-h-screen">
        <Topbar
          title="Scan Result"
          subtitle="Comprehensive AI Analysis Report"
        />

        <div className="px-8 py-6 space-y-6">
          <div className="flex items-center justify-between">
            <div></div>
            <a
              href={isLive ? api.downloadPdfReport(scan.scan_id) : undefined}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-brand to-brand-dark text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Download size={15} /> Download PDF Report
            </a>
          </div>

          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-3 space-y-5">
              <div className="panel p-5">
                <h3 className="text-sm font-semibold text-slate-900 mb-4">
                  Scan Input
                </h3>
                <div className="space-y-2">
                  {[
                    { icon: Play, label: "Play Store URL" },
                    { icon: Link2, label: "APK Download URL" },
                    { icon: Upload, label: "Upload APK" },
                    { icon: Package, label: "Package Name" },
                    { icon: Hash, label: "APK Hash (SHA256)" },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-bg-panel2 border border-bg-border text-sm text-slate-700"
                    >
                      <item.icon size={15} className="text-slate-500" />{" "}
                      {item.label}
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel p-5">
                <h3 className="text-sm font-semibold text-slate-900 mb-4">
                  Scanned Application
                </h3>
                <div className="flex items-center gap-3 mb-4">
                  {scan.app_icon ? (
                    <img
                      src={scan.app_icon}
                      alt={`${scan.app_name ?? "Scanned application"} icon`}
                      className="w-11 h-11 rounded-xl object-cover bg-bg-panel2 border border-bg-border"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-xl bg-emerald-500 flex items-center justify-center text-white font-bold">
                      {scan.app_name?.[0] ?? "?"}
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      {scan.app_name}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {scan.package_name}
                    </div>
                  </div>
                </div>
                <dl className="space-y-2 text-[11px]">
                  {[
                    ["Version", scan.version],
                    ["Developer", scan.developer],
                    ["Category", scan.category],
                    ["Downloads", scan.downloads],
                    [
                      "Rating",
                      scan.rating ? `${scan.rating} ★` : undefined,
                    ],
                    ["Size", scan.size_mb ? `${scan.size_mb} MB` : undefined],
                    ["Scanned At", scan.scanned_at],
                  ].map(([k, v]) =>
                    v ? (
                      <div key={k} className="flex justify-between">
                        <dt className="text-slate-500">{k}</dt>
                        <dd className="text-slate-800 font-medium">{v}</dd>
                      </div>
                    ) : null
                  )}
                </dl>
              </div>
            </div>

            <div className="col-span-6 panel p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate-900">
                  Overall Verdict
                </h3>
                <button className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 border border-bg-border rounded-lg px-2.5 py-1">
                  <Share2 size={12} /> Share
                </button>
              </div>
              <div className="grid grid-cols-[112px,1fr] gap-4 items-center">
                <RiskGauge score={scan.overall_risk_score} size={112} />
                <div className="space-y-3">
                  <div>
                    <div className={`text-xl font-bold ${riskTone.accentTextClass}`}>
                      {riskTone.verdictLabel}
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                      This application is likely{" "}
                      <span className={`font-semibold ${riskTone.accentTextClass}`}>
                        {scan.prediction}
                      </span>
                    </p>
                  </div>
                  <div>
                    <div className="h-2 rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 to-red-600 relative">
                      <div
                        className="absolute -top-1 w-2 h-4 bg-white rounded-full"
                        style={{
                          left: `calc(${Number(scan.overall_risk_score)}% - 4px)`,
                        }}
                      />
                    </div>
                    <div className="grid grid-cols-4 text-[10px] text-slate-500 mt-1.5">
                      <span className="text-left">Low Risk</span>
                      <span className="text-center">Moderate Risk</span>
                      <span className="text-center">High Risk</span>
                      <span className="text-right">Critical Risk</span>
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Confidence Score:{" "}
                    <span className="text-slate-800 font-medium">
                      {scan.confidence}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-span-3 space-y-5">
              <div className="panel p-5">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">
                  Model Used{" "}
                  <span className="text-slate-500 font-normal">
                    (Research Mode)
                  </span>
                </h3>
                <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-bg-panel2 border border-bg-border">
                  <span className="text-sm text-slate-900">
                    {scan.model_used}
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded ${
                      isBestModel
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-brand/20 text-brand-light"
                    }`}
                  >
                    {isBestModel ? "Best Performer" : "Selected Model"}
                  </span>
                </div>
              </div>
              <div className="panel p-5">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">
                  Prediction Summary
                </h3>
                <div className="space-y-2 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      Fraudulent
                    </span>
                    <span className="text-slate-800 font-medium">
                      {predictionBreakdown.Fraudulent}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      Suspicious
                    </span>
                    <span className="text-slate-800 font-medium">
                      {predictionBreakdown.Suspicious}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Safe
                    </span>
                    <span className="text-slate-800 font-medium">
                      {predictionBreakdown.Safe}%
                    </span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-bg-border flex justify-between text-xs">
                  <span className="text-slate-500">Prediction</span>
                  <span className={`font-semibold ${riskTone.accentTextClass}`}>
                    {scan.prediction}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div id="risk" className="panel p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">
              Risk Breakdown (By AI Modules)
            </h3>
            <div className="grid grid-cols-7 gap-3">
              {moduleCards}
            </div>
          </div>

          <div className="grid grid-cols-12 gap-5">
            <div id="reports" className="col-span-8 panel p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-900">
                  Model Comparison
                </h3>
                <button className="text-xs text-brand-light flex items-center gap-1 hover:underline">
                  View Full Benchmark Report{" "}
                  <ChevronRight size={12} />
                </button>
              </div>
              <ModelComparisonTable
                results={benchmark.results}
                bestModel={benchmark.best_model}
                highlight={scan.model_used.toLowerCase().replace(/\s+/g, "_")}
              />
            </div>
            <div className="col-span-4 panel p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">
                Top Risk Contributors (Feature Impact)
              </h3>
              <RiskContributorsChart data={scan.top_contributors} />
            </div>
          </div>

          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-4 panel p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">
                App Screenshots
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {scan.screenshots && scan.screenshots.length > 0 ? (
                  scan.screenshots.slice(0, 5).map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt={`Screenshot ${i + 1}`}
                      className="aspect-[9/16] rounded-lg bg-bg-panel2 border border-bg-border object-cover"
                    />
                  ))
                ) : (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="aspect-[9/16] rounded-lg bg-bg-panel2 border border-bg-border flex items-center justify-center text-[10px] text-slate-600"
                    >
                      Screenshot {i + 1}
                    </div>
                  ))
                )}
              </div>
            </div>
            <div id="trends" className="col-span-4 panel p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">
                Risk Score Over Time (History)
              </h3>
              <ScanHistoryChart data={HISTORY} />
            </div>
            <div className="col-span-4 space-y-5">
              <div className="panel p-5">
                <h3 className="text-sm font-semibold text-slate-900 mb-4">
                  Why is this app flagged?
                </h3>
                <div className="space-y-3">
                  {scan.flag_reasons.slice(0, 4).map((f, i) => (
                    <div
                      key={i}
                      className="flex items-start justify-between gap-2"
                    >
                      <p className="text-xs text-slate-700 leading-snug">
                        {f.reason}
                      </p>
                      <span
                        className={`shrink-0 text-[10px] px-2 py-0.5 rounded font-medium ${getFlagLevelClass(
                          f.level
                        )}`}
                      >
                        {f.level}
                      </span>
                    </div>
                  ))}
                </div>
                <button className="mt-4 w-full text-xs py-2 rounded-lg border border-bg-border text-slate-600 hover:text-slate-900 hover:border-brand/50 transition-colors">
                  View Detailed Explanation
                </button>
              </div>
              <div className={`panel p-5 bg-gradient-to-br ${riskTone.accentSoftClass}`}>
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${riskTone.accentBadgeClass}`}
                  >
                    {riskTone.recommendationIcon === "check" ? (
                      <CheckCircle2 size={20} />
                    ) : (
                      <AlertTriangle size={20} />
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">
                      Recommended Action
                    </h4>
                    <p className="text-[11px] text-slate-700 mt-1">
                      {riskTone.recommendationText}
                    </p>
                  </div>
                </div>
                <div className="mt-4 space-y-1.5 text-[11px]">
                  {riskTone.recommendationItems.map((item) => (
                    <div key={item} className="flex items-center gap-2 text-emerald-500">
                      <CheckCircle2 size={14} />
                      <span className="text-slate-700">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
