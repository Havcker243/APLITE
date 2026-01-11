/**
 * Shared navigation chrome for public pages.
 * Provides a back button and a subtle brand mark link.
 */

import Link from "next/link";
import { useRouter } from "next/router";
import { ArrowLeft } from "lucide-react";

type PublicPageNavProps = {
  backHref: string;
  markHref?: string;
};

export function PublicPageNav({ backHref, markHref }: PublicPageNavProps) {
  const router = useRouter();
  const targetHref = markHref || backHref;

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(backHref);
  };

  return (
    <>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <Link
          href={targetHref}
          className="pointer-events-auto absolute right-6 top-6 text-5xl font-semibold tracking-tight text-foreground/5"
        >
          Aplite
        </Link>
      </div>
      <button
        type="button"
        onClick={handleBack}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        aria-label="Go back"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>
    </>
  );
}
