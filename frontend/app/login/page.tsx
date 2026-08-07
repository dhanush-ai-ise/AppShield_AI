"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Cpu,
  ScanSearch,
  Sparkles,
  ShieldAlert,
} from "lucide-react";
import { api } from "@/lib/api";
import { APP_NAME, APP_TAGLINE } from "@/lib/messages";

/* ─── Social SVG Icons ────────────────────────────────────────── */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#4285F4" d="M47.5 24.6c0-1.6-.1-3.1-.4-4.6H24v8.7h13.2c-.6 3-2.3 5.5-4.9 7.2v6h7.9c4.6-4.3 7.3-10.6 7.3-17.3z" />
      <path fill="#34A853" d="M24 48c6.5 0 12-2.1 16-5.8l-7.9-6c-2.2 1.5-5 2.3-8.1 2.3-6.2 0-11.5-4.2-13.4-9.9H2.5v6.2C6.5 42.6 14.7 48 24 48z" />
      <path fill="#FBBC05" d="M10.6 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6v-6.2H2.5A24 24 0 0 0 0 24c0 3.9.9 7.5 2.5 10.8l8.1-6.2z" />
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.8-6.8C35.9 2.3 30.4 0 24 0 14.7 0 6.5 5.4 2.5 13.2l8.1 6.2C12.5 13.7 17.8 9.5 24 9.5z" />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 23 23" aria-hidden>
      <path fill="#f35325" d="M1 1h10v10H1z" />
      <path fill="#81bc06" d="M12 1h10v10H12z" />
      <path fill="#05a6f0" d="M1 12h10v10H1z" />
      <path fill="#ffba08" d="M12 12h10v10H12z" />
    </svg>
  );
}

/* ─── Feature list configuration ──────────────────────────────── */
const featuresList = [
  {
    icon: ShieldCheck,
    title: "Real-time Threat Updates",
    body: "Accurate application risk scoring powered by multi-layered ML models.",
  },
  {
    icon: ScanSearch,
    title: "Advanced Analytics",
    body: "Visualize app permission trends, suspicious behavior, and security metrics.",
  },
  {
    icon: ShieldAlert,
    title: "Severe Security Alerts",
    body: "Stay ahead with instant notifications on high-risk app signatures.",
  },
  {
    icon: Sparkles,
    title: "AI Recommendations",
    body: "Smart security suggestions for automated threat mitigation.",
  },
];

/* ─── Main Page ─────────────────────────────────────────────── */
export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => searchParams.get("next") || "/dashboard", [searchParams]);

  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const googleOAuthUrl = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_URL || "http://localhost:8000/api/auth/google";
  const forgotPasswordUrl = process.env.NEXT_PUBLIC_FORGOT_PASSWORD_URL;

  // ── Handle Google OAuth callback token ──────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const next = params.get("next") || "/dashboard";
    if (token) {
      window.localStorage.setItem("appshield_admin_token", token);
      window.history.replaceState({}, "", window.location.pathname);
      router.replace(next);
    }
  }, [router]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (activeTab === "signin") {
        await api.loginAdmin(username, password, remember);
      } else {
        await api.loginAdmin(username, password, remember);
      }
      router.replace(nextPath);
    } catch (submitError: any) {
      setError(submitError?.message || "Authentication failed. Please check your credentials.");
      setSubmitting(false);
    }
  }

  function handleSocialClick(provider: string) {
    if (provider === "Google") {
      window.location.href = googleOAuthUrl;
      return;
    }
    setError(`${provider} sign-in is not configured yet.`);
  }

  return (
    <main className="ls-root">
      {/* Ambient background glows */}
      <div className="ls-orb ls-orb-1" aria-hidden />
      <div className="ls-orb ls-orb-2" aria-hidden />
      <div className="ls-orb ls-orb-3" aria-hidden />

      <div className="ls-layout">
        {/* ── LEFT PANEL ── */}
        <section className="ls-left" aria-label="AppShield AI branding">
          {/* Logo */}
          <div className="ls-logo">
            <div className="ls-logo-icon" aria-hidden>
              <ShieldCheck size={28} strokeWidth={2} />
            </div>
            <div>
              <div className="ls-logo-name">{APP_NAME}</div>
              <div className="ls-logo-tag">{APP_TAGLINE}</div>
            </div>
          </div>

          {/* Hero text */}
          <div className="ls-hero">
            <h1 className="ls-hero-heading">
              Smart <span className="ls-hero-accent-purple">Security</span>.
              <br />
              Better <span className="ls-hero-accent-blue">Decisions</span>.
            </h1>
            <p className="ls-hero-body">
              Real-time app fraud detection, advanced risk models, and intelligent safety recommendations for a secure digital ecosystem.
            </p>
          </div>

          {/* Features */}
          <ul className="ls-features" aria-label="Platform features">
            {featuresList.map(({ icon: Icon, title, body }) => (
              <li key={title} className="ls-feature">
                <div className="ls-feature-icon" aria-hidden>
                  <Icon size={22} strokeWidth={2} />
                </div>
                <div>
                  <h2 className="ls-feature-title">{title}</h2>
                  <p className="ls-feature-body">{body}</p>
                </div>
              </li>
            ))}
          </ul>

          {/* Quote at bottom left */}
          <div className="ls-quote">
            <div className="ls-quote-mark" aria-hidden>
              ”
            </div>
            <p className="ls-quote-text">
              “The AI security suggestions are spot on — genuinely useful.”
            </p>
          </div>
        </section>

        {/* ── RIGHT PANEL ── */}
        <section className="ls-right" aria-label="Authentication form">
          <div className="ls-card">
            {/* Header Tabs */}
            <div className="ls-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "signin"}
                className={`ls-tab ${activeTab === "signin" ? "ls-tab--active" : ""}`}
                onClick={() => {
                  setActiveTab("signin");
                  setError(null);
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "signup"}
                className={`ls-tab ${activeTab === "signup" ? "ls-tab--active" : ""}`}
                onClick={() => {
                  setActiveTab("signup");
                  setError(null);
                }}
              >
                Create Account
              </button>
            </div>

            {/* Form Card Content */}
            <div className="ls-card-body">
              <h2 className="ls-card-title">
                {activeTab === "signin" ? "Welcome Back! 👋" : "Create Account 🚀"}
              </h2>
              <p className="ls-card-subtitle">
                {activeTab === "signin"
                  ? `Sign in to continue to your ${APP_NAME} dashboard`
                  : `Sign up to access ${APP_NAME} threat detection features`}
              </p>

              {/* Form */}
              <form className="ls-form" onSubmit={handleSubmit} noValidate>
                {/* Email */}
                <div className="ls-field">
                  <span className="ls-input-wrap">
                    <Mail className="ls-input-icon" size={18} aria-hidden />
                    <input
                      id="login-email"
                      type="email"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoComplete="username"
                      placeholder="Email address"
                      required
                      className="ls-input"
                    />
                  </span>
                </div>

                {/* Password */}
                <div className="ls-field">
                  <span className="ls-input-wrap">
                    <LockKeyhole className="ls-input-icon" size={18} aria-hidden />
                    <input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={activeTab === "signin" ? "current-password" : "new-password"}
                      placeholder="Password"
                      required
                      className="ls-input ls-input--password"
                    />
                    <button
                      type="button"
                      className="ls-eye-btn"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </span>
                </div>

                {/* Remember + Forgot */}
                <div className="ls-row">
                  <label className="ls-remember" htmlFor="login-remember">
                    <input
                      id="login-remember"
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="ls-checkbox"
                    />
                    <span>Remember me</span>
                  </label>
                  {forgotPasswordUrl ? (
                    <Link href={forgotPasswordUrl} className="ls-forgot">
                      Forgot password?
                    </Link>
                  ) : (
                    <span
                      className="ls-forgot"
                      onClick={() => setError("Password reset link is not configured.")}
                    >
                      Forgot password?
                    </span>
                  )}
                </div>

                {/* Error */}
                {error ? (
                  <p className="ls-error" role="alert">
                    {error}
                  </p>
                ) : null}

                {/* Sign In button */}
                <button
                  id="login-submit-btn"
                  type="submit"
                  disabled={submitting}
                  className="ls-btn-primary"
                >
                  {submitting ? (
                    <>
                      <span className="ls-spinner" aria-hidden />{" "}
                      {activeTab === "signin" ? "Signing In..." : "Creating Account..."}
                    </>
                  ) : (
                    <>
                      <span>{activeTab === "signin" ? "Sign In" : "Create Account"}</span>
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>

                {/* Divider */}
                <div className="ls-divider" aria-hidden>
                  <span className="ls-divider-line" />
                  <span className="ls-divider-text">or continue with</span>
                  <span className="ls-divider-line" />
                </div>

                {/* Social Auth grid */}
                <div className="ls-social-grid">
                  <a
                    id="google-signin-btn"
                    href={googleOAuthUrl}
                    className="ls-btn-social"
                  >
                    <GoogleIcon />
                    <span>Google</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => handleSocialClick("GitHub")}
                    className="ls-btn-social"
                  >
                    <GithubIcon />
                    <span>GitHub</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSocialClick("Microsoft")}
                    className="ls-btn-social"
                  >
                    <MicrosoftIcon />
                    <span>Microsoft</span>
                  </button>
                </div>

                {/* Switch tab hint */}
                <div className="ls-signup">
                  {activeTab === "signin" ? (
                    <>
                      Don’t have an account?{" "}
                      <button
                        type="button"
                        className="ls-signup-link"
                        onClick={() => {
                          setActiveTab("signup");
                          setError(null);
                        }}
                      >
                        Create Account
                      </button>
                    </>
                  ) : (
                    <>
                      Already have an account?{" "}
                      <button
                        type="button"
                        className="ls-signup-link"
                        onClick={() => {
                          setActiveTab("signin");
                          setError(null);
                        }}
                      >
                        Sign In
                      </button>
                    </>
                  )}
                </div>

                {/* Security line */}
                <div className="ls-security-note">
                  <LockKeyhole size={14} aria-hidden />
                  <span>Your data is secure and encrypted</span>
                </div>

                {/* Direct Dashboard Link */}
                <div className="ls-guest">
                  <Link href="/dashboard" className="ls-guest-link">
                    Continue without an account &rarr;
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

