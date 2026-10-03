"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Play, Link2, Upload, Package, Hash, Loader2,
  ShieldCheck, MessageSquare, Code2, UserCheck, Award, ImageIcon,
  FolderArchive, BrainCircuit, FileText, Check, Settings2, ShieldAlert,
  DownloadCloud, ArrowRight, Sparkles, AlertCircle, RefreshCw
} from "lucide-react";
import clsx from "clsx";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { api } from "@/lib/api";
import { NEW_SCAN } from "@/lib/messages";

type Tab = "play_url" | "apk_upload" | "package_name" | "apk_url" | "hash";

interface TabMeta {
  key: Tab;
  title: string;
  subtitle: string;
  placeholder: string;
  inputLabel: string;
  inputHelp: string;
  icon: any;
}

const TABS: TabMeta[] = [
  {
    key: "play_url",
    title: "Google Play Store",
    subtitle: "Public Play Store URL",
    placeholder: "https://play.google.com/store/apps/details?id=com.spotify.music",
    inputLabel: "Google Play Store Target URL",
    inputHelp: "Scrapes official store metadata, reviews, developer credentials, and downloads APK.",
    icon: Play,
  },
  {
    key: "apk_upload",
    title: "Upload APK Binary",
    subtitle: "Local .apk package file",
    placeholder: "Select or drop .apk file",
    inputLabel: "Android APK Binary Package",
    inputHelp: "Upload compiled Android package binary (up to 500MB) for Dalvik bytecode extraction.",
    icon: Upload,
  },
  {
    key: "package_name",
    title: "Package Identifier",
    subtitle: "Namespace (e.g. com.example)",
    placeholder: "com.whatsapp or com.spotify.music",
    inputLabel: "Application Package Namespace",
    inputHelp: "Queries threat intelligence database and catalogs for the unique Android package ID.",
    icon: Package,
  },
  {
    key: "apk_url",
    title: "Direct Download URL",
    subtitle: "Remote HTTP / HTTPS link",
    placeholder: "https://cdn.example.com/builds/app-release.apk",
    inputLabel: "Direct Remote APK URL",
    inputHelp: "Fetches binary stream over secure HTTPS and pipes into decompiler sandbox.",
    icon: Link2,
  },
  {
    key: "hash",
    title: "SHA-256 Hash",
    subtitle: "Cryptographic checksum",
    placeholder: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    inputLabel: "Cryptographic SHA-256 Checksum",
    inputHelp: "Queries known threat signatures, malware catalogs, and past audit dossiers by hash.",
    icon: Hash,
  },
];

export default function NewScanPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("play_url");
  const [value, setValue] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<{
    percent: number;
    message: string;
    downloadedMb?: number;
    totalMb?: number | null;
    status?: string;
  } | null>(null);

  // Configuration options
  const [analysisDepth, setAnalysisDepth] = useState("standard");
  const [riskSensitivity, setRiskSensitivity] = useState("medium");
  const [selectedModel, setSelectedModel] = useState("random_forest");

  // Additional Checks State
  const [checks, setChecks] = useState({
    permission: true,
    code: true,
    network: true,
    behavior: true,
    certificate: true,
    review: true,
  });

  const activeTab = TABS.find((t) => t.key === tab)!;

  async function handleScan(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);
    setDownloadProgress(null);
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    try {
      let result;
      if (tab === "play_url") {
        if (!value.includes("/store/apps/details") || !value.includes("id=")) {
          throw new Error(NEW_SCAN.errors.invalidPlayUrl);
        }
        result = await api.scanPlayUrl(value, selectedModel);
      } else if (tab === "package_name") {
        result = await api.scanPackageName(value, selectedModel);
      } else if (tab === "apk_url") {
        const trackerId = `track-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        setDownloadProgress({
          percent: 5,
          message: "Connecting to remote APK server...",
          status: "connecting",
        });

        let elapsed = 0;
        pollTimer = setInterval(async () => {
          elapsed += 0.5;
          try {
            const prog = await api.getApkDownloadProgress(trackerId);
            if (prog && prog.message) {
              if (prog.status === "error") {
                setError(prog.message);
              }
              setDownloadProgress({
                percent: prog.percent ?? 0,
                message: prog.message,
                downloadedMb: prog.downloaded_mb,
                totalMb: prog.total_mb,
                status: prog.status,
              });
            } else if (elapsed > 2) {
              setDownloadProgress((prev) => ({
                percent: prev?.percent || 5,
                message: `Negotiating stream (${Math.round(elapsed)}s)...`,
                status: "connecting",
              }));
            }
          } catch {}
        }, 500);

        result = await api.scanApkUrl(value, selectedModel, trackerId);
      } else if (tab === "apk_upload" && file) {
        result = await api.scanApkUpload(file, selectedModel);
      } else if (tab === "hash") {
        result = await api.scanByHash(value, selectedModel);
      } else {
        throw new Error(NEW_SCAN.errors.noInput);
      }

      if (result) {
        const username = api.adminUsername() || "admin";
        if (!result.user_email) {
          result.user_email = username;
          result.scanned_by = username;
        }
        if (typeof window !== "undefined") {
          try {
            sessionStorage.setItem("appshield_last_scan", JSON.stringify(result));
            if (result.scan_id) {
              sessionStorage.setItem(`appshield_scan_${result.scan_id}`, JSON.stringify(result));
            }
          } catch {}
        }
      }

      if (result?.scan_id) {
        router.push(`/dashboard?scan_id=${result.scan_id}`);
      } else {
        router.push("/dashboard");
      }
    } catch (e: any) {
      setError(e.message || NEW_SCAN.errors.scanFailed);
    } finally {
      if (pollTimer) clearInterval(pollTimer);
      setLoading(false);
      setDownloadProgress(null);
    }
  }

  const toggleCheck = (key: keyof typeof checks) => {
    setChecks((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="flex bg-[#f8fafc] min-h-screen text-slate-800 font-sans">
      <Sidebar />
      <main className="flex-1 min-h-screen pb-16 overflow-x-hidden">
        <Topbar title="New Forensic Scan" subtitle="Submit application package or Play Store URL for multi-vector threat inspection" />

        <div className="px-8 py-6 max-w-5xl mx-auto space-y-6">

          {/* Main Ingestion Terminal Card */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-card">
            {/* Tabbed Ingestion Selector */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200/60 overflow-x-auto mb-6">
              {TABS.map((t) => {
                const Icon = t.icon;
                const isActive = tab === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => {
                      setTab(t.key);
                      setValue("");
                      setFile(null);
                      setError(null);
                    }}
                    className={clsx(
                      "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer shrink-0",
                      isActive
                        ? "bg-white text-slate-900 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    <Icon size={14} className={isActive ? "text-blue-600" : "text-slate-400"} />
                    <span>{t.title}</span>
                  </button>
                );
              })}
            </div>

            {/* Input Form Body */}
            <form onSubmit={handleScan} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-900 mb-1">
                  {activeTab.inputLabel}
                </label>
                <p className="text-[11px] text-slate-500 mb-2.5">
                  {activeTab.inputHelp}
                </p>

                {tab === "apk_upload" ? (
                  <div
                    onClick={() => document.getElementById("apk-file-input")?.click()}
                    className="p-8 text-center cursor-pointer bg-slate-50 hover:bg-white border-2 border-dashed border-slate-200 hover:border-blue-500 rounded-xl transition-colors group"
                  >
                    <Upload size={28} className="mx-auto text-slate-400 group-hover:text-blue-600 mb-2 transition-colors" />
                    <p className="text-xs font-semibold text-slate-900">
                      {file ? file.name : "Click or drag & drop Android APK package (.apk)"}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Max file size: 500 MB • Dalvik bytecode & AndroidManifest automatically extracted
                    </p>
                    <input
                      id="apk-file-input"
                      type="file"
                      accept=".apk"
                      className="hidden"
                      onChange={(e) => {
                        const selected = e.target.files?.[0] ?? null;
                        if (selected && selected.size > 500 * 1024 * 1024) {
                          setError(`Selected file (${(selected.size / (1024 * 1024)).toFixed(1)}MB) exceeds 500MB.`);
                          setFile(null);
                          return;
                        }
                        setError(null);
                        setFile(selected);
                      }}
                    />
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <activeTab.icon size={15} />
                    </div>
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      placeholder={activeTab.placeholder}
                      className="w-full h-10 pl-9 pr-3 text-xs font-mono text-slate-900 placeholder:text-slate-400 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-500 transition-colors"
                    />
                  </div>
                )}
              </div>

              {/* Sample Target Quick Links */}
              {tab === "play_url" && (
                <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-500">
                  <span>Quick sample:</span>
                  <button
                    type="button"
                    onClick={() => setValue("https://play.google.com/store/apps/details?id=com.spotify.music")}
                    className="text-blue-600 hover:underline font-mono text-[10px] cursor-pointer"
                  >
                    Spotify Music
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => setValue("https://play.google.com/store/apps/details?id=com.whatsapp")}
                    className="text-blue-600 hover:underline font-mono text-[10px] cursor-pointer"
                  >
                    WhatsApp Messenger
                  </button>
                </div>
              )}

              {/* Error Callout */}
              {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-3 flex items-center gap-2 text-xs font-medium">
                  <AlertCircle size={15} className="shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              {/* Real-time Progress Bar */}
              {loading && tab === "apk_url" && downloadProgress && (
                <div className="p-3.5 rounded-lg border border-blue-200 bg-blue-50/60 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                    <div className="flex items-center gap-2">
                      <DownloadCloud size={15} className="text-blue-600 animate-bounce" />
                      <span>{downloadProgress.message}</span>
                    </div>
                    <span className="font-mono text-blue-700 font-bold">{downloadProgress.percent}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(downloadProgress.percent, 8)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || (tab === "apk_upload" ? !file : !value.trim())}
                className="w-full h-10 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 size={15} className="animate-spin" />
                    <span>Executing Forensic Inspection Pipeline...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span>Run Multi-Vector Security Scan</span>
                    <ArrowRight size={14} />
                  </div>
                )}
              </button>
            </form>
          </div>

          {/* Scan Pipeline Configuration (2-Column Card) */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-card">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Settings2 size={16} className="text-slate-500" />
                <h3 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider">
                  Analysis Pipeline Calibration
                </h3>
              </div>
              <span className="text-[11px] font-mono text-slate-500">Heuristics v2.4</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Configuration Dropdowns */}
              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ML Classifier Model
                  </label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full h-8 px-2.5 text-xs font-mono font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-blue-500"
                  >
                    <option value="random_forest">Random Forest (High Accuracy Ensemble)</option>
                    <option value="xgboost">XGBoost (Gradient Boosted Decision Trees)</option>
                    <option value="lightgbm">LightGBM (Fast Tree-Based Classifier)</option>
                    <option value="catboost">CatBoost (Categorical Feature Boost)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Inspection Depth
                  </label>
                  <select
                    value={analysisDepth}
                    onChange={(e) => setAnalysisDepth(e.target.value)}
                    className="w-full h-8 px-2.5 text-xs font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-blue-500"
                  >
                    <option value="standard">Standard (Static Bytecode + Dynamic Telemetry)</option>
                    <option value="deep">Deep Forensic (Full Bytecode Graph + Review NLP)</option>
                    <option value="quick">Fast Triage (Manifest & Certificate Only)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Risk Sensitivity Threshold
                  </label>
                  <select
                    value={riskSensitivity}
                    onChange={(e) => setRiskSensitivity(e.target.value)}
                    className="w-full h-8 px-2.5 text-xs font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-blue-500"
                  >
                    <option value="medium">Balanced (Recommended for general auditing)</option>
                    <option value="high">High Sensitivity (Aggressive fraud flags)</option>
                    <option value="low">Conservative (Strict proof threshold)</option>
                  </select>
                </div>
              </div>

              {/* Active Analyzers Matrix */}
              <div className="border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6 space-y-2">
                <span className="block text-xs font-semibold text-slate-700 mb-2">
                  Active Security Modules
                </span>
                {[
                  { key: "permission", label: "Permission Privilege Verification" },
                  { key: "code", label: "Dalvik Bytecode Decompilation" },
                  { key: "network", label: "Network Endpoint & SSL Pinning" },
                  { key: "behavior", label: "Behavioral Heuristics Engine" },
                  { key: "certificate", label: "X.509 Certificate Chain Analysis" },
                  { key: "review", label: "Astroturfed Review NLP Detection" },
                ].map((check) => {
                  const isChecked = checks[check.key as keyof typeof checks];
                  return (
                    <div
                      key={check.key}
                      onClick={() => toggleCheck(check.key as keyof typeof checks)}
                      className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 hover:text-slate-900 select-none"
                    >
                      <div
                        className={clsx(
                          "w-3.5 h-3.5 rounded flex items-center justify-center transition-colors",
                          isChecked ? "bg-blue-600 text-white" : "border border-slate-300 bg-white"
                        )}
                      >
                        {isChecked && <Check size={10} strokeWidth={3} />}
                      </div>
                      <span>{check.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
