import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { PublicPageNav } from "../components/PublicPageNav";
import { useAuth } from "../utils/auth";
import { Button } from "../components/ui/button";

export default function ConfirmEmailPage() {
  /** Render the email confirmation guidance page. */
  const router = useRouter();
  const { token } = useAuth();
  const backHref = token ? "/dashboard" : "/";
  const email = typeof router.query.email === "string" ? router.query.email : "";

  return (
    <div className="min-h-screen bg-gradient-subtle relative overflow-hidden">
      <Head>
        <title>Confirm your email Aú Aplite</title>
      </Head>

      <main className="mx-auto w-full max-w-5xl px-6 py-12">
        <div className="mb-10 rounded-2xl border border-border bg-background/80 p-8 shadow-card backdrop-blur">
          <PublicPageNav backHref={backHref} />
          <h1 className="mt-4 text-3xl font-semibold text-foreground">Confirm your email</h1>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            We just sent a confirmation link to your inbox. Please click the link to activate your account.
          </p>
          {email && (
            <p className="mt-3 text-sm text-muted-foreground">
              Sent to: <span className="font-medium text-foreground">{email}</span>
            </p>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h2 className="text-base font-semibold text-foreground">Next steps</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>Check your inbox and spam folder.</li>
              <li>Open the confirmation email and click the link.</li>
              <li>Return here to sign in.</li>
            </ul>
            <div className="mt-5">
              <Link href="/login">
                <Button variant="hero">Back to login</Button>
              </Link>
            </div>
          </section>
          <section className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h2 className="text-base font-semibold text-foreground">Did not receive it?</h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Double-check your email address and try signing up again if needed. If the issue continues, contact
              support and we will help you complete verification.
            </p>
            <div className="mt-5">
              <Link href="/contact" className="text-accent hover:underline text-sm">
                Contact support
              </Link>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
