"use client";
import { useRef, useState } from "react";
import { UploadCloud, FileText, Trash2, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";

export interface DatasetModuleInfo {
  key: string;
  title: string;
  description: string;
  expectedFormat: string;
  sources: { name: string; url: string; note: string }[];
}

export default function DatasetUploadCard({
  info,
  files,
  onChanged,
}: {
  info: DatasetModuleInfo;
  files: string[];
  onChanged: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      await api.uploadDataset(info.key, file);
      onChanged();
    } catch (e: any) {
      setError(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="panel p-6 flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-sm font-extrabold text-slate-900">{info.title}</h3>
          <span className="clay-badge-purple text-[10px] font-bold px-2.5 py-0.5">
            /datasets/{info.key}/raw
          </span>
        </div>
        <p className="text-xs font-medium text-slate-500 mb-2.5">{info.description}</p>
        <p className="text-[11px] font-semibold text-slate-600 mb-4">Expected format: {info.expectedFormat}</p>

        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
          }}
          className="clay-inset p-5 text-center cursor-pointer border border-dashed border-slate-300 hover:border-violet-400 transition-all"
        >
          <UploadCloud size={20} className="mx-auto text-violet-600 mb-1.5" />
          <p className="text-xs font-bold text-slate-700">{uploading ? "Uploading..." : "Click or drag a file to upload"}</p>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>
        {error && <p className="ag-error text-[11px] mt-3">{error}</p>}

        {files.length > 0 && (
          <div className="mt-4 space-y-2">
            {files.map((f) => (
              <div key={f} className="flex items-center justify-between px-3 py-2 rounded-xl bg-white border border-slate-100 shadow-sm text-[11px]">
                <span className="flex items-center gap-2 font-bold text-slate-800 truncate"><FileText size={14} className="shrink-0 text-violet-600" />{f}</span>
                <button
                  onClick={() => api.deleteDataset(info.key, f).then(onChanged).catch((e: any) => setError(e.message || "Delete failed"))}
                  className="clay-btn-soft p-1.5 text-slate-500 hover:text-red-500 shrink-0"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5 pt-3.5 border-t border-slate-100">
        <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">Recommended open-source sources</p>
        <div className="space-y-1.5">
          {info.sources.map((s) => (
            <a
              key={s.name}
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between text-[11px] font-semibold text-slate-700 hover:text-violet-600 transition-colors group"
            >
              <span className="truncate">{s.name} — <span className="text-slate-400 font-normal">{s.note}</span></span>
              <ExternalLink size={11} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
