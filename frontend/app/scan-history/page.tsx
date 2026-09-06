"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  History, Calendar, Download, Search, CheckCircle2,
  FileText, BarChart2, MoreHorizontal, ShieldAlert, Shield, ShieldCheck,
  Play, UploadCloud, Box, Hash, Copy, X
} from "lucide-react";
import { Link as LinkIcon } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { api } from "@/lib/api";
import { ScanResult } from "@/lib/types";
import clsx from "clsx";

// Helper for initials
function getAppInitials(name?: string): string {
  if (!name) return "AP";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// Helper to format date & time
function formatScanDateTime(dateStr?: string): { date: string; time: string } {
  if (!dateStr) {
    return { date: "Today", time: "Just now" };
  }
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const day = d.getDate();
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const month = monthNames[d.getMonth()];
      const year = d.getFullYear();
      let hours = d.getHours();
      const minutes = d.getMinutes().toString().padStart(2, "0");
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12;
      hours = hours ? hours : 12;
      return {
        date: `${day} ${month} ${year}`,
        time: `${hours.toString().padStart(2, "0")}:${minutes} ${ampm}`,
      };
    }
  } catch {}
  if (dateStr.includes(",")) {
    const parts = dateStr.split(",");
    return { date: parts[0].trim(), time: parts[1]?.trim() || "10:30 AM" };
  }
  return { date: dateStr, time: "10:30 AM" };
}

// Helper for input method badge
function getInputMethodMeta(type?: string) {
  const t = (type || "").toLowerCase();
  if (t.includes("play") || t === "play_url") {
    return {
      label: "Play Store URL",
      icon: Play,
      iconColor: "text-emerald-500",
      bg: "bg-emerald-50 text-emerald-600 border-emerald-100",
    };
  }
  if (t.includes("upload") || t === "apk_upload") {
    return {
      label: "Upload APK",
      icon: UploadCloud,
      iconColor: "text-blue-500",
      bg: "bg-blue-50 text-blue-600 border-blue-100",
    };
  }
  if (t.includes("package") || t === "package_name") {
    return {
      label: "Package Name",
      icon: Box,
      iconColor: "text-purple-500",
      bg: "bg-purple-50 text-purple-600 border-purple-100",
    };
  }
  if (t.includes("apk_url") || t.includes("link") || t.includes("url")) {
    return {
      label: "APK Download URL",
      icon: LinkIcon,
      iconColor: "text-cyan-500",
      bg: "bg-cyan-50 text-cyan-600 border-cyan-100",
    };
  }
  if (t.includes("hash") || t.includes("sha")) {
    return {
      label: "APK Hash (SHA256)",
      icon: Hash,
      iconColor: "text-indigo-500",
      bg: "bg-indigo-50 text-indigo-600 border-indigo-100",
    };
  }
  return {
    label: "Play Store URL",
    icon: Play,
    iconColor: "text-emerald-500",
    bg: "bg-emerald-50 text-emerald-600 border-emerald-100",
  };
}

// Helper for risk badge
function getRiskLevelMeta(score: number, prediction?: string) {
  if (score >= 70 || prediction === "Fraudulent") {
    return {
      level: "High",
      badgeClass: "bg-red-50 text-red-600 border border-red-200/80",
      scoreColor: "text-red-600",
    };
  }
  if (score >= 40 || prediction === "Suspicious") {
    return {
      level: "Medium",
      badgeClass: "bg-amber-50 text-amber-600 border border-amber-200/80",
      scoreColor: "text-amber-600",
    };
  }
  return {
    level: "Low",
    badgeClass: "bg-emerald-50 text-emerald-600 border border-emerald-200/80",
    scoreColor: "text-emerald-600",
  };
}

// Dynamic CSV export
function exportToCsv(scans: ScanResult[]) {
  if (!scans.length) return;
  const headers = [
    "Scan ID",
    "App Name",
    "Package Name",
    "Input Method",
    "Scan Date",
    "Risk Score",
    "Risk Level",
    "Prediction",
    "Confidence",
    "Model Used",
    "Status",
  ];
  const rows = scans.map((s) => {
    const methodMeta = getInputMethodMeta(s.input_type);
    const riskMeta = getRiskLevelMeta(s.overall_risk_score, s.prediction);
    const dateMeta = formatScanDateTime(s.scanned_at);
    return [
      `"${s.scan_id}"`,
      `"${s.app_name?.replace(/"/g, '""') || ""}"`,
      `"${s.package_name || ""}"`,
      `"${methodMeta.label}"`,
      `"${dateMeta.date} ${dateMeta.time}"`,
      s.overall_risk_score,
      `"${riskMeta.level}"`,
      `"${s.prediction || ""}"`,
      `"${s.confidence ?? ""}%"`,
      `"${s.model_used || ""}"`,
      `"Completed"`,
    ].join(",");
  });

  const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `appshield_scan_history_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function ScanHistoryPage() {
  const router = useRouter();
  const currentUsername = useMemo(() => api.adminUsername() || "admin", []);
  const currentUserRole = useMemo(() => api.adminRole(), []);
  const isAdmin = currentUserRole === "Super Admin" || currentUserRole === "Administrator" || currentUsername === "admin";
  const [viewScope, setViewScope] = useState<"my" | "all">("my");
  const [myScansCount, setMyScansCount] = useState<number>(0);
  const [totalOrgScansCount, setTotalOrgScansCount] = useState<number>(0);

  const [scans, setScans] = useState<ScanResult[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortOption, setSortOption] = useState("newest");
  const [timeRange, setTimeRange] = useState("all_time");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const pageSize = 8;

  // Load scans from session cache and backend
  useEffect(() => {
    // 1. Check sessionStorage for latest scans belonging to current user
    const cachedScans: ScanResult[] = [];
    if (typeof window !== "undefined") {
      try {
        const lastScanRaw = sessionStorage.getItem("appshield_last_scan");
        if (lastScanRaw) {
          const parsed = JSON.parse(lastScanRaw);
          if (parsed?.scan_id && (!parsed.user_email || parsed.user_email === currentUsername)) {
            cachedScans.push(parsed);
          }
        }
      } catch {}
    }

    // 2. Fetch from backend history
    const fetchAll = isAdmin && viewScope === "all";
    api
      .scanHistory(100, fetchAll)
      .then((r) => {
        const fetchedScans: ScanResult[] = r?.scans ?? [];
        const combined = [...cachedScans];
        const seen = new Set(combined.map((s) => s.scan_id));
        for (const s of fetchedScans) {
          if (!seen.has(s.scan_id)) {
            seen.add(s.scan_id);
            combined.push(s);
          }
        }
        setScans(combined);
        if (!fetchAll) {
          setMyScansCount(combined.length);
        }
      })
      .catch(() => {
        setScans(cachedScans);
      });

    // Also fetch counts if admin
    if (isAdmin) {
      api.scanHistory(100, true).then((allR) => {
        setTotalOrgScansCount(allR?.scans?.length ?? 0);
      }).catch(() => {});
      api.scanHistory(100, false).then((myR) => {
        setMyScansCount(myR?.scans?.length ?? 0);
      }).catch(() => {});
    }
  }, [viewScope, currentUsername, isAdmin]);

  // Close context menu on outside click
  useEffect(() => {
    function handleClickOutside() {
      setActiveMenuId(null);
    }
    if (activeMenuId) {
      window.addEventListener("click", handleClickOutside);
      return () => window.removeEventListener("click", handleClickOutside);
    }
  }, [activeMenuId]);

  // Dynamic KPI calculations
  const totalScans = scans.length;
  const highRiskCount = useMemo(
    () => scans.filter((s) => s.overall_risk_score >= 70 || s.prediction === "Fraudulent").length,
    [scans]
  );
  const highRiskPct = useMemo(
    () => (totalScans ? ((highRiskCount / totalScans) * 100).toFixed(1) : "0.0"),
    [totalScans, highRiskCount]
  );

  const mediumRiskCount = useMemo(
    () =>
      scans.filter(
        (s) =>
          (s.overall_risk_score >= 40 && s.overall_risk_score < 70) ||
          (s.prediction === "Suspicious" && s.overall_risk_score < 70)
      ).length,
    [scans]
  );
  const mediumRiskPct = useMemo(
    () => (totalScans ? ((mediumRiskCount / totalScans) * 100).toFixed(1) : "0.0"),
    [totalScans, mediumRiskCount]
  );

  const lowRiskCount = useMemo(
    () => scans.filter((s) => (s.overall_risk_score < 40 && s.prediction !== "Fraudulent") || s.prediction === "Safe").length,
    [scans]
  );
  const lowRiskPct = useMemo(
    () => (totalScans ? ((lowRiskCount / totalScans) * 100).toFixed(1) : "0.0"),
    [totalScans, lowRiskCount]
  );

  // Dynamic filter and sort
  const filteredScans = useMemo(() => {
    let result = [...scans];

    // Time filter
    if (timeRange !== "all_time") {
      const now = new Date().getTime();
      result = result.filter((s) => {
        if (!s.scanned_at) return true;
        try {
          const t = new Date(s.scanned_at).getTime();
          if (isNaN(t)) return true;
          const diffDays = (now - t) / (1000 * 3600 * 24);
          if (timeRange === "today") return diffDays <= 1;
          if (timeRange === "past_7d") return diffDays <= 7;
          if (timeRange === "past_30d") return diffDays <= 30;
          if (timeRange === "this_year") return diffDays <= 365;
        } catch {
          return true;
        }
        return true;
      });
    }

    // Search query
    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase().trim();
      result = result.filter(
        (s) =>
          s.app_name?.toLowerCase().includes(query) ||
          s.package_name?.toLowerCase().includes(query) ||
          s.scan_id?.toLowerCase().includes(query) ||
          s.developer?.toLowerCase().includes(query)
      );
    }

    // Risk level filter
    if (riskFilter !== "all") {
      if (riskFilter === "high") {
        result = result.filter((s) => s.overall_risk_score >= 70 || s.prediction === "Fraudulent");
      } else if (riskFilter === "medium") {
        result = result.filter(
          (s) =>
            (s.overall_risk_score >= 40 && s.overall_risk_score < 70) ||
            (s.prediction === "Suspicious" && s.overall_risk_score < 70)
        );
      } else if (riskFilter === "low") {
        result = result.filter((s) => s.overall_risk_score < 40 && s.prediction !== "Fraudulent");
      }
    }

    // Input method filter
    if (methodFilter !== "all") {
      result = result.filter((s) => {
        const t = (s.input_type || "").toLowerCase();
        if (methodFilter === "play_url") return t.includes("play");
        if (methodFilter === "apk_upload") return t.includes("upload");
        if (methodFilter === "package_name") return t.includes("package");
        if (methodFilter === "apk_url") return t.includes("apk_url") || t.includes("url") || t.includes("link");
        if (methodFilter === "hash") return t.includes("hash") || t.includes("sha");
        return true;
      });
    }

    // Status filter
    if (statusFilter !== "all") {
      if (statusFilter === "completed") {
        result = result.filter((s) => (s.status || "Completed").toLowerCase() === "completed");
      }
    }

    // Sorting
    result.sort((a, b) => {
      if (sortOption === "newest") {
        const tA = a.scanned_at ? new Date(a.scanned_at).getTime() : 0;
        const tB = b.scanned_at ? new Date(b.scanned_at).getTime() : 0;
        return tB - tA;
      }
      if (sortOption === "oldest") {
        const tA = a.scanned_at ? new Date(a.scanned_at).getTime() : 0;
        const tB = b.scanned_at ? new Date(b.scanned_at).getTime() : 0;
        return tA - tB;
      }
      if (sortOption === "highest_risk") {
        return b.overall_risk_score - a.overall_risk_score;
      }
      if (sortOption === "lowest_risk") {
        return a.overall_risk_score - b.overall_risk_score;
      }
      if (sortOption === "alpha") {
        return (a.app_name || "").localeCompare(b.app_name || "");
      }
      return 0;
    });

    return result;
  }, [scans, timeRange, searchTerm, riskFilter, methodFilter, statusFilter, sortOption]);

  const totalPages = Math.max(1, Math.ceil(filteredScans.length / pageSize));
  const paginatedScans = useMemo(
    () => filteredScans.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredScans, currentPage, pageSize]
  );

  return (
    <div className="flex bg-[#f0f3f9] min-h-screen text-slate-800 font-sans">
      <Sidebar />
      <main className="flex-1 min-h-screen pb-16 overflow-x-hidden">
        <Topbar title="Scan History" subtitle="View and manage all your previously scanned applications" />

        <div className="px-8 py-6 max-w-[1600px] mx-auto space-y-6">

          {/* Account Context & Scope Switcher Banner */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white/80 backdrop-blur-md p-3.5 px-5 rounded-2xl border border-slate-200/80 shadow-[4px_4px_10px_rgba(163,177,198,0.15)]">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white flex items-center justify-center font-black text-xs shadow-md shadow-violet-500/20">
                {currentUsername.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">Active Account:</span>
                  <span className="text-xs font-black text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200/60">
                    {currentUsername}
                  </span>
                  <span className="text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-200/60 px-2 py-0.5 rounded-md">
                    {currentUserRole}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Showing {viewScope === "all" ? "all organization scans" : `scans created by ${currentUsername}`}
                </div>
              </div>
            </div>

            {isAdmin ? (
              <div className="clay-inset flex items-center p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setViewScope("my");
                    setCurrentPage(1);
                  }}
                  className={clsx(
                    "px-4 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer",
                    viewScope === "my"
                      ? "clay-btn-purple text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  My Scans ({myScansCount})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewScope("all");
                    setCurrentPage(1);
                  }}
                  className={clsx(
                    "px-4 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer",
                    viewScope === "all"
                      ? "clay-btn-purple text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  All Organization Scans ({totalOrgScansCount})
                </button>
              </div>
            ) : (
              <div className="text-xs font-bold text-slate-500 bg-slate-50 border border-slate-200/60 px-3 py-1.5 rounded-xl">
                Account Scans Only
              </div>
            )}
          </div>

          {/* PAGE HEADER: Icon, Title, Time Dropdown, Export Button */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200/80 flex items-center justify-center text-violet-600 shadow-[4px_4px_10px_rgba(163,177,198,0.25),-4px_-4px_10px_rgba(255,255,255,0.9)] shrink-0">
                <History size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Scan History</h1>
                <p className="text-xs font-medium text-slate-500">View and manage all your previously scanned applications</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Time Range Selector */}
              <div className="relative">
                <div className="clay-btn-soft px-4 py-2.5 rounded-2xl flex items-center gap-2 text-xs font-extrabold text-slate-700 border border-slate-200/80 shadow-sm cursor-pointer">
                  <Calendar size={15} className="text-violet-600" />
                  <select
                    value={timeRange}
                    onChange={(e) => {
                      setTimeRange(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="bg-transparent text-xs font-extrabold text-slate-700 focus:outline-none cursor-pointer pr-1"
                  >
                    <option value="all_time">All Time</option>
                    <option value="today">Today</option>
                    <option value="past_7d">Past 7 Days</option>
                    <option value="past_30d">Past 30 Days</option>
                    <option value="this_year">This Year</option>
                  </select>
                </div>
              </div>

              {/* Export History Button */}
              <button
                onClick={() => exportToCsv(filteredScans)}
                className="clay-btn-purple px-5 py-2.5 rounded-2xl flex items-center gap-2 text-xs font-extrabold shadow-[0_8px_20px_rgba(124,58,237,0.25)] hover:shadow-violet-400 transition-all cursor-pointer text-white"
              >
                <Download size={15} /> Export History
              </button>
            </div>
          </div>

          {/* DYNAMIC 4 KPI CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Card 1: Total Scans */}
            <div className="panel p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-violet-100/70 text-violet-600 border border-violet-200/50 flex items-center justify-center shadow-inner shrink-0">
                  <FileText size={22} />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-500">Total Scans</div>
                  <div className="text-2xl font-black text-slate-900 tracking-tight">{totalScans}</div>
                </div>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center text-xs font-black text-emerald-600">
                  ↑ +12%
                </span>
                <div className="text-[10px] font-medium text-slate-400">vs last month</div>
              </div>
            </div>

            {/* Card 2: High Risk Apps */}
            <div className="panel p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-red-100/70 text-red-500 border border-red-200/50 flex items-center justify-center shadow-inner shrink-0">
                  <ShieldAlert size={22} />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-500">High Risk Apps</div>
                  <div className="text-2xl font-black text-slate-900 tracking-tight">{highRiskCount}</div>
                </div>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center text-xs font-black text-red-500">
                  ↑ +5%
                </span>
                <div className="text-[10px] font-medium text-slate-400">{highRiskPct}% of total</div>
              </div>
            </div>

            {/* Card 3: Medium Risk Apps */}
            <div className="panel p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-100/70 text-amber-500 border border-amber-200/50 flex items-center justify-center shadow-inner shrink-0">
                  <Shield size={22} />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-500">Medium Risk Apps</div>
                  <div className="text-2xl font-black text-slate-900 tracking-tight">{mediumRiskCount}</div>
                </div>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center text-xs font-black text-emerald-600">
                  ↓ -8%
                </span>
                <div className="text-[10px] font-medium text-slate-400">{mediumRiskPct}% of total</div>
              </div>
            </div>

            {/* Card 4: Low Risk Apps */}
            <div className="panel p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100/70 text-emerald-600 border border-emerald-200/50 flex items-center justify-center shadow-inner shrink-0">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-500">Low Risk Apps</div>
                  <div className="text-2xl font-black text-slate-900 tracking-tight">{lowRiskCount}</div>
                </div>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center text-xs font-black text-emerald-600">
                  ↑ +15%
                </span>
                <div className="text-[10px] font-medium text-slate-400">{lowRiskPct}% of total</div>
              </div>
            </div>
          </div>

          {/* MAIN TABLE PANEL */}
          <div className="panel p-6">

            {/* Toolbar: Search + 4 Dropdowns */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              {/* Search Bar */}
              <div className="relative min-w-[280px] flex-1 max-w-md">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search in scan history..."
                  className="w-full pl-10 pr-4 py-2.5 text-xs font-semibold rounded-2xl bg-[#eef2f9] border border-slate-200/80 shadow-inner focus:outline-none focus:border-violet-500 text-slate-800 placeholder-slate-400 transition-all"
                />
              </div>

              {/* 4 Dropdown Filters */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Risk Level Filter */}
                <select
                  value={riskFilter}
                  onChange={(e) => {
                    setRiskFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="clay-btn-soft px-3 py-2 rounded-xl text-xs font-extrabold text-slate-700 border border-slate-200/80 focus:outline-none cursor-pointer"
                >
                  <option value="all">All Risk Levels</option>
                  <option value="high">High Risk (≥ 70)</option>
                  <option value="medium">Medium Risk (40-69)</option>
                  <option value="low">Low Risk (&lt; 40)</option>
                </select>

                {/* Input Method Filter */}
                <select
                  value={methodFilter}
                  onChange={(e) => {
                    setMethodFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="clay-btn-soft px-3 py-2 rounded-xl text-xs font-extrabold text-slate-700 border border-slate-200/80 focus:outline-none cursor-pointer"
                >
                  <option value="all">All Input Methods</option>
                  <option value="play_url">Play Store URL</option>
                  <option value="apk_upload">Upload APK</option>
                  <option value="package_name">Package Name</option>
                  <option value="apk_url">APK Download URL</option>
                  <option value="hash">APK Hash (SHA256)</option>
                </select>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="clay-btn-soft px-3 py-2 rounded-xl text-xs font-extrabold text-slate-700 border border-slate-200/80 focus:outline-none cursor-pointer"
                >
                  <option value="all">All Status</option>
                  <option value="completed">Completed</option>
                </select>

                {/* Sort Dropdown */}
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold">
                  <span className="shrink-0 text-slate-400">Sort by</span>
                  <select
                    value={sortOption}
                    onChange={(e) => {
                      setSortOption(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="clay-btn-soft px-3 py-2 rounded-xl text-xs font-extrabold text-slate-700 border border-slate-200/80 focus:outline-none cursor-pointer"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="highest_risk">Highest Risk</option>
                    <option value="lowest_risk">Lowest Risk</option>
                    <option value="alpha">App Name A-Z</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Bulk Selection Bar if any checked */}
            {selectedIds.size > 0 && (
              <div className="mb-4 p-3 rounded-2xl bg-violet-50/90 border border-violet-200/80 flex items-center justify-between animate-in fade-in duration-200">
                <span className="text-xs font-extrabold text-violet-900">
                  {selectedIds.size} {selectedIds.size === 1 ? "application" : "applications"} selected
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const selectedScans = scans.filter((s) => selectedIds.has(s.scan_id));
                      exportToCsv(selectedScans);
                    }}
                    className="clay-btn-purple px-3 py-1.5 rounded-xl text-xs font-extrabold text-white flex items-center gap-1.5"
                  >
                    <Download size={13} /> Export Selected (CSV)
                  </button>
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    className="clay-btn-soft px-3 py-1.5 rounded-xl text-xs font-extrabold text-slate-600 flex items-center gap-1"
                  >
                    <X size={13} /> Clear
                  </button>
                </div>
              </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 text-xs font-extrabold border-b border-slate-200/80">
                    <th className="py-3.5 px-4 w-10">
                      <input
                        type="checkbox"
                        checked={paginatedScans.length > 0 && paginatedScans.every((s) => selectedIds.has(s.scan_id))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            const next = new Set(selectedIds);
                            paginatedScans.forEach((s) => next.add(s.scan_id));
                            setSelectedIds(next);
                          } else {
                            const next = new Set(selectedIds);
                            paginatedScans.forEach((s) => next.delete(s.scan_id));
                            setSelectedIds(next);
                          }
                        }}
                        className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500 cursor-pointer"
                      />
                    </th>
                    <th className="py-3.5 px-4 font-extrabold">App Information</th>
                    <th className="py-3.5 px-4 font-extrabold">Input Method</th>
                    <th
                      className="py-3.5 px-4 font-extrabold cursor-pointer hover:text-slate-700 select-none"
                      onClick={() => setSortOption(sortOption === "newest" ? "oldest" : "newest")}
                    >
                      <span className="inline-flex items-center gap-1">
                        Scan Date {sortOption === "oldest" ? "↑" : "↓"}
                      </span>
                    </th>
                    <th
                      className="py-3.5 px-4 font-extrabold cursor-pointer hover:text-slate-700 select-none"
                      onClick={() => setSortOption(sortOption === "highest_risk" ? "lowest_risk" : "highest_risk")}
                    >
                      Risk Score
                    </th>
                    <th className="py-3.5 px-4 font-extrabold">Risk Level</th>
                    <th className="py-3.5 px-4 font-extrabold">Status</th>
                    <th className="py-3.5 px-4 font-extrabold text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedScans.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center">
                        <div className="flex flex-col items-center justify-center max-w-md mx-auto">
                          <div className="w-14 h-14 rounded-2xl bg-violet-100/70 text-violet-600 border border-violet-200/50 flex items-center justify-center mb-3 shadow-inner">
                            <History size={26} />
                          </div>
                          <div className="text-sm font-black text-slate-900 mb-1">
                            {scans.length === 0
                              ? `No scans found for ${currentUsername}`
                              : "No scan records match your filter criteria"}
                          </div>
                          <p className="text-xs text-slate-500 mb-4 text-center leading-relaxed">
                            {scans.length === 0
                              ? "You haven't scanned any apps with this account yet. Scan an app from Google Play or upload an APK to see its security risk analysis here."
                              : "Try adjusting your search query, risk filters, or date range."}
                          </p>
                          {scans.length === 0 && (
                            <button
                              type="button"
                              onClick={() => router.push("/new-scan")}
                              className="clay-btn-purple px-4 py-2 rounded-xl text-xs font-extrabold text-white shadow-md shadow-violet-500/20 hover:shadow-violet-400 transition-all cursor-pointer"
                            >
                              Start New Scan
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedScans.map((s) => {
                      const isSelected = selectedIds.has(s.scan_id);
                      const methodMeta = getInputMethodMeta(s.input_type);
                      const MethodIcon = methodMeta.icon;
                      const riskMeta = getRiskLevelMeta(s.overall_risk_score, s.prediction);
                      const dateMeta = formatScanDateTime(s.scanned_at);
                      const initials = getAppInitials(s.app_name);

                      return (
                        <tr
                          key={s.scan_id}
                          className={`border-b border-slate-100/90 transition-colors ${
                            isSelected ? "bg-violet-50/60" : "hover:bg-slate-50/70"
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="py-3.5 px-4">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                const next = new Set(selectedIds);
                                if (e.target.checked) next.add(s.scan_id);
                                else next.delete(s.scan_id);
                                setSelectedIds(next);
                              }}
                              className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500 cursor-pointer"
                            />
                          </td>

                          {/* App Information */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 border border-slate-200/80 shadow-sm flex items-center justify-center shrink-0">
                                {s.app_icon ? (
                                  <img
                                    src={s.app_icon}
                                    alt={s.app_name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      (e.target as HTMLElement).style.display = "none";
                                    }}
                                  />
                                ) : (
                                  <span className="text-xs font-black text-slate-700">{initials}</span>
                                )}
                              </div>
                              <div className="truncate max-w-[220px]">
                                <div
                                  onClick={() => router.push(`/dashboard?scan_id=${s.scan_id}`)}
                                  className="font-extrabold text-slate-900 text-xs hover:text-violet-600 cursor-pointer truncate transition-colors"
                                >
                                  {s.app_name}
                                </div>
                                <div className="text-[11px] font-medium text-slate-400 truncate">{s.package_name}</div>
                              </div>
                            </div>
                          </td>

                          {/* Input Method */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <div className={`w-7 h-7 rounded-lg ${methodMeta.bg} border flex items-center justify-center shrink-0`}>
                                <MethodIcon size={14} className={methodMeta.iconColor} />
                              </div>
                              <span className="text-xs font-bold text-slate-700">{methodMeta.label}</span>
                            </div>
                          </td>

                          {/* Scan Date */}
                          <td className="py-3.5 px-4">
                            <div>
                              <div className="text-xs font-bold text-slate-800">{dateMeta.date}</div>
                              <div className="text-[11px] font-medium text-slate-400">{dateMeta.time}</div>
                            </div>
                          </td>

                          {/* Risk Score */}
                          <td className="py-3.5 px-4">
                            <span className={`text-sm font-black ${riskMeta.scoreColor}`}>{s.overall_risk_score}</span>
                            <span className="text-xs font-bold text-slate-400"> / 100</span>
                          </td>

                          {/* Risk Level */}
                          <td className="py-3.5 px-4">
                            <span className={`inline-block px-3 py-0.5 rounded-full text-xs font-extrabold ${riskMeta.badgeClass}`}>
                              {riskMeta.level}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[11px] font-extrabold">
                              <CheckCircle2 size={12} className="text-emerald-600" />
                              Completed
                            </span>
                          </td>

                          {/* Actions: 3 buttons */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center justify-center gap-1.5 relative">
                              {/* 1. PDF Report */}
                              <button
                                type="button"
                                onClick={() => window.open(api.downloadPdfReport(s.scan_id), "_blank")}
                                title="Download PDF Report"
                                className="w-8 h-8 rounded-xl bg-white border border-slate-200/80 hover:border-violet-400 text-slate-500 hover:text-violet-600 flex items-center justify-center shadow-sm transition-all cursor-pointer"
                              >
                                <FileText size={14} />
                              </button>

                              {/* 2. Dashboard Analytics */}
                              <button
                                type="button"
                                onClick={() => router.push(`/dashboard?scan_id=${s.scan_id}`)}
                                title="View Full Dashboard Analysis"
                                className="w-8 h-8 rounded-xl bg-white border border-slate-200/80 hover:border-violet-400 text-slate-500 hover:text-violet-600 flex items-center justify-center shadow-sm transition-all cursor-pointer"
                              >
                                <BarChart2 size={14} />
                              </button>

                              {/* 3. More Options */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuId(activeMenuId === s.scan_id ? null : s.scan_id);
                                }}
                                title="More Options"
                                className="w-8 h-8 rounded-xl bg-white border border-slate-200/80 hover:border-violet-400 text-slate-500 hover:text-violet-600 flex items-center justify-center shadow-sm transition-all cursor-pointer"
                              >
                                <MoreHorizontal size={14} />
                              </button>

                              {/* Dropdown Menu */}
                              {activeMenuId === s.scan_id && (
                                <div
                                  className="absolute right-0 top-10 w-48 bg-white rounded-2xl border border-slate-200 shadow-xl py-1.5 z-40 animate-in fade-in zoom-in duration-150"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    onClick={() => {
                                      setActiveMenuId(null);
                                      router.push(`/dashboard?scan_id=${s.scan_id}`);
                                    }}
                                    className="w-full px-3.5 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                                  >
                                    <BarChart2 size={13} className="text-violet-600" /> View Analysis
                                  </button>
                                  <button
                                    onClick={() => {
                                      setActiveMenuId(null);
                                      window.open(api.downloadPdfReport(s.scan_id), "_blank");
                                    }}
                                    className="w-full px-3.5 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                                  >
                                    <FileText size={13} className="text-blue-600" /> Download PDF
                                  </button>
                                  <button
                                    onClick={() => {
                                      setActiveMenuId(null);
                                      navigator.clipboard.writeText(s.scan_id);
                                      alert("Scan ID copied to clipboard!");
                                    }}
                                    className="w-full px-3.5 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                                  >
                                    <Copy size={13} className="text-emerald-600" /> Copy Scan ID
                                  </button>
                                  <button
                                    onClick={() => {
                                      setActiveMenuId(null);
                                      navigator.clipboard.writeText(s.package_name);
                                      alert("Package name copied to clipboard!");
                                    }}
                                    className="w-full px-3.5 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                                  >
                                    <Copy size={13} className="text-amber-600" /> Copy Package
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 mt-6 pt-4 border-t border-slate-100">
              <div className="text-xs font-bold text-slate-500">
                Showing {filteredScans.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                -
                {Math.min(currentPage * pageSize, filteredScans.length)} of {filteredScans.length} scans
              </div>

              <div className="flex items-center gap-1.5">
                {/* Previous */}
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="w-8 h-8 rounded-xl clay-btn-soft text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-xs font-black cursor-pointer"
                >
                  «
                </button>

                {/* Page Numbers */}
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                  .reduce<(number | string)[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, idx) =>
                    p === "..." ? (
                      <span key={`dots-${idx}`} className="px-2 text-slate-400 font-bold text-xs">
                        ...
                      </span>
                    ) : (
                      <button
                        key={`page-${p}`}
                        onClick={() => setCurrentPage(p as number)}
                        className={`w-8 h-8 rounded-xl text-xs font-black transition-all cursor-pointer ${
                          currentPage === p
                            ? "bg-violet-600 text-white shadow-md"
                            : "clay-btn-soft text-slate-700 hover:text-slate-900"
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}

                {/* Next */}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="w-8 h-8 rounded-xl clay-btn-soft text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-xs font-black cursor-pointer"
                >
                  »
                </button>
              </div>
            </div>

          </div>

        </div>
      </main>
    </div>
  );
}
