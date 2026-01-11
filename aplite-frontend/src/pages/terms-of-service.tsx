import Head from "next/head";
import { useAuth } from "../utils/auth";
import { PublicPageNav } from "../components/PublicPageNav";

export default function TermsOfServicePage() {
  /** Render the terms of service page content. */
  const { token } = useAuth();
  const backHref = token ? "/dashboard" : "/";
  return (
    <div className="min-h-screen bg-gradient-subtle relative overflow-hidden">
      <Head>
        <title>Aplite Terms of Service</title>
      </Head>

      <main className="mx-auto w-full max-w-4xl px-6 py-12">
        <div className="mb-10 rounded-2xl border border-border bg-background/80 p-8 shadow-card backdrop-blur">
          <PublicPageNav backHref={backHref} />
          <h1 className="mt-4 text-3xl font-semibold text-foreground">Terms of Service</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: 2026-01-08</p>
          <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
            Aplite is a fintech infrastructure company focused on payment identity. We help businesses verify who they
            are, connect payout rails, and issue short identifiers that resolve into accurate payment coordinates.
            The goal is simple: less operational friction, fewer mistakes, and a clearer audit trail when money moves.
          </p>
          <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
            Our platform is designed for compliance-minded teams. We treat onboarding and verification as a core product
            experience, not a checkbox. These Terms define how Aplite should be used, the standards we expect, and the
            responsibilities we share with our customers.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h2 className="text-base font-semibold text-foreground">What we provide</h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              We provide secure onboarding, verified business profiles, and payment identifiers that resolve to payout
              coordinates for approved rails. The platform is built for clear ownership, strong auditability, and
              predictable resolution behavior across internal teams and external partners.
            </p>
          </section>
          <section className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h2 className="text-base font-semibold text-foreground">What you agree to</h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              You agree to provide accurate information, keep credentials secure, and use the platform only for lawful
              business activity. If we detect misuse or policy violations, we may suspend access to protect the network.
            </p>
          </section>
        </div>

        <div className="mt-10 space-y-6 text-sm text-foreground/90 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">1. Agreement</h2>
            <p>
              These Terms of Service ("Terms") govern your use of Aplite ("Aplite", "we", "us"). By creating an
              account or using the services, you agree to these Terms. If you do not agree, do not use the services.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">2. Eligibility</h2>
            <p>
              You must be legally able to enter into a contract and authorized to act on behalf of a business entity
              to use Aplite. You represent that the information you provide is accurate and complete.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">3. Accounts and Security</h2>
            <p>
              You are responsible for maintaining the confidentiality of your credentials and for all activity that
              occurs under your account. Notify us immediately if you suspect unauthorized access.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">4. Services</h2>
            <p>
              Aplite provides onboarding, verification workflows, and payment identity resolution features. We may
              modify, suspend, or discontinue services at any time.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">5. Verification and Compliance</h2>
            <p>
              You authorize Aplite to collect and review documentation to verify your business and representatives.
              You agree to provide accurate, up to date information and documents upon request.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">6. Prohibited Use</h2>
            <p>
              You may not use the services for unlawful activity, to misrepresent your identity, or to transmit
              harmful code. We may suspend or terminate access if we detect prohibited activity.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">7. Fees</h2>
            <p>Fees (if any) will be disclosed prior to billing. You agree to pay all applicable fees and taxes.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">8. Intellectual Property</h2>
            <p>
              Aplite and its licensors retain all rights in the services, including all software, branding, and
              documentation.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">9. Disclaimers</h2>
            <p>
              The services are provided "as is" and "as available" without warranties of any kind, express or implied,
              including merchantability, fitness for a particular purpose, and non-infringement.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">10. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, Aplite will not be liable for indirect, incidental, or
              consequential damages or for loss of profits, data, or goodwill.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">11. Termination</h2>
            <p>
              We may suspend or terminate your access if you violate these Terms or if required to do so by law. You
              may stop using the services at any time.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">12. Changes</h2>
            <p>
              We may update these Terms from time to time. If we make material changes, we will provide notice by
              updating the "Last updated" date and, when appropriate, through the service.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">13. Contact</h2>
            <p>
              Questions about these Terms can be sent to{" "}
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
