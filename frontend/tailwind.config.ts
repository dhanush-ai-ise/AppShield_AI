import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#f8fafc",
          panel: "#ffffff",
          panel2: "#f1f5f9",
          border: "#e2e8f0",
        },
        brand: {
          DEFAULT: "#2563eb",
          light: "#3b82f6",
          dark: "#1d4ed8",
          subtle: "#eff6ff",
        },
        risk: {
          safe: "#10b981",
          moderate: "#f59e0b",
          high: "#f43f5e",
          critical: "#e11d48",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "monospace"],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.04)",
        "card-hover": "0 4px 12px -2px rgba(15, 23, 42, 0.08), 0 2px 6px -2px rgba(15, 23, 42, 0.04)",
        dropdown: "0 12px 24px -4px rgba(15, 23, 42, 0.1), 0 4px 8px -4px rgba(15, 23, 42, 0.06)",
      },
    },
  },
  plugins: [],
};
export default config;
