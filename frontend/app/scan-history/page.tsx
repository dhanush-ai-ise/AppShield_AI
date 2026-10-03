"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  History, Calendar, Download, Search, CheckCircle2,
  FileText, BarChart2, MoreHorizontal, ShieldAlert, Shield, ShieldCheck,
  Play, UploadCloud, Box, Hash, Copy, X, ArrowUpDown, Trash2, AlertTriangle
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
      label: "Play Store",
      icon: Play,
      iconColor: "text-emerald-600",
      bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
  }
  if (t.includes("upload") || t === "apk_upload") {
    return {
      label: "APK Upload",
      icon: UploadCloud,
      iconColor: "text-blue-600",
      bg: "bg-blue-50 text-blue-700 border-blue-200",
    };
  }
  if (t.includes("package") || t === "package_name") {
    return {
      label: "Package ID",
      icon: Box,
      iconColor: "text-indigo-600",
      bg: "bg-indigo-50 text-indigo-700 border-indigo-200",
    };
  }
  if (t.includes("apk_url") || t.includes("link") || t.includes("url")) {
    return {
      label: "APK URL",
      icon: LinkIcon,
      iconColor: "text-sky-600",
      bg: "bg-sky-50 text-sky-700 border-sky-200",
    };
  }
  if (t.includes("hash") || t.includes("sha")) {
    return {
      label: "SHA-256",
      icon: Hash,
      iconColor: "text-slate-600",
      bg: "bg-slate-100 text-slate-700 border-slate-200",
    };
  }
  return {
    label: "Play Store",
    icon: Play,
    iconColor: "text-emerald-600",
    bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
}

// Helper for risk badge
function getRiskLevelMeta(score: number, prediction?: string) {
  if (score >= 70 || prediction === "Fraudulent") {
    return {
      level: "Critical Fraud",
      badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
      scoreColor: "text-rose-600",
    };
  }
  if (score >= 30 || prediction === "Suspicious") {
    return {
      level: "Suspicious",
      badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
      scoreColor: "text-amber-600",
    };
  }
  return {
    level: "Verified Safe",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
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
  link.setAttribute("download", `appshield_audit_history_${new Date().toISOString().slice(0, 10)}.csv`);
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
  const pageSize = 10;

  // Deletion and confirmation state
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string } | null>(null);
  const [showBatchConfirm, setShowBatchConfirm] = useState<boolean>(false);

  // Auto-dismiss delete notice
  useEffect(() => {
    if (deleteNotice) {
      const timer = setTimeout(() => setDeleteNotice(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [deleteNotice]);

  const executeDeleteSingle = async (scanId: string, appName: string) => {
    setIsDeleting(true);
    try {
      await api.deleteScan(scanId);
      setScans((prev) => prev.filter((s) => s.scan_id !== scanId));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(scanId);
        return next;
      });
      if (typeof window !== "undefined") {
        try {
          const lastRaw = sessionStorage.getItem("appshield_last_scan");
          if (lastRaw && JSON.parse(lastRaw)?.scan_id === scanId) {
            sessionStorage.removeItem("appshield_last_scan");
          }
          sessionStorage.removeItem(`appshield_scan_${scanId}`);
        } catch {}
      }
      setItemToDelete(null);
      setDeleteNotice(`Successfully deleted scan record for "${appName}".`);
    } catch (err: any) {
      alert(err.message || "Failed to delete scan record.");
    } finally {
      setIsDeleting(false);
    }
  };

  const executeBatchDelete = async () => {
    if (!selectedIds.size) return;
    setIsDeleting(true);
    const ids = Array.from(selectedIds);
    try {
      await api.deleteScansBatch(ids);
      setScans((prev) => prev.filter((s) => !selectedIds.has(s.scan_id)));
      if (typeof window !== "undefined") {
        try {
          const lastRaw = sessionStorage.getItem("appshield_last_scan");
          if (lastRaw && selectedIds.has(JSON.parse(lastRaw)?.scan_id)) {
            sessionStorage.removeItem("appshield_last_scan");
          }
          ids.forEach((sid) => sessionStorage.removeItem(`appshield_scan_${sid}`));
        } catch {}
      }
      const count = selectedIds.size;
      setSelectedIds(new Set());
      setShowBatchConfirm(false);
      setDeleteNotice(`Successfully deleted ${count} scan dossiers from the database.`);
    } catch (err: any) {
      alert(err.message || "Failed to batch delete records.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Load scans from session cache and backend
  useEffect(() => {
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

  // KPI calculations
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
          (s.overall_risk_score >= 30 && s.overall_risk_score < 70) ||
          (s.prediction === "Suspicious" && s.overall_risk_score < 70)
      ).length,
    [scans]
  );
  const mediumRiskPct = useMemo(
    () => (totalScans ? ((mediumRiskCount / totalScans) * 100).toFixed(1) : "0.0"),
    [totalScans, mediumRiskCount]
  );

  const lowRiskCount = useMemo(
    () => scans.filter((s) => (s.overall_risk_score < 30 && s.prediction !== "Fraudulent") || s.prediction === "Safe").length,
    [scans]
  );
  const lowRiskPct = useMemo(
    () => (totalScans ? ((lowRiskCount / totalScans) * 100).toFixed(1) : "0.0"),
    [totalScans, lowRiskCount]
  );

  // Filter and sort
  const filteredScans = useMemo(() => {
    let result = [...scans];

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

    if (riskFilter !== "all") {
      if (riskFilter === "high") {
        result = result.filter((s) => s.overall_risk_score >= 70 || s.prediction === "Fraudulent");
      } else if (riskFilter === "medium") {
        result = result.filter(
          (s) =>
            (s.overall_risk_score >= 30 && s.overall_risk_score < 70) ||
            (s.prediction === "Suspicious" && s.overall_risk_score < 70)
        );
      } else if (riskFilter === "low") {
        result = result.filter((s) => s.overall_risk_score < 30 && s.prediction !== "Fraudulent");
      }
    }

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

    if (statusFilter !== "all") {
      if (statusFilter === "completed") {
        result = result.filter((s) => (s.status || "Completed").toLowerCase() === "completed");
      }
    }

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
    <div className="flex bg-[#f8fafc] min-h-screen text-slate-800 font-sans">
      <Sidebar />
      <main className="flex-1 min-h-screen pb-16 overflow-x-hidden">
        <Topbar title="Security Audit Explorer" subtitle="Forensic dossiers and historical telemetry across inspected applications" />

        <div className="px-8 py-6 max-w-7xl mx-auto space-y-6">

          {/* Account Scope Switcher Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-slate-200/90 p-3.5 px-4 rounded-xl shadow-card">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs">
                {currentUsername.slice(0, 2).toUpperCase()}
              </div>
              <div className="leading-tight">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">{currentUsername}</span>
                  <span className="text-[10px] font-mono font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                    {currentUserRole}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Scope: {viewScope === "all" ? "All organization audit records" : `Dossiers created by ${currentUsername}`}
                </div>
              </div>
            </div>

            {isAdmin && (
              <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200/60">
                <button
                  type="button"
                  onClick={() => {
                    setViewScope("my");
                    setCurrentPage(1);
                  }}
                  className={clsx(
                    "px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer",
                    viewScope === "my"
                      ? "bg-white text-slate-900 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  My Dossiers ({myScansCount})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewScope("all");
                    setCurrentPage(1);
                  }}
                  className={clsx(
                    "px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer",
                    viewScope === "all"
                      ? "bg-white text-slate-900 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  All Org Dossiers ({totalOrgScansCount})
                </button>
              </div>
            )}
          </div>

          {/* 4 Metric KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-card flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider font-mono">
                  Total Analyzed
                </div>
                <div className="text-2xl font-bold font-mono text-slate-900 mt-1">{totalScans}</div>
              </div>
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                <FileText size={18} />
              </div>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-card flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider font-mono">
                  Critical Fraud
                </div>
                <div className="text-2xl font-bold font-mono text-rose-600 mt-1">{highRiskCount}</div>
              </div>
              <div className="p-2 rounded-lg bg-rose-50 text-rose-600">
                <ShieldAlert size={18} />
              </div>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-card flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider font-mono">
                  Suspicious Apps
                </div>
                <div className="text-2xl font-bold font-mono text-amber-600 mt-1">{mediumRiskCount}</div>
              </div>
              <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                <Shield size={18} />
              </div>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-card flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider font-mono">
                  Verified Safe
                </div>
                <div className="text-2xl font-bold font-mono text-emerald-600 mt-1">{lowRiskCount}</div>
              </div>
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                <ShieldCheck size={18} />
              </div>
            </div>
          </div>

          {/* Delete Notice Banner */}
          {deleteNotice && (
            <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between shadow-2xs animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-medium">{deleteNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setDeleteNotice(null)}
                className="text-slate-400 hover:text-slate-700 text-xs px-2 py-0.5 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Table Container */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-card space-y-4">

            {/* Filter Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Search */}
              <div className="relative min-w-[260px] flex-1 max-w-md">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Filter by package name, title, or SHA-256..."
                  className="w-full h-8 pl-8 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-500 transition-colors"
                />
              </div>

              {/* Filters & Export */}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={riskFilter}
                  onChange={(e) => {
                    setRiskFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-8 px-2.5 rounded-lg text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 focus:outline-none"
                >
                  <option value="all">All Risk Tiers</option>
                  <option value="high">Critical Fraud (≥ 70)</option>
                  <option value="medium">Suspicious (30–69)</option>
                  <option value="low">Verified Safe (&lt; 30)</option>
                </select>

                <select
                  value={methodFilter}
                  onChange={(e) => {
                    setMethodFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-8 px-2.5 rounded-lg text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 focus:outline-none"
                >
                  <option value="all">All Ingestion Vectors</option>
                  <option value="play_url">Play Store</option>
                  <option value="apk_upload">APK Upload</option>
                  <option value="package_name">Package ID</option>
                  <option value="apk_url">Direct URL</option>
                  <option value="hash">SHA-256</option>
                </select>

                <select
                  value={timeRange}
                  onChange={(e) => {
                    setTimeRange(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-8 px-2.5 rounded-lg text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 focus:outline-none"
                >
                  <option value="all_time">All Time</option>
                  <option value="today">Today</option>
                  <option value="past_7d">Past 7 Days</option>
                  <option value="past_30d">Past 30 Days</option>
                </select>

                {selectedIds.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowBatchConfirm(true)}
                    className="h-8 px-3 rounded-lg flex items-center gap-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer shadow-xs animate-in fade-in"
                    title="Delete selected applications"
                  >
                    <Trash2 size={13} />
                    <span>Delete Selected ({selectedIds.size})</span>
                  </button>
                )}
              </div>
            </div>

            {/* Bulk Selection Ribbon */}
            {selectedIds.size > 0 && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-between text-xs animate-in fade-in">
                <span className="font-semibold text-rose-900">
                  {selectedIds.size} {selectedIds.size === 1 ? "record" : "records"} selected for deletion
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowBatchConfirm(true)}
                    disabled={isDeleting}
                    className="px-2.5 py-1 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                  >
                    <Trash2 size={11} />
                    Delete Selected
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedIds(new Set())}
                    className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-[11px] font-semibold cursor-pointer"
                  >
                    Clear Selection
                  </button>
                </div>
              </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-500 font-semibold border-b border-slate-200">
                    <th className="py-2.5 px-3 w-8">
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
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="py-2.5 px-3">Target Application</th>
                    <th className="py-2.5 px-3">Ingestion Method</th>
                    <th className="py-2.5 px-3">Scan Timestamp</th>
                    <th className="py-2.5 px-3">Risk Index</th>
                    <th className="py-2.5 px-3">Threat Tier</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedScans.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        <History size={20} className="mx-auto mb-2 text-slate-300" />
                        <p className="font-semibold text-slate-800">No scan dossiers found</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Submit an Android package to start building your threat database.</p>
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
                          className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                            isSelected ? "bg-blue-50/40" : ""
                          }`}
                        >
                          <td className="py-3 px-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                const next = new Set(selectedIds);
                                if (e.target.checked) next.add(s.scan_id);
                                else next.delete(s.scan_id);
                                setSelectedIds(next);
                              }}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                          </td>

                          <td className="py-3 px-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                                {s.app_icon ? (
                                  <img src={s.app_icon} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <span className="font-bold text-slate-600 text-[10px]">{initials}</span>
                                )}
                              </div>
                              <div className="truncate max-w-[240px]">
                                <div
                                  onClick={() => router.push(`/dashboard?scan_id=${s.scan_id}`)}
                                  className="font-semibold text-slate-900 hover:text-blue-600 cursor-pointer truncate transition-colors"
                                >
                                  {s.app_name || s.package_name}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono truncate">{s.package_name}</div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5">
                              <MethodIcon size={13} className={methodMeta.iconColor} />
                              <span className="text-slate-600 font-medium">{methodMeta.label}</span>
                            </div>
                          </td>

                          <td className="py-3 px-3 font-mono text-slate-600">
                            <div>{dateMeta.date}</div>
                            <div className="text-[10px] text-slate-400">{dateMeta.time}</div>
                          </td>

                          <td className="py-3 px-3 font-mono font-bold">
                            <span className={riskMeta.scoreColor}>{s.overall_risk_score}</span>
                            <span className="text-slate-400 font-normal">/100</span>
                          </td>

                          <td className="py-3 px-3">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${riskMeta.badgeClass}`}>
                              {riskMeta.level}
                            </span>
                          </td>

                          <td className="py-3 px-3">
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                              <CheckCircle2 size={11} className="text-emerald-600" />
                              Analyzed
                            </span>
                          </td>

                          <td className="py-3 px-3">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => router.push(`/dashboard?scan_id=${s.scan_id}`)}
                                title="Target Application (Open Dossier)"
                                className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                              >
                                <BarChart2 size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => window.open(api.downloadPdfReport(s.scan_id), "_blank")}
                                title="Download PDF Report"
                                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                              >
                                <FileText size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setItemToDelete({ id: s.scan_id, name: s.app_name || s.package_name });
                                }}
                                title="Delete Application Dossier"
                                className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-500">
              <div>
                Showing {filteredScans.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                -
                {Math.min(currentPage * pageSize, filteredScans.length)} of {filteredScans.length} dossiers
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2 py-1 rounded bg-white border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50"
                >
                  Previous
                </button>
                <span className="px-2 font-mono">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="px-2 py-1 rounded bg-white border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50"
                >
                  Next
                </button>
              </div>
            </div>

          </div>

        </div>
      </main>

      {/* Single Item Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 border border-slate-200 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Delete Scan Dossier</h3>
                <p className="text-xs text-slate-500">Remove record from database and audit log</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
              Are you sure you want to permanently delete the audit record for <strong className="text-slate-900 font-semibold">{itemToDelete.name}</strong>?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => executeDeleteSingle(itemToDelete.id, itemToDelete.name)}
                disabled={isDeleting}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <Trash2 size={13} />
                <span>{isDeleting ? "Deleting..." : "Delete Record"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Delete Confirmation Modal */}
      {showBatchConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 border border-slate-200 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Delete Selected Dossiers</h3>
                <p className="text-xs text-slate-500">Remove multiple records from database</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
              Are you sure you want to permanently delete <strong className="text-slate-900 font-semibold">{selectedIds.size} selected scan {selectedIds.size === 1 ? "record" : "records"}</strong>?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowBatchConfirm(false)}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeBatchDelete}
                disabled={isDeleting}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <Trash2 size={13} />
                <span>{isDeleting ? "Deleting..." : `Delete ${selectedIds.size} Records`}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
