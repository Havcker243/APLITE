/**
 * KYB policy page describing verification requirements and process.
 */

import Link from "next/link";
import {
  Shield,
  ArrowLeft,
  CheckCircle2,
  FileText,
  User,
  Building2,
  CreditCard,
  Phone,
  Globe,
} from "lucide-react";
import { Button } from "../components/ui/button";

export default function KybPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-foreground hover:text-muted-foreground transition-colors">
            <Shield className="h-6 w-6" />
            <span className="font-semibold">Aplite</span>
          </Link>
          <Button variant="outline" size="sm" asChild>
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to home
            </Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 px-6 bg-secondary/30 border-b border-border">
        <div className="container mx-auto max-w-4xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold text-foreground">Know Your Business (KYB) Policy</h1>
              <p className="text-muted-foreground">Last updated: January 2026</p>
            </div>
          </div>
          <p className="text-lg text-muted-foreground">
            Aplite requires verification of every business before granting access to our platform.
            This policy outlines our verification requirements and process.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 px-6">
        <div className="container mx-auto max-w-4xl">
          <div className="space-y-12">
            <div>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Overview</h2>
              <div className="prose prose-slate max-w-none">
                <p className="text-muted-foreground leading-relaxed">
                  Know Your Business (KYB) is our verification process to confirm the identity and
                  legitimacy of businesses using Aplite. This helps prevent fraud, money laundering,
                  and ensures only legitimate businesses can create and resolve payment identifiers.
                </p>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  All businesses must complete KYB verification before gaining full access to the platform.
                  The verification process is manual and typically takes 1-3 business days.
                </p>
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-foreground mb-6">Verification Requirements</h2>
              <div className="grid md:grid-cols-2 gap-6">
                <RequirementCard
                  icon={<Building2 className="h-5 w-5" />}
                  title="Business Registration"
                  description="Valid business license or certificate of incorporation"
                  details={[
                    "Must be current and not expired",
                    "Business name must match application",
                    "Registration number clearly visible",
                    "Issued by a government authority",
                  ]}
                />
                <RequirementCard
                  icon={<User className="h-5 w-5" />}
                  title="Executive Identity"
                  description="Government-issued photo ID of an authorized signatory"
                  details={[
                    "Passport, driver's license, or national ID",
                    "Must not be expired",
                    "Photo must be clearly visible",
                    "Name must match attestation form",
                  ]}
                />
                <RequirementCard
                  icon={<Globe className="h-5 w-5" />}
                  title="Business Address"
                  description="Proof of business address dated within 90 days"
                  details={[
                    "Utility bill or bank statement",
                    "Must show business name and address",
                    "Cannot be a PO Box",
                    "Must match declared address",
                  ]}
                />
                <RequirementCard
                  icon={<CreditCard className="h-5 w-5" />}
                  title="Bank Account Verification"
                  description="Business bank statement showing account details"
                  details={[
                    "Dated within the last 90 days",
                    "Business name on statement must match",
                    "Account number clearly visible",
                    "Must be a business account",
                  ]}
                />
                <RequirementCard
                  icon={<FileText className="h-5 w-5" />}
                  title="Beneficial Ownership"
                  description="Disclosure of shareholders with 25%+ ownership"
                  details={[
                    "Self-attestation form required",
                    "Full legal names of beneficial owners",
                    "Ownership percentages",
                    "Additional ID may be required",
                  ]}
                />
                <RequirementCard
                  icon={<Phone className="h-5 w-5" />}
                  title="Verification Call"
                  description="Live call with our verification team"
                  details={[
                    "15-30 minute scheduled call",
                    "Identity confirmation via video",
                    "Business details verification",
                    "Q&A about intended platform use",
                  ]}
                />
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-foreground mb-6">Verification Checklist</h2>
              <div className="bg-card border border-border rounded-xl p-6">
                <p className="text-muted-foreground mb-6">
                  Our verification team reviews the following items before approving a business:
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  <ChecklistItem text="Business registration documents are valid and current" />
                  <ChecklistItem text="Photo ID matches name on attestation form" />
                  <ChecklistItem text="Verification call completed with identity confirmed" />
                  <ChecklistItem text="Bank statement shows matching business name" />
                  <ChecklistItem text="Address documents are recent (under 90 days)" />
                  <ChecklistItem text="Website or LinkedIn confirms business legitimacy" />
                  <ChecklistItem text="No adverse media or sanctions matches" />
                  <ChecklistItem text="All attestations signed and complete" />
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-foreground mb-6">Verification Timeline</h2>
              <div className="space-y-4">
                <TimelineItem
                  step="1"
                  title="Application Submitted"
                  time="Day 0"
                  description="Complete the onboarding form with business details, identity information, and document uploads."
                />
                <TimelineItem
                  step="2"
                  title="Document Review"
                  time="Day 1-2"
                  description="Our team reviews submitted documents for completeness and validity."
                />
                <TimelineItem
                  step="3"
                  title="Verification Call"
                  time="Day 2-3"
                  description="Schedule and complete a video call with our verification team."
                />
                <TimelineItem
                  step="4"
                  title="Final Approval"
                  time="Day 3-4"
                  description="Receive verification status and gain full access to the platform."
                />
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-foreground mb-6">Common Rejection Reasons</h2>
              <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-6">
                <p className="text-muted-foreground mb-4">
                  Applications may be rejected for the following reasons:
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-destructive mt-2 shrink-0" />
                    <span className="text-foreground">
                      <strong>Document mismatch:</strong> Information on documents does not match the application
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-destructive mt-2 shrink-0" />
                    <span className="text-foreground">
                      <strong>Expired documents:</strong> Registration, ID, or address proof is outdated
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-destructive mt-2 shrink-0" />
                    <span className="text-foreground">
                      <strong>Unclear documents:</strong> Photos are blurry, cropped, or unreadable
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-destructive mt-2 shrink-0" />
                    <span className="text-foreground">
                      <strong>Missed verification call:</strong> Failure to attend scheduled verification call
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-destructive mt-2 shrink-0" />
                    <span className="text-foreground">
                      <strong>Sanctions or AML check:</strong> Business or individuals appear on watchlists
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-destructive mt-2 shrink-0" />
                    <span className="text-foreground">
                      <strong>Incomplete attestation:</strong> Required attestations not signed or incomplete
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Data Handling and Privacy</h2>
              <div className="prose prose-slate max-w-none">
                <p className="text-muted-foreground leading-relaxed">
                  All documents and personal information submitted during the KYB process are handled with
                  the highest security standards:
                </p>
                <ul className="mt-4 space-y-2 text-muted-foreground">
                  <li>Documents are encrypted at rest using AES-256 encryption</li>
                  <li>All data transmission uses TLS 1.3 encryption</li>
                  <li>Access to verification documents is restricted to authorized personnel</li>
                  <li>Documents are retained for 7 years as required by financial regulations</li>
                  <li>You may request deletion of your data subject to regulatory requirements</li>
                </ul>
              </div>
            </div>

            <div className="bg-primary rounded-2xl p-8 text-center">
              <h3 className="text-xl font-semibold text-primary-foreground mb-3">
                Ready to get verified?
              </h3>
              <p className="text-primary-foreground/80 mb-6">
                Start your verification today and join our network of trusted businesses.
              </p>
              <Button variant="secondary" size="lg" asChild>
                <Link href="/signup">Start verification</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border">
        <div className="container mx-auto text-center">
          <p className="text-sm text-muted-foreground">
            2024 Aplite. For questions about our KYB policy, contact{" "}
            <a href="mailto:compliance@aplite.com" className="text-foreground hover:underline">
              compliance@aplite.com
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}

interface RequirementCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  details: string[];
}

const RequirementCard = ({ icon, title, description, details }: RequirementCardProps) => (
  <div className="p-6 rounded-xl bg-card border border-border">
    <div className="flex items-center gap-3 mb-3">
      <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-foreground">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
    <ul className="space-y-2 mt-4">
      {details.map((detail, idx) => (
        <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
          {detail}
        </li>
      ))}
    </ul>
  </div>
);

const ChecklistItem = ({ text }: { text: string }) => (
  <div className="flex items-start gap-3 p-3 rounded-lg bg-success/5">
    <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
    <span className="text-sm text-foreground">{text}</span>
  </div>
);

interface TimelineItemProps {
  step: string;
  title: string;
  time: string;
  description: string;
}

const TimelineItem = ({ step, title, time, description }: TimelineItemProps) => (
  <div className="flex gap-4">
    <div className="flex flex-col items-center">
      <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
        {step}
      </div>
      <div className="w-0.5 flex-1 bg-border mt-2" />
    </div>
    <div className="pb-8">
      <div className="flex items-center gap-3 mb-1">
        <h3 className="font-semibold text-foreground">{title}</h3>
        <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded">{time}</span>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  </div>
);
