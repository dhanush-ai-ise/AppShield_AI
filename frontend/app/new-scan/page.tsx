"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Play, Link2, Upload, Package, Hash, Loader2, Sparkles, ChevronRight,
  ShieldCheck, MessageSquare, Code2, UserCheck, Award, ImageIcon,
  FolderArchive, BrainCircuit, FileText, Check, Info, Settings2, ShieldAlert,
  DownloadCloud
} from "lucide-react";
import clsx from "clsx";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { api } from "@/lib/api";
import { NEW_SCAN } from "@/lib/messages";

type Tab = "play_url" | "apk_url" | "apk_upload" | "package_name" | "hash";

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
    title: "Play Store URL",
    subtitle: "Scan app from Google Play Store",
    placeholder: "https://play.google.com/store/apps/details?id=com.example.app",
    inputLabel: "Play Store URL",
    inputHelp: "Enter the full URL of the app on Google Play Store",
    icon: Play,
  },
  {
    key: "apk_url",
    title: "APK Download URL",
    subtitle: "Scan from direct download link",
    placeholder: "https://example.com/downloads/app.apk",
    inputLabel: "APK Direct Download URL",
    inputHelp: "Direct URL pointing to a downloadable .apk file",
    icon: Link2,
  },
  {
    key: "apk_upload",
    title: "Upload APK",
    subtitle: "Upload APK file from device",
    placeholder: "Select .apk file to upload",
    inputLabel: "Select APK File",
    inputHelp: "Drag & drop or browse your local system for an .apk package",
    icon: Upload,
  },
  {
    key: "package_name",
    title: "Package Name",
    subtitle: "Scan using app package name",
    placeholder: "com.instagram.android",
    inputLabel: "Application Package Name",
    inputHelp: "Standard Android package name (e.g. com.developer.appname)",
    icon: Package,
  },
  {
    key: "hash",
    title: "APK Hash (SHA256)",
    subtitle: "Scan using APK hash value",
    placeholder: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    inputLabel: "SHA-256 Hash",
    inputHelp: "Unique 64-character SHA-256 cryptographic hash of the APK file",
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
    if (e) {
      e.preventDefault();
    }
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
      }
      else if (tab === "package_name") result = await api.scanPackageName(value, selectedModel);
      else if (tab === "apk_url") {
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
                message: `Negotiating download stream (${Math.round(elapsed)}s)...`,
                status: "connecting",
              }));
            }
          } catch {}
        }, 500);

        result = await api.scanApkUrl(value, selectedModel, trackerId);
      }
      else if (tab === "apk_upload" && file) result = await api.scanApkUpload(file, selectedModel);
      else if (tab === "hash") result = await api.scanByHash(value, selectedModel);
      else throw new Error(NEW_SCAN.errors.noInput);

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
    <div className="flex bg-[#f0f3f9] min-h-screen text-slate-800 font-sans">
      <Sidebar />
      <main className="flex-1 min-h-screen pb-16 overflow-x-hidden">
        <Topbar title="New Scan" subtitle="Analyze your application for potential fraud risks and security issues" />

        <div className="px-8 py-6 max-w-[1600px] mx-auto space-y-6">

          {/* SECTION 1: Choose input method */}
          <div className="panel p-7 relative overflow-hidden">
            <div className="flex items-center gap-2.5 mb-6">
              <span className="w-6 h-6 rounded-full bg-violet-600 text-white font-extrabold text-xs flex items-center justify-center shadow-md">
                1
              </span>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                Choose input method
              </h3>
            </div>

            <form onSubmit={handleScan}>
              <div className="grid grid-cols-12 gap-6 items-center mb-6">
                
                {/* 5 Input Method Cards */}
                <div className="col-span-12 xl:col-span-9 grid grid-cols-5 gap-3.5">
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
                          setError(null);
                        }}
                        className={clsx(
                          "flex flex-col items-center text-center p-4 rounded-2xl transition-all duration-200 cursor-pointer relative group",
                          isActive
                            ? "bg-white border-2 border-violet-500 shadow-[0_8px_25px_rgba(124,58,237,0.18)] scale-[1.02]"
                            : "clay-inset hover:bg-white/80 border border-slate-200/60"
                        )}
                      >
                        <div className={clsx(
                          "w-12 h-12 rounded-2xl flex items-center justify-center mb-3 transition-transform duration-200 group-hover:scale-110",
                          isActive
                            ? "bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 text-white shadow-md"
                            : "bg-violet-100/70 text-violet-700 border border-violet-200/60"
                        )}>
                          <Icon size={22} />
                        </div>
                        <h4 className={clsx(
                          "text-xs font-extrabold mb-1 truncate w-full",
                          isActive ? "text-slate-900" : "text-slate-700"
                        )}>
                          {t.title}
                        </h4>
                        <p className="text-[10px] font-medium text-slate-400 leading-tight line-clamp-2">
                          {t.subtitle}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* Right Side 3D Phone & Scanning Illustration */}
                <div className="hidden xl:flex col-span-3 items-center justify-center relative p-4">
                  <div className="relative w-48 h-48 flex items-center justify-center">
                    {/* Glowing Backdrop Circle */}
                    <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-violet-300/40 via-purple-200/30 to-indigo-300/40 blur-2xl animate-pulse" />
                    
                    {/* Floating 3D Phone Mock Container */}
                    <div className="relative z-10 w-32 h-44 rounded-3xl bg-white/90 border-2 border-violet-200/80 shadow-[0_15px_35px_rgba(124,58,237,0.2)] p-2 flex flex-col justify-between items-center rotate-[-6deg] hover:rotate-0 transition-transform duration-500">
                      {/* Speaker Notch */}
                      <div className="w-10 h-1.5 rounded-full bg-slate-200/90 mx-auto" />
                      
                      {/* Play Icon Badge */}
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg my-auto">
                        <Play size={24} className="text-white fill-white ml-0.5" />
                      </div>

                      {/* Scanning Line */}
                      <div className="w-full h-1 bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500 rounded-full shadow-[0_0_8px_rgba(124,58,237,0.8)] animate-pulse" />
                    </div>

                    {/* 3D Floating Magnifying Glass Graphic */}
                    <div className="absolute -top-1 -right-2 z-20 w-16 h-16 rounded-full bg-gradient-to-br from-violet-600 to-purple-700 p-3 shadow-xl border-2 border-white flex items-center justify-center animate-bounce">
                      <Sparkles size={28} className="text-white" />
                    </div>
                  </div>
                </div>

              </div>

              {/* Input Form Box */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-extrabold text-slate-900 mb-1">
                    {activeTab.inputLabel}
                  </label>
                  <p className="text-[11px] font-medium text-slate-400 mb-2">
                    {activeTab.inputHelp}
                  </p>

                  {tab === "apk_upload" ? (
                    <div
                      onClick={() => document.getElementById("apk-file-input")?.click()}
                      className="clay-inset p-8 text-center cursor-pointer hover:border-violet-500 transition-all border border-dashed border-slate-300 rounded-2xl group"
                    >
                      <Upload size={32} className="mx-auto text-violet-600 mb-2 group-hover:scale-110 transition-transform" />
                      <p className="text-xs font-bold text-slate-800">
                        {file ? file.name : "Click or drag & drop .apk file here"}
                      </p>
                      <p className="text-[10px] font-medium text-slate-400 mt-1">
                        Supports Android package files up to 500MB
                      </p>
                      <input
                        id="apk-file-input"
                        type="file"
                        accept=".apk"
                        className="hidden"
                        onChange={(e) => {
                          const selected = e.target.files?.[0] ?? null;
                          if (selected && selected.size > 500 * 1024 * 1024) {
                            setError(`Selected file (${(selected.size / (1024 * 1024)).toFixed(1)}MB) exceeds the maximum 500MB limit.`);
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
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                        <activeTab.icon size={18} />
                      </div>
                      <input
                        type="text"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder={activeTab.placeholder}
                        className="clay-input w-full pl-11 pr-4 py-3.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 bg-white/90 border border-slate-200/80 rounded-2xl shadow-inner focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                      />
                    </div>
                  )}
                </div>

                {error && (
                  <div className="clay-badge-red p-3 flex items-center gap-2 text-xs font-bold">
                    <ShieldAlert size={16} />
                    {error}
                  </div>
                )}

                {/* Real-time APK Download / Scan Progress Card */}
                {loading && tab === "apk_url" && downloadProgress && (
                  <div className="clay-card p-4 rounded-2xl border border-violet-200/90 bg-gradient-to-br from-violet-50/90 via-purple-50/70 to-indigo-50/80 shadow-md flex flex-col gap-2.5 transition-all duration-300">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                      <div className="flex items-center gap-2">
                        {downloadProgress.status === "analyzing" ? (
                          <ShieldCheck size={17} className="text-emerald-600 animate-pulse" />
                        ) : (
                          <DownloadCloud size={17} className="text-violet-600 animate-bounce" />
                        )}
                        <span className="font-extrabold text-slate-900">
                          {downloadProgress.status === "analyzing"
                            ? "Decompiling & AI Security Analysis"
                            : "Downloading Remote APK"}
                        </span>
                      </div>
                      <span className="text-violet-700 font-extrabold text-xs px-2 py-0.5 rounded-full bg-violet-100/80">
                        {downloadProgress.percent > 0 ? `${downloadProgress.percent}%` : "Connecting..."}
                      </span>
                    </div>

                    {/* Animated Progress Bar */}
                    <div className="w-full h-2.5 bg-slate-200/80 rounded-full overflow-hidden relative shadow-inner">
                      <div
                        className="h-full bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 transition-all duration-300 rounded-full shadow"
                        style={{ width: `${Math.max(downloadProgress.percent, 6)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
                      <span className="truncate pr-2 font-semibold text-slate-600">
                        {downloadProgress.message}
                      </span>
                      {downloadProgress.totalMb && (
                        <span className="whitespace-nowrap font-bold text-violet-600">
                          Total: ~{downloadProgress.totalMb} MB
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Submit Action Button */}
                <button
                  type="submit"
                  disabled={loading || (tab === "apk_upload" ? !file : !value)}
                  className="relative overflow-hidden w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-700 hover:via-purple-700 hover:to-indigo-700 text-white font-extrabold text-sm shadow-[0_8px_20px_rgba(124,58,237,0.3)] hover:shadow-[0_12px_28px_rgba(124,58,237,0.4)] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  {/* Glowing progress fill layer inside button */}
                  {loading && tab === "apk_url" && downloadProgress && (
                    <div
                      className="absolute inset-y-0 left-0 bg-white/20 transition-all duration-300 pointer-events-none rounded-2xl"
                      style={{ width: `${Math.max(downloadProgress.percent, 8)}%` }}
                    />
                  )}

                  {loading ? (
                    tab === "apk_url" && downloadProgress ? (
                      <div className="relative z-10 flex items-center justify-center gap-2 w-full px-1">
                        {downloadProgress.status === "downloading" ? (
                          <DownloadCloud size={18} className="animate-bounce shrink-0" />
                        ) : (
                          <Loader2 size={18} className="animate-spin shrink-0" />
                        )}
                        <span className="truncate tracking-wide">
                          {downloadProgress.message}
                        </span>
                        {downloadProgress.percent > 0 && (
                          <span className="text-[11px] font-extrabold bg-black/20 px-2 py-0.5 rounded-full ml-auto shrink-0">
                            {downloadProgress.percent}%
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="relative z-10 flex items-center justify-center gap-2">
                        <Loader2 size={18} className="animate-spin" />
                        Analyzing Security Features...
                      </div>
                    )
                  ) : (
                    <div className="relative z-10 flex items-center justify-center gap-2">
                      Run Scan <ChevronRight size={18} />
                    </div>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* ROW 2: Scan Configuration + What AI Will Analyze */}
          <div className="grid grid-cols-12 gap-6">

            {/* SECTION 2: Scan Configuration & Additional Checks */}
            <div className="col-span-12 lg:col-span-7 panel p-7">
              <div className="flex items-center gap-2.5 mb-5">
                <span className="w-6 h-6 rounded-full bg-violet-600 text-white font-extrabold text-xs flex items-center justify-center shadow-md">
                  2
                </span>
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                  Scan Configuration
                </h3>
              </div>

              <div className="grid grid-cols-12 gap-6">
                
                {/* Configuration Dropdowns */}
                <div className="col-span-12 md:col-span-7 space-y-4">
                  {/* Analysis Depth */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <Settings2 size={14} className="text-violet-600" />
                      Analysis Depth
                    </label>
                    <select
                      value={analysisDepth}
                      onChange={(e) => setAnalysisDepth(e.target.value)}
                      className="clay-input w-full px-3.5 py-2.5 text-xs font-bold text-slate-900 bg-white/90 border border-slate-200/80 rounded-xl shadow-inner focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                    >
                      <option value="standard">Standard Scan</option>
                      <option value="deep">Deep Bytecode Scan</option>
                      <option value="quick">Quick Header Scan</option>
                    </select>
                    <p className="text-[10px] font-medium text-slate-400 mt-1">
                      Balanced speed and accuracy
                    </p>
                  </div>

                  {/* Risk Sensitivity */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <ShieldAlert size={14} className="text-amber-500" />
                      Risk Sensitivity
                    </label>
                    <select
                      value={riskSensitivity}
                      onChange={(e) => setRiskSensitivity(e.target.value)}
                      className="clay-input w-full px-3.5 py-2.5 text-xs font-bold text-slate-900 bg-white/90 border border-slate-200/80 rounded-xl shadow-inner focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                    >
                      <option value="medium">Medium (Balanced)</option>
                      <option value="low">Low (Conservative)</option>
                      <option value="high">High (Aggressive)</option>
                    </select>
                    <p className="text-[10px] font-medium text-slate-400 mt-1">
                      Balanced detection of risks and accuracy
                    </p>
                  </div>

                  {/* AI Model */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <BrainCircuit size={14} className="text-violet-600" />
                      AI Model
                    </label>
                    <div className="relative flex items-center">
                      <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="clay-input w-full px-3.5 py-2.5 text-xs font-bold text-slate-900 bg-white/90 border border-slate-200/80 rounded-xl shadow-inner focus:outline-none focus:ring-2 focus:ring-violet-500/40 pr-16"
                      >
                        <option value="random_forest">Random Forest</option>
                        <option value="xgboost">XGBoost</option>
                        <option value="lightgbm">LightGBM</option>
                        <option value="catboost">CatBoost</option>
                      </select>
                      <span className="absolute right-2 clay-badge-green text-[10px] font-extrabold px-2 py-0.5 pointer-events-none">
                        Default
                      </span>
                    </div>
                    <p className="text-[10px] font-medium text-slate-400 mt-1">
                      Our production recommended model
                    </p>
                  </div>
                </div>

                {/* Additional Checks List */}
                <div className="col-span-12 md:col-span-5 border-t md:border-t-0 md:border-l border-slate-200/60 pt-4 md:pt-0 md:pl-6 space-y-2.5">
                  <h4 className="text-xs font-extrabold text-slate-800 mb-3">
                    Additional Checks
                  </h4>
                  {[
                    { key: "permission", label: "Permission Analysis" },
                    { key: "code", label: "Code Analysis" },
                    { key: "network", label: "Network Security" },
                    { key: "behavior", label: "Behavior Analysis" },
                    { key: "certificate", label: "Certificate Analysis" },
                    { key: "review", label: "Review Analysis" },
                  ].map((check) => {
                    const isChecked = checks[check.key as keyof typeof checks];
                    return (
                      <div
                        key={check.key}
                        onClick={() => toggleCheck(check.key as keyof typeof checks)}
                        className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-slate-700 hover:text-slate-900"
                      >
                        <div className={clsx(
                          "w-4 h-4 rounded-md flex items-center justify-center transition-colors",
                          isChecked ? "bg-violet-600 text-white" : "border border-slate-300 bg-white"
                        )}>
                          {isChecked && <Check size={12} strokeWidth={3} />}
                        </div>
                        <span>{check.label}</span>
                      </div>
                    );
                  })}
                </div>

              </div>
            </div>

            {/* SECTION 3: What AI Will Analyze */}
            <div className="col-span-12 lg:col-span-5 panel p-7">
              <div className="flex items-center gap-2.5 mb-5">
                <span className="w-6 h-6 rounded-full bg-violet-600 text-white font-extrabold text-xs flex items-center justify-center shadow-md">
                  3
                </span>
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                  What AI Will Analyze
                </h3>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                {[
                  { label: "Permission Analysis", icon: ShieldCheck, color: "bg-purple-100/80 text-purple-700 border-purple-200/60" },
                  { label: "Review Analysis", icon: MessageSquare, color: "bg-amber-100/80 text-amber-700 border-amber-200/60" },
                  { label: "APK Static Analysis", icon: Code2, color: "bg-blue-100/80 text-blue-700 border-blue-200/60" },
                  { label: "Developer Reputation", icon: UserCheck, color: "bg-emerald-100/80 text-emerald-700 border-emerald-200/60" },
                  { label: "Certificate Validation", icon: Award, color: "bg-yellow-100/80 text-yellow-700 border-yellow-200/60" },
                  { label: "Icon Similarity", icon: ImageIcon, color: "bg-pink-100/80 text-pink-700 border-pink-200/60" },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.label}
                      className="p-3.5 rounded-2xl bg-white/80 border border-slate-200/80 shadow-sm flex flex-col items-center text-center hover:shadow-md transition-shadow"
                    >
                      <div className={clsx("w-10 h-10 rounded-2xl flex items-center justify-center mb-2 border", item.color)}>
                        <Icon size={18} />
                      </div>
                      <span className="text-[11px] font-bold text-slate-800 leading-tight">
                        {item.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* SECTION 4: How It Works */}
          <div className="panel p-7 relative overflow-hidden">
            <div className="flex items-center gap-2.5 mb-6">
              <span className="w-6 h-6 rounded-full bg-violet-600 text-white font-extrabold text-xs flex items-center justify-center shadow-md">
                4
              </span>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                How It Works
              </h3>
            </div>

            <div className="grid grid-cols-12 gap-6 items-center">
              
              {/* 5 Connected Timeline Steps */}
              <div className="col-span-12 lg:col-span-9 grid grid-cols-5 gap-2 relative">
                {[
                  { num: 1, title: "Upload / Input", desc: "Provide app details using any method", icon: Upload },
                  { num: 2, title: "Extract & Decompile", desc: "Extract app components and resources", icon: FolderArchive },
                  { num: 3, title: "AI Analysis", desc: "Run multiple AI models and checks", icon: BrainCircuit },
                  { num: 4, title: "Risk Scoring", desc: "Calculate fraud score and risk level", icon: ShieldCheck },
                  { num: 5, title: "Generate Report", desc: "Detailed report with insights and recommendations", icon: FileText },
                ].map((step, idx) => {
                  const Icon = step.icon;
                  return (
                    <div key={step.num} className="flex flex-col items-center text-center relative px-2">
                      {/* Connecting Line (except for last item) */}
                      {idx < 4 && (
                        <div className="hidden sm:block absolute top-6 left-[60%] right-[-40%] h-0.5 border-t-2 border-dashed border-violet-300 z-0" />
                      )}
                      
                      <div className="w-12 h-12 rounded-2xl bg-white border-2 border-violet-200 shadow-md flex items-center justify-center text-violet-600 mb-3 relative z-10">
                        <Icon size={20} />
                      </div>
                      
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="w-4 h-4 rounded-full bg-violet-100 text-violet-700 font-extrabold text-[9px] flex items-center justify-center">
                          {step.num}
                        </span>
                        <h4 className="text-xs font-extrabold text-slate-900">{step.title}</h4>
                      </div>
                      
                      <p className="text-[10px] font-medium text-slate-400 leading-tight">
                        {step.desc}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Right Side 3D Security Shield & Pedestal Graphic */}
              <div className="hidden lg:flex col-span-3 items-center justify-center p-2">
                <div className="relative w-36 h-32 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-violet-400/20 blur-xl animate-pulse" />
                  
                  {/* 3D Shield */}
                  <div className="relative z-10 w-20 h-24 rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-4 flex items-center justify-center text-white shadow-[0_10px_25px_rgba(124,58,237,0.3)] border-2 border-white/80 rotate-[4deg] hover:rotate-0 transition-transform duration-300">
                    <Check size={36} strokeWidth={3} className="drop-shadow" />
                  </div>

                  {/* 3D Pedestal Cylinders */}
                  <div className="absolute bottom-0 w-28 h-6 rounded-full bg-slate-200/80 border border-white shadow-md z-0" />
                </div>
              </div>

            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
