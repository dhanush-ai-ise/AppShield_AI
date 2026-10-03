"use client";
import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LucideIcon,
  LayoutDashboard,
  ScanLine,
  History,
  Settings,
  Shield,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  Database,
  ExternalLink,
} from "lucide-react";
import clsx from "clsx";
import { api } from "@/lib/api";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Workspace",
    icon: LayoutDashboard,
  },
  {
    href: "/new-scan",
    label: "New Scan",
    icon: ScanLine,
  },
  {
    href: "/scan-history",
    label: "Scan History",
    icon: History,
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [scansCount, setScansCount] = useState<number | null>(null);
  const [isMongoOnline, setIsMongoOnline] = useState(true);
  const [mounted, setMounted] = useState(false);

  const [profile, setProfile] = useState<{
    email?: string;
    fullName?: string;
    username?: string;
    avatarUrl?: string;
    role?: string;
  } | null>(null);
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    setMounted(true);
    api.getCurrentUser?.()
      .then((data: any) => {
        if (data && (data.email || data.avatar_url || data.username)) {
          setProfile({
            email: data.email,
            fullName: data.full_name,
            username: data.username,
            avatarUrl: data.avatar_url,
            role: data.role,
          });
        }
      })
      .catch(() => {});
  }, []);

  const adminName = useMemo(() => {
    if (profile?.fullName) return profile.fullName;
    if (profile?.username) return profile.username;
    if (!mounted) return "Security Analyst";
    return api.adminFullName?.() || api.adminUsername() || "Security Analyst";
  }, [mounted, profile]);

  const adminEmail = useMemo(() => {
    if (profile?.email) return profile.email;
    if (!mounted) return null;
    return api.adminEmail?.() || null;
  }, [mounted, profile]);

  const adminAvatar = useMemo(() => {
    if (profile?.avatarUrl) return profile.avatarUrl;
    if (!mounted) return null;
    return api.adminAvatar?.() || null;
  }, [mounted, profile]);

  const adminRole = useMemo(() => {
    if (profile?.role) {
      return profile.role === "super_admin" || profile.role === "admin"
        ? "Administrator"
        : "Security Analyst";
    }
    if (!mounted) return "Admin";
    return api.adminRole() || "Admin";
  }, [mounted, profile]);

  const initials = useMemo(() => {
    const raw = adminName || adminEmail || "SA";
    const clean = raw.split("@")[0];
    const parts = clean.split(/[@._ -]/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return clean.slice(0, 2).toUpperCase();
  }, [adminName, adminEmail]);

  useEffect(() => {
    let active = true;
    api
      .scanHistory(100)
      .then((res) => {
        if (active && res && Array.isArray(res.scans)) {
          setScansCount(res.scans.length);
          setIsMongoOnline(true);
        }
      })
      .catch(() => {
        if (active) setIsMongoOnline(false);
      });

    return () => {
      active = false;
    };
  }, [pathname]);

  const isCurrentActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/" || pathname === "/dashboard";
    }
    return pathname.startsWith(href);
  };

  const handleLogout = () => {
    api.logoutAdmin();
    router.replace("/login");
  };

  return (
    <aside
      className={clsx(
        "shrink-0 h-screen sticky top-0 flex flex-col justify-between border-r border-slate-200/80 bg-white text-slate-800 transition-all duration-200 z-30 select-none",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* ── Brand Header ── */}
      <div className="flex flex-col">
        <div className="h-14 px-4 flex items-center justify-between border-b border-slate-100">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 overflow-hidden group cursor-pointer"
            title="AppShield AI Platform"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs group-hover:bg-blue-700 transition-colors shrink-0">
              <Shield className="w-4 h-4 fill-white/20 stroke-[2.2]" />
            </div>
            {!collapsed && (
              <div className="leading-tight truncate">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-900 font-bold text-sm tracking-tight">AppShield</span>
                  <span className="text-[10px] font-mono font-semibold bg-blue-50 text-blue-700 px-1 py-0.2 rounded border border-blue-200/60">
                    AI
                  </span>
                </div>
              </div>
            )}
          </Link>

          {!collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
              title="Collapse sidebar"
            >
              <PanelLeftClose size={15} />
            </button>
          )}
        </div>

        {/* ── Navigation Links ── */}
        <nav className="p-2.5 space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = isCurrentActive(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "group relative flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer",
                  active
                    ? "bg-slate-100 text-slate-900 font-semibold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50",
                  collapsed && "justify-center px-0 py-2.5"
                )}
                title={collapsed ? item.label : undefined}
              >
                {/* Active Indicator Bar */}
                {active && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-blue-600 rounded-r" />
                )}

                <Icon
                  size={16}
                  className={clsx(
                    "shrink-0 transition-colors",
                    active ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"
                  )}
                />

                {!collapsed && (
                  <span className="flex-1 truncate">{item.label}</span>
                )}

                {!collapsed && item.href === "/scan-history" && scansCount !== null && scansCount > 0 && (
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-200/60 text-slate-600 font-medium">
                    {scansCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* ── Footer ── */}
      <div className="p-2.5 border-t border-slate-100 space-y-2">
        {/* Expand button if collapsed */}
        {collapsed && (
          <div className="flex justify-center pb-1">
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
              title="Expand sidebar"
            >
              <PanelLeftOpen size={16} />
            </button>
          </div>
        )}

        {/* MongoDB Status */}
        {!collapsed ? (
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-slate-50 border border-slate-200/60 text-[11px] font-mono">
            <div className="flex items-center gap-1.5">
              <span
                className={clsx(
                  "w-1.5 h-1.5 rounded-full",
                  isMongoOnline ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                )}
              />
              <span className="text-slate-500 text-[10px]">Mongo 27017</span>
            </div>
            <span
              className={clsx(
                "text-[9px] font-semibold uppercase tracking-wider",
                isMongoOnline ? "text-emerald-700" : "text-rose-700"
              )}
            >
              {isMongoOnline ? "Connected" : "Offline"}
            </span>
          </div>
        ) : (
          <div className="flex justify-center py-1" title={`MongoDB: ${isMongoOnline ? "Connected" : "Offline"}`}>
            <span
              className={clsx(
                "w-2 h-2 rounded-full",
                isMongoOnline ? "bg-emerald-500" : "bg-rose-500"
              )}
            />
          </div>
        )}

        {/* User Profile */}
        <div
          className={clsx(
            "flex items-center gap-2.5 px-2 py-2 rounded-xl border border-transparent hover:border-slate-200 hover:bg-slate-50 transition-all",
            collapsed && "justify-center px-0"
          )}
          title={adminEmail ? `${adminName} (${adminEmail})` : adminName}
        >
          <div className="relative shrink-0">
            {adminAvatar && !avatarError ? (
              <img
                src={adminAvatar}
                alt={adminName}
                className="w-8 h-8 rounded-lg object-cover border border-slate-200 shadow-2xs"
                onError={() => setAvatarError(true)}
              />
            ) : (
              <div
                className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs"
                suppressHydrationWarning
              >
                {initials}
              </div>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full" />
          </div>

          {!collapsed && (
            <div className="flex-1 min-w-0 leading-tight">
              <div className="text-xs font-semibold text-slate-900 truncate" suppressHydrationWarning>
                {adminName}
              </div>
              <div
                className="text-[10px] text-slate-500 font-mono truncate"
                suppressHydrationWarning
                title={adminEmail || adminRole}
              >
                {adminEmail || adminRole}
              </div>
            </div>
          )}

          {!collapsed && (
            <button
              type="button"
              onClick={handleLogout}
              className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut size={13} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
