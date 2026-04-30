/**
 * API key management page for verified users.
 * Keys allow partners to call the resolve endpoint without a user session.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Copy, Key, Loader2, Plus, Trash2 } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Skeleton } from "../components/ui/skeleton";
import DashboardLayout from "../components/DashboardLayout";
import { useAuth } from "../utils/auth";
import { ApiKeyRecord, createApiKey, listApiKeys, revokeApiKey } from "../utils/api";
import { toast } from "sonner";
import { toastApiError } from "../utils/notifications";

export default function ApiKeysPage() {
  const router = useRouter();
  const { token, loading, profile } = useAuth();
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);

  const isVerified = String(profile?.onboarding_status || "").toUpperCase() === "VERIFIED";

  useEffect(() => {
    if (loading) return;
    if (!token) { router.replace("/login"); return; }
    void loadKeys();
  }, [loading, token, router]);

  async function loadKeys() {
    setLoadingKeys(true);
    try {
      const data = await listApiKeys();
      setKeys(data);
    } catch (err) {
      toastApiError(err, "Unable to load API keys");
    } finally {
      setLoadingKeys(false);
    }
  }

  async function handleCreate() {
    if (!newKeyName.trim()) {
      toast.warning("Enter a name for this key.");
      return;
    }
    setCreating(true);
    try {
      const result = await createApiKey(newKeyName.trim());
      setNewKeyValue(result.key);
      setNewKeyName("");
      await loadKeys();
    } catch (err) {
      toastApiError(err, "Unable to create API key");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke() {
    if (!revokeId) return;
    setRevoking(true);
    try {
      await revokeApiKey(revokeId);
      toast.success("API key revoked.");
      setRevokeId(null);
      await loadKeys();
    } catch (err) {
      toastApiError(err, "Unable to revoke key");
    } finally {
      setRevoking(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).catch(() => undefined);
    toast.success("Copied to clipboard.");
  }

  if (!token) return null;

  const activeKeys = keys.filter((k) => k.active);
  const revokedKeys = keys.filter((k) => !k.active);

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="max-w-3xl">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-semibold text-foreground mb-2">API Keys</h1>
              <p className="text-muted-foreground">
                Use API keys to integrate UPI resolution into your systems. Keys authenticate
                requests to the <code className="text-xs bg-muted px-1 py-0.5 rounded">POST /api/resolve</code> endpoint.
              </p>
            </div>
            <Button
              variant="hero"
              onClick={() => setIsCreating(true)}
              disabled={!isVerified}
            >
              <Plus className="h-4 w-4 mr-2" />
              New key
            </Button>
          </div>

          {!isVerified && (
            <div className="mb-6 rounded-lg border border-warning/20 bg-warning/5 p-4 text-sm text-warning">
              Your account must be verified before you can create API keys.
            </div>
          )}

          <div className="mb-4 rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">How to use</p>
            <p>Pass your key in the <code className="bg-muted px-1 rounded">Authorization</code> header:</p>
            <code className="block mt-2 bg-muted px-3 py-2 rounded text-xs font-mono">
              Authorization: ApiKey ak_your_key_here
            </code>
          </div>

          {loadingKeys ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="rounded-lg border border-border p-4">
                  <Skeleton className="h-4 w-40 mb-2" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ))}
            </div>
          ) : activeKeys.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-12 text-center">
              <Key className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No API keys</h3>
              <p className="text-muted-foreground mb-6">Create your first key to start integrating.</p>
              <Button variant="hero" onClick={() => setIsCreating(true)} disabled={!isVerified}>
                <Plus className="h-4 w-4 mr-2" />
                New key
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {activeKeys.map((k) => (
                <div key={k.id} className="rounded-lg border border-border bg-card p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Key className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-foreground text-sm">{k.name}</span>
                      <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{k.key_prefix}...</code>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>Created {new Date(k.created_at).toLocaleDateString()}</span>
                      {k.last_used_at && (
                        <span>Last used {new Date(k.last_used_at).toLocaleDateString()}</span>
                      )}
                      <span className="text-success">Active</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setRevokeId(k.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {revokedKeys.length > 0 && (
            <div className="mt-8">
              <h2 className="text-sm font-medium text-muted-foreground mb-3">Revoked keys</h2>
              <div className="space-y-2">
                {revokedKeys.map((k) => (
                  <div key={k.id} className="rounded-lg border border-border bg-muted/20 p-3 flex items-center justify-between opacity-60">
                    <div className="flex items-center gap-2 text-sm">
                      <Key className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{k.name}</span>
                      <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{k.key_prefix}...</code>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Revoked {k.revoked_at ? new Date(k.revoked_at).toLocaleDateString() : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create key dialog */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create API key</DialogTitle>
            <DialogDescription>
              Give this key a name to identify what it is used for.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="key-name">Key name</Label>
            <Input
              id="key-name"
              placeholder="e.g. Production integration, Partner X"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button>
            <Button variant="hero" onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show new key — one time only */}
      <Dialog open={!!newKeyValue} onOpenChange={() => setNewKeyValue(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Your new API key</DialogTitle>
            <DialogDescription>
              Copy this key now. You will not be able to see it again.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border bg-muted p-3 flex items-center justify-between gap-2">
            <code className="text-xs font-mono break-all text-foreground flex-1">{newKeyValue}</code>
            <Button variant="ghost" size="icon" onClick={() => newKeyValue && copyToClipboard(newKeyValue)}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Use this key in the <code className="bg-muted px-1 rounded">Authorization: ApiKey &lt;key&gt;</code> header.
          </p>
          <DialogFooter>
            <Button variant="hero" onClick={() => setNewKeyValue(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke confirm */}
      <AlertDialog open={!!revokeId} onOpenChange={() => setRevokeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this API key?</AlertDialogTitle>
            <AlertDialogDescription>
              Any integrations using this key will immediately stop working. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={revoking}
            >
              {revoking && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Revoke key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
