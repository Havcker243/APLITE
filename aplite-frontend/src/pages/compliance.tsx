import Head from "next/head";
import { useAuth } from "../utils/auth";
import { PublicPageNav } from "../components/PublicPageNav";

export default function CompliancePage() {
  /** Render the compliance page content. */
  const { token } = useAuth();
  const backHref = token ? "/dashboard" : "/";
  return (
    <div className="min-h-screen bg-gradient-subtle relative overflow-hidden">
      <Head>
        <title>Compliance and Risk · Aplite</title>
      </Head>

      <main className="mx-auto w-full max-w-5xl px-6 py-12">
        <div className="mb-10 rounded-2xl border border-border bg-background/80 p-8 shadow-card backdrop-blur">
          <PublicPageNav backHref={backHref} />
          <h1 className="mt-4 text-3xl font-semibold text-foreground">Compliance and risk management</h1>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            Aplite is built to support the practical controls that Accounts Payable teams need for regulatory
            compliance and risk mitigation. We provide verifiable evidence of authorization and review without
            replacing your internal control framework.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h2 className="text-base font-semibold text-foreground">Proof of authorization</h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Every onboarding flow includes explicit attestation and role documentation, creating a clear chain of
              authority for payment changes.
            </p>
          </section>
          <section className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h2 className="text-base font-semibold text-foreground">Documented verification</h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Verification events are recorded with method, timestamps, and reviewer context so teams can audit and
              defend decisions later.
            </p>
          </section>
        </div>

        <div className="mt-10 space-y-6 text-sm text-muted-foreground leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Complete audit trail</h2>
            <p>
              We maintain records of submissions, status changes, and review decisions to make compliance reviews
              faster and more consistent.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Data minimization</h2>
            <p>
              Sensitive payment details are encrypted at rest and access is limited to verified workflows. We store
              only what is operationally necessary to run the system.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Important clarification</h2>
            <p>
              Aplite does not replace your internal control framework. It provides consistent workflows and verifiable
              evidence to support those controls.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
