import Head from "next/head";
import Link from "next/link";
import { useAuth } from "../utils/auth";

export default function SlaPage() {
  const { token } = useAuth();
  const backHref = token ? "/dashboard" : "/";
  const backLabel = token ? "Back to dashboard" : "Back to Aplite";

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Head>
        <title>Service Commitments · Aplite</title>
      </Head>

      <main className="mx-auto w-full max-w-5xl px-6 py-12">
        <div className="mb-10 rounded-2xl border border-border bg-background/80 p-8 shadow-card backdrop-blur">
          <Link href={backHref} className="text-sm text-muted-foreground hover:text-foreground">
            {backLabel}
          </Link>
          <h1 className="mt-4 text-3xl font-semibold text-foreground">Customer commitments and SLA</h1>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            Aplite is committed to helping teams verify payment identity with clarity, speed, and confidence. These
            service commitments reflect our current stage and near-term standards.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h2 className="text-base font-semibold text-foreground">Verification processing</h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Target review time for manual verification: 1–2 business days. Automated verifications complete in
              real time upon successful confirmation.
            </p>
          </section>
          <section className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h2 className="text-base font-semibold text-foreground">System availability</h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              During MVP, uptime is best effort. As we scale, we will publish a formal uptime commitment with measured
              availability and incident reporting.
            </p>
          </section>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <section className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h2 className="text-base font-semibold text-foreground">Customer support</h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Support is email-based. We aim to respond within the same business day for requests received during
              business hours. Escalations are available for time-sensitive verification needs.
            </p>
          </section>
          <section className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h2 className="text-base font-semibold text-foreground">Transparency</h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Verification status and review outcomes are visible in the dashboard. We record all decisions to support
              auditability and compliance reviews.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
