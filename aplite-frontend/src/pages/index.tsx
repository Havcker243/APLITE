import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import { Shield, ArrowRight, CheckCircle2, AlertCircle, Search } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

export default function LandingPage() {
  const router = useRouter();
  const [apliteId, setApliteId] = useState("bulldogbites@aplite");

  function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = apliteId.trim();
    if (!trimmed) return;
    void router.push(`/verify?id=${encodeURIComponent(trimmed)}`);
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-7 w-7 text-primary" />
            <span className="text-xl font-semibold text-foreground">Aplite</span>
          </div>
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

      {/* Hero */}
      <section className="pt-40 pb-24 px-6">
        <div className="container mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary text-secondary-foreground text-sm mb-8">
            <Shield className="h-4 w-4" />
            <span>Payment identity verification</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-semibold text-foreground leading-tight mb-6">
            Verify who you're paying
            <br />
            <span className="text-muted-foreground">before sending money.</span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-12">
            Before wiring money to a new vendor, check their Aplite ID. Instantly
            see if they're a verified business — or flag them as suspicious.
          </p>

          <form onSubmit={handleVerify} className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">
            <Input
              value={apliteId}
              onChange={(e) => setApliteId(e.target.value)}
              placeholder="bulldogbites@aplite"
              className="flex-1 h-12 text-base font-mono"
              aria-label="Aplite ID"
            />
            <Button type="submit" variant="hero" size="lg" className="h-12 px-8 shrink-0">
              <Search className="h-4 w-4 mr-2" />
              Verify now
            </Button>
          </form>

          <p className="text-sm text-muted-foreground mt-4">
            Try: <button
              type="button"
              className="font-mono underline underline-offset-2 hover:text-foreground transition-colors"
              onClick={() => setApliteId("bulldogbites@aplite")}
            >
              bulldogbites@aplite
            </button>
            {" · "}
            <button
              type="button"
              className="font-mono underline underline-offset-2 hover:text-foreground transition-colors"
              onClick={() => setApliteId("fastfreight@aplite")}
            >
              fastfreight@aplite
            </button>
          </p>
        </div>
      </section>

      {/* What it looks like */}
      <section className="py-20 px-6 bg-secondary/30">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-2xl font-semibold text-center text-foreground mb-12">
            What you'll see
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Verified example */}
            <div className="bg-card border border-success/30 rounded-xl p-6 shadow-card">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Verified Business</p>
                  <p className="text-xs text-success">Aplite confirmed</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name</span>
                  <span className="font-medium text-foreground">Bulldog Bites LLC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-medium text-success">Verified</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last verified</span>
                  <span className="font-medium text-foreground">Apr 25, 2026</span>
                </div>
              </div>
            </div>

            {/* Not verified example */}
            <div className="bg-card border border-destructive/30 rounded-xl p-6 shadow-card">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Not Verified</p>
                  <p className="text-xs text-destructive">Proceed with caution</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                We could not verify this business. This ID is not registered in the Aplite network.
              </p>
              <button
                type="button"
                className="text-sm text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
              >
                Request verification →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-2xl font-semibold text-center text-foreground mb-12">
            How it works
          </h2>
          <div className="space-y-8">
            <Step
              number="01"
              title="Get the Aplite ID"
              description="When paying a new vendor, ask them for their Aplite ID. It looks like: businessname@aplite"
            />
            <Step
              number="02"
              title="Check it here"
              description="Enter the ID above. Aplite instantly tells you if this business has been verified by our team."
            />
            <Step
              number="03"
              title="Pay with confidence"
              description="Verified = safe to proceed. Not verified = flag it, ask questions, or request they get verified."
            />
          </div>
        </div>
      </section>

      {/* CTA for businesses */}
      <section className="py-20 px-6 bg-primary">
        <div className="container mx-auto max-w-2xl text-center text-primary-foreground">
          <h2 className="text-3xl font-semibold mb-4">
            Are you a business?
          </h2>
          <p className="text-primary-foreground/80 mb-8 text-lg">
            Get verified so your clients know you're legitimate. Verification takes less than 24 hours.
          </p>
          <Button variant="secondary" size="lg" asChild>
            <Link href="/signup">
              Apply for verification
              <ArrowRight className="h-5 w-5 ml-2" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Aplite</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/kyb-policy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              KYB Policy
            </Link>
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Business login
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2026 Aplite. Payment identity verification.
          </p>
        </div>
      </footer>
    </div>
  );
}

function Step({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="flex gap-6 items-start">
      <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold shrink-0">
        {number}
      </div>
      <div className="pt-2">
        <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
        <p className="text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
