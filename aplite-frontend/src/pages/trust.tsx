import Head from "next/head";
import Link from "next/link";
import { useAuth } from "../utils/auth";

export default function TrustPage() {
  const { token } = useAuth();
  const backHref = token ? "/dashboard" : "/";
  const backLabel = token ? "Back to dashboard" : "Back to Aplite";

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Head>
        <title>Trust and Transparency · Aplite</title>
      </Head>

      <main className="mx-auto w-full max-w-5xl px-6 py-12">
        <div className="mb-10 rounded-2xl border border-border bg-background/80 p-8 shadow-card backdrop-blur">
          <Link href={backHref} className="text-sm text-muted-foreground hover:text-foreground">
            {backLabel}
          </Link>
          <h1 className="mt-4 text-3xl font-semibold text-foreground">Trust and transparency</h1>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            Aplite provides a verified payment identity system that gives Accounts Payable teams confidence in vendor
            banking changes. We replace email‑only verification with structured workflows and a permanent audit trail.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h2 className="text-base font-semibold text-foreground">How Aplite works</h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Vendors complete a structured onboarding flow, attach payout rails, and receive a verified identifier.
              When a payment is made, the identifier resolves to approved coordinates with clear ownership.
            </p>
          </section>
          <section className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h2 className="text-base font-semibold text-foreground">Evidence and auditability</h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Each verification event records who submitted data, the method used, and the reviewer’s decision. That
              creates a defensible trail for compliance reviews.
            </p>
          </section>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <section className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h2 className="text-base font-semibold text-foreground">Data protection standards</h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Sensitive payment information is encrypted at rest and access is limited to authorized workflows. We
              minimize retention and avoid unnecessary exposure.
            </p>
          </section>
          <section className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h2 className="text-base font-semibold text-foreground">What you can expect</h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Clear visibility into verification status, consistent standards across vendors, and identifiers that
              remain stable as details evolve.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
