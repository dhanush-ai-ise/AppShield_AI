"use client";
import { useEffect, useState } from "react";
import { History, ChevronRight } from "lucide-react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { api } from "@/lib/api";
import { ScanResult } from "@/lib/types";

export default function ScanHistoryPage() {
  const [scans, setScans] = useState<ScanResult[]>([]);

  useEffect(() => {
    api.scanHistory(50).then((r) => setScans(r.scans ?? [])).catch(() => {});
  }, []);

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 min-h-screen">
        <Topbar title="Scan History" subtitle="All previous application scans" icon={<History size={20} className="text-brand-light" />} />

        <div className="px-8 py-6">
          <div className="panel">
            {scans.length === 0 ? (
              <p className="text-sm text-slate-500 p-6">
                No scans yet — run one from <Link href="/new-scan" className="text-brand-light hover:underline">New Scan</Link>, or connect the backend to see live history here.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 text-xs border-b border-bg-border">
                    <th className="py-3 px-5 font-medium">App</th>
                    <th className="py-3 px-5 font-medium">Prediction</th>
                    <th className="py-3 px-5 font-medium">Risk Score</th>
                    <th className="py-3 px-5 font-medium">Model</th>
                    <th className="py-3 px-5 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {scans.map((s) => (
                    <tr key={s.scan_id} className="border-b border-bg-border/60 hover:bg-slate-50">
                      <td className="py-3 px-5">
                        <div className="text-slate-900 font-medium">{s.app_name}</div>
                        <div className="text-xs text-slate-500">{s.package_name}</div>
                      </td>
                      <td className="py-3 px-5">
                        <span
                          className={
                            s.prediction === "Fraudulent"
                              ? "text-red-600"
                              : s.prediction === "Suspicious"
                              ? "text-amber-600"
                              : "text-emerald-600"
                          }
                        >
                          {s.prediction}
                        </span>
                      </td>
                      <td className="py-3 px-5 text-slate-700">{s.overall_risk_score}/100</td>
                      <td className="py-3 px-5 text-slate-600">{s.model_used}</td>
                      <td className="py-3 px-5">
                        <ChevronRight size={14} className="text-slate-600" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
