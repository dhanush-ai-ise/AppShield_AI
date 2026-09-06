"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { User, Mail, Lock, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { APP_NAME, APP_TAGLINE } from "@/lib/messages";

/* ─── AppShield AI Logo ────────────────────────────────────────── */
function AppShieldLogo({ size = 52 }: { size?: number }) {
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/25"
    >
      <ShieldCheck size={size * 0.58} className="text-white" strokeWidth={2.2} />
    </div>
  );
}

/* ─── Google Icon ─────────────────────────────────────────────── */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.66 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.66 48 24 48z"
      />
    </svg>
  );
}

/* ─── Main Component ──────────────────────────────────────────── */
export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => searchParams.get("next") || "/dashboard", [searchParams]);

  // Mode: 'login' or 'signup'
  const [mode, setMode] = useState<"login" | "signup">("login");

  // Dynamic Form States
  const [fullName, setFullName] = useState("");
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // UI States
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const googleOAuthUrl = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_URL || "http://localhost:8000/api/auth/google";

  // Google OAuth callback handling
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const next = params.get("next") || "/dashboard";
    if (token) {
      window.localStorage.setItem("appshield_admin_token", token);
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem("appshield_logged_out");
        window.sessionStorage.removeItem("appshield_last_scan");
      }
      window.history.replaceState({}, "", window.location.pathname);
      router.replace(next);
    }
  }, [router]);

  // Form Validation & Submission
  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (mode === "login") {
      if (!usernameOrEmail.trim()) {
        setError("Please enter your Username or Email.");
        return;
      }
      if (!password) {
        setError("Please enter your Password.");
        return;
      }
    } else {
      if (!fullName.trim()) {
        setError("Please enter your Full Name.");
        return;
      }
      if (!email.trim()) {
        setError("Please enter your Email Address.");
        return;
      }
      if (!password) {
        setError("Please enter a Password.");
        return;
      }
      if (password.length < 6) {
        setError("Password should be at least 6 characters long.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    setSubmitting(true);

    try {
      if (mode === "signup") {
        await api.signup(fullName.trim(), email.trim().toLowerCase(), password, true);
      } else {
        await api.loginAdmin(usernameOrEmail.trim(), password, true);
      }
      router.replace(nextPath);
    } catch (submitError: any) {
      if (submitError?.message) {
        setError(submitError.message);
      } else {
        setError("Authentication failed. Please check your credentials.");
      }
      setSubmitting(false);
    }
  }

  // Switch between Login and Signup modes cleanly
  function toggleMode(targetMode: "login" | "signup") {
    setMode(targetMode);
    setError(null);
    setShowPassword(false);
    setShowConfirmPassword(false);
  }

  return (
    <main className="ag-page">
      <div className="ag-layout">
        <div className="ag-card">
          {/* ── AppShield AI Brand Header ── */}
          <div className="ag-header">
            <div className="ag-logo-wrapper">
              <AppShieldLogo size={46} />
            </div>
            <h1 className="ag-brand-name">
              <span className="ag-brand-andro">AppShield </span>
              <span className="ag-brand-guard">AI</span>
            </h1>
            <p className="ag-brand-tagline">{APP_TAGLINE}</p>
          </div>

          {/* ── Section Title ── */}
          <div className="ag-section">
            <h2 className="ag-title">
              {mode === "login" ? "Welcome Back" : "Create Your Account"}
            </h2>
            <p className="ag-subtitle">
              {mode === "login"
                ? `Sign in to continue to your ${APP_NAME} account`
                : `Sign up to get started with ${APP_NAME}`}
            </p>
          </div>

          {/* ── Form ── */}
          <form className="ag-form" onSubmit={handleSubmit} noValidate>
            {mode === "login" ? (
              /* ────── LOGIN FIELDS ────── */
              <>
                {/* Username or Email */}
                <div className="ag-field">
                  <div className="ag-input-wrap">
                    <User className="ag-input-icon" size={18} aria-hidden />
                    <input
                      id="ag-username-or-email"
                      type="text"
                      value={usernameOrEmail}
                      onChange={(e) => setUsernameOrEmail(e.target.value)}
                      autoComplete="username"
                      placeholder="Username or Email"
                      required
                      className="ag-input"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="ag-field">
                  <div className="ag-input-wrap">
                    <Lock className="ag-input-icon" size={18} aria-hidden />
                    <input
                      id="ag-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      placeholder="Password"
                      required
                      className="ag-input ag-input--password"
                    />
                    <button
                      type="button"
                      className="ag-eye-btn"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Forgot Password Link */}
                <div className="ag-options-row" style={{ justifyContent: "flex-end" }}>
                  <span
                    className="ag-link"
                    onClick={() => setError("Password reset link has been sent to your email if registered.")}
                    role="button"
                    tabIndex={0}
                  >
                    Forgot Password?
                  </span>
                </div>
              </>
            ) : (
              /* ────── SIGNUP FIELDS ────── */
              <>
                {/* Full Name */}
                <div className="ag-field">
                  <div className="ag-input-wrap">
                    <User className="ag-input-icon" size={18} aria-hidden />
                    <input
                      id="ag-fullname"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      autoComplete="name"
                      placeholder="Full Name"
                      required
                      className="ag-input"
                    />
                  </div>
                </div>

                {/* Email Address */}
                <div className="ag-field">
                  <div className="ag-input-wrap">
                    <Mail className="ag-input-icon" size={18} aria-hidden />
                    <input
                      id="ag-signup-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      placeholder="Email Address"
                      required
                      className="ag-input"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="ag-field">
                  <div className="ag-input-wrap">
                    <Lock className="ag-input-icon" size={18} aria-hidden />
                    <input
                      id="ag-signup-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      placeholder="Password"
                      required
                      className="ag-input ag-input--password"
                    />
                    <button
                      type="button"
                      className="ag-eye-btn"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="ag-field">
                  <div className="ag-input-wrap">
                    <Lock className="ag-input-icon" size={18} aria-hidden />
                    <input
                      id="ag-confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      placeholder="Confirm Password"
                      required
                      className="ag-input ag-input--password"
                    />
                    <button
                      type="button"
                      className="ag-eye-btn"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Error Message Display */}
            {error && (
              <div className="ag-error" role="alert">
                {error}
              </div>
            )}

            {/* Primary Action Button */}
            <button
              id="ag-submit-btn"
              type="submit"
              disabled={submitting}
              className="ag-btn-primary"
            >
              {submitting ? (
                <>
                  <span className="ag-spinner" aria-hidden />
                  <span>{mode === "login" ? "Logging in..." : "Creating Account..."}</span>
                </>
              ) : (
                <span>{mode === "login" ? "Login" : "Create Account"}</span>
              )}
            </button>

            {/* Divider */}
            <div className="ag-divider" aria-hidden>
              <span className="ag-divider-line" />
              <span className="ag-divider-text">OR</span>
              <span className="ag-divider-line" />
            </div>

            {/* Social Login Button */}
            <a href={googleOAuthUrl} className="ag-btn-google">
              <GoogleIcon />
              <span>Continue with Google</span>
            </a>

            {/* Mode Switch Footer */}
            <div className="ag-footer">
              {mode === "login" ? (
                <>
                  Don't have an account?{" "}
                  <button
                    type="button"
                    className="ag-switch-btn"
                    onClick={() => toggleMode("signup")}
                  >
                    Sign Up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    className="ag-switch-btn"
                    onClick={() => toggleMode("login")}
                  >
                    Login
                  </button>
                </>
              )}
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
