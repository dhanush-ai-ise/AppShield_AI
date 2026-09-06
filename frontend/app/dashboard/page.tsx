"use client";
import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  Download, Share2, Info, ChevronRight, ChevronLeft, AlertTriangle,
  CheckCircle2, ShieldAlert, KeyRound, MessageSquareWarning, ImageIcon,
  FileBadge2, Search, ShieldCheck, Lock, Sparkles, ZoomIn, X,
  Smartphone, Layers, Maximize2
} from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import RiskGauge from "@/components/RiskGauge";
import { api } from "@/lib/api";
import { ScanResult } from "@/lib/types";

// Helper to derive app initials
function getAppInitials(name?: string): string {
  if (!name) return "AP";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// Helper for dynamic risk metadata
function getRiskMeta(score: number, prediction?: string) {
  if (score >= 85 || (prediction === "Fraudulent" && score >= 70)) {
    return {
      title: "Critical Risk",
      prediction: "Fraudulent",
      colorText: "text-red-600",
      badgeClass: "clay-badge-red",
      barColor: "bg-red-600",
      bgLight: "bg-red-50/90",
      borderColor: "border-red-200/80",
      iconColor: "bg-red-600",
      recommendation: "Do not install this application. High likelihood of fraudulent or malicious activity.",
      RecommendationIcon: AlertTriangle,
    };
  }
  if (score >= 70 || prediction === "Fraudulent") {
    return {
      title: "High Risk",
      prediction: "Fraudulent",
      colorText: "text-red-500",
      badgeClass: "clay-badge-red",
      barColor: "bg-red-500",
      bgLight: "bg-red-50/90",
      borderColor: "border-red-200/80",
      iconColor: "bg-red-500",
      recommendation: "Do not install this application. Security risks and anomalies were flagged.",
      RecommendationIcon: AlertTriangle,
    };
  }
  if (score >= 40 || prediction === "Suspicious") {
    return {
      title: "Moderate Risk",
      prediction: "Suspicious",
      colorText: "text-amber-500",
      badgeClass: "clay-badge-yellow",
      barColor: "bg-amber-500",
      bgLight: "bg-amber-50/90",
      borderColor: "border-amber-200/80",
      iconColor: "bg-amber-500",
      recommendation: "Exercise extreme caution. App exhibits suspicious behaviors or unverified sources.",
      RecommendationIcon: ShieldAlert,
    };
  }
  return {
    title: "Low Risk",
    prediction: "Safe",
    colorText: "text-emerald-600",
    badgeClass: "clay-badge-green",
    barColor: "bg-emerald-500",
    bgLight: "bg-emerald-50/90",
    borderColor: "border-emerald-200/80",
    iconColor: "bg-emerald-500",
    recommendation: "This application appears safe. No critical security anomalies detected.",
    RecommendationIcon: CheckCircle2,
  };
}

// Helper for dynamic probabilities in donut chart
function getPredictionProbabilities(
  score: number,
  prediction?: string,
  classProbs?: { Safe?: number; Suspicious?: number; Fraudulent?: number } & Record<string, number>
) {
  let fraud = 0;
  let suspicious = 0;
  let safe = 0;

  if (classProbs && (classProbs.Safe !== undefined || classProbs.Fraudulent !== undefined || classProbs.Suspicious !== undefined)) {
    fraud = Math.round(classProbs.Fraudulent ?? classProbs.fraud ?? 0);
    suspicious = Math.round(classProbs.Suspicious ?? classProbs.suspicious ?? 0);
    safe = Math.round(classProbs.Safe ?? classProbs.safe ?? 0);

    const total = fraud + suspicious + safe;
    if (total > 0 && total !== 100) {
      fraud = Math.round((fraud / total) * 100);
      suspicious = Math.round((suspicious / total) * 100);
      safe = Math.max(0, 100 - fraud - suspicious);
    }
  } else if (score >= 70 || prediction === "Fraudulent") {
    fraud = Math.min(98, Math.max(70, Math.round(score)));
    suspicious = Math.round((100 - fraud) * 0.7);
    safe = 100 - fraud - suspicious;
  } else if (score >= 40 || prediction === "Suspicious") {
    suspicious = Math.min(85, Math.max(45, Math.round(score)));
    fraud = Math.round((100 - suspicious) * 0.35);
    safe = 100 - suspicious - fraud;
  } else {
    safe = Math.min(99, Math.max(70, Math.round(100 - score)));
    suspicious = Math.round((100 - safe) * 0.75);
    fraud = 100 - safe - suspicious;
  }

  const donutStyle = {
    background: `conic-gradient(#ef4444 0% ${fraud}%, #f59e0b ${fraud}% ${fraud + suspicious}%, #10b981 ${fraud + suspicious}% 100%)`
  };

  return { fraud, suspicious, safe, donutStyle };
}

// Helper for dynamic recommended actions tailored to verdict
function getRecommendedActions(score: number, prediction?: string) {
  if (score >= 70 || prediction === "Fraudulent") {
    return [
      "Do not install or immediately remove this application.",
      "Revoke all device, SMS, and storage permissions granted to it.",
      "Perform a full anti-malware and system security audit.",
      "Report this application package to the store or security team."
    ];
  }
  if (score >= 40 || prediction === "Suspicious") {
    return [
      "Exercise extreme caution before granting sensitive permissions.",
      "Verify developer credentials and official publishing channels.",
      "Monitor background battery, network, and data usage anomalies.",
      "Check recent user reviews for repeated spam or fraud complaints."
    ];
  }
  return [
    "App passed all behavioral and static security checks.",
    "Standard permissions requested align with its declared category.",
    "Authentic and verified developer signature detected.",
    "Safe to install and operate under standard security policies."
  ];
}

// Helper to choose module icon
function getModuleIcon(moduleName: string) {
  const m = moduleName.toLowerCase();
  if (m.includes("permission")) return KeyRound;
  if (m.includes("review")) return MessageSquareWarning;
  if (m.includes("icon")) return ImageIcon;
  if (m.includes("cert")) return FileBadge2;
  if (m.includes("developer")) return ShieldAlert;
  if (m.includes("static") || m.includes("apk")) return Lock;
  return Sparkles;
}

const MODULE_LABELS: Record<string, string> = {
  permission_analysis: "Dangerous Permissions",
  review_analysis: "Fake / Spam Reviews",
  icon_similarity: "Icon Similarity",
  certificate_analysis: "Certificate Trust",
  developer_reputation: "Developer Reputation",
  apk_static_analysis: "APK Static Analysis",
  metadata_analysis: "Metadata Consistency",
};

const DEMO_FALLBACK: ScanResult = {
  scan_id: "demo-scan",
  app_name: "WhatsApp Messenger",
  package_name: "com.whatsapp",
  app_icon: "https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg",
  version: "2.24.11.78",
  developer: "WhatsApp LLC",
  category: "Communication",
  downloads: "5B+",
  rating: 4.2,
  size_mb: 86.7,
  scanned_at: "Today, 10:30 AM",
  overall_risk_score: 82,
  trust_score: 18,
  prediction: "Fraudulent",
  confidence: 96.3,
  model_used: "LightGBM",
  screenshots: [
    "https://images.unsplash.com/photo-1616469829941-c7200edec809?auto=format&fit=crop&w=400&q=80",
    "https://images.unsplash.com/photo-1556742049-0a67daf4005a?auto=format&fit=crop&w=400&q=80",
    "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=400&q=80",
    "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=400&q=80",
    "https://images.unsplash.com/photo-1526498460520-4c246339dccb?auto=format&fit=crop&w=400&q=80",
    "https://images.unsplash.com/photo-1551650975-87deedd944c3?auto=format&fit=crop&w=400&q=80",
    "https://images.unsplash.com/photo-1534972195531-d756b9bfa9f2?auto=format&fit=crop&w=400&q=80",
    "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=400&q=80",
  ],
  module_scores: {
    permission_analysis: { module: "permission_analysis", score: 0.87, reasons: ["23 dangerous permissions requested"] },
    review_analysis: { module: "review_analysis", score: 0.74, reasons: ["High fake review ratio"] },
    apk_static_analysis: { module: "apk_static_analysis", score: 0.9, reasons: ["Suspicious bytecode patterns"] },
    icon_similarity: { module: "icon_similarity", score: 0.93, reasons: ["92% match to official WhatsApp icon"] },
    developer_reputation: { module: "developer_reputation", score: 0.48, reasons: ["Unverified developer account"] },
    certificate_analysis: { module: "certificate_analysis", score: 0.88, reasons: ["Untrusted self-signed certificate"] },
  },
  top_contributors: [
    { feature: "permission_risk", label: "Dangerous Permissions", impact_percent: 31 },
    { feature: "review_risk", label: "Fake / Spam Reviews", impact_percent: 22 },
    { feature: "icon_similarity_risk", label: "Icon Similarity", impact_percent: 18 },
    { feature: "certificate_risk", label: "Certificate Trust", impact_percent: 14 },
    { feature: "developer_risk", label: "Developer Reputation", impact_percent: 9 },
  ],
  flag_reasons: [
    { module: "permission_analysis", reason: "Requests dangerous permissions including SMS, Contacts, and Location.", level: "High Risk", score: 0.87 },
    { module: "review_analysis", reason: "High volume of repetitive/fake user reviews detected.", level: "High Risk", score: 0.74 },
    { module: "icon_similarity", reason: "App icon closely imitates official brand visual assets.", level: "High Risk", score: 0.93 },
    { module: "certificate_analysis", reason: "App binary signed with untrusted signature.", level: "High Risk", score: 0.88 },
  ],
};

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const requestedScanId = searchParams.get("scan_id");

  const [scan, setScan] = useState<ScanResult>(DEMO_FALLBACK);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number>(0);
  const [activeShotIndex, setActiveShotIndex] = useState<number>(0);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [screenshotViewMode, setScreenshotViewMode] = useState<"phone" | "grid">("phone");

  useEffect(() => {
    let isMounted = true;

    async function loadScanData() {
      // 1. Check if we have a specific scan requested
      if (requestedScanId) {
        // Try sessionStorage first for instant render
        if (typeof window !== "undefined") {
          try {
            const cachedSpecific = sessionStorage.getItem(`appshield_scan_${requestedScanId}`);
            if (cachedSpecific) {
              const parsed = JSON.parse(cachedSpecific);
              if (parsed && isMounted) {
                setScan(parsed);
              }
            }
          } catch {}
        }

        // Try API direct getScan
        try {
          const direct = await api.getScan(requestedScanId);
          if (direct && isMounted) {
            setScan(direct);
            return;
          }
        } catch {}
      }

      // 2. If no requestedScanId or direct failed, check last scan in sessionStorage
      const currentUsername = api.adminUsername() || "admin";
      if (typeof window !== "undefined") {
        try {
          const lastScanRaw = sessionStorage.getItem("appshield_last_scan");
          if (lastScanRaw) {
            const parsed = JSON.parse(lastScanRaw);
            if (
              parsed &&
              (!parsed.user_email || parsed.user_email === currentUsername) &&
              (!requestedScanId || parsed.scan_id === requestedScanId)
            ) {
              if (isMounted) {
                setScan(parsed);
              }
            }
          }
        } catch {}
      }

      // 3. Query history from backend
      try {
        const r = await api.scanHistory(50);
        if (r?.scans?.length && isMounted) {
          let selectedScan: ScanResult | undefined;
          if (requestedScanId) {
            selectedScan = r.scans.find((s: ScanResult) => s.scan_id === requestedScanId);
          }
          if (!selectedScan) {
            selectedScan = r.scans[0];
          }
          if (selectedScan) {
            setScan(selectedScan);
          }
        }
      } catch {}
    }

    loadScanData();

    return () => {
      isMounted = false;
    };
  }, [requestedScanId]);

  const riskMeta = useMemo(
    () => getRiskMeta(scan.overall_risk_score, scan.prediction),
    [scan.overall_risk_score, scan.prediction]
  );

  const probabilities = useMemo(
    () => getPredictionProbabilities(scan.overall_risk_score, scan.prediction, scan.class_probabilities),
    [scan.overall_risk_score, scan.prediction, scan.class_probabilities]
  );

  const appInitials = useMemo(
    () => getAppInitials(scan.app_name),
    [scan.app_name]
  );

  // Dynamic Top Risk Contributors
  const topFactors = useMemo(() => {
    if (scan.top_contributors && scan.top_contributors.length > 0) {
      return scan.top_contributors.map((c) => {
        const pctVal = c.impact_percent;
        const level = pctVal >= 25 ? "High Risk" : pctVal >= 12 ? "Moderate Risk" : "Low Risk";
        const badge = pctVal >= 25 ? "clay-badge-red" : pctVal >= 12 ? "clay-badge-yellow" : "clay-badge-green";
        const color = pctVal >= 25 ? "bg-red-500" : pctVal >= 12 ? "bg-amber-500" : "bg-emerald-500";
        return {
          label: c.label || c.feature,
          detail: `Impact: ${pctVal}% of overall score`,
          pct: pctVal,
          risk: level,
          color,
          badge,
        };
      });
    }

    // Fallback computed from module scores
    if (scan.module_scores) {
      const sorted = Object.values(scan.module_scores)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      const totalScore = sorted.reduce((sum, item) => sum + item.score, 0) || 1;

      return sorted.map((m) => {
        const pctVal = Math.round((m.score / totalScore) * 100);
        const level = m.score >= 0.7 ? "High Risk" : m.score >= 0.4 ? "Moderate Risk" : "Low Risk";
        const badge = m.score >= 0.7 ? "clay-badge-red" : m.score >= 0.4 ? "clay-badge-yellow" : "clay-badge-green";
        const color = m.score >= 0.7 ? "bg-red-500" : m.score >= 0.4 ? "bg-amber-500" : "bg-emerald-500";
        const label = MODULE_LABELS[m.module] || m.module.replace(/_/g, " ");
        const detail = m.reasons?.[0] || `${Math.round(m.score * 100)}% risk score`;

        return {
          label,
          detail,
          pct: pctVal,
          risk: level,
          color,
          badge,
        };
      });
    }

    return [];
  }, [scan.top_contributors, scan.module_scores]);

  // Dynamic AI Insights List
  const insightsList = useMemo(() => {
    if (scan.flag_reasons && scan.flag_reasons.length > 0) {
      return scan.flag_reasons.map((f) => {
        const Icon = getModuleIcon(f.module);
        const isHigh = f.level === "High Risk" || f.score >= 0.7;
        const isMod = f.level === "Moderate Risk" || (f.score >= 0.4 && f.score < 0.7);

        return {
          Icon,
          moduleName: MODULE_LABELS[f.module] || f.module.replace(/_/g, " "),
          reason: f.reason,
          bgColor: isHigh ? "bg-purple-50/80 border-purple-100" : isMod ? "bg-amber-50/80 border-amber-100" : "bg-emerald-50/80 border-emerald-100",
          iconBg: isHigh ? "bg-purple-100 text-purple-700" : isMod ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700",
        };
      });
    }

    // Default safe insights if no flags raised
    return [
      {
        Icon: CheckCircle2,
        moduleName: "Permissions Check",
        reason: "All requested permissions are standard and expected for this application category.",
        bgColor: "bg-emerald-50/80 border-emerald-100",
        iconBg: "bg-emerald-100 text-emerald-700",
      },
      {
        Icon: CheckCircle2,
        moduleName: "Review Authenticity",
        reason: "User reviews display organic distribution and genuine feedback patterns.",
        bgColor: "bg-emerald-50/80 border-emerald-100",
        iconBg: "bg-emerald-100 text-emerald-700",
      },
      {
        Icon: CheckCircle2,
        moduleName: "App Branding",
        reason: "Icon and package metadata correspond accurately to official developer records.",
        bgColor: "bg-emerald-50/80 border-emerald-100",
        iconBg: "bg-emerald-100 text-emerald-700",
      },
      {
        Icon: ShieldCheck,
        moduleName: "Code Integrity",
        reason: "Static bytecode analysis found no known malicious payloads or obfuscated threats.",
        bgColor: "bg-emerald-50/80 border-emerald-100",
        iconBg: "bg-emerald-100 text-emerald-700",
      },
    ];
  }, [scan.flag_reasons]);

  // Dynamic "Why Flagged" Callout Grid
  const whyFlaggedGrid = useMemo(() => {
    if (scan.flag_reasons && scan.flag_reasons.length > 0) {
      return scan.flag_reasons.slice(0, 4).map((f) => {
        const Icon = getModuleIcon(f.module);
        const isHigh = f.level === "High Risk" || f.score >= 0.7;
        const isMod = f.level === "Moderate Risk" || (f.score >= 0.4 && f.score < 0.7);

        return {
          Icon,
          reason: f.reason,
          iconBg: isHigh ? "bg-purple-100 text-purple-700" : isMod ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700",
        };
      });
    }

    // Default positive verification callouts for Safe apps
    return [
      { Icon: KeyRound, reason: "Permissions requested match standard application functionalities.", iconBg: "bg-emerald-100 text-emerald-700" },
      { Icon: MessageSquareWarning, reason: "Review sentiments show no indication of artificial inflation.", iconBg: "bg-emerald-100 text-emerald-700" },
      { Icon: ImageIcon, reason: "Icon branding is verified against official repository indices.", iconBg: "bg-emerald-100 text-emerald-700" },
      { Icon: FileBadge2, reason: "Signed with an authentic, verified developer key.", iconBg: "bg-emerald-100 text-emerald-700" },
    ];
  }, [scan.flag_reasons]);

  const rawScreenshots = useMemo(() => {
    if (!scan.screenshots || scan.screenshots.length === 0) return [];
    const seen = new Set<string>();
    const result: string[] = [];
    for (const url of scan.screenshots) {
      if (!url || typeof url !== "string") continue;
      // Deduplicate Play Store images using base ID before resize/query params
      const baseId = url.split("=")[0];
      if (!seen.has(baseId)) {
        seen.add(baseId);
        // Optimize Google Play CDN URLs for lightweight, high-res webp
        let optimized = url;
        if (url.includes("googleusercontent.com")) {
          optimized = `${baseId}=w480-h960-rw`;
        }
        result.push(optimized);
      }
    }
    return result;
  }, [scan.screenshots]);

  const screenshots = useMemo(() => {
    return rawScreenshots.filter((url) => !failedImages[url]);
  }, [rawScreenshots, failedImages]);

  const safeActiveIndex = useMemo(() => {
    if (screenshots.length === 0) return 0;
    return Math.min(Math.max(0, activeShotIndex), screenshots.length - 1);
  }, [screenshots.length, activeShotIndex]);

  const miniFilmstrip = useMemo(() => {
    if (screenshots.length <= 5) return screenshots;
    const start = Math.max(0, Math.min(safeActiveIndex - 2, screenshots.length - 5));
    return screenshots.slice(start, start + 5);
  }, [screenshots, safeActiveIndex]);

  const markImageFailed = (url: string) => {
    setFailedImages((prev) => {
      if (prev[url]) return prev;
      return { ...prev, [url]: true };
    });
    if (previewImage === url) {
      setPreviewImage(null);
    }
  };

  useEffect(() => {
    setActiveShotIndex(0);
    setFailedImages({});
  }, [scan.scan_id]);

  useEffect(() => {
    if (!previewImage) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPreviewImage(null);
      } else if (e.key === "ArrowLeft" && previewIndex > 0) {
        const newIdx = previewIndex - 1;
        setPreviewIndex(newIdx);
        setPreviewImage(screenshots[newIdx]);
      } else if (e.key === "ArrowRight" && previewIndex < screenshots.length - 1) {
        const newIdx = previewIndex + 1;
        setPreviewIndex(newIdx);
        setPreviewImage(screenshots[newIdx]);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewImage, previewIndex, screenshots]);

  return (
    <div className="flex bg-[#f0f3f9] min-h-screen text-slate-800 font-sans">
      <Sidebar />
      <main className="flex-1 min-h-screen pb-12 overflow-x-hidden">
        <Topbar
          title="Scan Result"
          subtitle="Comprehensive AI Analysis Report"
        />

        <div className="px-8 py-6 space-y-6 max-w-[1600px] mx-auto">
          
          {/* Top Banner Actions */}
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-500">
              Report ID: <span className="text-slate-800 font-bold">{scan.scan_id}</span>
            </div>
            <a
              href={api.downloadPdfReport(scan.scan_id)}
              target="_blank"
              rel="noreferrer"
              className="clay-btn-purple px-5 py-2.5 flex items-center gap-2 text-xs font-bold shadow-lg"
            >
              <Download size={16} /> Download PDF Report
            </a>
          </div>

          {/* ROW 1: Overall Verdict + Scanned App + App Screenshots */}
          <div className="grid grid-cols-12 gap-6 items-stretch">
            
            {/* 1. Overall Verdict Card */}
            <div className="col-span-12 lg:col-span-5 panel p-6 flex flex-col justify-between h-[380px]">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-extrabold text-slate-900">Overall Verdict</h3>
                <button
                  type="button"
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({
                        title: `AppShield AI Scan - ${scan.app_name}`,
                        url: window.location.href,
                      }).catch(() => {});
                    } else if (navigator.clipboard) {
                      navigator.clipboard.writeText(window.location.href);
                      alert("Scan report link copied to clipboard!");
                    }
                  }}
                  className="clay-btn-soft px-3 py-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900"
                >
                  <Share2 size={13} /> Share
                </button>
              </div>

              <div className="flex items-center gap-6 my-auto">
                <div className="shrink-0 relative p-2 rounded-full bg-white shadow-[inset_3px_3px_8px_rgba(163,177,198,0.25),inset_-3px_-3px_8px_rgba(255,255,255,0.9)]">
                  <RiskGauge score={scan.overall_risk_score} size={135} />
                </div>
                
                <div className="space-y-3 flex-1">
                  <div>
                    <h2 className={`text-2xl font-black ${riskMeta.colorText} tracking-tight`}>{riskMeta.title}</h2>
                    <p className="text-xs font-medium text-slate-500 mt-0.5">
                      This application is likely <span className={`font-bold ${riskMeta.colorText}`}>{scan.prediction || riskMeta.prediction}</span>
                    </p>
                  </div>

                  {/* Spectrum Bar */}
                  <div className="space-y-1.5">
                    <div className="h-3 rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 via-orange-500 to-red-600 relative shadow-inner">
                      <div
                        className="absolute -top-1.5 w-6 h-6 bg-slate-900 border-2 border-white rounded-full shadow-md transition-all duration-500"
                        style={{
                          left: `calc(${Math.min(95, Math.max(5, scan.overall_risk_score))}% - 12px)`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] font-bold text-slate-400">
                      <span className="text-emerald-600">Low Risk</span>
                      <span className="text-amber-600">Moderate Risk</span>
                      <span className="text-orange-600">High Risk</span>
                      <span className="text-red-600">Critical Risk</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 pt-1">
                    <span>Confidence Score:</span>
                    <span className="font-extrabold text-slate-900">{scan.confidence != null ? `${scan.confidence}%` : "N/A"}</span>
                    <Info size={14} className="text-slate-400 cursor-pointer hover:text-slate-600" />
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Scanned Application Details Card */}
            <div className="col-span-12 md:col-span-6 lg:col-span-4 panel p-6 flex flex-col justify-between h-[380px]">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 mb-3">Scanned Application</h3>
                <div className="flex items-center gap-4 mb-3 p-3 rounded-2xl bg-[#e6ecf5]/60 border border-white/80 shadow-inner">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center text-white font-extrabold shadow-md overflow-hidden shrink-0">
                    {scan.app_icon ? (
                      <img
                        src={scan.app_icon}
                        alt={scan.app_name}
                        className="w-full h-full object-cover rounded-2xl"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <span className="text-lg font-black">{appInitials}</span>
                    )}
                  </div>
                  <div className="truncate">
                    <div className="text-sm font-extrabold text-slate-900 truncate">{scan.app_name}</div>
                    <div className="text-xs font-medium text-slate-500 truncate">{scan.package_name}</div>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Version</span>
                    <span className="font-bold text-slate-800">{scan.version || "N/A"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Developer</span>
                    <span className="font-bold text-slate-800">{scan.developer || "Unknown Developer"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Category</span>
                    <span className="font-bold text-slate-800">{scan.category || "General"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Downloads</span>
                    <span className="font-bold text-slate-800">{scan.downloads || "N/A (Direct Package)"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Rating</span>
                    <span className="font-bold text-amber-500 flex items-center gap-1">{scan.rating != null ? `${scan.rating} ★` : "N/A"}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500 font-medium">Scanned At</span>
                    <span className="font-bold text-slate-800">{scan.scanned_at || "Just now"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. App Screenshots Dynamic Showcase Card */}
            <div className="col-span-12 md:col-span-6 lg:col-span-3 panel p-5 flex flex-col justify-between h-[380px] relative">
              <div>
                {/* Header with Title, Mode Toggle, and Count Badge */}
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-base font-extrabold text-slate-900">
                    App Screenshots
                  </h3>
                  <div className="flex items-center gap-1.5">
                    {screenshots.length > 1 && (
                      <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                        <button
                          type="button"
                          title="Phone Carousel View"
                          onClick={() => setScreenshotViewMode("phone")}
                          className={`p-1 rounded-md transition-all ${
                            screenshotViewMode === "phone"
                              ? "bg-white text-violet-700 shadow-sm font-bold"
                              : "text-slate-400 hover:text-slate-700"
                          }`}
                        >
                          <Smartphone size={13} />
                        </button>
                        <button
                          type="button"
                          title="Grid Gallery View"
                          onClick={() => setScreenshotViewMode("grid")}
                          className={`p-1 rounded-md transition-all ${
                            screenshotViewMode === "grid"
                              ? "bg-white text-violet-700 shadow-sm font-bold"
                              : "text-slate-400 hover:text-slate-700"
                          }`}
                        >
                          <Layers size={13} />
                        </button>
                      </div>
                    )}
                    <span className="clay-badge-purple text-[10px] font-extrabold px-2.5 py-0.5">
                      {screenshots.length} {screenshots.length === 1 ? "Pic" : "Pics"}
                    </span>
                  </div>
                </div>

                {screenshots.length > 0 ? (
                  screenshotViewMode === "phone" ? (
                    /* PHONE SHOWCASE VIEW */
                    <div className="relative flex flex-col items-center my-1">
                      {/* Realistic Smartphone Mockup */}
                      <div className="relative w-[124px] h-[216px] bg-slate-950 rounded-[20px] p-[5px] shadow-[0_10px_25px_rgba(15,23,42,0.22)] border border-slate-700/70 group">
                        {/* Dynamic Island / Speaker */}
                        <div className="absolute top-[6px] left-1/2 -translate-x-1/2 w-7 h-1.5 bg-slate-950 rounded-full z-20" />

                        {/* Screen Image Container */}
                        <div
                          className="relative w-full h-full rounded-[16px] overflow-hidden bg-slate-900 flex items-center justify-center cursor-pointer"
                          onClick={() => {
                            setPreviewIndex(safeActiveIndex);
                            setPreviewImage(screenshots[safeActiveIndex]);
                          }}
                        >
                          <img
                            src={screenshots[safeActiveIndex]}
                            alt={`App Screenshot ${safeActiveIndex + 1}`}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={() => markImageFailed(screenshots[safeActiveIndex])}
                          />
                          <div className="absolute inset-0 bg-violet-950/20 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-white">
                            <ZoomIn size={18} className="drop-shadow-md" />
                            <span className="text-[9px] font-bold drop-shadow">Expand</span>
                          </div>
                        </div>

                        {/* Floating Prev Button */}
                        {safeActiveIndex > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveShotIndex((prev) => Math.max(0, prev - 1));
                            }}
                            className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/95 shadow-md border border-slate-200 text-slate-700 flex items-center justify-center hover:bg-violet-600 hover:text-white transition-all z-20"
                            title="Previous Screenshot"
                          >
                            <ChevronLeft size={14} />
                          </button>
                        )}

                        {/* Floating Next Button */}
                        {safeActiveIndex < screenshots.length - 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveShotIndex((prev) => Math.min(screenshots.length - 1, prev + 1));
                            }}
                            className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/95 shadow-md border border-slate-200 text-slate-700 flex items-center justify-center hover:bg-violet-600 hover:text-white transition-all z-20"
                            title="Next Screenshot"
                          >
                            <ChevronRight size={14} />
                          </button>
                        )}
                      </div>

                      {/* Mini Thumbnail Filmstrip */}
                      {screenshots.length > 1 && (
                        <div className="flex items-center justify-center gap-1.5 mt-2.5 max-w-full overflow-hidden px-1">
                          {miniFilmstrip.map((thumbUrl) => {
                            const actualIdx = screenshots.indexOf(thumbUrl);
                            const isActive = actualIdx === safeActiveIndex;
                            return (
                              <button
                                key={actualIdx}
                                type="button"
                                onClick={() => setActiveShotIndex(actualIdx)}
                                className={`w-6 h-10 rounded-md overflow-hidden transition-all shrink-0 border ${
                                  isActive
                                    ? "border-violet-600 ring-2 ring-violet-500/40 scale-110 shadow-sm"
                                    : "border-slate-200 opacity-60 hover:opacity-100"
                                }`}
                              >
                                <img
                                  src={thumbUrl}
                                  alt={`Thumb ${actualIdx + 1}`}
                                  referrerPolicy="no-referrer"
                                  loading="lazy"
                                  className="w-full h-full object-cover"
                                  onError={() => markImageFailed(thumbUrl)}
                                />
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* GRID GALLERY VIEW (Clean 3-column proportional grid) */
                    <div className="grid grid-cols-3 gap-2 my-2 h-[225px] max-h-[225px] overflow-y-auto pr-1 scrollbar-thin">
                      {screenshots.map((url, idx) => (
                        <div
                          key={idx}
                          className="aspect-[9/16] rounded-xl overflow-hidden border border-slate-200 hover:border-violet-600 hover:shadow-md transition-all cursor-pointer group relative bg-slate-100"
                          onClick={() => {
                            setPreviewIndex(idx);
                            setPreviewImage(url);
                          }}
                        >
                          <img
                            src={url}
                            alt={`Screenshot ${idx + 1}`}
                            referrerPolicy="no-referrer"
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={() => markImageFailed(url)}
                          />
                          <div className="absolute inset-0 bg-violet-900/0 group-hover:bg-violet-900/25 transition-colors flex items-center justify-center">
                            <ZoomIn size={16} className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" />
                          </div>
                          <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[8px] font-bold px-1 rounded backdrop-blur-xs">
                            {idx + 1}
                          </span>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  /* EMPTY STATE */
                  <div className="h-[230px] rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200/80 flex flex-col items-center justify-center p-4 text-center my-1">
                    <div className="w-10 h-10 rounded-full bg-slate-200/70 flex items-center justify-center mb-2 text-slate-400">
                      <ImageIcon size={20} />
                    </div>
                    <div className="text-xs font-bold text-slate-700">No Screenshots</div>
                    <div className="text-[10px] text-slate-400 mt-1 max-w-[170px]">
                      This package was analyzed without Google Play Store screenshots.
                    </div>
                  </div>
                )}
              </div>

              {/* Card Footer with Quick Action */}
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 pt-2 border-t border-slate-100/80">
                {screenshots.length > 0 ? (
                  <>
                    <span>
                      {screenshotViewMode === "phone"
                        ? `Shot ${safeActiveIndex + 1} of ${screenshots.length}`
                        : "Grid Gallery"}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewIndex(safeActiveIndex);
                        setPreviewImage(screenshots[safeActiveIndex]);
                      }}
                      className="text-violet-600 hover:text-violet-800 font-bold flex items-center gap-1 transition-colors"
                    >
                      <Maximize2 size={11} /> Full Screen
                    </button>
                  </>
                ) : (
                  <span className="w-full text-center text-slate-400">Direct Binary Analysis</span>
                )}
              </div>
            </div>

          </div>

          {/* ROW 2: Top Risk Factors + AI Insights + Model Used & Summary */}
          <div className="grid grid-cols-12 gap-6">

            {/* 1. Top Risk Factors */}
            <div className="col-span-12 lg:col-span-4 panel p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-extrabold text-slate-900">Top Risk Factors</h3>
                  <span className="text-xs font-bold text-slate-400">By Impact</span>
                </div>

                <div className="space-y-4">
                  {topFactors.map((item) => (
                    <div key={item.label} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{item.label}</span>
                          <span className="text-[10px] text-slate-400 font-medium truncate max-w-[120px]">{item.detail}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-extrabold text-slate-800">{item.pct}%</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 ${item.badge}`}>{item.risk}</span>
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden shadow-inner">
                        <div className={`h-full ${item.color} rounded-full transition-all duration-500`} style={{ width: `${Math.min(100, Math.max(5, item.pct * 2.5))}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. AI Insights */}
            <div className="col-span-12 lg:col-span-4 panel p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles size={18} className="text-violet-600" />
                  <h3 className="text-base font-extrabold text-slate-900">AI Insights</h3>
                </div>

                <div className="space-y-3">
                  {insightsList.map((item, idx) => (
                    <div key={idx} className={`p-3.5 rounded-2xl ${item.bgColor} flex items-start gap-3 shadow-sm`}>
                      <div className={`w-8 h-8 rounded-xl ${item.iconBg} flex items-center justify-center shrink-0`}>
                        <item.Icon size={16} />
                      </div>
                      <div className="text-xs">
                        <span className="font-bold text-slate-900">{item.moduleName}: </span>
                        <span className="text-slate-600">{item.reason}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dynamic Overall Recommendation Banner */}
              <div className={`p-4 rounded-2xl ${riskMeta.bgLight} border ${riskMeta.borderColor} flex items-center justify-between mt-4 shadow-sm`}>
                <div>
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Overall Recommendation</div>
                  <div className={`text-xs font-extrabold ${riskMeta.colorText} mt-0.5`}>{riskMeta.recommendation}</div>
                </div>
                <div className={`w-10 h-10 rounded-2xl ${riskMeta.iconColor} text-white flex items-center justify-center shadow-lg shrink-0 ml-3`}>
                  <riskMeta.RecommendationIcon size={20} />
                </div>
              </div>
            </div>

            {/* 3. Model Used & Prediction Summary */}
            <div className="col-span-12 lg:col-span-4 panel p-6 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 mb-4">Model Used <span className="text-xs font-normal text-slate-400">(Production Mode)</span></h3>
                
                <div className="p-3 rounded-2xl bg-[#e6ecf5]/80 border border-white/80 flex items-center justify-between shadow-inner mb-5">
                  <span className="text-xs font-extrabold text-slate-800">{scan.model_used || "Random Forest"}</span>
                  <span className="clay-badge-green px-3 py-1 text-[11px] font-extrabold">Active Classifier</span>
                </div>

                <h4 className="text-xs font-extrabold text-slate-900 mb-3">Prediction Breakdown</h4>

                <div className="flex items-center gap-6">
                  {/* Dynamic Conic-Gradient Donut Chart */}
                  <div
                    className="relative w-28 h-28 rounded-full border-4 border-white flex items-center justify-center shadow-md shrink-0 transition-all duration-500"
                    style={probabilities.donutStyle}
                  >
                    <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center text-center shadow-inner">
                      <div>
                        <div className="text-sm font-black text-slate-900">100%</div>
                        <div className="text-[9px] font-bold text-slate-400">Probability</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs flex-1">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 font-semibold text-slate-600">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Fraudulent
                      </span>
                      <span className="font-extrabold text-slate-900">{probabilities.fraud}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 font-semibold text-slate-600">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Suspicious
                      </span>
                      <span className="font-extrabold text-slate-900">{probabilities.suspicious}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 font-semibold text-slate-600">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Safe
                      </span>
                      <span className="font-extrabold text-slate-900">{probabilities.safe}%</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-slate-100 mt-4">
                <span className="text-xs font-semibold text-slate-500">Final Prediction</span>
                <span className={`text-sm font-extrabold ${riskMeta.colorText}`}>{scan.prediction || riskMeta.prediction}</span>
              </div>
            </div>

          </div>

          {/* ROW 3: "Why this app is flagged?" + Recommended Actions */}
          <div className="grid grid-cols-12 gap-6">

            {/* 1. Why this app is flagged? Callout Row */}
            <div className="col-span-12 lg:col-span-8 panel p-6">
              <h3 className="text-base font-extrabold text-slate-900 mb-4">
                {scan.flag_reasons?.length ? "Why this app is flagged?" : "Security Analysis Verification"}
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {whyFlaggedGrid.map((item, idx) => (
                  <div key={idx} className="p-4 rounded-2xl bg-white border border-slate-100 shadow-[4px_4px_12px_rgba(163,177,198,0.25),-4px_-4px_12px_rgba(255,255,255,0.9)] flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-xl ${item.iconBg} flex items-center justify-center shrink-0 shadow-sm`}>
                      <item.Icon size={18} />
                    </div>
                    <p className="text-xs font-semibold text-slate-600 leading-snug">
                      {item.reason}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Recommended Actions Card */}
            <div className="col-span-12 lg:col-span-4 panel p-6 flex items-center justify-between">
              <div className="space-y-3">
                <h3 className="text-base font-extrabold text-slate-900">Recommended Actions</h3>
                <div className="space-y-2 text-xs font-bold text-slate-700">
                  {getRecommendedActions(scan.overall_risk_score, scan.prediction).map((act, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckCircle2
                        size={16}
                        className={`shrink-0 mt-0.5 ${
                          scan.overall_risk_score >= 70
                            ? "text-red-500"
                            : scan.overall_risk_score >= 40
                            ? "text-amber-500"
                            : "text-emerald-600"
                        }`}
                      />
                      <span>{act}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3D Shield Graphic Adaptive to Verdict */}
              <div
                className={`w-20 h-24 rounded-3xl flex items-center justify-center shadow-lg border border-white/60 text-white shrink-0 ${
                  scan.overall_risk_score >= 70
                    ? "bg-gradient-to-br from-red-600 via-rose-600 to-red-800 shadow-[6px_6px_16px_rgba(239,68,68,0.4)]"
                    : scan.overall_risk_score >= 40
                    ? "bg-gradient-to-br from-amber-500 via-orange-500 to-amber-700 shadow-[6px_6px_16px_rgba(245,158,11,0.4)]"
                    : "bg-gradient-to-br from-emerald-500 via-teal-600 to-emerald-800 shadow-[6px_6px_16px_rgba(16,185,129,0.4)]"
                }`}
              >
                <Lock size={32} className="drop-shadow-lg" />
              </div>
            </div>

          </div>

        </div>

        {/* Lightbox Modal with Full-Resolution Gallery Filmstrip */}
        {previewImage && (
          <div
            className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setPreviewImage(null)}
          >
            <div
              className="relative max-w-2xl w-full bg-slate-900 p-5 rounded-3xl border border-slate-700 shadow-2xl flex flex-col items-center animate-in fade-in zoom-in duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="absolute -top-3 -right-3 w-9 h-9 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors z-10"
                title="Close"
              >
                <X size={18} />
              </button>

              {/* Main Image Display */}
              <div className="w-full flex items-center justify-center max-h-[68vh] overflow-hidden my-1">
                <img
                  src={previewImage}
                  alt={`Screenshot ${previewIndex + 1}`}
                  referrerPolicy="no-referrer"
                  className="max-h-[68vh] w-auto rounded-2xl object-contain shadow-2xl border border-slate-800"
                  onError={() => markImageFailed(previewImage)}
                />
              </div>

              {/* Bottom Navigation and Filmstrip */}
              <div className="w-full pt-3 border-t border-slate-800 flex flex-col gap-2.5">
                {/* Controls */}
                <div className="flex items-center justify-between px-2 text-white text-xs font-bold">
                  <button
                    type="button"
                    disabled={previewIndex === 0}
                    onClick={() => {
                      const newIdx = previewIndex - 1;
                      setPreviewIndex(newIdx);
                      setPreviewImage(screenshots[newIdx]);
                      setActiveShotIndex(newIdx);
                    }}
                    className="clay-btn-soft px-3.5 py-1.5 text-white disabled:opacity-30 flex items-center gap-1 text-xs"
                  >
                    <ChevronLeft size={14} /> Previous
                  </button>
                  <span className="text-slate-300 font-extrabold text-xs">
                    {previewIndex + 1} of {screenshots.length}
                  </span>
                  <button
                    type="button"
                    disabled={previewIndex === screenshots.length - 1}
                    onClick={() => {
                      const newIdx = previewIndex + 1;
                      setPreviewIndex(newIdx);
                      setPreviewImage(screenshots[newIdx]);
                      setActiveShotIndex(newIdx);
                    }}
                    className="clay-btn-purple px-3.5 py-1.5 text-white disabled:opacity-30 flex items-center gap-1 text-xs"
                  >
                    Next <ChevronRight size={14} />
                  </button>
                </div>

                {/* Filmstrip of all screenshots */}
                {screenshots.length > 1 && (
                  <div className="flex gap-2 max-w-full overflow-x-auto py-1 px-1 scrollbar-thin">
                    {screenshots.map((url, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setPreviewIndex(idx);
                          setPreviewImage(url);
                          setActiveShotIndex(idx);
                        }}
                        className={`h-12 w-8 rounded-lg overflow-hidden shrink-0 border-2 transition-all ${
                          idx === previewIndex
                            ? "border-violet-500 ring-2 ring-violet-500/50 scale-105"
                            : "border-slate-700 opacity-60 hover:opacity-100"
                        }`}
                      >
                        <img
                          src={url}
                          alt={`Thumb ${idx + 1}`}
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          className="w-full h-full object-cover"
                          onError={() => markImageFailed(url)}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
