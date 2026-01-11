/**
 * Marketing landing page for Aplite.
 * Introduces the product and drives signup/login conversions.
 */

import Link from "next/link";
import { Shield, ArrowRight, Lock, Zap, CheckCircle2, HelpCircle, Check, X } from "lucide-react";
import { Button } from "../components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../components/ui/accordion";

export default function LandingPage() {
  /** Render the index page content. */
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
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </a>
            <a href="#faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              FAQ
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

      {/* Pricing Section */}
      <section id="pricing" className="py-24 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-success/10 text-success text-sm mb-6">
              <Zap className="h-4 w-4" />
              <span>Pilot program now open</span>
            </div>
            <h2 className="text-3xl font-semibold text-foreground mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Start free during our pilot program. Upgrade as you grow.
            </p>
          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6">
            <PricingCard
              name="Pilot"
              price="Free"
              period="during beta"
              description="For early adopters testing the platform"
              features={[
                { text: "1 payout account", included: true },
                { text: "3 UPIs", included: true },
                { text: "10 resolutions/month", included: true },
                { text: "ACH only", included: true },
                { text: "Email support", included: true },
                { text: "30-day audit logs", included: true },
                { text: "API access", included: false },
                { text: "Webhooks", included: false },
              ]}
              cta="Start free"
              ctaLink="/signup"
              highlighted={false}
            />
            <PricingCard
              name="Starter"
              price="$49"
              period="/month"
              description="For small businesses and freelancer platforms"
              features={[
                { text: "3 payout accounts", included: true },
                { text: "Unlimited UPIs", included: true },
                { text: "100 resolutions/month", included: true },
                { text: "ACH + Wire", included: true },
                { text: "Priority support", included: true },
                { text: "90-day audit logs", included: true },
                { text: "API access", included: false },
                { text: "Webhooks", included: true },
              ]}
              cta="Get started"
              ctaLink="/signup"
              highlighted={false}
            />
            <PricingCard
              name="Business"
              price="$199"
              period="/month"
              description="For growing companies with high volume"
              features={[
                { text: "Unlimited accounts", included: true },
                { text: "Unlimited UPIs", included: true },
                { text: "Unlimited resolutions", included: true },
                { text: "ACH + Wire + SWIFT", included: true },
                { text: "Dedicated CSM", included: true },
                { text: "1-year audit logs", included: true },
                { text: "Full API access", included: true },
                { text: "Webhooks", included: true },
              ]}
              cta="Get started"
              ctaLink="/signup"
              highlighted={true}
            />
            <PricingCard
              name="Enterprise"
              price="Custom"
              period=""
              description="For large organizations with custom needs"
              features={[
                { text: "Custom limits", included: true },
                { text: "Custom integrations", included: true },
                { text: "On-premise option", included: true },
                { text: "All payment rails", included: true },
                { text: "24/7 support + SLA", included: true },
                { text: "Custom retention", included: true },
                { text: "Dedicated infrastructure", included: true },
                { text: "SSO / SAML", included: true },
              ]}
              cta="Contact sales"
              ctaLink="/contact"
              highlighted={false}
            />
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-24 px-6 bg-secondary/30">
        <div className="container mx-auto max-w-3xl">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary text-secondary-foreground text-sm mb-6">
              <HelpCircle className="h-4 w-4" />
              <span>Common questions</span>
            </div>
            <h2 className="text-3xl font-semibold text-foreground mb-4">
              Frequently asked questions
            </h2>
            <p className="text-muted-foreground">
              Everything you need to know about Aplite.
            </p>
          </div>

          <Accordion type="single" collapsible className="space-y-4">
            <AccordionItem value="item-1" className="bg-card border border-border rounded-xl px-6">
              <AccordionTrigger className="text-left font-medium text-foreground hover:no-underline">
                What is a UPI and how does it work?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                A UPI (Unique Payment Identifier) is a secure token that represents your bank account details without exposing them directly. When you share a UPI with a verified partner, they can resolve it to see your payout details only if they are verified. Every resolution is logged for your audit trail.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2" className="bg-card border border-border rounded-xl px-6">
              <AccordionTrigger className="text-left font-medium text-foreground hover:no-underline">
                How long does verification take?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Most businesses complete onboarding in 15-20 minutes. After submitting your documents, we schedule a verification call within 1-2 business days. Once the call is complete and all documents are verified, you will have full access within 24 hours.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3" className="bg-card border border-border rounded-xl px-6">
              <AccordionTrigger className="text-left font-medium text-foreground hover:no-underline">
                What documents do I need for verification?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                You will need a business registration document, a government-issued photo ID of an authorized signer, proof of business address dated within 90 days, and a bank statement showing the account you want to link.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4" className="bg-card border border-border rounded-xl px-6">
              <AccordionTrigger className="text-left font-medium text-foreground hover:no-underline">
                Is my banking information secure?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Yes. Data is encrypted at rest and in transit. Your bank details are never exposed directly. Only verified partners can resolve UPIs, and every access is logged.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5" className="bg-card border border-border rounded-xl px-6">
              <AccordionTrigger className="text-left font-medium text-foreground hover:no-underline">
                What payment rails do you support?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                We support ACH transfers (US domestic), wire transfers (domestic), and SWIFT transfers (international). Available rails depend on your plan.
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="text-center mt-12">
            <p className="text-muted-foreground mb-4">
              Still have questions?
            </p>
            <Button variant="outline" asChild>
              <a href="mailto:support@aplite.com">Contact support</a>
            </Button>
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
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button variant="secondary" size="lg" asChild>
                <Link href="/signup">Start your verification</Link>
              </Button>
              <Button
                variant="ghost"
                size="lg"
                className="text-primary-foreground hover:text-primary-foreground hover:bg-primary-foreground/10"
                asChild
              >
                <Link href="/kyb-policy">View KYB policy</Link>
              </Button>
            </div>
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
            <div className="flex items-center gap-6">
              <Link href="/kyb-policy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                KYB Policy
              </Link>
              <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Pricing
              </a>
              <a href="#faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                FAQ
              </a>
            </div>
            <p className="text-sm text-muted-foreground">
              2024 Aplite. Secure payment identifiers for verified businesses.
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

interface PricingFeature {
  text: string;
  included: boolean;
}

interface PricingCardProps {
  name: string;
  price: string;
  period: string;
  description: string;
  features: PricingFeature[];
  cta: string;
  ctaLink: string;
  highlighted: boolean;
}

const PricingCard = ({ name, price, period, description, features, cta, ctaLink, highlighted }: PricingCardProps) => (
  <div className={`relative p-6 rounded-xl border ${highlighted ? "border-primary bg-primary/5 shadow-elevated" : "border-border bg-card shadow-card"}`}>
    {highlighted && (
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-full">
        Most popular
      </div>
    )}
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-foreground mb-2">{name}</h3>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-semibold text-foreground">{price}</span>
        <span className="text-sm text-muted-foreground">{period}</span>
      </div>
      <p className="text-sm text-muted-foreground mt-2">{description}</p>
    </div>
    <ul className="space-y-3 mb-6">
      {features.map((feature, idx) => (
        <li key={idx} className="flex items-start gap-2 text-sm">
          {feature.included ? (
            <Check className="h-4 w-4 text-success shrink-0 mt-0.5" />
          ) : (
            <X className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-0.5" />
          )}
          <span className={feature.included ? "text-foreground" : "text-muted-foreground/50"}>
            {feature.text}
          </span>
        </li>
      ))}
    </ul>
    <Button
      variant={highlighted ? "hero" : "outline"}
      className="w-full"
      asChild
    >
      <Link href={ctaLink}>{cta}</Link>
    </Button>
  </div>
);
