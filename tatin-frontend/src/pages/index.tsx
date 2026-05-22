import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import { Shield, ArrowRight, CheckCircle2, AlertCircle, Search, Lock, FileText, Users } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

export default function LandingPage() {
  const router = useRouter();
  const [tatinId, setTatinId] = useState("bulldogbites@tatin");

  function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = tatinId.trim();
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
            <span className="text-xl font-semibold text-foreground">Tatin</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link href="/login">Log in</Link>
            </Button>
            <Button variant="hero" asChild>
              <Link href="/signup">Get your business verified</Link>
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
            Before wiring money to a new vendor, check their Tatin ID. Instantly
            see if they're a verified business — or flag them as suspicious.
          </p>

          <form onSubmit={handleVerify} className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">
            <Input
              value={tatinId}
              onChange={(e) => setTatinId(e.target.value)}
              placeholder="bulldogbites@tatin"
              className="flex-1 h-12 text-base font-mono"
              aria-label="Tatin ID"
            />
            <Button type="submit" variant="hero" size="lg" className="h-12 px-8 shrink-0">
              <Search className="h-4 w-4 mr-2" />
              Verify a Tatin ID
            </Button>
          </form>

          <p className="text-sm text-muted-foreground mt-4">
            Try:{" "}
            <button
              type="button"
              className="font-mono underline underline-offset-2 hover:text-foreground transition-colors"
              onClick={() => setTatinId("bulldogbites@tatin")}
            >
              bulldogbites@tatin
            </button>
            {" · "}
            <button
              type="button"
              className="font-mono underline underline-offset-2 hover:text-foreground transition-colors"
              onClick={() => setTatinId("fastfreight@tatin")}
            >
              fastfreight@tatin
            </button>
          </p>
        </div>
      </section>

      {/* Trust strip */}
      <section className="py-6 px-6 border-y border-border bg-muted/20">
        <div className="container mx-auto max-w-4xl">
          <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
            <TrustBadge icon={<Lock className="h-4 w-4" />} label="AES-256 encrypted at rest" />
            <TrustBadge icon={<CheckCircle2 className="h-4 w-4" />} label="Human-reviewed KYB" />
            <TrustBadge icon={<FileText className="h-4 w-4" />} label="Full audit trail" />
            <TrustBadge icon={<Shield className="h-4 w-4" />} label="HMAC-signed identifiers" />
            <TrustBadge icon={<Users className="h-4 w-4" />} label="Business-verified network" />
          </div>
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
                  <p className="text-xs text-success">Tatin confirmed</p>
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
                We could not verify this business. This ID is not registered in the Tatin network.
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
              title="Get the Tatin ID"
              description="When paying a new vendor, ask them for their Tatin ID. It looks like: businessname@tatin"
            />
            <Step
              number="02"
              title="Check it here"
              description="Enter the ID above. Tatin instantly tells you if this business has been verified by our team."
            />
            <Step
              number="03"
              title="Pay with confidence"
              description="Verified = safe to proceed. Not verified = flag it, ask questions, or request they get verified."
            />
          </div>
        </div>
      </section>

      {/* Security section */}
      <section className="py-20 px-6 bg-secondary/20">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-2xl font-semibold text-center text-foreground mb-4">
            Built with security in mind
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto">
            Bank details never touch plain text. Every access is logged. Every identifier is cryptographically signed.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            <SecurityCard
              title="Encrypted at rest"
              description="All payment account details are AES-256 GCM encrypted before any database write. The plaintext never reaches storage."
            />
            <SecurityCard
              title="Cryptographic IDs"
              description="Tatin IDs are generated via HMAC with a per-deployment secret. They are not guessable or enumerable."
            />
            <SecurityCard
              title="Rate limited"
              description="Verification and resolution endpoints are rate-limited to prevent enumeration or scraping attacks."
            />
          </div>
          <div className="text-center mt-8">
            <Link href="/security" className="text-sm text-primary underline underline-offset-2 hover:text-primary/80 transition-colors">
              Read our full security posture →
            </Link>
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
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="secondary" size="lg" asChild>
              <Link href="/signup">
                Get your business verified
                <ArrowRight className="h-5 w-5 ml-2" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10" asChild>
              <Link href="/waitlist">
                Join the waitlist
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-border">
        <div className="container mx-auto max-w-5xl">
          <div className="flex flex-col md:flex-row items-start justify-between gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-5 w-5 text-foreground" />
                <span className="font-semibold text-foreground">Tatin</span>
              </div>
              <p className="text-sm text-muted-foreground max-w-xs">
                Verified payment identity for businesses. Replace bank-detail sharing with a secure, stable identifier.
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-8 text-sm">
              <div className="space-y-2">
                <p className="font-medium text-foreground">Product</p>
                <Link href="/verify" className="block text-muted-foreground hover:text-foreground transition-colors">Verify an ID</Link>
                <Link href="/signup" className="block text-muted-foreground hover:text-foreground transition-colors">Get verified</Link>
                <Link href="/waitlist" className="block text-muted-foreground hover:text-foreground transition-colors">Join waitlist</Link>
              </div>
              <div className="space-y-2">
                <p className="font-medium text-foreground">Trust</p>
                <Link href="/security" className="block text-muted-foreground hover:text-foreground transition-colors">Security</Link>
                <Link href="/trust" className="block text-muted-foreground hover:text-foreground transition-colors">Trust</Link>
                <Link href="/kyb-policy" className="block text-muted-foreground hover:text-foreground transition-colors">KYB Policy</Link>
                <Link href="/compliance" className="block text-muted-foreground hover:text-foreground transition-colors">Compliance</Link>
              </div>
              <div className="space-y-2">
                <p className="font-medium text-foreground">Legal</p>
                <Link href="/privacy-policy" className="block text-muted-foreground hover:text-foreground transition-colors">Privacy</Link>
                <Link href="/terms-of-service" className="block text-muted-foreground hover:text-foreground transition-colors">Terms</Link>
                <Link href="/sla" className="block text-muted-foreground hover:text-foreground transition-colors">SLA</Link>
              </div>
            </div>
          </div>
          <div className="border-t border-border pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">© 2026 Tatin. Payment identity verification.</p>
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Business login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function TrustBadge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-primary">{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function SecurityCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-card">
      <h3 className="font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
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
