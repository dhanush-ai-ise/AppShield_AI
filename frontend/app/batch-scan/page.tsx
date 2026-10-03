"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function BatchScanRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#f8fafc] text-xs text-slate-500 font-medium">
      Redirecting to Workspace...
    </div>
  );
}
