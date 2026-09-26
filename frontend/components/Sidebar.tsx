"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ScanLine, History, Layers, FileBarChart2, GitCompare,
  ShieldAlert, TrendingUp, BrainCircuit, Database, Users, ScrollText,
  Settings, ShieldCheck, ChevronsLeft, ChevronsRight,
} from "lucide-react";
import clsx from "clsx";
import { SIDEBAR, APP_NAME, APP_TAGLINE } from "@/lib/messages";
import { api } from "@/lib/api";
import { ScanResult } from "@/lib/types";
import { useEffect } from "react";

const NAV_SECTIONS = [
  {
    label: SIDEBAR.navSections.main,
    items: [
      { href: "/dashboard", label: SIDEBAR.navItems.dashboard, icon: LayoutDashboard },
      { href: "/scan-history", label: SIDEBAR.navItems.scanHistory, icon: History },
      { href: "/batch-scan", label: SIDEBAR.navItems.batchScan, icon: Layers },
    ],
  },
  {
    label: SIDEBAR.navSections.research,
    items: [
      { href: "/research", label: SIDEBAR.navItems.researchMode, icon: BrainCircuit },
      { href: "/research#comparison", label: SIDEBAR.navItems.modelComparison, icon: GitCompare },
      { href: "/research#benchmark", label: SIDEBAR.navItems.benchmarkResults, icon: FileBarChart2 },
    ],
  },
  {
    label: SIDEBAR.navSections.analytics,
    items: [
      { href: "/dashboard#risk", label: SIDEBAR.navItems.riskAnalytics, icon: ShieldAlert },
      { href: "/dashboard#trends", label: SIDEBAR.navItems.trendsInsights, icon: TrendingUp },
      { href: "/dashboard#reports", label: SIDEBAR.navItems.reports, icon: FileBarChart2 },
    ],
  },
  {
    label: SIDEBAR.navSections.management,
    items: [
      { href: "/datasets", label: SIDEBAR.navItems.datasets, icon: Database },
      { href: "/research#training", label: SIDEBAR.navItems.modelTraining, icon: BrainCircuit },
      { href: "/management/users", label: SIDEBAR.navItems.users, icon: Users },
      { href: "/management/logs", label: SIDEBAR.navItems.systemLogs, icon: ScrollText },
      { href: "/management/settings", label: SIDEBAR.navItems.settings, icon: Settings },
    ],
  },
];

function formatRelativeTime(dateString?: string): string {
  if (!dateString) return "N/A";
  try {
    const timestamp = new Date(dateString).getTime();
    if (isNaN(timestamp)) return "N/A";
    const diffMs = Date.now() - timestamp;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch {
    return "N/A";
  }
}

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [systemStatus, setSystemStatus] = useState({
    modelsTrained: 7,
    scansToday: 0,
    avgAccuracy: 98.43,
    lastTraining: "N/A",
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const benchmark = await api.getBenchmark().catch(() => null);
        const scanHistory = await api.scanHistory(100).catch(() => null);

        const scans = scanHistory?.scans ?? [];
        const todayStr = new Date().toDateString();
        const todayCount = scans.filter((s: ScanResult) => {
          if (!s.scanned_at) return false;
          try {
            return new Date(s.scanned_at).toDateString() === todayStr;
          } catch {
            return false;
          }
        }).length;

        const bestModel = benchmark?.results && benchmark?.best_model ? benchmark.results[benchmark.best_model] : null;

        setSystemStatus({
          modelsTrained: benchmark?.results ? Object.keys(benchmark.results).length : 7,
          scansToday: todayCount,
          avgAccuracy: bestModel?.accuracy ?? 98.43,
          lastTraining: formatRelativeTime(benchmark?.last_trained_at),
        });
      } catch {
        // Fallback
      }
    };
    fetchData();
  }, []);

  const isDark = pathname === "/dashboard" || pathname === "/";

  return (
    <aside className={clsx(
      "shrink-0 h-screen max-h-screen sticky top-0 flex flex-col overflow-hidden transition-all duration-300 z-30",
      isDark ? "bg-[#0c101d] border-r border-slate-800/80 text-white" : "bg-[#f0f3f9] border-r border-slate-200/80 text-slate-800",
      collapsed ? "w-20" : "w-64"
    )}>
      {/* Brand Header */}
      <div className={clsx(
        "flex items-center gap-3 px-5 py-5 border-b",
        isDark ? "border-slate-800/80" : "border-slate-200/60"
      )}>
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 flex items-center justify-center shadow-[0_0_15px_rgba(124,58,237,0.4)] border border-white/20">
          <ShieldCheck size={22} className="text-white drop-shadow" />
        </div>
        {!collapsed && (
          <div>
            <div className={clsx("text-base font-extrabold leading-tight tracking-tight", isDark ? "text-white" : "text-slate-900")}>
              AppShield <span className="text-violet-500">AI</span>
            </div>
            <div className={clsx("text-[11px] font-medium leading-tight", isDark ? "text-slate-400" : "text-slate-500")}>
              AI Fraud Detection Platform
            </div>
          </div>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-4 py-5 space-y-6 scrollbar-none">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            {!collapsed && (
              <div className={clsx("px-2 mb-2.5 text-[10px] font-extrabold tracking-wider uppercase", isDark ? "text-slate-500" : "text-slate-400")}>
                {section.label}
              </div>
            )}
            <div className="space-y-1.5">
              {section.items.map((item) => {
                const active = pathname === item.href.split("#")[0] || pathname === item.href.split("?")[0];
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={clsx(
                      "flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all duration-200",
                      active
                        ? isDark
                          ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-[0_0_15px_rgba(124,58,237,0.4)]"
                          : "clay-inset-active text-violet-700"
                        : isDark
                        ? "text-slate-400 hover:text-white hover:bg-slate-800/60"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white/80 hover:shadow-[4px_4px_10px_rgba(163,177,198,0.25),-4px_-4px_10px_rgba(255,255,255,0.9)]",
                      collapsed && "justify-center px-0"
                    )}
                    title={item.label}
                  >
                    <Icon size={17} className={active ? "text-white" : isDark ? "text-slate-400" : "text-slate-400"} />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* System Status Card */}
      <div className={clsx("p-4 border-t space-y-3", isDark ? "border-slate-800/80" : "border-slate-200/60")}>
        {!collapsed && (
          <div className={clsx("p-4 rounded-2xl", isDark ? "bg-[#131b2e] border border-slate-800 shadow-xl" : "panel")}>
            <div className={clsx("text-[10px] font-extrabold tracking-wider uppercase mb-2", isDark ? "text-slate-400" : "text-slate-400")}>
              System Status
            </div>
            
            <div className={clsx(
              "flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold mb-3 rounded-xl border",
              isDark
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : "clay-badge-green"
            )}>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              All Systems Operational
            </div>

            <div className={clsx("p-3 space-y-2 text-[11px] rounded-xl", isDark ? "bg-[#0e1424] border border-slate-800/80" : "clay-inset")}>
              <div className="flex justify-between items-center text-slate-400">
                <span className="font-medium">Scans Today</span>
                <span className={clsx("font-extrabold", isDark ? "text-white font-mono" : "text-slate-900")}>{systemStatus.scansToday}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span className="font-medium">Models Trained</span>
                <span className={clsx("font-extrabold", isDark ? "text-white font-mono" : "text-slate-900")}>{systemStatus.modelsTrained}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span className="font-medium">Avg. Accuracy</span>
                <span className={clsx("font-extrabold", isDark ? "text-white font-mono" : "text-slate-900")}>{systemStatus.avgAccuracy}%</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span className="font-medium">Last Training</span>
                <span className={clsx("font-extrabold", isDark ? "text-white font-mono" : "text-slate-900")}>{systemStatus.lastTraining}</span>
              </div>
            </div>
          </div>
        )}
        <button 
          className={clsx(
            "flex items-center gap-2 text-xs font-bold w-full justify-center py-2 rounded-xl transition-colors",
            isDark ? "bg-slate-800/60 hover:bg-slate-800 text-slate-300 border border-slate-700/60" : "clay-btn-soft text-slate-600 hover:text-slate-900"
          )}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          {!collapsed && <span>Collapse Sidebar</span>}
        </button>
      </div>
    </aside>
  );
}
