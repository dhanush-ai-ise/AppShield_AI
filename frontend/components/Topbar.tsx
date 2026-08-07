"use client";
import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Settings, ChevronDown } from "lucide-react";
import clsx from "clsx";
import { TOPBAR } from "@/lib/messages";
import { api } from "@/lib/api";

export default function Topbar({
  title,
  subtitle,
  icon,
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
  const adminName = useMemo(() => api.adminUsername() || "Account", []);

  return (
    <header className="flex items-center justify-between px-8 py-5 border-b border-bg-border bg-bg/60 backdrop-blur sticky top-0 z-10">
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
          <p className="text-xs text-slate-600">{subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center bg-bg-panel2 border border-bg-border rounded-lg p-1">
          <button
            onClick={() => {
              router.push("/research");
            }}
            className={clsx(
              "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              mode === "research" ? "bg-brand text-white" : "text-slate-600 hover:text-slate-900"
            )}
          >
            {TOPBAR.researchMode}
          </button>
          <button
            onClick={() => {
              router.push("/dashboard");
            }}
            className={clsx(
              "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              mode === "production" ? "bg-brand text-white" : "text-slate-600 hover:text-slate-900"
            )}
          >
            {TOPBAR.productionMode}
          </button>
        </div>

        <button className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100">
          <Settings size={16} />
        </button>

        <div className="relative pl-3 border-l border-bg-border">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand to-pink-500" />
            <div className="leading-tight text-left">
              <div className="text-xs font-medium text-slate-900">{adminName}</div>
              <div className="text-[10px] text-slate-500">Admin</div>
            </div>
            <ChevronDown size={14} className="text-slate-500" />
          </button>

          {menuOpen ? (
            <div className="absolute right-0 mt-3 w-44 panel shadow-panel overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  api.logoutAdmin();
                  setMenuOpen(false);
                  router.push("/login");
                }}
                className="w-full text-left px-4 py-3 text-xs text-slate-700 hover:bg-slate-50"
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
