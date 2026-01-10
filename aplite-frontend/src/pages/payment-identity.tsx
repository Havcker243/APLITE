import Head from "next/head";
import Link from "next/link";
import { useAuth } from "../utils/auth";

export default function PaymentIdentityPage() {
  /** Render the payment identity page content. */
  const { token } = useAuth();
  const backHref = token ? "/dashboard" : "/";
  const backLabel = token ? "Back to dashboard" : "Back to Aplite";

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Head>
        <title>Why Payment Identity Matters · Aplite</title>
      </Head>

      <main className="mx-auto w-full max-w-5xl px-6 py-12">
        <div className="mb-10 rounded-2xl border border-border bg-background/80 p-8 shadow-card backdrop-blur">
          <Link href={backHref} className="text-sm text-muted-foreground hover:text-foreground">
            {backLabel}
          </Link>
          <h1 className="mt-4 text-3xl font-semibold text-foreground">Why payment identity matters</h1>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            Payment fraud often starts with ambiguity. A vendor requests a bank change, someone forwards an email, and a
            detail is updated without strong verification. The result is avoidable risk. Aplite replaces that ambiguity
            with a verified identifier that stays stable over time, even as rails and bank details evolve.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h2 className="text-base font-semibold text-foreground">The real source of fraud</h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Most AP fraud is not a sophisticated hack. It is a believable request that arrives during a busy week,
              paired with a payment change that is hard to validate quickly. Ambiguity is the threat surface.
            </p>
          </section>
          <section className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h2 className="text-base font-semibold text-foreground">The core problem</h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Payment instructions live in inboxes, spreadsheets, and ticketing tools. When details are treated as
              plain text, it is hard to answer who requested a change, how it was verified, and what changed.
            </p>
          </section>
        </div>

        <div className="mt-10 space-y-6 text-sm text-muted-foreground leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Aplite's approach</h2>
            <p>
              We treat payment details as structured, verifiable data. A stable identifier allows AP teams to remit
              payments to a verified entity without re-verifying everything each time a routing detail changes. Our
              system preserves proof: who requested changes, what was reviewed, and how approval happened.
            </p>
            <p>
              The goal is not to remove human judgment. The goal is to make verification consistent, repeatable, and
              defensible so teams can move quickly without assuming invisible risk.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
