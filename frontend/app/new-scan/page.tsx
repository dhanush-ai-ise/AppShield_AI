"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Link2, Upload, Package, Hash, Loader2 } from "lucide-react";
import clsx from "clsx";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { api } from "@/lib/api";
import { NEW_SCAN } from "@/lib/messages";

type Tab = "play_url" | "apk_url" | "apk_upload" | "package_name" | "hash";

const TABS: { key: Tab; label: string; icon: any; placeholder: string }[] = [
  { key: "play_url", label: NEW_SCAN.tabs.playStoreUrl, icon: Play, placeholder: NEW_SCAN.placeholders.playStoreUrl },
  { key: "apk_url", label: NEW_SCAN.tabs.apkUrl, icon: Link2, placeholder: NEW_SCAN.placeholders.apkUrl },
  { key: "apk_upload", label: NEW_SCAN.tabs.apkUpload, icon: Upload, placeholder: "" },
  { key: "package_name", label: NEW_SCAN.tabs.packageName, icon: Package, placeholder: NEW_SCAN.placeholders.packageName },
  { key: "hash", label: NEW_SCAN.tabs.apkHash, icon: Hash, placeholder: NEW_SCAN.placeholders.apkHash },
];

export default function NewScanPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("play_url");
  const [value, setValue] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleScan(e?: React.FormEvent) {
    if (e) {
      e.preventDefault(); // Prevent form from reloading page
    }
    setLoading(true);
    setError(null);
    try {
      let result;
      if (tab === "play_url") {
        if (!value.includes("/store/apps/details") || !value.includes("id=")) {
          throw new Error(NEW_SCAN.errors.invalidPlayUrl);
        }
        result = await api.scanPlayUrl(value);
      }
      else if (tab === "package_name") result = await api.scanPackageName(value);
      else if (tab === "apk_url") result = await api.scanApkUrl(value);
      else if (tab === "apk_upload" && file) result = await api.scanApkUpload(file);
      else if (tab === "hash") result = await api.scanByHash(value);
      else throw new Error(NEW_SCAN.errors.noInput);

      router.push("/dashboard");
    } catch (e: any) {
      setError(e.message || NEW_SCAN.errors.scanFailed);
    } finally {
      setLoading(false);
    }
  }

  const activeTab = TABS.find((t) => t.key === tab)!;

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 min-h-screen">
        <Topbar title={NEW_SCAN.title} subtitle={NEW_SCAN.subtitle} />

        <div className="px-8 py-6 max-w-2xl">
          <form onSubmit={handleScan} className="panel p-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">{NEW_SCAN.chooseMethod}</h3>
            <div className="grid grid-cols-5 gap-2 mb-6">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => { setTab(t.key); setValue(""); setError(null); }}
                  className={clsx(
                    "flex flex-col items-center gap-1.5 py-3 rounded-lg border text-[11px] transition-colors",
                    tab === t.key
                      ? "border-brand bg-brand/10 text-brand-light"
                      : "border-bg-border text-slate-600 hover:text-slate-900"
                  )}
                >
                  <t.icon size={16} />
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "apk_upload" ? (
              <div
                onClick={() => document.getElementById("apk-file-input")?.click()}
                className="border border-dashed border-bg-border rounded-lg p-8 text-center cursor-pointer hover:border-brand/50 transition-colors"
              >
                <Upload size={22} className="mx-auto text-slate-500 mb-2" />
                <p className="text-sm text-slate-600">{file ? file.name : NEW_SCAN.selectApkFile}</p>
                <input
                  id="apk-file-input"
                  type="file"
                  accept=".apk"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
            ) : (
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={activeTab.placeholder}
                className="w-full px-4 py-3 rounded-lg bg-bg-panel2 border border-bg-border text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:border-brand"
              />
            )}

            {error && <p className="text-xs text-red-400 mt-3">{error}</p>}

            <button
              type="submit"
              disabled={loading || (tab === "apk_upload" ? !file : !value)}
              className="mt-5 w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-gradient-to-r from-brand to-brand-dark text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {loading ? NEW_SCAN.analyzing : NEW_SCAN.runScan}
            </button>
          </form>

          <p className="text-[11px] text-slate-600 mt-4">
            {NEW_SCAN.info}
          </p>
        </div>
      </main>
    </div>
  );
}
