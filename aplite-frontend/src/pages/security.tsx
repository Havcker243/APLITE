import Head from "next/head";
import Link from "next/link";
import { useAuth } from "../utils/auth";

export default function SecurityPage() {
  /** Render the security page content. */
  const { token } = useAuth();
  const backHref = token ? "/dashboard" : "/";
  const backLabel = token ? "Back to dashboard" : "Back to Aplite";

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Head>
        <title>Security · Aplite</title>
      </Head>

      <main className="mx-auto w-full max-w-5xl px-6 py-12">
        <div className="mb-10 rounded-2xl border border-border bg-background/80 p-8 shadow-card backdrop-blur">
          <Link href={backHref} className="text-sm text-muted-foreground hover:text-foreground">
            {backLabel}
          </Link>
          <h1 className="mt-4 text-3xl font-semibold text-foreground">Security posture</h1>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            Aplite is architected to ensure sensitive payment details are never stored in plain text and are not
            exposed in logs or user interfaces. We minimize data exposure while maintaining the auditability required
            for regulated workflows.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h2 className="text-base font-semibold text-foreground">Current safeguards</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>Encrypted storage for sensitive payment fields.</li>
              <li>Minimal data retention for operational necessity.</li>
              <li>Masked display of sensitive values in the UI.</li>
              <li>Session-based authentication with secure tokens.</li>
              <li>Verification records retained for audit review.</li>
            </ul>
          </section>
          <section className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h2 className="text-base font-semibold text-foreground">Roadmap enhancements</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>Role-based access controls for internal reviewers.</li>
              <li>Managed storage for file uploads with audit logging.</li>
              <li>Detection for anomalous login and OTP patterns.</li>
              <li>Structured monitoring and alerting workflows.</li>
            </ul>
          </section>
        </div>

        <div className="mt-10 space-y-6 text-sm text-muted-foreground leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Data protection principles</h2>
            <p>
              We encrypt sensitive data at rest and restrict access to verified roles. Our objective is to keep payment
              data secure while preserving a clear audit trail of verification actions.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
