/**
 * Fallback page for unknown routes.
 * Provides a friendly 404 experience and navigation recovery.
 */

import Link from "next/link";
import React, { useEffect } from "react";
import { useRouter } from "next/router";

export default function NotFoundPage() {
  /** Render the 404 page content. */
  const router = useRouter();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", router.asPath);
  }, [router.asPath]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Oops! Page not found</p>
        <Link href="/" className="text-primary underline hover:text-primary/90">
          Return to Home
        </Link>
      </div>
    </div>
  );
}
