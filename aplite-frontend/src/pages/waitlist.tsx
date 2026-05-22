import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { Shield, CheckCircle2, Lock, Users, FileText, ArrowRight } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { joinWaitlist } from "../utils/api";

export default function WaitlistPage() {
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    try {
      const res = await joinWaitlist(email.trim(), company.trim() || undefined);
      setStatus("success");
      setMessage(res.message || "You're on the list.");
    } catch (err: unknown) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Head>
        <title>Join the Waitlist — TATIN</title>
        <meta name="description" content="Get early access to TATIN — verified payment identity for businesses." />
      </Head>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Shield className="h-7 w-7 text-primary" />
            <span className="text-xl font-semibold text-foreground">TATIN</span>
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link href="/login">Log in</Link>
            </Button>
            <Button variant="hero" asChild>
              <Link href="/signup">Get verified</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="pt-32 pb-20 px-6">
        <div className="container mx-auto max-w-2xl">

          {/* Hero */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary text-secondary-foreground text-sm mb-6">
              <Users className="h-4 w-4" />
              <span>Early access</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-semibold text-foreground leading-tight mb-4">
              Be first to know<br />
              <span className="text-muted-foreground">when TATIN opens.</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-lg mx-auto">
              TATIN gives businesses a verified payment identity so partners know
              exactly who they're paying — before money moves.
            </p>
          </div>

          {/* Form */}
          <div className="bg-card border border-border rounded-2xl p-8 shadow-card mb-10">
            {status === "success" ? (
              <div className="text-center py-6">
                <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="h-7 w-7 text-success" />
                </div>
                <h2 className="text-xl font-semibold text-foreground mb-2">You're on the list</h2>
                <p className="text-muted-foreground mb-6">
                  We'll reach out when early access opens. In the meantime, you can explore the product.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button variant="hero" asChild>
                    <Link href="/verify">Try verification</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/">Back to home</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email">Work email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 text-base"
                    disabled={status === "loading"}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">
                    Company name <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Input
                    id="company"
                    type="text"
                    placeholder="Acme Corp"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="h-12 text-base"
                    disabled={status === "loading"}
                  />
                </div>

                {status === "error" && (
                  <p className="text-sm text-destructive">{message}</p>
                )}

                <Button
                  type="submit"
                  variant="hero"
                  size="lg"
                  className="w-full h-12 text-base"
                  disabled={status === "loading"}
                >
                  {status === "loading" ? "Joining…" : "Join the waitlist"}
                  {status !== "loading" && <ArrowRight className="h-4 w-4 ml-2" />}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  No spam. We'll only email you about early access.
                </p>
              </form>
            )}
          </div>

          {/* Why section */}
          <div className="grid sm:grid-cols-3 gap-4">
            <Feature
              icon={<Lock className="h-5 w-5" />}
              title="Encrypted by default"
              description="Bank details are AES-256 encrypted at rest. Never exposed in plain text."
            />
            <Feature
              icon={<CheckCircle2 className="h-5 w-5" />}
              title="Human-reviewed KYB"
              description="Every business is manually verified before a TATIN ID is issued."
            />
            <Feature
              icon={<FileText className="h-5 w-5" />}
              title="Full audit trail"
              description="Every resolution is logged. Know who accessed payment details and when."
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">TATIN</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/security" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Security</Link>
            <Link href="/trust" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Trust</Link>
            <Link href="/privacy-policy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Privacy</Link>
          </div>
          <p className="text-sm text-muted-foreground">© 2026 TATIN. Payment identity verification.</p>
        </div>
      </footer>
    </div>
  );
}

function Feature({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-3">
        {icon}
      </div>
      <h3 className="font-semibold text-foreground text-sm mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}
