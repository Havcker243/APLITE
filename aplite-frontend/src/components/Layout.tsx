/**
 * Top-level layout wrapper for the app.
 * Waits for auth/profile loading before rendering child routes.
 */

import React, { PropsWithChildren, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useAuth } from "../utils/auth";
import { LoadingScreen } from "./LoadingScreen";

export function Layout({ children }: PropsWithChildren) {
  const { token, isBootstrapping, emailConfirmed } = useAuth();
  const router = useRouter();

  if (token && isBootstrapping) {
    return <LoadingScreen />;
  }

  useEffect(() => {
    if (isBootstrapping) return;
    if (!token) return;
    if (emailConfirmed) return;
    const allowlist = new Set([
      "/",
      "/confirm-email",
      "/login",
      "/signup",
      "/auth/callback",
      "/terms-of-service",
      "/privacy-policy",
    ]);
    if (allowlist.has(router.pathname)) return;
    router.replace("/confirm-email");
  }, [isBootstrapping, token, emailConfirmed, router]);

  return (
    <>
      {children}
      <footer className="border-t border-border bg-background">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-sm text-muted-foreground">
          <span>Aplite</span>
          <div className="flex items-center gap-4">
            <Link href="/terms-of-service" className="hover:text-foreground">
              Terms
            </Link>
            <Link href="/privacy-policy" className="hover:text-foreground">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </>
  );
}
