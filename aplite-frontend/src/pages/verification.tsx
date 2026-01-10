import Head from "next/head";
import Link from "next/link";
import { useAuth } from "../utils/auth";

export default function VerificationPage() {
  /** Render the verification page content. */
  const { token } = useAuth();
  const backHref = token ? "/dashboard" : "/";
  const backLabel = token ? "Back to dashboard" : "Back to Aplite";

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Head>
        <title>Verification Process · Aplite</title>
      </Head>

      <main className="mx-auto w-full max-w-5xl px-6 py-12">
        <div className="mb-10 rounded-2xl border border-border bg-background/80 p-8 shadow-card backdrop-blur">
          <Link href={backHref} className="text-sm text-muted-foreground hover:text-foreground">
            {backLabel}
          </Link>
          <h1 className="mt-4 text-3xl font-semibold text-foreground">Verification process</h1>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            Our workflow balances security and speed. Verification is structured, auditable, and designed to protect
            both your business and your payment partners.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h2 className="text-base font-semibold text-foreground">Step 1: Organization details</h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Submit legal business name, EIN, formation state, and primary address. We use this information to anchor
              the verified business identity.
            </p>
          </section>
          <section className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h2 className="text-base font-semibold text-foreground">Step 2: Submitter role</h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Identify whether the submitter is the business owner or an authorized representative. This determines the
              verification path and risk tier.
            </p>
          </section>
          <section className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h2 className="text-base font-semibold text-foreground">Step 3: Identity evidence</h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Provide identity documentation and attest authorization to act on behalf of the organization. Owners may
              complete a verification call where appropriate.
            </p>
          </section>
          <section className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h2 className="text-base font-semibold text-foreground">Step 4: Payment rails</h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Configure payout rails such as ACH, domestic wire, or SWIFT. Sensitive fields are encrypted before
              storage.
            </p>
          </section>
        </div>

        <div className="mt-10 space-y-6 text-sm text-muted-foreground leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Step 5: Verification execution</h2>
            <p>
              Lower-risk cases may complete with an email verification step. Higher-risk cases are reviewed manually
              or verified via call. Every decision is recorded for auditability.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Step 6: Activation</h2>
            <p>
              Once approved, the organization receives verified status and its payment identifier becomes active for
              resolution.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
