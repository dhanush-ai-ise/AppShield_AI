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
    if (!mounted) return "Admin";
    return api.adminFullName?.() || api.adminUsername() || "Admin";
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
    const raw = adminName || adminEmail || "AD";
    const clean = raw.split("@")[0];
    const parts = clean.split(/[@._ -]/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return clean.slice(0, 2).toUpperCase();
  }, [adminName, adminEmail]);

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
            className="flex items-center gap-2 p-1 pr-2.5 rounded-lg hover:bg-slate-50 border border-slate-200 transition-colors cursor-pointer"
            title={adminEmail ? `${adminName} (${adminEmail})` : adminName}
          >
            {adminAvatar && !avatarError ? (
              <img
                src={adminAvatar}
                alt={adminName}
                className="w-6 h-6 rounded-md object-cover border border-slate-200 shadow-2xs"
                onError={() => setAvatarError(true)}
              />
            ) : (
              <div
                className="w-6 h-6 rounded-md bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center font-bold text-[10px]"
                suppressHydrationWarning
              >
                {initials}
              </div>
            )}
            <span className="text-xs font-semibold text-slate-800" suppressHydrationWarning>
              {adminName}
            </span>
            <ChevronDown size={12} className="text-slate-400" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-1.5 w-60 bg-white border border-slate-200 rounded-xl p-1.5 z-50 shadow-dropdown animate-in fade-in zoom-in-95">
              <div className="px-3 py-2.5 border-b border-slate-100 flex items-center gap-2.5">
                {adminAvatar && !avatarError ? (
                  <img
                    src={adminAvatar}
                    alt={adminName}
                    className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0"
                    onError={() => setAvatarError(true)}
                  />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                    {initials}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-slate-900 truncate" suppressHydrationWarning>
                    {adminName}
                  </div>
                  {adminEmail && (
                    <div className="text-[10px] text-slate-500 font-mono truncate" suppressHydrationWarning title={adminEmail}>
                      {adminEmail}
                    </div>
                  )}
                  <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-mono font-medium bg-slate-100 text-slate-600 border border-slate-200">
                    {adminRole}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  router.push("/settings");
                }}
                className="w-full text-left px-3 py-2 mt-1 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-between"
              >
                <span>Operator Settings</span>
                <span className="text-[10px] text-slate-400 font-mono">⌘,</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  api.logoutAdmin();
                  setMenuOpen(false);
                  router.replace("/login");
                }}
                className="w-full text-left px-3 py-1.5 mt-0.5 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
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
