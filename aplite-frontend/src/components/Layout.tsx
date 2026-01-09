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
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/about" className="hover:text-foreground">
              About
            </Link>
            <Link href="/payment-identity" className="hover:text-foreground">
              Payment Identity
            </Link>
            <Link href="/verification" className="hover:text-foreground">
              Verification
            </Link>
            <Link href="/security" className="hover:text-foreground">
              Security
            </Link>
            <Link href="/compliance" className="hover:text-foreground">
              Compliance
            </Link>
            <Link href="/sla" className="hover:text-foreground">
              SLA
            </Link>
            <Link href="/trust" className="hover:text-foreground">
              Trust
            </Link>
            <Link href="/faq" className="hover:text-foreground">
              FAQ
            </Link>
            <Link href="/status" className="hover:text-foreground">
              Status
            </Link>
            <Link href="/contact" className="hover:text-foreground">
              Contact
            </Link>
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
