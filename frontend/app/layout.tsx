import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { METADATA } from "@/lib/messages";
import AuthGate from "@/components/AuthGate";

export const metadata: Metadata = {
  title: METADATA.title,
  description: METADATA.description,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans bg-bg text-slate-900 antialiased">
        <Suspense
          fallback={<div className="min-h-screen flex items-center justify-center text-sm text-slate-500">Loading...</div>}
        >
          <AuthGate>{children}</AuthGate>
        </Suspense>
      </body>
    </html>
  );
}
