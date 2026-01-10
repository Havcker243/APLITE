/**
 * Payment accounts management page.
 * Lists existing rails and allows creating new payment accounts.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { 
  CreditCard, 
  Plus, 
  Lock,
  MoreHorizontal,
  Pencil
} from "lucide-react";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import DashboardLayout from "../components/DashboardLayout";
import { useAuth } from "../utils/auth";
import { useAppData } from "../utils/appData";
import { toast } from "sonner";
import { createAccount, updateAccount } from "../utils/api";
import { requireVerifiedOrRedirect } from "../utils/requireVerified";
import { toastApiError } from "../utils/notifications";

type RailType = "ach" | "wire" | "swift";

export default function Accounts() {
  const router = useRouter();
  const { token, loading, profile } = useAuth();
  const { accounts, refreshAccounts } = useAppData();
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);
  const [editingNickname, setEditingNickname] = useState("");
  const [isSavingNickname, setIsSavingNickname] = useState(false);
  const [newAccount, setNewAccount] = useState({
    nickname: "",
    railType: "ach" as RailType,
    bankName: "",
    accountNumber: "",
    routingNumber: "",
    swiftCode: "",
  });

  useEffect(() => {
    if (loading) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    requireVerifiedOrRedirect({ profile, router });
    void refreshAccounts();
  }, [loading, token, profile, router, refreshAccounts]);

  async function handleAddAccount() {
    /** Validate inputs and create a new payout account. */
    if (!newAccount.bankName || !newAccount.accountNumber) {
      toast.error("Please fill in the required fields.");
      return;
    }

    const rail = newAccount.railType === "ach" ? "ACH" : newAccount.railType === "wire" ? "WIRE_DOM" : "SWIFT";

    try {
      await createAccount({
        rail,
        bank_name: newAccount.bankName,
        account_name: newAccount.nickname || newAccount.bankName,
        ach_routing: newAccount.railType === "ach" ? newAccount.routingNumber : undefined,
        ach_account: newAccount.railType === "ach" ? newAccount.accountNumber : undefined,
        wire_routing: newAccount.railType === "wire" ? newAccount.routingNumber : undefined,
        wire_account: newAccount.railType === "wire" ? newAccount.accountNumber : undefined,
        swift_bic: newAccount.railType === "swift" ? newAccount.swiftCode : undefined,
        iban: newAccount.railType === "swift" ? newAccount.accountNumber : undefined,
      });

      setNewAccount({
        nickname: "",
        railType: "ach",
        bankName: "",
        accountNumber: "",
        routingNumber: "",
        swiftCode: "",
      });
      setIsAddingAccount(false);
      toast.success("Payout account added successfully.");
      await refreshAccounts({ force: true });
    } catch (err) {
      toastApiError(err, "Unable to add payout account");
    }
  }

  async function handleSaveNickname() {
    /** Update the account nickname/display name. */
    if (!editingAccountId) return;
    if (!editingNickname.trim()) {
      toast.error("Please enter a nickname.");
      return;
    }

    setIsSavingNickname(true);
    try {
      await updateAccount(editingAccountId, { account_name: editingNickname.trim() });
      toast.success("Nickname updated");
      setIsEditingNickname(false);
      setEditingAccountId(null);
      setEditingNickname("");
      await refreshAccounts({ force: true });
    } catch (err) {
      toastApiError(err, "Unable to update nickname");
    } finally {
      setIsSavingNickname(false);
    }
  }

  if (!token) return null;

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="max-w-4xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-semibold text-foreground mb-2">
                Payment Accounts
              </h1>
              <p className="text-muted-foreground">
                Manage your payout destinations.
              </p>
            </div>

            <Dialog open={isAddingAccount} onOpenChange={setIsAddingAccount}>
              <DialogTrigger asChild>
                <Button variant="hero">
                  <Plus className="h-4 w-4 mr-2" />
                  Add account
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add payout account</DialogTitle>
                  <DialogDescription>
                    Add a new bank account for receiving payments.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="add-nickname">Account nickname (optional)</Label>
                    <Input
                      id="add-nickname"
                      placeholder="Primary checking"
                      value={newAccount.nickname}
                      onChange={(e) => setNewAccount(prev => ({ ...prev, nickname: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Rail type *</Label>
                    <Select
                      value={newAccount.railType}
                      onValueChange={(value) => setNewAccount(prev => ({ ...prev, railType: value as RailType }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ach">ACH</SelectItem>
                        <SelectItem value="wire">Wire</SelectItem>
                        <SelectItem value="swift">SWIFT</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="add-bankName">Bank name *</Label>
                    <Input
                      id="add-bankName"
                      placeholder="First National Bank"
                      value={newAccount.bankName}
                      onChange={(e) => setNewAccount(prev => ({ ...prev, bankName: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="add-accountNumber">Account number *</Label>
                    <Input
                      id="add-accountNumber"
                      placeholder="123456789012"
                      value={newAccount.accountNumber}
                      onChange={(e) => setNewAccount(prev => ({ ...prev, accountNumber: e.target.value }))}
                    />
                  </div>

                  {newAccount.railType !== "swift" && (
                    <div className="space-y-2">
                      <Label htmlFor="add-routingNumber">Routing number *</Label>
                      <Input
                        id="add-routingNumber"
                        placeholder="123456789"
                        value={newAccount.routingNumber}
                        onChange={(e) => setNewAccount(prev => ({ ...prev, routingNumber: e.target.value }))}
                      />
                    </div>
                  )}

                  {newAccount.railType === "swift" && (
                    <div className="space-y-2">
                      <Label htmlFor="add-swiftCode">SWIFT code *</Label>
                      <Input
                        id="add-swiftCode"
                        placeholder="ABCDUS33"
                        value={newAccount.swiftCode}
                        onChange={(e) => setNewAccount(prev => ({ ...prev, swiftCode: e.target.value }))}
                      />
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddingAccount(false)}>
                    Cancel
                  </Button>
                  <Button variant="hero" onClick={handleAddAccount}>
                    Add account
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Accounts list */}
          {accounts.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-12 text-center">
              <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No payout accounts
              </h3>
              <p className="text-muted-foreground mb-6">
                Add your first payout account to start creating UPIs.
              </p>
              <Button variant="hero" onClick={() => setIsAddingAccount(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add account
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.map((account) => {
                const accountNumber = account.ach_account || account.wire_account || account.iban || "";
                const nickname = account.account_name || account.bank_name || "Account";
                const railLabel = (account.rail || "").toUpperCase();
                return (
                  <div
                    key={account.id}
                    className="bg-card border border-border rounded-xl p-5 shadow-card"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                          <CreditCard className="h-5 w-5 text-foreground" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-foreground">{nickname}</h3>
                            {account.rail_locked && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                                <Lock className="h-3 w-3" />
                                <span>Locked</span>
                              </div>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {account.bank_name} • {railLabel}
                          </p>
                          {accountNumber && (
                            <p className="text-sm text-muted-foreground">
                              ••••{accountNumber.slice(-4)}
                            </p>
                          )}
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditingAccountId(account.id);
                              setEditingNickname(nickname);
                              setIsEditingNickname(true);
                            }}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit nickname
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Info box */}
          <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-border">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Note:</strong> Once an account is linked to a UPI, the rail details become read-only. Only the nickname can be edited.
            </p>
          </div>
        </div>
      </div>

      <Dialog open={isEditingNickname} onOpenChange={setIsEditingNickname}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit nickname</DialogTitle>
            <DialogDescription>Update the display name for this payout account.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="edit-nickname">Nickname</Label>
            <Input
              id="edit-nickname"
              value={editingNickname}
              onChange={(e) => setEditingNickname(e.target.value)}
              placeholder="Primary checking"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditingNickname(false)}>
              Cancel
            </Button>
            <Button variant="hero" onClick={handleSaveNickname} disabled={isSavingNickname}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
