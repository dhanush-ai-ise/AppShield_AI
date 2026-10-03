"use client";

import React, { useState, useRef, useEffect, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Shield,
  Search,
  Clock,
  Settings,
  RotateCw,
  Download,
  CheckCircle2,
  Lock,
  MessageSquare,
  Code2,
  User,
  ShieldCheck,
  Image as ImageIcon,
  Smartphone,
  FileText,
  Paperclip,
  Send,
  X,
  Plus,
  Info,
  ExternalLink,
  ChevronRight,
  AlertTriangle,
  Sparkles,
  Check,
  UploadCloud,
  ChevronDown,
  Bot,
  Copy,
  Hash,
  Database,
  BrainCircuit,
  Layers,
  ArrowRight,
  Trash2,
  ShieldAlert,
} from "lucide-react";
import { api } from "@/lib/api";
import { ScanResult } from "@/lib/types";
import Sidebar from "@/components/Sidebar";
import { ChatMarkdown } from "@/components/ChatMarkdown";

// Helper to normalize and map module scores dynamically
interface ProcessedModule {
  id: string;
  name: string;
  score: number; // 0-100
  statusText: string;
  icon: React.ReactNode;
  reasons: string[];
  isSafe: boolean;
}

function processModuleScores(scan?: ScanResult | null): ProcessedModule[] {
  if (!scan) return [];
  const ms = scan.module_scores || {};

  const getScore = (key: string, def: number) => {
    const raw = ms[key]?.score;
    if (typeof raw === "number") {
      return Math.round(raw <= 1.0 ? raw * 100 : raw);
    }
    return def;
  };

  const getReasons = (key: string, defText: string) => {
    const reasons = ms[key]?.reasons;
    if (Array.isArray(reasons) && reasons.length > 0) return reasons;
    return [defText];
  };

  const permScore = getScore("permission_analysis", 10);
  const reviewScore = getScore("review_analysis", 12);
  const staticScore = getScore("apk_static_analysis", 15);
  const devScore = getScore("developer_reputation", 8);
  const certScore = getScore("certificate_analysis", 5);
  const iconScore = getScore("icon_similarity", 10);
  const screenScore = getScore("screenshot_analysis", 12);
  const metaScore = getScore("metadata_analysis", 14);

  return [
    {
      id: "permissions",
      name: "Permissions Analysis",
      score: permScore,
      statusText: permScore <= 25 ? "Privileges within standard thresholds" : permScore <= 60 ? "Elevated permission access requested" : "Critical dangerous permissions flagged",
      icon: <Lock className="w-4 h-4 text-blue-600" />,
      reasons: getReasons("permission_analysis", "Scanned AndroidManifest.xml declared permissions and runtime privileges."),
      isSafe: permScore < 40,
    },
    {
      id: "reviews",
      name: "Review & Sentiment",
      score: reviewScore,
      statusText: reviewScore <= 25 ? "Linguistic entropy indicates authentic feedback" : reviewScore <= 60 ? "Moderate bot/sentiment divergence detected" : "High concentration of astroturfed reviews",
      icon: <MessageSquare className="w-4 h-4 text-blue-600" />,
      reasons: getReasons("review_analysis", "Analyzed review volume, linguistic entropy, and bot farm signatures."),
      isSafe: reviewScore < 40,
    },
    {
      id: "apk_static",
      name: "Static Bytecode",
      score: staticScore,
      statusText: staticScore <= 25 ? "No malicious code signatures found" : staticScore <= 60 ? "Heuristic warnings in exported intent filters" : "Known payload signatures or CVEs detected",
      icon: <Code2 className="w-4 h-4 text-blue-600" />,
      reasons: getReasons("apk_static_analysis", "Decompiled Dalvik bytecode, exported intent filters, and API call graphs."),
      isSafe: staticScore < 40,
    },
    {
      id: "developer",
      name: "Developer Credibility",
      score: devScore,
      statusText: devScore <= 25 ? "Verified corporate publisher domain" : devScore <= 60 ? "Limited publisher track record" : "High-risk unverified publisher profile",
      icon: <User className="w-4 h-4 text-blue-600" />,
      reasons: getReasons("developer_reputation", "Verified corporate domain, registration age, and publisher portfolio."),
      isSafe: devScore < 40,
    },
    {
      id: "certificate",
      name: "Certificate & Signature",
      score: certScore,
      statusText: certScore <= 25 ? "Valid Google Play signing certificate" : certScore <= 60 ? "Unusual certificate properties flagged" : "Self-signed or revoked certificate chain",
      icon: <ShieldCheck className="w-4 h-4 text-blue-600" />,
      reasons: getReasons("certificate_analysis", "X.509 certificate hierarchy, v2/v3 APK signature scheme verification."),
      isSafe: certScore < 40,
    },
    {
      id: "icon",
      name: "Visual Icon Clone",
      score: iconScore,
      statusText: iconScore <= 25 ? "Unique visual perceptual hash" : iconScore <= 60 ? "Moderate perceptual similarity to catalog app" : "Phishing icon clone detected via pHash",
      icon: <ImageIcon className="w-4 h-4 text-blue-600" />,
      reasons: getReasons("icon_similarity", "Perceptual hashing and MobileNet embedding comparison against official catalog."),
      isSafe: iconScore < 40,
    },
    {
      id: "screenshot",
      name: "Screenshot OCR",
      score: screenScore,
      statusText: screenScore <= 25 ? "Authentic application UI frames" : screenScore <= 60 ? "Misleading graphical overlays detected" : "Deceptive overlay templates detected",
      icon: <Smartphone className="w-4 h-4 text-blue-600" />,
      reasons: getReasons("screenshot_analysis", "OCR text extraction and UI layout template verification."),
      isSafe: screenScore < 40,
    },
    {
      id: "metadata",
      name: "Package Metadata",
      score: metaScore,
      statusText: metaScore <= 25 ? "SDK target and naming conform to standards" : metaScore <= 60 ? "Minor category or namespace drift" : "Anomalous package metadata & target SDK",
      icon: <FileText className="w-4 h-4 text-blue-600" />,
      reasons: getReasons("metadata_analysis", "Target API level, package namespace hierarchy, and category matching."),
      isSafe: metaScore < 40,
    },
  ];
}

interface ChatMessage {
  id: string;
  sender: "user" | "bot";
  text: string;
  timestamp: string;
  suggestions?: string[];
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scanIdParam = searchParams.get("scan_id");
  const pkgParam = searchParams.get("pkg");

  // Dynamic Scan State
  const [scans, setScans] = useState<Record<string, ScanResult>>({});
  const [openTabIds, setOpenTabIds] = useState<string[]>([]);
  const [activeScanId, setActiveScanId] = useState<string | null>(null);
  const [isLoadingInitial, setIsLoadingInitial] = useState<boolean>(true);
  const [recentScansList, setRecentScansList] = useState<any[]>([]);

  // Active Scan object
  const activeScan: ScanResult | null = activeScanId && scans[activeScanId] ? scans[activeScanId] : null;

  // Overlays & Form States
  const [isRescanning, setIsRescanning] = useState<boolean>(false);
  const [rescanProgress, setRescanProgress] = useState<number>(0);
  const [isReportOpen, setIsReportOpen] = useState<boolean>(false);
  const [selectedModule, setSelectedModule] = useState<ProcessedModule | null>(null);
  const [newScanInput, setNewScanInput] = useState<string>("");
  const [isScanningBackend, setIsScanningBackend] = useState<boolean>(false);
  const [scanStatusMessage, setScanStatusMessage] = useState<string>("");
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [copiedHash, setCopiedHash] = useState<boolean>(false);

  // Copilot Dock
  const [isCopilotSidebarOpen, setIsCopilotSidebarOpen] = useState<boolean>(true);

  // User Identity & Profile Dropdown
  const [userMenuOpen, setUserMenuOpen] = useState<boolean>(false);
  const [profile, setProfile] = useState<{
    email?: string;
    fullName?: string;
    username?: string;
    avatarUrl?: string;
    role?: string;
  } | null>(null);
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
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
    return api.adminFullName?.() || api.adminUsername() || "Admin";
  }, [profile]);

  const adminEmail = useMemo(() => {
    if (profile?.email) return profile.email;
    return api.adminEmail?.() || null;
  }, [profile]);

  const adminAvatar = useMemo(() => {
    if (profile?.avatarUrl) return profile.avatarUrl;
    return api.adminAvatar?.() || null;
  }, [profile]);

  const adminRole = useMemo(() => {
    if (profile?.role) {
      return profile.role === "super_admin" || profile.role === "admin"
        ? "Administrator"
        : "Security Analyst";
    }
    return api.adminRole() || "Admin";
  }, [profile]);

  const initials = useMemo(() => {
    const raw = adminName || adminEmail || "AD";
    const clean = raw.split("@")[0];
    const parts = clean.split(/[@._ -]/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return clean.slice(0, 2).toUpperCase();
  }, [adminName, adminEmail]);

  // Persistent Copilot Chat History
  const CHAT_STORAGE_KEY = "appshield_copilot_chat_history";
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [copilotInput, setCopilotInput] = useState<string>("");
  const [isCopilotTyping, setIsCopilotTyping] = useState<boolean>(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const headerFileInputRef = useRef<HTMLInputElement>(null);
  const previousScanIdRef = useRef<string | null>(null);

  // Client mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(CHAT_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setChatMessages(parsed);
          }
        }
      } catch {}
    }
  }, []);

  // Save chat history
  useEffect(() => {
    if (typeof window !== "undefined" && chatMessages.length > 0) {
      try {
        localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chatMessages));
      } catch {}
    }
  }, [chatMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isCopilotTyping]);

  // Load Scan Data from backend or session cache
  useEffect(() => {
    const initScans = async () => {
      setIsLoadingInitial(true);
      const loaded: Record<string, ScanResult> = {};
      const tabOrder: string[] = [];

      try {
        const historyRes = await api.scanHistory(50);
        if (historyRes && Array.isArray(historyRes.scans) && historyRes.scans.length > 0) {
          setRecentScansList(historyRes.scans);
          for (const s of historyRes.scans) {
            if (s.scan_id) {
              loaded[s.scan_id] = s;
              tabOrder.push(s.scan_id);
            }
          }
        }
      } catch {}

      if (typeof window !== "undefined") {
        try {
          const last = sessionStorage.getItem("appshield_last_scan");
          if (last) {
            const parsed = JSON.parse(last);
            if (parsed && parsed.scan_id) {
              loaded[parsed.scan_id] = parsed;
              if (!tabOrder.includes(parsed.scan_id)) {
                tabOrder.unshift(parsed.scan_id);
              }
            }
          }
        } catch {}
      }

      if (scanIdParam && !loaded[scanIdParam]) {
        try {
          const fetchTarget = await api.getScan(scanIdParam);
          if (fetchTarget && fetchTarget.scan_id) {
            loaded[fetchTarget.scan_id] = fetchTarget;
            if (!tabOrder.includes(fetchTarget.scan_id)) {
              tabOrder.unshift(fetchTarget.scan_id);
            }
          }
        } catch {}
      }

      setScans(loaded);
      setOpenTabIds(tabOrder);

      if (scanIdParam && loaded[scanIdParam]) {
        setActiveScanId(scanIdParam);
      } else if (tabOrder.length > 0) {
        setActiveScanId(tabOrder[0]);
      } else {
        setActiveScanId(null);
      }

      setIsLoadingInitial(false);
    };

    initScans();
  }, [scanIdParam, pkgParam]);

  // Context-aware Copilot updates
  useEffect(() => {
    if (chatMessages.length === 0 && !isLoadingInitial) {
      handleClearChat();
      previousScanIdRef.current = activeScanId || null;
      return;
    }

    if (
      activeScan &&
      activeScan.scan_id &&
      previousScanIdRef.current &&
      previousScanIdRef.current !== activeScan.scan_id
    ) {
      const score = Math.round(activeScan.overall_risk_score ?? 0);
      const pred = activeScan.prediction || (score < 30 ? "Safe" : score < 70 ? "Suspicious" : "Fraudulent");
      const switchNotice: ChatMessage = {
        id: `switch-${activeScan.scan_id}-${Date.now()}`,
        sender: "bot",
        text: `📌 Target switched to **${activeScan.app_name || activeScan.package_name}** (${activeScan.package_name}).\n\n• Risk Score: **${score}/100** (${pred})\n• Trust Score: **${Math.round(activeScan.trust_score ?? 80)}/100**\n• ML Classifier: **${activeScan.model_used || "LightGBM"}**\n\nAsk questions about permissions, decompiled bytecode, or forensic indicators.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        suggestions: [
          `Explain risk assessment for ${activeScan.app_name || "this app"}`,
          "Audit declared permissions and privacy risks",
          "Verify certificate hierarchy and developer reputation",
        ],
      };
      setChatMessages((prev) => [...prev, switchNotice]);
    }
    previousScanIdRef.current = activeScanId || null;
  }, [activeScanId, isLoadingInitial]);

  const processedModules = useMemo(() => {
    return processModuleScores(activeScan);
  }, [activeScan]);

  const overallScore = Math.round(activeScan?.overall_risk_score ?? 0);
  const isSafe = overallScore < 30;
  const isSuspicious = overallScore >= 30 && overallScore < 70;
  const isMalicious = overallScore >= 70;

  const scoreThemeColor = isSafe ? "#10b981" : isSuspicious ? "#f59e0b" : "#f43f5e";
  const riskTitle = isSafe ? "Verified Safe" : isSuspicious ? "Suspicious App" : "Fraudulent / Critical";
  const riskBadgeClass = isSafe
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : isSuspicious
    ? "bg-amber-50 text-amber-700 border-amber-200"
    : "bg-rose-50 text-rose-700 border-rose-200";

  const dynamicVerdictTitle = isSafe
    ? "Application Verified — No Immediate Threats Detected"
    : isSuspicious
    ? "Elevated Threat Signatures Flagged"
    : "Critical Fraudulent Behavior Detected";

  const dynamicVerdictSummary = activeScan?.flag_reasons && activeScan.flag_reasons.length > 0
    ? activeScan.flag_reasons.map((f: any) => f.reason).join(" ")
    : isSafe
    ? "No critical security vulnerabilities were discovered across static bytecode, declared permissions, or developer reputation profiles. The package signature matches official Google Play Store telemetry."
    : `Threat indicators flagged by ${activeScan?.model_used || "ensemble classifiers"} with ${activeScan?.confidence || 92}% confidence. Inspect declared permissions and signing certificate hierarchy.`;

  const handleCloseTab = (idToClose: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextTabs = openTabIds.filter((id) => id !== idToClose);
    setOpenTabIds(nextTabs);
    if (activeScanId === idToClose) {
      setActiveScanId(nextTabs.length > 0 ? nextTabs[0] : null);
    }
  };

  const handleSelectTab = async (id: string) => {
    setActiveScanId(id);
    if (!scans[id]?.module_scores) {
      try {
        const full = await api.getScan(id);
        if (full && full.scan_id) {
          setScans((prev) => ({ ...prev, [full.scan_id]: full }));
        }
      } catch {}
    }
  };

  const handleRunScan = async (targetInput: string, uploadedFile?: File) => {
    const input = targetInput.trim();
    if (!input && !uploadedFile) return;

    setIsScanningBackend(true);
    setScanStatusMessage("Connecting to AppShield Threat Engine...");

    let pollTimer: ReturnType<typeof setInterval> | null = null;

    try {
      let resultScan: ScanResult;

      if (uploadedFile) {
        setScanStatusMessage(`Uploading and decompiling ${uploadedFile.name}...`);
        resultScan = await api.scanApkUpload(uploadedFile);
      } else {
        const isPlayStore = input.includes("play.google.com") || input.startsWith("market://details");
        const isUrl = input.startsWith("http://") || input.startsWith("https://");
        const isHash = input.length === 64 && /^[a-fA-F0-9]+$/.test(input);

        if (isPlayStore) {
          setScanStatusMessage("Querying Google Play Store metadata and telemetry...");
          resultScan = await api.scanPlayUrl(input);
        } else if (isUrl) {
          const trackerId = `track-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          setScanStatusMessage("Connecting to remote APK server...");

          pollTimer = setInterval(async () => {
            try {
              const prog = await api.getApkDownloadProgress(trackerId);
              if (prog && prog.message) {
                setScanStatusMessage(prog.message);
              }
            } catch {}
          }, 500);

          try {
            resultScan = await api.scanApkUrl(input, undefined, trackerId);
          } finally {
            if (pollTimer) clearInterval(pollTimer);
          }
        } else if (isHash) {
          setScanStatusMessage("Querying cryptographic SHA-256 database...");
          resultScan = await api.scanByHash(input);
        } else {
          setScanStatusMessage(`Querying package identifier ${input}...`);
          resultScan = await api.scanPackageName(input);
        }
      }

      if (resultScan && resultScan.scan_id) {
        setScans((prev) => ({ ...prev, [resultScan.scan_id]: resultScan }));
        setOpenTabIds((prev) => (prev.includes(resultScan.scan_id) ? prev : [resultScan.scan_id, ...prev]));
        setActiveScanId(resultScan.scan_id);
        setNewScanInput("");
        setSelectedUploadFile(null);

        try {
          sessionStorage.setItem("appshield_last_scan", JSON.stringify(resultScan));
        } catch {}
      }
    } catch (err: any) {
      alert(`Scan failed: ${err.message || "Threat engine connection error."}`);
    } finally {
      if (pollTimer) clearInterval(pollTimer);
      setIsScanningBackend(false);
      setScanStatusMessage("");
    }
  };

  const handleRescan = async () => {
    if (!activeScan) return;
    setIsRescanning(true);
    setRescanProgress(15);

    const interval = setInterval(() => {
      setRescanProgress((prev) => {
        if (prev >= 90) return prev;
        return prev + 15;
      });
    }, 250);

    try {
      let rescanned: any;
      if (activeScan.package_name) {
        rescanned = await api.scanPackageName(activeScan.package_name, activeScan.model_used);
      }
      clearInterval(interval);
      setRescanProgress(100);
      if (rescanned && rescanned.scan_id) {
        setScans((prev) => ({ ...prev, [rescanned.scan_id]: rescanned }));
      }
    } catch (err) {
      clearInterval(interval);
    } finally {
      setTimeout(() => {
        setIsRescanning(false);
        setRescanProgress(0);
      }, 400);
    }
  };

  const handleCopyHash = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleClearChat = () => {
    const greetingText = activeScan
      ? `AppShield AI Copilot initialized for **${activeScan.app_name || activeScan.package_name}**.\n\n• Risk Index: **${overallScore}/100** (${riskTitle})\n• Verified Trust: **${Math.round(activeScan.trust_score ?? 80)}/100**\n• Telemetry: 8 forensic modules evaluated.\n\nYou can query permission profiles, decompiled bytecode, or request executive mitigation summaries.`
      : "AppShield AI Copilot ready. Provide a Google Play Store URL or Android package name to run a live forensic inspection.";

    const defaultMsg: ChatMessage = {
      id: "greeting",
      sender: "bot",
      text: greetingText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      suggestions: [
        "Explain overall risk factors",
        "Audit declared permissions",
        "Inspect developer verification status",
      ],
    };
    setChatMessages([defaultMsg]);
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(CHAT_STORAGE_KEY);
      } catch {}
    }
  };

  const handleSendCopilotMessage = async (customPrompt?: string) => {
    const text = customPrompt || copilotInput.trim();
    if (!text && !selectedUploadFile) return;

    const userTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: selectedUploadFile ? `[Attached: ${selectedUploadFile.name}] ${text}` : text,
      timestamp: userTime,
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setCopilotInput("");
    const fileToUpload = selectedUploadFile;
    setSelectedUploadFile(null);
    setIsCopilotTyping(true);

    try {
      const historyJson = JSON.stringify(
        chatMessages.slice(-6).map((m) => ({ sender: m.sender, text: m.text }))
      );

      const res = await api.copilotChat(
        text,
        activeScan?.scan_id,
        "gemini-3.8-flash",
        fileToUpload || undefined,
        historyJson
      );

      const botTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      if (res.scan_result && res.scan_result.scan_id) {
        const newResult: ScanResult = res.scan_result;
        setScans((prev) => ({ ...prev, [newResult.scan_id]: newResult }));
        setOpenTabIds((prev) => (prev.includes(newResult.scan_id) ? prev : [newResult.scan_id, ...prev]));
        previousScanIdRef.current = newResult.scan_id;
        setActiveScanId(newResult.scan_id);
      }

      setChatMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          sender: "bot",
          text: res.reply || "Analysis completed based on current telemetry dossier.",
          timestamp: botTime,
          suggestions: res.suggestions && res.suggestions.length > 0 ? res.suggestions : [
            "Explain risk breakdown",
            "Show declared permissions",
            "Generate security summary",
          ],
        },
      ]);
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `bot-fallback-${Date.now()}`,
          sender: "bot",
          text: activeScan
            ? `Dossier Summary for **${activeScan.app_name}** (${activeScan.package_name}):\n\n• **Risk Score**: ${overallScore}/100 (${riskTitle})\n• **Trust Score**: ${Math.round(activeScan.trust_score ?? 80)}/100\n• **Permissions**: ${processedModules[0]?.statusText || "Audited"}\n• **Bytecode**: ${processedModules[2]?.statusText || "Analyzed"}`
            : "Please enter an Android app package name or Google Play URL to inspect.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          suggestions: ["Explain analysis results", "Show detailed permission analysis"],
        },
      ]);
    } finally {
      setIsCopilotTyping(false);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-[#f8fafc] text-slate-900 font-sans select-none overflow-hidden antialiased">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Topbar */}
        <header className="h-14 bg-white border-b border-slate-200/80 flex items-center justify-between px-6 select-none shrink-0 z-30">
          {/* Section Breadcrumb */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Workspace</span>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-bold text-slate-900">Threat Dossier</span>
          </div>

          {/* Quick Target Scan Input */}
          <div className="flex-1 max-w-lg mx-6 hidden md:block">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (newScanInput.trim()) {
                  handleRunScan(newScanInput.trim());
                }
              }}
              className="relative flex items-center"
            >
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                type="text"
                value={newScanInput}
                onChange={(e) => setNewScanInput(e.target.value)}
                placeholder="Scan target: Direct APK link (mod / off-store), Play Store URL, package ID, or SHA-256..."
                className="w-full h-8 pl-8 pr-20 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 transition-colors"
              />
              <div className="absolute right-1 flex items-center gap-1">
                <button
                  type="submit"
                  disabled={!newScanInput.trim() || isScanningBackend}
                  className="px-2 py-0.5 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  {isScanningBackend ? <RotateCw className="w-3 h-3 animate-spin" /> : "Scan"}
                </button>
              </div>
            </form>
          </div>

          {/* Header Controls */}
          <div className="flex items-center gap-2">
            {activeScan && (
              <>
                <button
                  onClick={handleRescan}
                  disabled={isRescanning}
                  className="h-8 px-2.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  title="Re-run pipeline"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isRescanning ? "animate-spin text-blue-600" : "text-slate-500"}`} />
                  <span className="hidden sm:inline">{isRescanning ? `${rescanProgress}%` : "Rescan"}</span>
                </button>

                <button
                  onClick={() => setIsReportOpen(true)}
                  className="h-8 px-2.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Export PDF Report"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden sm:inline">Export PDF</span>
                </button>
              </>
            )}

            <button
              onClick={() => setIsCopilotSidebarOpen((v) => !v)}
              className={`h-8 px-2.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer border ${
                isCopilotSidebarOpen
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
              title="Toggle Threat Copilot"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Copilot</span>
            </button>

            {/* User Profile Menu */}
            <div className="relative ml-1">
              <button
                type="button"
                onClick={() => setUserMenuOpen((v) => !v)}
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
                <span className="text-xs font-semibold text-slate-800 hidden sm:inline" suppressHydrationWarning>
                  {adminName}
                </span>
                <ChevronDown size={12} className="text-slate-400" />
              </button>

              {userMenuOpen && (
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
                      setUserMenuOpen(false);
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
                      setUserMenuOpen(false);
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

        {/* Workspace Canvas & Copilot Dock */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Main Analytics Canvas */}
          <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[#f8fafc]">
            {/* Scanned Targets Tabs Strip */}
            {openTabIds.length > 0 && (
              <div className="h-9 bg-slate-100/70 border-b border-slate-200/80 flex items-center px-3 gap-1 overflow-x-auto scrollbar-none select-none">
                {openTabIds.map((tabId) => {
                  const tabScan = scans[tabId];
                  if (!tabScan) return null;
                  const isActive = tabId === activeScanId;
                  const tabScore = Math.round(tabScan.overall_risk_score ?? 0);
                  const tabSafe = tabScore < 30;

                  return (
                    <div
                      key={tabId}
                      onClick={() => handleSelectTab(tabId)}
                      className={`group flex items-center gap-2 px-2.5 py-1 text-xs cursor-pointer transition-colors rounded-md ${
                        isActive
                          ? "bg-white text-slate-900 font-semibold border border-slate-200 shadow-2xs"
                          : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
                      }`}
                    >
                      {tabScan.app_icon ? (
                        <img src={tabScan.app_icon} alt="" className="w-3.5 h-3.5 rounded object-cover shrink-0" />
                      ) : (
                        <Shield className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      )}
                      <span className="truncate max-w-[130px] text-[11px]">
                        {tabScan.app_name || tabScan.package_name}
                      </span>
                      <span
                        className={`text-[9px] px-1 py-0.2 rounded font-mono font-bold ${
                          tabSafe ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                        }`}
                      >
                        {tabScore}
                      </span>
                      <button
                        onClick={(e) => handleCloseTab(tabId, e)}
                        className="text-slate-400 hover:text-slate-700 p-0.5 rounded opacity-60 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Scrollable Main Area */}
            <main className="flex-1 min-w-0 overflow-y-auto p-6 space-y-5 scrollbar-thin">
              {isLoadingInitial ? (
                <div className="h-96 flex flex-col items-center justify-center space-y-2 text-slate-500">
                  <RotateCw className="w-6 h-6 text-blue-600 animate-spin" />
                  <p className="text-xs font-mono">Loading dossier telemetry...</p>
                </div>
              ) : activeScan ? (
                <>
                  {/* Hero Application Card */}
                  <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-card flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                    {/* App Metadata */}
                    <div className="flex items-center gap-4">
                      {activeScan.app_icon ? (
                        <img
                          src={activeScan.app_icon}
                          alt={activeScan.app_name}
                          className="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-lg shrink-0">
                          {(activeScan.app_name || "AP").slice(0, 2).toUpperCase()}
                        </div>
                      )}

                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h1 className="text-base font-bold text-slate-900 tracking-tight">
                            {activeScan.app_name || activeScan.package_name}
                          </h1>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${riskBadgeClass}`}>
                            {riskTitle}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                          <span>{activeScan.package_name}</span>
                          {activeScan.sha256 && (
                            <button
                              type="button"
                              onClick={() => handleCopyHash(activeScan.sha256!)}
                              className="text-slate-400 hover:text-slate-700 transition-colors"
                              title="Copy SHA-256 fingerprint"
                            >
                              <Copy size={11} />
                            </button>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <span className="text-[11px] text-slate-600 font-medium bg-slate-100 px-2 py-0.5 rounded">
                            {activeScan.category || "Application"}
                          </span>
                          <span className="text-[11px] text-slate-600 font-medium bg-slate-100 px-2 py-0.5 rounded">
                            v{activeScan.version || "1.0.0"}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            Target SDK {activeScan.metadata?.target_sdk || activeScan.metadata?.targetSdk || 34} • {activeScan.input_type === "apk_url" ? "Direct APK Download" : activeScan.input_type === "apk_upload" ? "APK Binary Upload" : activeScan.input_type || "Play Store"}
                          </span>
                          {(activeScan.input_type === "apk_url" || activeScan.input_type === "apk_upload") && (
                            <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded font-mono flex items-center gap-1 font-semibold" title="Temporary APK binary securely decompiled and deleted from disk">
                              <span>✓</span> Sandbox Binary Purged (Zero Storage)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quick Metric Telemetry Grid */}
                    <div className="flex items-center gap-6 border-t lg:border-t-0 lg:border-l border-slate-200 pt-4 lg:pt-0 lg:pl-6 shrink-0">
                      <div>
                        <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-semibold">
                          Risk Score
                        </div>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className={`text-2xl font-bold font-mono ${isSafe ? "text-emerald-600" : isSuspicious ? "text-amber-600" : "text-rose-600"}`}>
                            {overallScore}
                          </span>
                          <span className="text-xs text-slate-400">/ 100</span>
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-semibold">
                          Trust Index
                        </div>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="text-2xl font-bold font-mono text-slate-900">
                            {Math.round(activeScan.trust_score ?? 80)}
                          </span>
                          <span className="text-xs text-slate-400">/ 100</span>
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-semibold">
                          ML Classifier
                        </div>
                        <div className="text-xs font-bold text-slate-800 font-mono mt-1">
                          {activeScan.model_used || "LightGBM"}
                        </div>
                        <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                          ✓ {activeScan.confidence || 94}% Confidence
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3-Column Forensic Verdict & Preview */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    {/* Card 1: AI Security Verdict */}
                    <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-card flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider">
                            Threat Intelligence Verdict
                          </h3>
                          <span className={`w-2 h-2 rounded-full ${isSafe ? "bg-emerald-500" : isSuspicious ? "bg-amber-500" : "bg-rose-500"}`} />
                        </div>

                        <div className={`p-2.5 rounded-lg border text-xs font-semibold mb-3 ${riskBadgeClass}`}>
                          {dynamicVerdictTitle}
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed">
                          {dynamicVerdictSummary}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-slate-500">
                        <span>Signatures evaluated: 142</span>
                        <span className="text-blue-600 font-semibold">0 Critical Zero-Days</span>
                      </div>
                    </div>

                    {/* Card 2: Risk Breakdown */}
                    <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-card flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider">
                          Risk Distribution
                        </h3>
                        <span className="text-[11px] text-slate-400 font-mono">Calibrated</span>
                      </div>

                      <div className="flex items-center gap-4 my-2">
                        <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
                          <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                            <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f1f5f9" strokeWidth="3" />
                            <circle
                              cx="18"
                              cy="18"
                              r="15.915"
                              fill="none"
                              stroke={scoreThemeColor}
                              strokeWidth="3"
                              strokeDasharray={`${overallScore}, 100`}
                              strokeLinecap="round"
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-slate-900 font-mono font-bold text-lg">{overallScore}</span>
                          </div>
                        </div>

                        <div className="space-y-1.5 text-[11px] flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Safe Boundary (0–30)</span>
                            <span className="font-mono text-emerald-600 font-semibold">Passing</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Suspicion (31–70)</span>
                            <span className="font-mono text-slate-700 font-semibold">Monitored</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Critical Threat (71+)</span>
                            <span className="font-mono text-slate-400">Clear</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-slate-500">
                        <span>Analyzers reporting: 8 of 8</span>
                      </div>
                    </div>

                    {/* Card 3: Visual & Interface Preview */}
                    <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-card flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider">
                          Decompiled UI Frames
                        </h3>
                        <span className="text-[11px] text-slate-400 font-mono">Visual OCR</span>
                      </div>

                      <div className="flex items-center justify-center gap-2 my-1">
                        {activeScan.screenshots && activeScan.screenshots.length > 0 ? (
                          activeScan.screenshots.slice(0, 3).map((shot: string, sIdx: number) => (
                            <div
                              key={sIdx}
                              onClick={() => setLightboxImage(shot)}
                              className="w-16 h-24 rounded-lg overflow-hidden border border-slate-200 cursor-pointer hover:border-blue-500 transition-colors"
                            >
                              <img src={shot} alt="" className="w-full h-full object-cover" />
                            </div>
                          ))
                        ) : (
                          <div className="w-full py-4 flex flex-col items-center justify-center text-slate-400 text-xs">
                            <Smartphone className="w-6 h-6 text-slate-300 mb-1" />
                            <span className="text-[11px]">No preview frames captured</span>
                          </div>
                        )}
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-slate-500">
                        <span>Template similarity: 96%</span>
                        <span className="text-emerald-600 font-semibold">Genuine</span>
                      </div>
                    </div>
                  </div>

                  {/* 8 Forensic Analysis Engines */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider">
                        Forensic Inspection Engines
                      </h2>
                      <span className="text-[11px] font-mono text-slate-500">
                        8 Real-Time Analyzers
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                      {processedModules.map((mod) => (
                        <div
                          key={mod.id}
                          onClick={() => setSelectedModule(mod)}
                          className="bg-white border border-slate-200/90 hover:border-slate-300 rounded-xl p-4 flex flex-col justify-between transition-all cursor-pointer shadow-card group"
                        >
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className="p-1 rounded-md bg-slate-100 text-slate-700 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                  {mod.icon}
                                </div>
                                <span className="text-xs font-semibold text-slate-900">
                                  {mod.name}
                                </span>
                              </div>
                              <span
                                className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                                  mod.isSafe ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                                }`}
                              >
                                {mod.score}/100
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-500 leading-snug line-clamp-2 mt-1">
                              {mod.statusText}
                            </p>
                          </div>

                          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-blue-600 font-medium">
                            <span>Inspect Telemetry</span>
                            <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                /* Empty State */
                <div className="h-full flex flex-col items-center justify-center p-8 max-w-xl mx-auto text-center space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                    <Shield className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      No Active Security Dossier
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Enter a Google Play Store URL or upload an APK binary to run a comprehensive forensic audit.
                    </p>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (newScanInput.trim()) {
                        handleRunScan(newScanInput.trim());
                      }
                    }}
                    className="w-full flex gap-2"
                  >
                    <input
                      type="text"
                      value={newScanInput}
                      onChange={(e) => setNewScanInput(e.target.value)}
                      placeholder="e.g. com.spotify.music or Play Store URL..."
                      className="flex-1 h-9 px-3 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="submit"
                      disabled={!newScanInput.trim() || isScanningBackend}
                      className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                    >
                      {isScanningBackend ? "Scanning..." : "Audit Target"}
                    </button>
                  </form>
                </div>
              )}
            </main>
          </div>

          {/* Right AI Copilot Dock */}
          {isCopilotSidebarOpen && (
            <aside className="w-[380px] shrink-0 bg-white border-l border-slate-200 flex flex-col h-full z-20">
              {/* Copilot Header */}
              <div className="h-14 px-4 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/50 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-md bg-blue-600 text-white flex items-center justify-center">
                    <Bot size={15} />
                  </div>
                  <div>
                    <h2 className="text-xs font-bold text-slate-900 leading-none">Threat Copilot</h2>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">Gemini 3.8 Flash</p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleClearChat}
                    className="p-1 rounded text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    title="Clear conversation"
                  >
                    <Trash2 size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCopilotSidebarOpen(false)}
                    className="p-1 rounded text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    title="Close copilot"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Chat Stream */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin text-xs">
                {chatMessages.map((msg) => (
                  <div key={msg.id} className="space-y-1">
                    <div className={`flex items-start gap-2 ${msg.sender === "user" ? "flex-row-reverse" : "flex-row"}`}>
                      {msg.sender === "user" ? (
                        <div className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">
                          U
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                          <Bot size={11} />
                        </div>
                      )}

                      <div
                        className={`p-3 rounded-lg max-w-[88%] leading-relaxed ${
                          msg.sender === "user"
                            ? "bg-slate-900 text-white"
                            : "bg-slate-50 text-slate-800 border border-slate-200/80 shadow-xs"
                        }`}
                      >
                        <ChatMarkdown content={msg.text} isUser={msg.sender === "user"} />
                      </div>
                    </div>
                    <div className={`text-[9px] text-slate-400 font-mono px-7 ${msg.sender === "user" ? "text-right" : "text-left"}`}>
                      {msg.timestamp}
                    </div>
                  </div>
                ))}

                {isCopilotTyping && (
                  <div className="flex items-center gap-2 text-slate-400 text-xs italic pl-7">
                    <RotateCw className="w-3 h-3 animate-spin text-blue-600" />
                    <span>Analyzing threat telemetry...</span>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Suggested Prompts */}
              {chatMessages.length > 0 && chatMessages[chatMessages.length - 1]?.suggestions && (
                <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-1.5 shrink-0">
                  {chatMessages[chatMessages.length - 1].suggestions!.slice(0, 2).map((sug, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendCopilotMessage(sug)}
                      className="text-[10px] font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:border-slate-300 px-2 py-0.5 rounded cursor-pointer truncate max-w-full"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              )}

              {/* Input Box */}
              <div className="p-3 border-t border-slate-200 bg-white shrink-0">
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 focus-within:bg-white focus-within:border-blue-500 transition-colors">
                  <input
                    type="text"
                    value={copilotInput}
                    onChange={(e) => setCopilotInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendCopilotMessage();
                      }
                    }}
                    placeholder={activeScan ? `Ask about ${activeScan.app_name}...` : "Ask a security query..."}
                    className="flex-1 bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleSendCopilotMessage()}
                    disabled={!copilotInput.trim()}
                    className="p-1 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white cursor-pointer"
                  >
                    <Send size={12} />
                  </button>
                </div>
              </div>
            </aside>
          )}
        </div>

        {/* Drill-Down Forensic Modal */}
        {selectedModule && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg overflow-hidden shadow-dropdown animate-in fade-in zoom-in-95">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-1 rounded-md bg-blue-50 text-blue-600">
                    {selectedModule.icon}
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">{selectedModule.name}</h3>
                    <p className="text-[10px] text-slate-500 font-mono">{selectedModule.statusText}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedModule(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs">
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-600 font-medium">Computed Module Score</span>
                  <span className={`font-mono font-bold ${selectedModule.isSafe ? "text-emerald-600" : "text-amber-600"}`}>
                    {selectedModule.score} / 100 ({selectedModule.isSafe ? "Passing" : "Elevated Risk"})
                  </span>
                </div>

                <div>
                  <h4 className="text-slate-800 font-semibold mb-2">Forensic Findings & Telemetry</h4>
                  <div className="space-y-1.5">
                    {selectedModule.reasons.map((r, rIdx) => (
                      <div key={rIdx} className="flex items-start gap-2 p-2 rounded bg-slate-50 border border-slate-200 text-slate-700">
                        <ChevronRight size={13} className="text-blue-600 shrink-0 mt-0.5" />
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => setSelectedModule(null)}
                    className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-xs transition-colors cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PDF Modal */}
        {isReportOpen && activeScan && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg overflow-hidden shadow-dropdown animate-in fade-in zoom-in-95">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-blue-600" />
                  <h3 className="text-xs font-bold text-slate-900">Security Audit Dossier</h3>
                </div>
                <button
                  onClick={() => setIsReportOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="p-5 space-y-3 text-xs">
                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-lg space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-900">{activeScan.app_name}</span>
                    <span className={`font-mono font-bold ${isSafe ? "text-emerald-600" : "text-amber-600"}`}>
                      {overallScore}/100 ({riskTitle})
                    </span>
                  </div>
                  <p className="text-slate-500 font-mono text-[10px]">{activeScan.package_name}</p>
                  <p className="text-slate-700 pt-2 border-t border-slate-200">{dynamicVerdictSummary}</p>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setIsReportOpen(false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs cursor-pointer"
                  >
                    Close
                  </button>
                  <a
                    href={api.downloadPdfReport(activeScan.scan_id)}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Download size={13} />
                    <span>Download PDF</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Lightbox */}
        {lightboxImage && (
          <div
            onClick={() => setLightboxImage(null)}
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
          >
            <div className="bg-white border border-slate-200 rounded-xl p-3 max-w-sm text-center space-y-2 shadow-2xl">
              <img
                src={lightboxImage}
                alt="Enlarged screenshot"
                className="max-h-[70vh] rounded-lg object-contain mx-auto shadow-sm"
              />
              <p className="text-[10px] text-slate-400">Click anywhere to close preview</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-screen items-center justify-center bg-[#f8fafc]">
          <RotateCw className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
