import Head from "next/head";
import Link from "next/link";
import { useAuth } from "../utils/auth";

export default function PrivacyPolicyPage() {
  const { token } = useAuth();
  const backHref = token ? "/dashboard" : "/";
  const backLabel = token ? "Back to dashboard" : "Back to Aplite";

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Head>
        <title>Aplite Privacy Policy</title>
      </Head>

      <main className="mx-auto w-full max-w-4xl px-6 py-12">
        <div className="mb-10 rounded-2xl border border-border bg-background/80 p-8 shadow-card backdrop-blur">
          <Link href={backHref} className="text-sm text-muted-foreground hover:text-foreground">
            {backLabel}
          </Link>
          <h1 className="mt-4 text-3xl font-semibold text-foreground">Privacy Policy</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: 2026-01-08</p>
          <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
            Aplite is a payment identity platform built for regulated workflows. We collect only what we need to verify
            your organization, connect payout rails, and maintain a secure, compliant network. This policy explains
            what we collect, why we collect it, and how we protect it.
          </p>
          <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
            Our approach favors minimal data exposure. Sensitive values are encrypted at rest, access is restricted by
            role, and we review data handling practices regularly as the platform grows.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h2 className="text-base font-semibold text-foreground">Transparency by design</h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              We avoid unnecessary tracking and use data only to verify businesses, secure payment operations, and
              satisfy compliance requirements. We do not sell your personal information.
            </p>
          </section>
          <section className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h2 className="text-base font-semibold text-foreground">Security first</h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Sensitive fields are encrypted at rest, access is restricted, and we monitor for suspicious activity.
              We continuously improve safeguards as the platform grows.
            </p>
          </section>
        </div>

        <div className="mt-10 space-y-6 text-sm text-foreground/90 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">1. Overview</h2>
            <p>
              This Privacy Policy explains how Aplite collects, uses, and shares information when you use our services.
              By using Aplite, you agree to the practices described here.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">2. Information We Collect</h2>
            <p>
              We collect information you provide directly, including account details, business information, identity
              verification documents, and payment rail data. We also collect basic usage data for security and
              performance.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">3. How We Use Information</h2>
            <p>
              We use information to provide the services, verify your business, prevent fraud, comply with legal
              obligations, and improve the product.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">4. Sharing</h2>
            <p>
              We share information only as needed to operate the services, comply with law, or protect our rights. This
              may include trusted service providers and law enforcement when required.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">5. Data Retention</h2>
            <p>
              We retain information for as long as needed to provide the services, satisfy legal requirements, and
              resolve disputes. You may request deletion where applicable.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">6. Security</h2>
            <p>
              We use encryption and access controls to protect sensitive information. No system is fully secure, so we
              cannot guarantee absolute security.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">7. Your Rights</h2>
            <p>
              Depending on your location, you may have rights to access, correct, or delete your personal information.
              Contact us to exercise these rights.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">8. Cookies</h2>
            <p>
              We use cookies and similar technologies to maintain sessions and improve the user experience. You can
              control cookies through your browser settings.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">9. Children</h2>
            <p>
              Aplite is not intended for use by individuals under 18. We do not knowingly collect personal information
              from minors.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">10. Contact</h2>
            <p>
              Questions about this Privacy Policy can be sent to{" "}
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
