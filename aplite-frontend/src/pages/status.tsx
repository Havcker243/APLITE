import Head from "next/head";
import Link from "next/link";
import { useAuth } from "../utils/auth";

export default function StatusPage() {
  /** Render the status page content. */
  const { token } = useAuth();
  const backHref = token ? "/dashboard" : "/";
  const backLabel = token ? "Back to dashboard" : "Back to Aplite";

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Head>
        <title>Status · Aplite</title>
      </Head>

      <main className="mx-auto w-full max-w-5xl px-6 py-12">
        <div className="mb-10 rounded-2xl border border-border bg-background/80 p-8 shadow-card backdrop-blur">
          <Link href={backHref} className="text-sm text-muted-foreground hover:text-foreground">
            {backLabel}
          </Link>
          <h1 className="mt-4 text-3xl font-semibold text-foreground">System status</h1>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            Current availability and recent incidents. During MVP, updates are posted here manually.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-xl border border-border bg-card p-6 shadow-card">
            <div className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full bg-verified" />
              <h2 className="text-base font-semibold text-foreground">All systems operational</h2>
            </div>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              API, onboarding, and resolution services are available.
            </p>
          </section>
          <section className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h2 className="text-base font-semibold text-foreground">Last incident</h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              No incidents reported in the last 30 days.
            </p>
          </section>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <section className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h2 className="text-base font-semibold text-foreground">Scheduled maintenance</h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              No maintenance scheduled.
            </p>
          </section>
          <section className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h2 className="text-base font-semibold text-foreground">Support</h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              For urgent issues, email{" "}
              <a className="text-accent hover:underline" href="mailto:support@aplite.io">
                support@aplite.io
              </a>
              .
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
