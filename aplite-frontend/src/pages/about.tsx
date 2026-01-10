import Head from "next/head";
import Link from "next/link";
import { useAuth } from "../utils/auth";

export default function AboutPage() {
  /** Render the about page content. */
  const { token } = useAuth();
  const backHref = token ? "/dashboard" : "/";
  const backLabel = token ? "Back to dashboard" : "Back to Aplite";

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Head>
        <title>About Aplite</title>
      </Head>

      <main className="mx-auto w-full max-w-5xl px-6 py-12">
        <div className="mb-10 rounded-2xl border border-border bg-background/80 p-8 shadow-card backdrop-blur">
          <Link href={backHref} className="text-sm text-muted-foreground hover:text-foreground">
            {backLabel}
          </Link>
          <h1 className="mt-4 text-3xl font-semibold text-foreground">About Aplite</h1>
          <p className="mt-2 text-sm text-muted-foreground">Built for businesses that move money with precision.</p>
          <p className="mt-5 text-sm text-muted-foreground leading-relaxed">
            Aplite is a payment identity platform designed for serious operators. We help businesses verify who they
            are, attach payout rails with encryption at rest, and issue short, resolvable identifiers that are easy to
            share internally and with partners. The result is a cleaner payments workflow: fewer errors, less manual
            verification, and a consistent audit trail when funds move.
          </p>
          <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
            We focus on trust. That means structured onboarding, clear ownership of payment data, and tools that make it
            obvious which entity controls each payment identity. Our product is intentionally strict because it handles
            real money.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <section className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h2 className="text-base font-semibold text-foreground">Mission</h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Make vendor payment changes safe, efficient, and fully auditable so teams can move money without
              operational drag.
            </p>
          </section>
          <section className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h2 className="text-base font-semibold text-foreground">Vision</h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              A world where every business has a verified payment identity that remains consistent over time, even as
              rails and bank accounts evolve.
            </p>
          </section>
          <section className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h2 className="text-base font-semibold text-foreground">Why it matters</h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Payment mistakes are expensive. Aplite provides a reliable identity layer that reduces error rates and
              improves compliance posture.
            </p>
          </section>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h2 className="text-base font-semibold text-foreground">What we believe</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>Clarity beats complexity. Payment identity should be easy to understand.</li>
              <li>Security is a product feature, not a checkbox.</li>
              <li>Compliance should be built into the flow, not bolted on later.</li>
              <li>Precision matters when money moves.</li>
            </ul>
          </section>
          <section className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h2 className="text-base font-semibold text-foreground">Who we serve</h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Accounts Payable teams, marketplaces, and regulated platforms that need predictable payouts and verifiable
              vendor identities. Aplite is built for teams that want controls without sacrificing speed.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
