/**
 * Main authenticated dashboard page.
 * Summarizes onboarding status and routes to key actions.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { 
  CreditCard, 
  Key, 
  ArrowRight, 
  CheckCircle2,
  Clock,
  FileText,
  Copy,
  Plus,
  ToggleLeft,
  ToggleRight
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useAuth } from "../utils/auth";
import { useAppData } from "../utils/appData";
import DashboardLayout from "../components/DashboardLayout";
import { toast } from "sonner";
import { toastApiError } from "../utils/notifications";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { createChildUpi, disableChildUpi, reactivateChildUpi } from "../utils/api";

export default function DashboardPage() {
  const router = useRouter();
  const { token, loading, profile } = useAuth();
  const { accounts, upis, refreshAccounts, refreshUpis } = useAppData();
  const [childUpis, setChildUpis] = useState<
    Array<{ child_upi_id?: string; upi: string; payment_account_id: number; rail: string; bank_name?: string; created_at?: string; status?: string }>
  >([]);
  const [childUpiBusy, setChildUpiBusy] = useState<Record<string, boolean>>({});
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [upiLabel, setUpiLabel] = useState("");

  const onboardingStatus = String(profile?.onboarding_status || "UNVERIFIED").toUpperCase();
  const isVerified = onboardingStatus === "VERIFIED";
  const isPending = onboardingStatus === "PENDING_CALL" || onboardingStatus === "PENDING_REVIEW";
  const isRejected = onboardingStatus === "REJECTED";
  const isUnverified = !isVerified && !isPending && !isRejected;

  useEffect(() => {
    if (loading) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    if (isVerified) {
      void refreshAccounts();
      void refreshUpis();
    }
  }, [loading, token, isVerified, router, refreshAccounts, refreshUpis]);

  useEffect(() => {
    setChildUpis(upis);
  }, [upis]);

  const getNextAction = () => {
    /** Determine the best next CTA based on onboarding state. */
    if (isUnverified) {
      return {
        title: "Complete onboarding",
        description: "Provide business details and add your first payout account to start the verification process.",
        action: () => router.push("/onboard"),
        buttonText: "Start onboarding",
        icon: FileText,
      };
    }
    if (isPending) {
      return {
        title: "Awaiting verification",
        description: "Your onboarding is complete. Our team will review your submission.",
        action: () => router.push("/onboard/pending"),
        buttonText: "View status",
        icon: Clock,
      };
    }
    if (isRejected) {
      return {
        title: "Verification rejected",
        description: "Review the reason and resubmit your onboarding details.",
        action: () => router.push("/onboard/pending"),
        buttonText: "View reason",
        icon: Clock,
      };
    }
    if (isVerified && childUpis.length === 0) {
      return {
        title: "Create your first UPI",
        description: "Generate secure payment identifiers for your payout accounts.",
        action: () => setIsCreateOpen(true),
        buttonText: "Create UPI",
        icon: Key,
      };
    }
    return null;
  };

  const handleCreateUPI = async () => {
    /** Create a child UPI for the selected account. */
    if (!selectedAccountId) {
      toast.error("Please select an account");
      return;
    }
    try {
      const response = await createChildUpi({
        account_id: Number(selectedAccountId),
        name: upiLabel || undefined,
        type: "payment",
      });
      toast.success(`UPI created: ${response.upi}`);
      setIsCreateOpen(false);
      setSelectedAccountId("");
      setUpiLabel("");
      await refreshUpis({ force: true });
    } catch (err) {
      toastApiError(err, "UPI failed");
    }
  };

  const handleCopy = (text: string) => {
    /** Copy a value to clipboard with feedback. */
    navigator.clipboard.writeText(text).catch(() => undefined);
    toast.success("Copied to clipboard");
  };


  async function handleToggleChildUpi(childUpiId: string, nextStatus: "active" | "disabled") {
    /** Toggle a child UPI's active status. */
    setChildUpiBusy((prev) => ({ ...prev, [childUpiId]: true }));
    try {
      if (nextStatus === "disabled") {
        await disableChildUpi(childUpiId);
      } else {
        await reactivateChildUpi(childUpiId);
      }
      await refreshUpis({ force: true });
    } catch (err) {
      toastApiError(err, "Update failed");
    } finally {
      setChildUpiBusy((prev) => ({ ...prev, [childUpiId]: false }));
    }
  }

  const nextAction = getNextAction();
  const orgUpi = profile?.organization?.upi || profile?.organization?.issued_upi;
  const activeUpiCount = childUpis.filter((u) => (u.status || "active") === "active").length;

  if (loading || !token) return null;

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="max-w-4xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-foreground mb-2">
              Welcome back
            </h1>
            <p className="text-muted-foreground">
              Manage your payment identifiers and payout accounts.
            </p>
          </div>

          {/* Next action card */}
          {nextAction && (
            <div className="bg-card border border-border rounded-xl p-6 mb-8 shadow-card animate-fade-in">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <nextAction.icon className="h-5 w-5 text-accent" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-foreground mb-1">
                    {nextAction.title}
                  </h2>
                  <p className="text-muted-foreground text-sm mb-4">
                    {nextAction.description}
                  </p>
                  <Button variant="hero" onClick={nextAction.action}>
                    {nextAction.buttonText}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Org UPI (verified only) */}
          {isVerified && orgUpi && (
            <div className="bg-card border border-border rounded-xl p-6 mb-8 shadow-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Organization UPI</p>
                  <p className="text-xl font-mono font-semibold text-foreground">{orgUpi}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleCopy(orgUpi)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            <StatCard
              icon={<CreditCard className="h-5 w-5" />}
              label="Payout Accounts"
              value={accounts.length}
            />
            <StatCard
              icon={<Key className="h-5 w-5" />}
              label="Active UPIs"
              value={activeUpiCount}
            />
            <StatCard
              icon={<CheckCircle2 className="h-5 w-5" />}
              label="Status"
              value={isVerified ? "Verified" : isPending ? "Pending" : isRejected ? "Rejected" : "Unverified"}
              isStatus
            />
          </div>

          {/* Verified dashboard content */}
          {isVerified && (
            <>
              {/* Create UPI */}
              <div className="flex flex-wrap gap-4 mb-8">
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                  <DialogTrigger asChild>
                    <Button variant="hero">
                      <Plus className="h-4 w-4 mr-2" />
                      Create child UPI
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create new UPI</DialogTitle>
                      <DialogDescription>
                        Generate a secure payment identifier linked to a payout account.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>Payout account</Label>
                        <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select account" />
                          </SelectTrigger>
                          <SelectContent>
                            {accounts.map(acc => (
                              <SelectItem key={acc.id} value={String(acc.id)}>
                                {acc.bank_name || "Account"} ({acc.rail})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Label (optional)</Label>
                        <Input
                          placeholder="e.g., Q4 payments"
                          value={upiLabel}
                          onChange={(e) => setUpiLabel(e.target.value)}
                        />
                      </div>
                      <Button variant="success" className="w-full" onClick={handleCreateUPI}>
                        Create UPI
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {/* UPI list */}
              {childUpis.length > 0 && (
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-card">
                  <div className="px-6 py-4 border-b border-border bg-muted/30">
                    <h3 className="font-semibold text-foreground">Your UPIs</h3>
                  </div>
                  <div className="divide-y divide-border">
                    {childUpis.map(upi => (
                      <div key={upi.child_upi_id || upi.upi} className="px-6 py-4 flex items-center justify-between">
                        <div>
                          <p className="font-mono font-medium text-foreground">{upi.upi}</p>
                          <p className="text-sm text-muted-foreground">
                            {(() => {
                              const account = accounts.find((acc) => acc.id === upi.payment_account_id);
                              const accountName = account?.account_name || account?.bank_name || "Account";
                              const label = (upi as any).label || (upi as any).name || "No label";
                              return `${accountName} - ${label}`;
                            })()}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs font-medium px-2 py-1 rounded ${
                            (upi.status || "active") === "active"
                              ? "bg-success/10 text-success"
                              : "bg-muted text-muted-foreground"
                          }`}>
                            {upi.status || "active"}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopy(upi.upi)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          {upi.child_upi_id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleToggleChildUpi(
                                  upi.child_upi_id as string,
                                  (upi.status || "active") === "active" ? "disabled" : "active"
                                )
                              }
                              disabled={childUpiBusy[upi.child_upi_id]}
                            >
                              {(upi.status || "active") === "active" ? (
                                <ToggleRight className="h-4 w-4 text-success" />
                              ) : (
                                <ToggleLeft className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Quick links for pending/unverified */}
          {!isVerified && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Quick links</h3>
              <div className="grid md:grid-cols-2 gap-3">
                <QuickLink
                  title="View community"
                  description="Browse verified organizations"
                  onClick={() => router.push("/clients")}
                />
                <QuickLink
                  title="View profile"
                  description="Check your account details"
                  onClick={() => router.push("/profile")}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

const StatCard = ({
  icon,
  label,
  value,
  isStatus
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  isStatus?: boolean;
}) => (
  /** Simple stat display card. */
  <div className="bg-card border border-border rounded-xl p-5 shadow-card">
    <div className="flex items-center gap-3 mb-3">
      <div className="text-muted-foreground">{icon}</div>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
    <p className={`text-2xl font-semibold ${isStatus ? "text-lg" : ""} text-foreground`}>
      {value}
    </p>
  </div>
);

const QuickLink = ({
  title,
  description,
  onClick
}: {
  title: string;
  description: string;
  onClick: () => void;
}) => (
  /** Small CTA button used for quick links. */
  <button
    onClick={onClick}
    className="flex items-center justify-between p-4 bg-card border border-border rounded-lg hover:bg-secondary/50 transition-colors text-left group"
  >
    <div>
      <p className="font-medium text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
  </button>
);
