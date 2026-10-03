"use client";
import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bell, ChevronDown, Shield, Database, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";

export default function Topbar({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
  icon?: React.ReactNode;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const adminName = useMemo(() => {
    if (!mounted) return "Admin";
    return api.adminUsername() || "Admin";
  }, [mounted]);

  const adminRole = useMemo(() => {
    if (!mounted) return "Admin";
    return api.adminRole() || "Admin";
  }, [mounted]);

  const initials = useMemo(() => {
    if (!adminName) return "AD";
    const parts = adminName.split(/[@._ -]/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return adminName.slice(0, 2).toUpperCase();
  }, [adminName]);

  return (
    <header className="h-14 px-6 border-b border-slate-200/80 bg-white flex items-center justify-between sticky top-0 z-20">
      {/* Title & Section Breadcrumb */}
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-sm font-bold text-slate-900 leading-tight tracking-tight">{title}</h1>
          <p className="text-[11px] text-slate-500 font-medium leading-none mt-0.5">{subtitle}</p>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2.5">
        {/* Telemetry pill */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-[11px] font-mono text-slate-600">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Engine v2.4 (Active)</span>
        </div>

        {/* User Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 p-1 pr-2 rounded-lg hover:bg-slate-50 border border-slate-200 transition-colors cursor-pointer"
          >
            <div
              className="w-6 h-6 rounded-md bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center font-bold text-[10px]"
              suppressHydrationWarning
            >
              {initials}
            </div>
            <span className="text-xs font-semibold text-slate-800" suppressHydrationWarning>
              {adminName}
            </span>
            <ChevronDown size={12} className="text-slate-400" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-1.5 w-44 bg-white border border-slate-200 rounded-xl p-1 z-50 shadow-dropdown animate-in fade-in zoom-in-95">
              <div className="px-3 py-2 border-b border-slate-100">
                <div className="text-xs font-semibold text-slate-900" suppressHydrationWarning>{adminName}</div>
                <div className="text-[10px] text-slate-500 font-mono" suppressHydrationWarning>{adminRole}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  api.logoutAdmin();
                  setMenuOpen(false);
                  router.replace("/login");
                }}
                className="w-full text-left px-3 py-1.5 mt-1 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
