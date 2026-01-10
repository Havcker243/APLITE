/**
 * Child UPI management page for verified users.
 * Lists issued UPIs and allows creating or disabling them.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { CheckCircle2, Copy, Key, MoreHorizontal, Plus, XCircle } from "lucide-react";

import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import DashboardLayout from "../components/DashboardLayout";
import { createChildUpi, disableChildUpi, reactivateChildUpi } from "../utils/api";
import { useAuth } from "../utils/auth";
import { useAppData } from "../utils/appData";
import { toast } from "sonner";

type ChildUpi = {
  child_upi_id?: string;
  upi: string;
  payment_account_id: number;
  rail: string;
  bank_name?: string;
  status?: string;
  created_at?: string;
};

export default function UpisPage() {
  const router = useRouter();
  const { token, loading, profile } = useAuth();
  const { accounts, upis, refreshAccounts, refreshUpis } = useAppData();
  const [isCreatingUPI, setIsCreatingUPI] = useState(false);
  const [upiToDisable, setUpiToDisable] = useState<string | null>(null);
  const [newUPI, setNewUPI] = useState({ payoutAccountId: "", label: "" });
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const onboardingStatus = useMemo(
    () => String(profile?.onboarding_status || "UNVERIFIED").toUpperCase(),
    [profile]
  );
  const isVerified = onboardingStatus === "VERIFIED";

  useEffect(() => {
    if (loading) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    void refreshAccounts();
    void refreshUpis();
  }, [loading, token, router, refreshAccounts, refreshUpis]);

  const handleCreateUPI = async () => {
    /** Create a new child UPI for the selected payout account. */
    if (!newUPI.payoutAccountId) {
      toast.warning("Select an account", { description: "Choose a payout account to create a UPI." });
      return;
    }
    try {
      const response = await createChildUpi({
        account_id: Number(newUPI.payoutAccountId),
        name: newUPI.label || undefined,
        type: "payment",
      });
      toast.success("UPI created", { description: `Your new UPI is ${response.upi}` });
      setNewUPI({ payoutAccountId: "", label: "" });
      setIsCreatingUPI(false);
      await refreshUpis({ force: true });
    } catch {
      toast.error("UPI failed", { description: "Unable to create UPI." });
    }
  };

  const handleDisableUPI = async (upiId: string) => {
    /** Disable a child UPI after confirmation. */
    setBusy((prev) => ({ ...prev, [upiId]: true }));
    try {
      await disableChildUpi(upiId);
      toast("UPI disabled", { description: "This UPI can no longer be resolved." });
      setUpiToDisable(null);
      await refreshUpis({ force: true });
    } catch {
      toast.error("Update failed", { description: "Unable to disable UPI." });
    } finally {
      setBusy((prev) => ({ ...prev, [upiId]: false }));
    }
  };

  const handleReactivateUPI = async (upiId: string) => {
    /** Reactivate a disabled child UPI. */
    setBusy((prev) => ({ ...prev, [upiId]: true }));
    try {
      await reactivateChildUpi(upiId);
      toast("UPI reactivated", { description: "This UPI can now be resolved." });
      await refreshUpis({ force: true });
    } catch {
      toast.error("Update failed", { description: "Unable to reactivate UPI." });
    } finally {
      setBusy((prev) => ({ ...prev, [upiId]: false }));
    }
  };

  const copyToClipboard = (text: string) => {
    /** Copy a UPI to clipboard with feedback. */
    navigator.clipboard.writeText(text).catch(() => undefined);
    toast("Copied", { description: "UPI copied to clipboard." });
  };

  const getAccountName = (accountId: number) => {
    /** Resolve the display name for a payout account. */
    const account = accounts.find((a) => a.id === accountId);
    if (!account) return "Unknown";
    return account.account_name || account.bank_name || account.rail || "Account";
  };

  if (!token) return null;

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="max-w-4xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-semibold text-foreground mb-2">
                Payment Identifiers (UPIs)
              </h1>
              <p className="text-muted-foreground">
                Create and manage secure payment identifiers.
              </p>
            </div>

            <Dialog open={isCreatingUPI} onOpenChange={setIsCreatingUPI}>
              <DialogTrigger asChild>
                <Button 
                  variant="hero" 
                  disabled={!accounts.length || !isVerified}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create UPI
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Create new UPI</DialogTitle>
                  <DialogDescription>
                    Generate a secure payment identifier linked to one of your payout accounts.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Payout account *</Label>
                    <Select
                      value={newUPI.payoutAccountId}
                      onValueChange={(value) => setNewUPI((prev) => ({ ...prev, payoutAccountId: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((account) => (
                          <SelectItem key={account.id} value={String(account.id)}>
                            {account.account_name || account.bank_name || account.rail}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="upi-label">Label (optional)</Label>
                    <Input
                      id="upi-label"
                      placeholder="e.g., Invoice payments, Client X"
                      value={newUPI.label}
                      onChange={(event) => setNewUPI((prev) => ({ ...prev, label: event.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground">
                      For your internal reference only
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-muted/50 rounded-lg border border-border">
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">Important:</strong> Share this UPI instead of your bank details.
                    Only verified partners can resolve it into payout information.
                  </p>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreatingUPI(false)}>
                    Cancel
                  </Button>
                  <Button variant="hero" onClick={handleCreateUPI}>
                    Create UPI
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* UPIs list */}
          {upis.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-12 text-center">
              <Key className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No UPIs created
              </h3>
              <p className="text-muted-foreground mb-6">
                {accounts.length === 0 
                  ? "Add a payout account first to create UPIs."
                  : "Create your first UPI to share with partners."}
              </p>
              <Button 
                variant="hero" 
                onClick={() => setIsCreatingUPI(true)}
                disabled={!accounts.length || !isVerified}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create UPI
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {upis.map((upi) => {
                const status = (upi.status || "active").toLowerCase();
                const isActive = status === "active";
                const upiId = upi.child_upi_id || "";
                return (
                  <div
                    key={upi.child_upi_id || upi.upi}
                    className="bg-card border border-border rounded-xl p-5 shadow-card"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          isActive ? "bg-success/10" : "bg-muted"
                        }`}>
                          <Key className={`h-5 w-5 ${
                            isActive ? "text-success" : "text-muted-foreground"
                          }`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <code className="font-mono text-sm font-semibold text-foreground bg-muted px-2 py-1 rounded">
                              {upi.upi}
                            </code>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={() => copyToClipboard(upi.upi)}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {(() => {
                              const accountName = getAccountName(upi.payment_account_id);
                              const label = (upi as any).label || (upi as any).name || "No label";
                              return `${accountName} • ${label}`;
                            })()}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded ${
                              isActive 
                                ? "bg-success/10 text-success" 
                                : "bg-muted text-muted-foreground"
                            }`}>
                              {isActive ? (
                                <CheckCircle2 className="h-3 w-3" />
                              ) : (
                                <XCircle className="h-3 w-3" />
                              )}
                              {isActive ? "Active" : "Disabled"}
                            </span>
                            {upi.created_at && (
                              <span className="text-xs text-muted-foreground">
                                Created {new Date(upi.created_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {isActive ? (
                            <DropdownMenuItem 
                              className="text-destructive"
                              disabled={!upiId}
                              onClick={() => upiId && setUpiToDisable(upiId)}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Disable UPI
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem disabled={!upiId} onClick={() => upiId && handleReactivateUPI(upiId)}>
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Reactivate UPI
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Disable confirmation dialog */}
          <AlertDialog open={!!upiToDisable} onOpenChange={() => setUpiToDisable(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Disable this UPI?</AlertDialogTitle>
                <AlertDialogDescription>
                  Once disabled, this UPI cannot be resolved by anyone. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={() => upiToDisable && handleDisableUPI(upiToDisable)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={upiToDisable ? busy[upiToDisable] : false}
                >
                  Disable UPI
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </DashboardLayout>
  );
}
