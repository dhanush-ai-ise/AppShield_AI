import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { METADATA } from "@/lib/messages";
import AuthGate from "@/components/AuthGate";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: METADATA.title,
  description: METADATA.description,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans bg-[#f8fafc] text-slate-900 antialiased selection:bg-blue-600 selection:text-white min-h-screen">
        <Suspense
          fallback={
            <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center text-xs font-mono text-slate-400">
              Initializing AppShield AI...
            </div>
          }
        >
          <AuthGate>{children}</AuthGate>
        </Suspense>
      </body>
    </html>
  );
}
