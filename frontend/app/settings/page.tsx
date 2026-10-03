"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import {
  Settings,
  Database,
  BrainCircuit,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  User,
  Sliders,
  ShieldAlert,
  Server,
  KeyRound,
  ExternalLink,
  Mail,
} from "lucide-react";
import { api } from "@/lib/api";

export default function SettingsPage() {
  const [dbStatus, setDbStatus] = useState<"checking" | "online" | "offline">("checking");
  const [scansCount, setScansCount] = useState<number>(0);
  const [isClearing, setIsClearing] = useState(false);
  const [clearMessage, setClearMessage] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const [profile, setProfile] = useState<{
    email?: string;
    fullName?: string;
    username?: string;
    avatarUrl?: string;
    role?: string;
  } | null>(null);
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    fetchStats();
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

  const adminUser = profile?.username || api.adminUsername() || "admin";
  const adminName = profile?.fullName || api.adminFullName() || adminUser;
  const adminEmail = profile?.email || api.adminEmail() || `${adminUser}@appshield.ai`;
  const adminAvatar = profile?.avatarUrl || api.adminAvatar();
  const adminRole = profile?.role === "super_admin" || profile?.role === "admin"
    ? "Administrator"
    : (api.adminRole() || "Administrator");

  const initials = (() => {
    const raw = adminName || adminEmail || "OP";
    const clean = raw.split("@")[0];
    const parts = clean.split(/[@._ -]/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return clean.slice(0, 2).toUpperCase();
  })();

  const fetchStats = async () => {
    try {
      const health = await api.health();
      if (health && health.status === "ok") {
        setDbStatus("online");
      }
      const history = await api.scanHistory(100);
      if (history && Array.isArray(history.scans)) {
        setScansCount(history.scans.length);
      }
    } catch {
      setDbStatus("offline");
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleClearHistory = async () => {
    setIsClearing(true);
    setClearMessage(null);
    try {
      const res = await fetch("http://localhost:8000/api/scan/history", {
        method: "DELETE",
      });
      const data = await res.json();
      setClearMessage(data.message || "All scan records and caches purged successfully.");
      setConfirmClear(false);
      setScansCount(0);
      fetchStats();
    } catch (err: any) {
      setClearMessage(`Failed to clear scans: ${err?.message || "Error"}`);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="flex bg-[#f8fafc] min-h-screen text-slate-800 font-sans">
      <Sidebar />
      <main className="flex-1 min-h-screen pb-16 overflow-x-hidden">
        <Topbar title="System & AI Settings" subtitle="Platform telemetry, database persistence & AI Copilot configurations" />

        <div className="px-8 py-6 max-w-5xl mx-auto space-y-6">

          {/* Success Callout */}
          {clearMessage && (
            <div className="p-3.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="font-medium">{clearMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setClearMessage(null)}
                className="text-slate-400 hover:text-slate-700 text-xs px-2 py-0.5"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* 2x2 Grid of Management Panels */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Panel 1: Database & Storage */}
            <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-card space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="p-1 rounded-md bg-emerald-50 text-emerald-600">
                    <Database size={16} />
                  </div>
                  <div>
                    <h2 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider">
                      MongoDB Database
                    </h2>
                    <p className="text-[11px] text-slate-500 font-mono">Collection: appshield_reports</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Connected
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-mono font-semibold uppercase block">Host URI</span>
                  <span className="text-slate-900 font-mono text-[11px] font-semibold mt-0.5 block">localhost:27017</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-mono font-semibold uppercase block">Stored Scans</span>
                  <span className="text-blue-600 font-mono text-[11px] font-bold mt-0.5 block">{scansCount} records</span>
                </div>
              </div>

              {/* Reset Database Action */}
              <div className="pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-semibold text-slate-800 block">Purge Database Records</span>
                    <span className="text-[11px] text-slate-400 block">Clear all stored scans to restart from zero</span>
                  </div>

                  {!confirmClear ? (
                    <button
                      type="button"
                      onClick={() => setConfirmClear(true)}
                      className="px-3 py-1.5 rounded-lg text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 text-xs font-semibold transition-colors cursor-pointer shrink-0"
                    >
                      Reset Scans
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleClearHistory}
                        disabled={isClearing}
                        className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {isClearing ? <RotateCw size={12} className="animate-spin" /> : null}
                        <span>Confirm</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmClear(false)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Panel 2: Threat Copilot & Inference */}
            <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-card space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="p-1 rounded-md bg-blue-50 text-blue-600">
                    <BrainCircuit size={16} />
                  </div>
                  <div>
                    <h2 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider">
                      Google Gemini Copilot
                    </h2>
                    <p className="text-[11px] text-slate-500 font-mono">Multimodal Threat Analyst</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                  Ready
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 font-mono font-semibold uppercase block">Primary LLM</span>
                    <span className="text-slate-900 font-mono font-bold">gemini-3.8-flash</span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    High Speed & Reasoning
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 font-mono font-semibold uppercase block">Offline Fallback</span>
                    <span className="text-slate-900 font-mono text-[11px]">Rule-Based Local SOC Analyst</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                    Active
                  </span>
                </div>
              </div>
            </div>

            {/* Panel 3: Risk Threshold Calibration */}
            <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-card space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="p-1 rounded-md bg-indigo-50 text-indigo-600">
                    <Sliders size={16} />
                  </div>
                  <div>
                    <h2 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider">
                      Risk Classification Engine
                    </h2>
                    <p className="text-[11px] text-slate-500 font-mono">Ensemble Calibrator</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-slate-500">v2.4</span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-200 text-emerald-800">
                  <span className="font-semibold">Safe Tier (Verified Low Risk)</span>
                  <span className="font-mono text-[11px] font-bold">0 — 29</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-50/60 border border-amber-200 text-amber-800">
                  <span className="font-semibold">Suspicious Tier (Elevated Audit)</span>
                  <span className="font-mono text-[11px] font-bold">30 — 69</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-rose-50/60 border border-rose-200 text-rose-800">
                  <span className="font-semibold">Fraudulent Tier (Immediate Threat)</span>
                  <span className="font-mono text-[11px] font-bold">70 — 100</span>
                </div>
              </div>
            </div>

            {/* Panel 4: Session & Security Identity */}
            <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-card space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="p-1 rounded-md bg-violet-50 text-violet-600">
                    <User size={16} />
                  </div>
                  <div>
                    <h2 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider">
                      Operator Identity & Profile
                    </h2>
                    <p className="text-[11px] text-slate-500 font-mono">Synchronized with MongoDB Compass</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 size={11} /> MongoDB Synced
                </span>
              </div>

              {/* Profile Avatar & Info Card */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-3.5">
                <div className="relative shrink-0">
                  {adminAvatar && !avatarError ? (
                    <img
                      src={adminAvatar}
                      alt={adminName}
                      className="w-12 h-12 rounded-xl object-cover border border-slate-200 shadow-2xs"
                      onError={() => setAvatarError(true)}
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-blue-100 border border-blue-200 text-blue-800 flex items-center justify-center font-bold text-base shadow-2xs">
                      {initials}
                    </div>
                  )}
                  <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full" title="Online" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-slate-900 truncate">
                    {adminName}
                  </div>
                  <div className="text-xs font-mono text-slate-600 truncate flex items-center gap-1 mt-0.5" title={adminEmail}>
                    <Mail size={12} className="text-slate-400 shrink-0" />
                    <span>{adminEmail}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-500">Stored Email ID</span>
                  <span className="text-slate-900 font-mono font-semibold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {adminEmail}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-500">Username</span>
                  <span className="text-slate-900 font-mono font-bold">{adminUser}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-500">Assigned Clearance</span>
                  <span className="text-blue-600 font-mono font-bold">{adminRole}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-500">Persistence Store</span>
                  <span className="text-emerald-700 font-mono text-[11px] font-semibold">mongodb://localhost:27017/users</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
