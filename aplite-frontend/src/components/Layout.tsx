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
  /** Global layout that enforces email confirmation gating. */
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
        <div className="mx-auto w-full max-w-6xl px-6 py-10 text-sm text-muted-foreground">
          <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <span className="text-base font-semibold text-foreground">Aplite</span>
              <p className="max-w-xs text-sm text-muted-foreground">
                Verified payment identity for businesses that want security without friction.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Company</div>
                <div className="flex flex-col gap-2">
                  <Link href="/about" className="hover:text-foreground">
                    About
                  </Link>
                  <Link href="/contact" className="hover:text-foreground">
                    Contact
                  </Link>
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Legal</div>
                <div className="flex flex-col gap-2">
                  <Link href="/terms-of-service" className="hover:text-foreground">
                    Terms
                  </Link>
                  <Link href="/privacy-policy" className="hover:text-foreground">
                    Privacy
                  </Link>
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</div>
                <div className="flex flex-col gap-2">
                  <Link href="/status" className="hover:text-foreground">
                    Status
                  </Link>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-8 text-xs text-muted-foreground">
            <span>Ac 2024 Aplite. Secure payment identifiers for verified businesses.</span>
          </div>
        </div>
      </footer>
    </>
  );
}
