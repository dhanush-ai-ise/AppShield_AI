"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const authenticated = api.isAdminAuthenticated();
    const isLogin = pathname === "/login";
    const next = searchParams.get("next");

    if (!authenticated && !isLogin) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }

    if (authenticated && isLogin) {
      router.replace(next || "/dashboard");
      return;
    }

    setReady(true);
  }, [pathname, router, searchParams]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">
        Loading...
      </div>
    );
  }

  return <>{children}</>;
}
