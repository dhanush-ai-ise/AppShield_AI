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
          DEFAULT: "#6d5ef8",
          light: "#8b7cfa",
          dark: "#5645e0",
        },
        risk: {
          safe: "#22c55e",
          moderate: "#f59e0b",
          high: "#ef4444",
          critical: "#dc2626",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        panel: "0 1px 3px rgba(15, 23, 42, 0.08)",
      },
    },
  },
  plugins: [],
};
export default config;
