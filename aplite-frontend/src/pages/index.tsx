/**
 * Marketing landing page for Aplite.
 * Introduces the product and drives signup/login conversions.
 */

import Link from "next/link";
import { Shield, ArrowRight, Lock, Zap, CheckCircle2 } from "lucide-react";
import { Button } from "../components/ui/button";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-7 w-7 text-primary" />
            <span className="text-xl font-semibold text-foreground">Aplite</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              How it works
            </a>
            <a href="#security" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Security
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link href="/login">Log in</Link>
            </Button>
            <Button variant="hero" asChild>
              <Link href="/signup">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary text-secondary-foreground text-sm mb-8 animate-fade-in">
            <Lock className="h-4 w-4" />
            <span>Secure payment identifiers for verified businesses</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-semibold text-foreground leading-tight mb-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            Share payments securely.
            <br />
            <span className="text-muted-foreground">Never expose bank details.</span>
          </h1>
          
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            Aplite lets verified businesses create secure payment identifiers (UPIs) that resolve into encrypted payout details. Control who can access your banking information.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <Button variant="hero" size="xl" asChild>
              <Link href="/signup">
                Start verification
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <Button variant="outline" size="xl" asChild>
              <Link href="/login">Sign in to dashboard</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Trust indicators */}
      <section className="py-12 border-y border-border bg-secondary/30">
        <div className="container mx-auto px-6">
          <div className="flex flex-wrap items-center justify-center gap-12 text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <span className="text-sm">Bank-grade encryption</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <span className="text-sm">Manual verification</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <span className="text-sm">ACH, Wire & SWIFT support</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <span className="text-sm">Audit logging</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-semibold text-foreground mb-4">
              Built for trust
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Every feature designed with security and clarity in mind.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Lock className="h-6 w-6" />}
              title="Secure Identifiers"
              description="Generate unique payment identifiers that mask your actual bank details. Control access with granular permissions."
            />
            <FeatureCard
              icon={<Shield className="h-6 w-6" />}
              title="Verified Businesses"
              description="Every business undergoes manual verification. Only verified entities can resolve UPIs into payout details."
            />
            <FeatureCard
              icon={<Zap className="h-6 w-6" />}
              title="Multiple Rails"
              description="Support for ACH, Wire, and SWIFT transfers. Add multiple payout accounts and choose the right rail for each transaction."
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-24 px-6 bg-secondary/30">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-semibold text-foreground mb-4">
              How it works
            </h2>
            <p className="text-muted-foreground">
              Simple, transparent process from signup to resolution.
            </p>
          </div>
          
          <div className="space-y-8">
            <StepCard
              number="01"
              title="Complete onboarding"
              description="Provide your business details, verify your identity, and add at least one payout account. All information is encrypted and securely stored."
            />
            <StepCard
              number="02"
              title="Verification call"
              description="Schedule a verification call with our team. We manually verify every business to ensure trust and compliance."
            />
            <StepCard
              number="03"
              title="Generate UPIs"
              description="Create unique payment identifiers linked to your payout accounts. Share these instead of exposing bank details."
            />
            <StepCard
              number="04"
              title="Resolve securely"
              description="Verified partners can resolve UPIs into encrypted payout details. Full audit trail for every resolution."
            />
          </div>
        </div>
      </section>

      {/* Security section */}
      <section id="security" className="py-24 px-6">
        <div className="container mx-auto max-w-4xl">
          <div className="bg-primary rounded-2xl p-12 text-primary-foreground text-center">
            <Lock className="h-12 w-12 mx-auto mb-6 opacity-80" />
            <h2 className="text-3xl font-semibold mb-4">
              Security is not optional
            </h2>
            <p className="text-primary-foreground/80 max-w-xl mx-auto mb-8">
              Your banking details are never exposed directly. Every resolution is logged, every access is controlled, and every business is verified.
            </p>
            <Button variant="secondary" size="lg" asChild>
              <Link href="/signup">Start your verification</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-border">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Aplite</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Ac 2024 Aplite. Secure payment identifiers for verified businesses.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) => (
  <div className="p-6 rounded-xl bg-card border border-border shadow-card">
    <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center text-foreground mb-4">
      {icon}
    </div>
    <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
    <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
  </div>
);

const StepCard = ({ number, title, description }: { number: string; title: string; description: string }) => (
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
