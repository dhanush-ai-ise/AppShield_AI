"use client";
import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Sun, Bell, ChevronDown } from "lucide-react";
import clsx from "clsx";
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
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const mode = useMemo<"research" | "production">(
    () => (pathname?.startsWith("/research") ? "research" : "production"),
    [pathname]
  );
  const adminName = useMemo(() => api.adminUsername() || "Admin", []);
  const adminRole = useMemo(() => api.adminRole(), []);
  const initials = useMemo(() => {
    if (!adminName) return "AD";
    const parts = adminName.split(/[@._ -]/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return adminName.slice(0, 2).toUpperCase();
  }, [adminName]);

  return (
    <header className="flex items-center justify-between px-8 py-4 border-b border-slate-200/60 bg-[#f0f3f9]/80 backdrop-blur sticky top-0 z-20">
      {/* Title & Mobile Toggle */}
      <div className="flex items-center gap-4">
        <button className="clay-btn-soft w-10 h-10 rounded-2xl flex items-center justify-center text-slate-600 hover:text-slate-900">
          <Menu size={18} />
        </button>
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">{title}</h1>
          <p className="text-xs font-medium text-slate-500">{subtitle}</p>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-4">
        {/* Mode Switcher Pill */}
        <div className="clay-inset flex items-center p-1.5 rounded-2xl">
          <button
            onClick={() => router.push("/research")}
            className={clsx(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200",
              mode === "research"
                ? "clay-btn-purple text-white shadow-md"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            Research Mode
          </button>
          <button
            onClick={() => router.push("/dashboard")}
            className={clsx(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200",
              mode === "production"
                ? "clay-btn-purple text-white shadow-md"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            Production Mode
          </button>
        </div>

        {/* Theme Sun Toggle */}
        <button className="clay-btn-soft w-10 h-10 rounded-full flex items-center justify-center text-slate-600 hover:text-amber-500">
          <Sun size={18} />
        </button>

        {/* Notifications Bell */}
        <button className="clay-btn-soft relative w-10 h-10 rounded-full flex items-center justify-center text-slate-600 hover:text-violet-600">
          <Bell size={18} />
          <span className="clay-badge-red absolute -top-1 -right-1 w-4 h-4 text-[10px] font-extrabold flex items-center justify-center">
            3
          </span>
        </button>

        {/* Admin Profile Dropdown */}
        <div className="relative pl-2">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="clay-btn-soft flex items-center gap-3 p-1.5 pr-3 rounded-2xl cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 overflow-hidden border border-white shadow-sm flex items-center justify-center font-black text-white text-xs">
              <span>{initials}</span>
            </div>
            <div className="leading-tight text-left">
              <div className="text-xs font-extrabold text-slate-900">{adminName}</div>
              <div className="text-[10px] font-bold text-violet-600">{adminRole}</div>
            </div>
            <ChevronDown size={14} className="text-slate-400" />
          </button>

          {menuOpen ? (
            <div className="absolute right-0 mt-3 w-48 panel p-2 z-50 animate-in fade-in zoom-in-95">
              <button
                type="button"
                onClick={() => {
                  api.logoutAdmin();
                  setMenuOpen(false);
                  router.replace("/login");
                }}
                className="w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
              >
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
