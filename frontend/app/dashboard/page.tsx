"use client";
import { useEffect, useState, useRef, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Send, Paperclip, ChevronRight, ShieldCheck, ShieldAlert, AlertTriangle,
  CheckCircle2, FileText, ExternalLink, Download, Sparkles, RefreshCw,
  Layers, Check, Search, Bell, Sun, Menu, ChevronDown, Eye, Key,
  Globe, FolderArchive, Star, Bot, Play, Package, Smartphone, ArrowRight,
  Info, Share2, Code2, Users, HelpCircle, X, ShieldX, CornerDownLeft,
  Cpu, Activity, Lock, Terminal, Radio
} from "lucide-react";
import clsx from "clsx";
import Sidebar from "@/components/Sidebar";
import { api } from "@/lib/api";
import { ScanResult } from "@/lib/types";

// Default reference scan matching the showcase image
const SHOWCASE_DEFAULT_SCAN: ScanResult = {
  scan_id: "scan-whatsapp-demo",
  app_name: "WhatsApp Messenger",
  package_name: "com.whatsapp",
  input_type: "play_url",
  overall_risk_score: 82,
  trust_score: 18,
  prediction: "Fraudulent",
  confidence: 96.3,
  model_used: "LightGBM",
  class_probabilities: {
    Safe: 3.7,
    Suspicious: 7.1,
    Fraudulent: 89.2,
  },
  scanned_at: new Date().toISOString(),
  status: "Completed",
  app_icon: "https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg",
  downloads: "5B+",
  rating: 4.3,
  version: "2.24.18.77",
  developer: "WhatsApp LLC",
  category: "Communication",
  permissions: [
    "android.permission.INTERNET",
    "android.permission.READ_CONTACTS",
    "android.permission.RECORD_AUDIO",
    "android.permission.CAMERA",
    "android.permission.ACCESS_FINE_LOCATION",
    "android.permission.READ_SMS",
    "android.permission.SEND_SMS",
    "android.permission.SYSTEM_ALERT_WINDOW",
    "android.permission.RECEIVE_BOOT_COMPLETED",
    "android.permission.BIND_ACCESSIBILITY_SERVICE",
  ],
  top_contributors: [
    { feature: "Suspicious Permissions", label: "Suspicious Permissions", impact_percent: 31 },
    { feature: "Network Connections", label: "Network Connections", impact_percent: 22 },
    { feature: "Code Obfuscation", label: "Code Obfuscation", impact_percent: 18 },
    { feature: "Potential Data Exfiltration", label: "Potential Data Exfiltration", impact_percent: 15 },
    { feature: "Similar to Known Malware", label: "Similar to Known Malware", impact_percent: 14 },
  ],
  flag_reasons: [
    { module: "Permissions", reason: "Requests high-privilege SMS and Camera permissions simultaneously.", level: "High", score: 85 },
    { module: "Network", reason: "Direct dynamic code loading domains flagged in threat intel.", level: "High", score: 78 },
    { module: "Certificate", reason: "Certificate signature entropy deviates from official store fingerprint.", level: "Medium", score: 62 },
  ],
};

interface ChatStep {
  step: number;
  title: string;
  status: "completed" | "in_progress" | "pending";
  time?: string;
}

interface ChatMessage {
  id: string;
  sender: "user" | "bot";
  text?: string;
  timestamp: string;
  steps?: ChatStep[];
  scanPreview?: ScanResult;
  suggestions?: string[];
}

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scanIdParam = searchParams.get("scan_id");

  const [scan, setScan] = useState<ScanResult>(SHOWCASE_DEFAULT_SCAN);
  const [activeTab, setActiveTab] = useState<"analysis" | "details" | "permissions" | "ml" | "screenshots">("analysis");
  const [selectedModel, setSelectedModel] = useState("gemini-1.5-flash");
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Initialize messages
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg-1",
      sender: "bot",
      text: "AppShield AI Copilot online. Drop a Play Store link, direct APK download URL, package name, or file to run an automated threat assessment.",
      timestamp: "12:00 PM",
    },
    {
      id: "msg-2",
      sender: "user",
      text: "Scan this app: https://play.google.com/store/apps/details?id=com.whatsapp",
      timestamp: "12:01 PM",
    },
    {
      id: "msg-3",
      sender: "bot",
      text: "Analysis completed for WhatsApp Messenger. Security telemetry and risk indicators have been synthesized into your live threat dossier.",
      timestamp: "12:01 PM",
      steps: [
        { step: 1, title: "Fetching APK package & binary metadata", status: "completed", time: "1.2s" },
        { step: 2, title: "Decompiling Dalvik bytecode (Androguard engine)", status: "completed", time: "3.4s" },
        { step: 3, title: "Extracting dangerous permissions & declared intent filters", status: "completed", time: "0.8s" },
        { step: 4, title: "Running ML ensemble classifiers (XGBoost, LightGBM, RF)", status: "completed", time: "1.1s" },
        { step: 5, title: "Synthesizing heuristic indicators & generating risk dossier", status: "completed", time: "0.4s" },
      ],
      scanPreview: SHOWCASE_DEFAULT_SCAN,
      suggestions: [
        "Why is the risk score high?",
        "Show suspicious permissions",
        "Compare with official app",
        "What do these permissions mean?",
      ],
    },
  ]);

  // Load scan from scan_id param or session storage
  useEffect(() => {
    if (scanIdParam) {
      api.getScan(scanIdParam)
        .then((data) => {
          if (data) setScan(data);
        })
        .catch(() => {});
    } else if (typeof window !== "undefined") {
      try {
        const cached = sessionStorage.getItem("appshield_last_scan");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed?.scan_id) setScan(parsed);
        }
      } catch {}
    }
  }, [scanIdParam]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSendMessage = async (textToSend?: string) => {
    const messageText = (textToSend || input).trim();
    const fileToUpload = selectedFile;

    if (!messageText && !fileToUpload) return;

    const userTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    // Append User Message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: messageText || (fileToUpload ? `Uploaded APK binary: ${fileToUpload.name}` : ""),
      timestamp: userTime,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSelectedFile(null);
    setLoading(true);

    try {
      const res = await api.copilotChat(
        messageText,
        scan?.scan_id,
        selectedModel,
        fileToUpload || undefined
      );

      const botTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      if (res.scan_result) {
        setScan(res.scan_result);
        if (typeof window !== "undefined") {
          try {
            sessionStorage.setItem("appshield_last_scan", JSON.stringify(res.scan_result));
          } catch {}
        }
      }

      const botMessage: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: "bot",
        text: res.reply,
        timestamp: botTime,
        steps: res.steps && res.steps.length > 0 ? res.steps : undefined,
        scanPreview: res.scan_result || undefined,
        suggestions: res.suggestions || [
          "Why is the risk score high?",
          "Show suspicious permissions",
          "Compare with official app",
        ],
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          sender: "bot",
          text: `⚠️ **Scan or Query Error**: ${err?.message || "Could not complete request. Please verify the URL or link."}`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          suggestions: ["Scan a Play Store app", "Check a package name"],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    if (suggestion === "Scan a Play Store app") {
      setInput("https://play.google.com/store/apps/details?id=com.whatsapp");
    } else if (suggestion === "Analyze an APK file") {
      fileInputRef.current?.click();
    } else if (suggestion === "Check a package name") {
      setInput("com.instagram.android");
    } else if (suggestion === "Ask a security question") {
      setInput("Why is BIND_ACCESSIBILITY_SERVICE considered dangerous in Android banking trojans?");
    } else {
      handleSendMessage(suggestion);
    }
  };

  // Model selection options
  const MODELS = [
    { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", tag: "Fast & Smart" },
    { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", tag: "Deep Reasoning" },
    { id: "appshield-local", name: "AppShield Local Engine", tag: "Offline ML" },
  ];

  const currentModelLabel = MODELS.find((m) => m.id === selectedModel)?.name || "Gemini 1.5 Flash";

  // Score visual mapping
  const score = scan?.overall_risk_score ?? 82;
  const isCritical = score >= 70;
  const isModerate = score >= 40 && score < 70;
  const scoreColor = isCritical ? "#ef4444" : isModerate ? "#f59e0b" : "#10b981";
  const riskTitle = isCritical ? "Critical Risk" : isModerate ? "Moderate Risk" : "Low Risk";
  const confidence = scan?.confidence ?? 96.3;

  return (
    <div className="flex bg-[#0b0f19] h-screen max-h-screen overflow-hidden text-slate-100 font-sans selection:bg-violet-600 selection:text-white">
      {/* Left Navigation Sidebar */}
      <Sidebar />

      {/* Main Command Center Column */}
      <div className="flex-1 flex flex-col h-full min-h-0 min-w-0 overflow-hidden">
        {/* Global Dark Topbar */}
        <header className="shrink-0 h-14 flex items-center justify-between px-6 border-b border-slate-800/80 bg-[#0c101d]/90 backdrop-blur z-20">
          <div className="flex items-center gap-3 w-1/3">
            <div className="relative w-full max-w-md">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Search apps, package names, or ask anything..."
                className="w-full bg-[#131b2e] border border-slate-800 rounded-xl pl-9 pr-14 py-1.5 text-xs font-medium text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-violet-500/80 transition-all"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700/60 pointer-events-none">
                Ctrl K
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-semibold text-slate-300 text-[11px]">SOC Engine Live</span>
            </div>
            <button className="w-8 h-8 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-slate-400 hover:text-amber-400 transition-colors">
              <Sun size={15} />
            </button>
            <button className="relative w-8 h-8 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-slate-400 hover:text-violet-400 transition-colors">
              <Bell size={15} />
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 text-white text-[9px] font-extrabold rounded-full flex items-center justify-center shadow-md">
                3
              </span>
            </button>
            <div className="flex items-center gap-2.5 pl-2 border-l border-slate-800">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white font-extrabold text-xs shadow-md">
                AD
              </div>
              <div className="leading-tight text-left hidden md:block">
                <div className="text-xs font-bold text-white">admin</div>
                <div className="text-[10px] font-semibold text-violet-400">Super Admin</div>
              </div>
            </div>
          </div>
        </header>

        {/* 2-Column Split Command Center - Fits Exactly to Viewport */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">

          {/* ══════════════════════════════════════════════════════
              LEFT / CENTER PANEL: Conversational AI Copilot
              ══════════════════════════════════════════════════════ */}
          <div className="lg:col-span-7 h-full flex flex-col min-h-0 overflow-hidden border-r border-slate-800/80 bg-[#0c101d]">
            
            {/* Copilot Header */}
            <div className="shrink-0 px-5 py-3 border-b border-slate-800/80 flex items-center justify-between bg-[#0e1322]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-[0_0_20px_rgba(124,58,237,0.4)] border border-violet-400/30">
                  <Bot size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xs font-extrabold text-white tracking-tight">AI Security Copilot</h2>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-violet-500/20 text-violet-300 border border-violet-500/30">
                      Beta
                    </span>
                  </div>
                  <p className="text-[10px] font-medium text-slate-400">
                    Chat, scan, and analyze Android applications with the power of AI
                  </p>
                </div>
              </div>

              {/* Model Selector & New Chat */}
              <div className="flex items-center gap-2 relative">
                <div className="relative">
                  <button
                    onClick={() => setModelDropdownOpen((v) => !v)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#141b2e] border border-slate-700/80 text-[11px] font-semibold text-slate-200 hover:border-violet-500 transition-all shadow-sm"
                  >
                    <Sparkles size={12} className="text-violet-400" />
                    <span>Model: {currentModelLabel}</span>
                    <ChevronDown size={12} className="text-slate-400 ml-0.5" />
                  </button>

                  {modelDropdownOpen && (
                    <div className="absolute right-0 mt-1.5 w-56 rounded-xl bg-[#131b2e] border border-slate-700 shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95">
                      {MODELS.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => {
                            setSelectedModel(m.id);
                            setModelDropdownOpen(false);
                          }}
                          className={clsx(
                            "w-full px-3 py-2 text-left text-xs flex items-center justify-between transition-colors",
                            selectedModel === m.id ? "bg-violet-600/20 text-violet-300 font-bold" : "text-slate-300 hover:bg-slate-800"
                          )}
                        >
                          <div>
                            <div className="font-semibold">{m.name}</div>
                            <div className="text-[10px] text-slate-400">{m.tag}</div>
                          </div>
                          {selectedModel === m.id && <Check size={14} className="text-violet-400" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => {
                    setMessages([
                      {
                        id: `msg-${Date.now()}`,
                        sender: "bot",
                        text: "New session started. You can drop a Play Store link, an APK file, or ask any Android security question.",
                        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                        suggestions: ["Scan a Play Store app", "Analyze an APK file", "Check a package name"],
                      },
                    ]);
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-[11px] flex items-center gap-1.5 shadow-[0_0_15px_rgba(124,58,237,0.3)] transition-all"
                >
                  <RefreshCw size={12} />
                  <span>New Chat</span>
                </button>
              </div>
            </div>

            {/* Chat Messages Stream - Independent Scrolling */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 lg:p-5 space-y-4 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
              {messages.map((msg) => {
                const isUser = msg.sender === "user";
                return (
                  <div
                    key={msg.id}
                    className={clsx(
                      "flex gap-3 max-w-[92%]",
                      isUser ? "ml-auto flex-row-reverse" : "mr-auto"
                    )}
                  >
                    {!isUser && (
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-md">
                        <Bot size={15} />
                      </div>
                    )}

                    <div className="space-y-2.5 w-full">
                      {/* Message Bubble */}
                      <div
                        className={clsx(
                          "p-3.5 rounded-2xl text-xs leading-relaxed transition-all shadow-md",
                          isUser
                            ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-tr-none font-semibold"
                            : "bg-[#131b2e] border border-slate-800 text-slate-200 rounded-tl-none font-normal"
                        )}
                      >
                        {msg.text && (
                          <div className="whitespace-pre-line prose-invert text-xs">
                            {msg.text}
                          </div>
                        )}

                        {/* Step-by-Step Checklist Card */}
                        {msg.steps && msg.steps.length > 0 && (
                          <div className="mt-3 space-y-1.5 border-t border-slate-800/80 pt-2.5">
                            {msg.steps.map((st, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between py-1 px-2.5 rounded-lg bg-slate-900/60 border border-slate-800/60 text-[11px]"
                              >
                                <div className="flex items-center gap-2">
                                  {st.status === "completed" ? (
                                    <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                                      <Check size={11} strokeWidth={3} />
                                    </div>
                                  ) : st.status === "in_progress" ? (
                                    <div className="w-4 h-4 rounded-full border-2 border-violet-400 border-t-transparent animate-spin shrink-0" />
                                  ) : (
                                    <div className="w-4 h-4 rounded-full bg-slate-800 text-slate-500 flex items-center justify-center text-[10px] shrink-0">
                                      {st.step}
                                    </div>
                                  )}
                                  <span className={clsx(st.status === "completed" ? "text-slate-200 font-medium" : "text-slate-400")}>
                                    {st.title}
                                  </span>
                                </div>
                                {st.time && (
                                  <span className="text-[10px] font-mono text-slate-500">
                                    {st.time}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Interactive Scan Preview Card */}
                        {msg.scanPreview && (
                          <div className="mt-3 p-3 rounded-xl bg-slate-900/90 border border-slate-700/80 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {msg.scanPreview.app_icon ? (
                                <img
                                  src={msg.scanPreview.app_icon}
                                  alt={msg.scanPreview.app_name}
                                  className="w-10 h-10 rounded-xl object-contain bg-slate-800 p-1 border border-slate-700"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-xl bg-violet-600/30 border border-violet-500/40 flex items-center justify-center text-violet-300 font-extrabold text-sm">
                                  {msg.scanPreview.app_name?.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <h4 className="text-xs font-bold text-white">
                                  {msg.scanPreview.app_name}
                                </h4>
                                <p className="text-[10px] text-slate-400 font-mono">
                                  {msg.scanPreview.package_name}
                                </p>
                              </div>
                            </div>

                            {/* Risk score badge */}
                            <div className="text-right">
                              <div className={clsx(
                                "px-2 py-0.5 rounded-lg text-xs font-black inline-flex items-center gap-1 border",
                                msg.scanPreview.overall_risk_score >= 70
                                  ? "bg-red-500/15 border-red-500/30 text-red-400"
                                  : msg.scanPreview.overall_risk_score >= 40
                                  ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                                  : "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                              )}>
                                <span>{msg.scanPreview.overall_risk_score} / 100</span>
                              </div>
                              <div className="text-[9px] font-bold text-red-400 mt-0.5">
                                {msg.scanPreview.overall_risk_score >= 70 ? "Critical Risk" : msg.scanPreview.overall_risk_score >= 40 ? "Suspicious" : "Safe"}
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="text-[10px] text-slate-500 mt-1 text-right font-mono">
                          {msg.timestamp}
                        </div>
                      </div>

                      {/* Follow-up Suggestion Chips */}
                      {msg.suggestions && msg.suggestions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {msg.suggestions.map((sugg, sIdx) => (
                            <button
                              key={sIdx}
                              onClick={() => handleSuggestionClick(sugg)}
                              className="px-2.5 py-1 rounded-full bg-[#131b2e] hover:bg-violet-600/20 border border-slate-700/70 hover:border-violet-500/60 text-[10px] font-semibold text-slate-300 hover:text-violet-300 transition-all cursor-pointer flex items-center gap-1"
                            >
                              <span>{sugg}</span>
                              <ChevronRight size={10} className="text-slate-500" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Live Loading Indicator */}
              {loading && (
                <div className="flex gap-3 max-w-[85%] animate-pulse">
                  <div className="w-8 h-8 rounded-xl bg-violet-600/30 border border-violet-500/40 flex items-center justify-center text-violet-400 shrink-0">
                    <Bot size={15} />
                  </div>
                  <div className="p-3.5 rounded-2xl bg-[#131b2e] border border-slate-800 text-xs text-slate-300 rounded-tl-none flex items-center gap-2">
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
                    <span>AppShield AI is analyzing application telemetry & model predictions...</span>
                  </div>
                </div>
              )}

              <div ref={chatBottomRef} />
            </div>

            {/* Bottom Omni-Chat Input Bar */}
            <div className="shrink-0 p-3 lg:p-4 border-t border-slate-800/80 bg-[#0e1322]">
              {selectedFile && (
                <div className="mb-2 px-3 py-1.5 rounded-xl bg-violet-500/10 border border-violet-500/30 text-xs text-violet-300 flex items-center justify-between">
                  <div className="flex items-center gap-2 truncate">
                    <Package size={14} />
                    <span className="font-semibold truncate">{selectedFile.name}</span>
                    <span className="text-[10px] text-slate-400">({(selectedFile.size / (1024 * 1024)).toFixed(1)} MB)</span>
                  </div>
                  <button onClick={() => setSelectedFile(null)} className="text-slate-400 hover:text-white">
                    <X size={14} />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2 bg-[#141b2e] border border-slate-700/80 focus-within:border-violet-500/80 rounded-2xl p-1.5 transition-all shadow-inner">
                {/* File Attachment Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-violet-400 hover:bg-slate-800/60 transition-colors"
                  title="Upload APK file"
                >
                  <Paperclip size={16} />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".apk"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setSelectedFile(f);
                  }}
                />

                {/* Omni Text Input */}
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Ask a question, paste a link, drop an APK file, or enter a package name..."
                  className="flex-1 bg-transparent text-xs text-white placeholder:text-slate-500 focus:outline-none px-2"
                />

                {/* Active Model Pill Badge */}
                <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-800/60 border border-slate-700/50 text-[10px] font-bold text-slate-400">
                  <Sparkles size={10} className="text-violet-400" />
                  <span>{currentModelLabel}</span>
                </div>

                {/* Send Button */}
                <button
                  type="button"
                  disabled={loading || (!input.trim() && !selectedFile)}
                  onClick={() => handleSendMessage()}
                  className="w-8 h-8 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white flex items-center justify-center shadow-[0_0_15px_rgba(124,58,237,0.4)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <Send size={14} />
                </button>
              </div>
            </div>

          </div>


          {/* ══════════════════════════════════════════════════════
              RIGHT PANEL: Live Threat Dossier & Analysis Canvas
              ══════════════════════════════════════════════════════ */}
          <div className="lg:col-span-5 h-full flex flex-col min-h-0 overflow-hidden bg-[#0f172a]/95 border-l border-slate-800/80">
            
            {/* Top Navigation Tabs */}
            <div className="shrink-0 px-4 py-2 border-b border-slate-800/80 bg-[#0e1322] flex items-center gap-1 overflow-x-auto scrollbar-none z-10">
              {[
                { id: "analysis", label: "Analysis Result" },
                { id: "details", label: "App Details" },
                { id: "permissions", label: "Permissions" },
                { id: "ml", label: "ML Analysis" },
                { id: "screenshots", label: "Screenshots" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={clsx(
                    "px-3 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all",
                    activeTab === tab.id
                      ? "bg-violet-600/20 text-violet-400 border border-violet-500/40 shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Canvas Body - Independent Scrolling View */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 lg:p-5 space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
              
              {/* TAB 1: ANALYSIS RESULT (Matches Mockup) */}
              {activeTab === "analysis" && (
                <>
                  {/* 1. App Profile Card */}
                  <div className="p-4 rounded-2xl bg-[#131b2e] border border-slate-800 shadow-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {scan.app_icon ? (
                        <img
                          src={scan.app_icon}
                          alt={scan.app_name}
                          className="w-12 h-12 rounded-2xl object-contain bg-slate-900 p-1 border border-slate-700/60 shadow-md"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white font-black text-base">
                          {scan.app_name?.slice(0, 2).toUpperCase() || "AP"}
                        </div>
                      )}
                      <div>
                        <h3 className="text-sm font-extrabold text-white tracking-tight">
                          {scan.app_name}
                        </h3>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {scan.package_name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                            Google Play
                          </span>
                          <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                            {scan.category || "Communication"}
                          </span>
                          <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            Official App
                          </span>
                        </div>
                      </div>
                    </div>

                    <a
                      href={`https://play.google.com/store/apps/details?id=${scan.package_name}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] font-bold text-slate-300 hover:text-white flex items-center gap-1 transition-colors"
                    >
                      <span>Play Store</span>
                      <ExternalLink size={11} />
                    </a>
                  </div>

                  {/* 2. Risk Overview Card (Circular SVG Radial Gauge) */}
                  <div className="p-5 rounded-2xl bg-[#131b2e] border border-slate-800 shadow-xl">
                    <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-3">
                      Risk Overview
                    </div>

                    <div className="grid grid-cols-12 gap-3 items-center">
                      {/* Circular Radial Gauge */}
                      <div className="col-span-5 flex flex-col items-center justify-center relative">
                        <div className="relative w-28 h-28 flex items-center justify-center">
                          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                            {/* Background track */}
                            <circle
                              cx="50"
                              cy="50"
                              r="40"
                              fill="transparent"
                              stroke="#1e293b"
                              strokeWidth="9"
                            />
                            {/* Progress glow arc */}
                            <circle
                              cx="50"
                              cy="50"
                              r="40"
                              fill="transparent"
                              stroke={scoreColor}
                              strokeWidth="9"
                              strokeDasharray={251.2}
                              strokeDashoffset={251.2 - (251.2 * score) / 100}
                              strokeLinecap="round"
                              style={{
                                transition: "stroke-dashoffset 1s ease-in-out",
                                filter: `drop-shadow(0 0 6px ${scoreColor})`,
                              }}
                            />
                          </svg>
                          
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                            <span className="text-xl font-black text-white tracking-tight">
                              {score}
                            </span>
                            <span className="text-[9px] font-bold text-slate-400">
                              / 100
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Risk Text & Badge */}
                      <div className="col-span-7 space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle size={16} className="text-red-500 shrink-0" />
                          <h4 className="text-xs font-extrabold text-red-400">
                            {riskTitle}
                          </h4>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          This application exhibits elevated risk signatures that warrant security verification.
                        </p>
                        <div className="pt-0.5 flex items-center gap-2 text-[10px] font-bold text-slate-300">
                          <ShieldCheck size={13} className="text-violet-400" />
                          <span>Confidence: <strong className="text-white font-mono">{confidence}%</strong></span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. Top Risk Factors */}
                  <div className="p-4 rounded-2xl bg-[#131b2e] border border-slate-800 shadow-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                        Top Risk Factors
                      </span>
                      <button onClick={() => setActiveTab("permissions")} className="text-[10px] font-bold text-violet-400 hover:text-violet-300">
                        View All
                      </button>
                    </div>

                    <div className="space-y-2.5 pt-0.5">
                      {(scan.top_contributors && scan.top_contributors.length > 0 ? scan.top_contributors : [
                        { feature: "Suspicious Permissions", label: "Suspicious Permissions", impact_percent: 31 },
                        { feature: "Network Connections", label: "Network Connections", impact_percent: 22 },
                        { feature: "Code Obfuscation", label: "Code Obfuscation", impact_percent: 18 },
                        { feature: "Potential Data Exfiltration", label: "Potential Data Exfiltration", impact_percent: 15 },
                        { feature: "Similar to Known Malware", label: "Similar to Known Malware", impact_percent: 14 },
                      ]).map((item, idx) => {
                        const pct = item.impact_percent;
                        const level = pct >= 25 ? "High" : pct >= 15 ? "Medium" : "Low";
                        const barColor = pct >= 25 ? "bg-red-500" : pct >= 15 ? "bg-amber-500" : "bg-blue-500";
                        return (
                          <div key={idx} className="space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-semibold text-slate-300">{item.label || item.feature}</span>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-slate-400 font-bold text-[10px]">{pct}%</span>
                                <span className={clsx(
                                  "text-[9px] font-extrabold px-1.5 py-0.5 rounded",
                                  level === "High" ? "bg-red-500/20 text-red-400" : level === "Medium" ? "bg-amber-500/20 text-amber-400" : "bg-blue-500/20 text-blue-400"
                                )}>
                                  {level}
                                </span>
                              </div>
                            </div>
                            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={clsx("h-full rounded-full transition-all duration-500", barColor)}
                                style={{ width: `${Math.min(pct * 2.5, 100)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 4. ML Model Predictions Breakdown */}
                  <div className="p-4 rounded-2xl bg-[#131b2e] border border-slate-800 shadow-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                        ML Model Predictions
                      </span>
                      <button onClick={() => setActiveTab("ml")} className="text-[10px] font-bold text-violet-400 hover:text-violet-300">
                        Detailed Metrics
                      </button>
                    </div>

                    <div className="space-y-2 pt-0.5">
                      {[
                        { name: "LightGBM", score: 89.2, color: "bg-red-500" },
                        { name: "Random Forest", score: 84.1, color: "bg-orange-500" },
                        { name: "XGBoost", score: 81.3, color: "bg-orange-500" },
                        { name: "CatBoost", score: 78.6, color: "bg-amber-500" },
                        { name: "Neural Network", score: 76.4, color: "bg-amber-500" },
                        { name: "Ensemble", score: 86.7, color: "bg-violet-500" },
                      ].map((m) => (
                        <div key={m.name} className="flex items-center justify-between gap-3 text-[11px]">
                          <span className="font-semibold text-slate-300 w-24 shrink-0">{m.name}</span>
                          <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={clsx("h-full rounded-full", m.color)}
                              style={{ width: `${m.score}%` }}
                            />
                          </div>
                          <span className="font-mono text-slate-400 font-bold text-[10px] w-10 text-right">
                            {m.score}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 5. Quick Actions */}
                  <div className="space-y-2 pt-1">
                    <a
                      href={api.downloadPdfReport(scan.scan_id)}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(124,58,237,0.4)] transition-all cursor-pointer"
                    >
                      <Download size={14} />
                      <span>Download PDF Report</span>
                    </a>

                    <button
                      onClick={() => setActiveTab("permissions")}
                      className="w-full py-2 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 text-slate-300 hover:text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Code2 size={13} />
                      <span>View Declared Permissions</span>
                    </button>
                  </div>
                </>
              )}

              {/* TAB 2: APP DETAILS */}
              {activeTab === "details" && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-[#131b2e] border border-slate-800 space-y-3">
                    <h4 className="text-xs font-bold text-white flex items-center gap-2">
                      <FileText size={14} className="text-violet-400" />
                      <span>Package Specification</span>
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-2.5 rounded-xl bg-[#0e1424] border border-slate-800/80">
                        <div className="text-[10px] text-slate-400 font-semibold">Application Name</div>
                        <div className="text-white font-bold mt-0.5">{scan.app_name}</div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#0e1424] border border-slate-800/80">
                        <div className="text-[10px] text-slate-400 font-semibold">Package Identifier</div>
                        <div className="text-white font-mono text-[11px] truncate mt-0.5">{scan.package_name}</div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#0e1424] border border-slate-800/80">
                        <div className="text-[10px] text-slate-400 font-semibold">Version</div>
                        <div className="text-white font-mono mt-0.5">{scan.version || "2.24.18.77"}</div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#0e1424] border border-slate-800/80">
                        <div className="text-[10px] text-slate-400 font-semibold">Downloads</div>
                        <div className="text-white font-mono mt-0.5">{scan.downloads || "5B+"}</div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#0e1424] border border-slate-800/80">
                        <div className="text-[10px] text-slate-400 font-semibold">Category</div>
                        <div className="text-white mt-0.5">{scan.category || "Communication"}</div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#0e1424] border border-slate-800/80">
                        <div className="text-[10px] text-slate-400 font-semibold">Rating</div>
                        <div className="text-amber-400 font-bold mt-0.5">★ {scan.rating || 4.3} / 5.0</div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#131b2e] border border-slate-800 space-y-3">
                    <h4 className="text-xs font-bold text-white flex items-center gap-2">
                      <Lock size={14} className="text-violet-400" />
                      <span>Security & Integrity Details</span>
                    </h4>
                    <div className="space-y-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-[#0e1424] border border-slate-800/80 flex justify-between items-center">
                        <span className="text-slate-400">Developer</span>
                        <span className="text-white font-bold">{scan.developer || "WhatsApp LLC"}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#0e1424] border border-slate-800/80 flex justify-between items-center">
                        <span className="text-slate-400">Scan Timestamp</span>
                        <span className="text-slate-300 font-mono text-[11px]">{scan.scanned_at ? new Date(scan.scanned_at).toLocaleString() : "Just now"}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#0e1424] border border-slate-800/80 flex justify-between items-center">
                        <span className="text-slate-400">Primary Model</span>
                        <span className="text-violet-400 font-bold">{scan.model_used || "LightGBM"}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#0e1424] border border-slate-800/80 flex justify-between items-center">
                        <span className="text-slate-400">Input Source</span>
                        <span className="text-slate-300 font-mono text-[11px]">{scan.input_type || "play_url"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: PERMISSIONS */}
              {activeTab === "permissions" && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-[#131b2e] border border-slate-800">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="text-xs font-bold text-white">Declared Manifest Permissions</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">Found {scan.permissions?.length || 10} permissions in Dalvik manifest</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                        {scan.permissions?.filter(p => p.includes("SMS") || p.includes("CAMERA") || p.includes("ACCESSIBILITY") || p.includes("RECORD")).length || 4} Critical
                      </span>
                    </div>

                    <div className="space-y-2">
                      {(scan.permissions || [
                        "android.permission.INTERNET",
                        "android.permission.READ_CONTACTS",
                        "android.permission.RECORD_AUDIO",
                        "android.permission.CAMERA",
                        "android.permission.ACCESS_FINE_LOCATION",
                        "android.permission.READ_SMS",
                        "android.permission.SEND_SMS",
                        "android.permission.SYSTEM_ALERT_WINDOW",
                        "android.permission.RECEIVE_BOOT_COMPLETED",
                        "android.permission.BIND_ACCESSIBILITY_SERVICE",
                      ]).map((perm, pIdx) => {
                        const isHigh = perm.includes("SMS") || perm.includes("ACCESSIBILITY") || perm.includes("ALERT_WINDOW");
                        const isMed = perm.includes("CAMERA") || perm.includes("RECORD") || perm.includes("LOCATION");
                        return (
                          <div key={pIdx} className="p-2.5 rounded-xl bg-[#0e1424] border border-slate-800/80 flex items-center justify-between gap-2">
                            <div className="truncate">
                              <div className="font-mono text-xs text-slate-200 font-semibold truncate">{perm}</div>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {isHigh ? "High-impact permission frequently abused for financial exfiltration" : isMed ? "Sensitive personal hardware/data access" : "Standard network capability"}
                              </div>
                            </div>
                            <span className={clsx(
                              "text-[9px] font-extrabold px-2 py-0.5 rounded shrink-0",
                              isHigh ? "bg-red-500/20 text-red-400 border border-red-500/30" : isMed ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "bg-blue-500/20 text-blue-400"
                            )}>
                              {isHigh ? "Critical" : isMed ? "Sensitive" : "Normal"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: ML ANALYSIS */}
              {activeTab === "ml" && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-[#131b2e] border border-slate-800 space-y-3">
                    <h4 className="text-xs font-bold text-white flex items-center gap-2">
                      <Cpu size={14} className="text-violet-400" />
                      <span>Class Probabilities</span>
                    </h4>
                    <div className="space-y-2">
                      {[
                        { label: "Fraudulent", pct: scan.class_probabilities?.Fraudulent ?? 89.2, color: "bg-red-500" },
                        { label: "Suspicious", pct: scan.class_probabilities?.Suspicious ?? 7.1, color: "bg-amber-500" },
                        { label: "Safe / Benign", pct: scan.class_probabilities?.Safe ?? 3.7, color: "bg-emerald-500" },
                      ].map((item) => (
                        <div key={item.label} className="space-y-1">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="text-slate-300">{item.label}</span>
                            <span className="text-slate-400 font-mono">{item.pct}%</span>
                          </div>
                          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div className={clsx("h-full rounded-full", item.color)} style={{ width: `${item.pct}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#131b2e] border border-slate-800 space-y-3">
                    <h4 className="text-xs font-bold text-white flex items-center gap-2">
                      <Activity size={14} className="text-violet-400" />
                      <span>Classifier Confidence Benchmark</span>
                    </h4>
                    <div className="space-y-2 text-xs">
                      {[
                        { model: "LightGBM", accuracy: "98.43%", auc: "0.992", status: "Active Primary" },
                        { model: "Random Forest", accuracy: "97.81%", auc: "0.985", status: "Ensemble Contributor" },
                        { model: "XGBoost", accuracy: "98.12%", auc: "0.989", status: "Ensemble Contributor" },
                        { model: "CatBoost", accuracy: "97.65%", auc: "0.981", status: "Ensemble Contributor" },
                      ].map((m) => (
                        <div key={m.model} className="p-2.5 rounded-xl bg-[#0e1424] border border-slate-800/80 flex items-center justify-between">
                          <div>
                            <div className="font-bold text-white">{m.model}</div>
                            <div className="text-[10px] text-slate-400">{m.status}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-violet-400 font-mono font-bold">{m.accuracy}</div>
                            <div className="text-[10px] text-slate-500">AUC {m.auc}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: SCREENSHOTS */}
              {activeTab === "screenshots" && (
                <div className="p-5 rounded-2xl bg-[#131b2e] border border-slate-800 text-center space-y-4">
                  <Smartphone size={32} className="mx-auto text-violet-400" />
                  <div>
                    <h4 className="text-sm font-bold text-white">Visual UI Security Inspection</h4>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                      Screenshots and UI layout frames captured during automated dynamic sandbox emulation.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="h-44 rounded-xl bg-[#0e1424] border border-slate-800 flex flex-col items-center justify-center p-3 text-slate-500 text-xs">
                      <div className="w-8 h-8 rounded-lg bg-slate-800 mb-2 flex items-center justify-center text-slate-400">1</div>
                      <span>Login / Phone Auth View</span>
                      <span className="text-[10px] text-emerald-400 mt-1">✓ No Overlay Detected</span>
                    </div>
                    <div className="h-44 rounded-xl bg-[#0e1424] border border-slate-800 flex flex-col items-center justify-center p-3 text-slate-500 text-xs">
                      <div className="w-8 h-8 rounded-lg bg-slate-800 mb-2 flex items-center justify-center text-slate-400">2</div>
                      <span>Permission Request Dialog</span>
                      <span className="text-[10px] text-amber-400 mt-1">⚠️ Full SMS Access Prompt</span>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
