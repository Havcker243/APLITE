import Head from "next/head";
import Link from "next/link";
import { useAuth } from "../utils/auth";

const FAQS = [
  {
    question: "What is Aplite?",
    answer:
      "Aplite is a payment identity platform that verifies businesses, links payout rails, and issues identifiers that resolve into trusted payment coordinates.",
  },
  {
    question: "Who is Aplite for?",
    answer:
      "Aplite is built for finance teams, marketplaces, platforms, and regulated businesses that need reliable payouts and clear identity verification.",
  },
  {
    question: "What is a UPI in Aplite?",
    answer:
      "A UPI is a universal payment identifier issued to a verified organization. It can be resolved into payout coordinates for approved rails.",
  },
  {
    question: "How does onboarding work?",
    answer:
      "You submit business details, verify identity, connect payout rails, and complete a review. Approved organizations are issued identifiers.",
  },
  {
    question: "What rails are supported?",
    answer:
      "Aplite supports ACH, domestic wire, and SWIFT for international payouts (based on the rail data you provide).",
  },
  {
    question: "How long does verification take?",
    answer:
      "Most reviews complete quickly once documents are submitted. We aim to confirm within a short review window.",
  },
  {
    question: "How is sensitive data protected?",
    answer:
      "Banking details are encrypted at rest and access is restricted by role. We treat payment data as high sensitivity.",
  },
  {
    question: "Can I issue multiple identifiers?",
    answer:
      "Yes. Once verified, you can create child identifiers for different payout accounts as needed.",
  },
  {
    question: "What happens if a business is rejected?",
    answer:
      "We provide a rejection reason and allow resubmission once the issue is corrected.",
  },
  {
    question: "How do I contact support?",
    answer:
      "Email support@aplite.io for onboarding or account help.",
  },
];

export default function FaqPage() {
  /** Render the faq page content. */
  const { token } = useAuth();
  const backHref = token ? "/dashboard" : "/";
  const backLabel = token ? "Back to dashboard" : "Back to Aplite";

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Head>
        <title>Aplite FAQ</title>
      </Head>

      <main className="mx-auto w-full max-w-5xl px-6 py-12">
        <div className="mb-10 rounded-2xl border border-border bg-background/80 p-8 shadow-card backdrop-blur">
          <Link href={backHref} className="text-sm text-muted-foreground hover:text-foreground">
            {backLabel}
          </Link>
          <h1 className="mt-4 text-3xl font-semibold text-foreground">Frequently asked questions</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Clear answers about onboarding, verification, and payment identifiers.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {FAQS.map((faq) => (
            <section key={faq.question} className="rounded-xl border border-border bg-card p-6 shadow-card">
              <h2 className="text-base font-semibold text-foreground">{faq.question}</h2>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{faq.answer}</p>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
