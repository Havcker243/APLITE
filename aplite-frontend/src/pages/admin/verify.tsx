/**
 * Admin verification queue dashboard.
 * Lists pending sessions and provides approve/reject actions.
 */

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Clock, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { cn } from "../../utils/cn";
import { toast } from "sonner";

type QueueItem = {
  session_id: string;
  org_id: string;
  user_id: number;
  state: string;
  current_step: number;
  risk_level: string;
  last_saved_at?: string | null;
  method: string;
  org: { legal_name?: string; verification_status?: string; status?: string };
  user: { email?: string; first_name?: string; last_name?: string };
};

type VerificationDetail = {
  session: any;
  org: any;
  user: any;
  identity: any;
  payment_account: any;
  method: string;
  formation_documents: Array<{ file_id: string; doc_type?: string; filename?: string; content_type?: string }>;
  identity_document?: { file_id: string; filename?: string; content_type?: string };
  latest_review?: { status?: string; reason?: string; reviewed_at?: string } | null;
  reviews?: Array<{ status?: string; reason?: string; reviewed_at?: string; reviewed_by?: string; method?: string }>;
};

const ADMIN_KEY_STORAGE = "aplite_admin_key";

export default function AdminVerifyPage() {
  const [adminKey, setAdminKey] = useState("");
  const [adminKeyInput, setAdminKeyInput] = useState("");
  const [authed, setAuthed] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<VerificationDetail | null>(null);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Persist admin key only for this session to avoid leaking across browser restarts.
    const saved = window.sessionStorage.getItem(ADMIN_KEY_STORAGE);
    if (saved) {
      setAdminKey(saved);
      setAdminKeyInput(saved);
    }
  }, []);

  useEffect(() => {
    if (!adminKey || authed) return;
    // Attempt auto-login only when a stored key exists.
    void refreshQueue({ persistOnSuccess: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminKey, authed]);

  async function refreshQueue(options?: { persistOnSuccess?: boolean; keyOverride?: string }) {
    setLoadingQueue(true);
    try {
      const headerKey = (options?.keyOverride ?? adminKey).trim();
      if (!headerKey) {
        toast.error("Missing admin key");
        return;
      }
      // Queue endpoint doubles as admin-key validation for initial login.
      const res = await fetch("/api/admin/queue", {
        headers: { "X-Admin-Key": headerKey },
      });
      if (!res.ok) {
        if (res.status === 403) {
          window.sessionStorage.removeItem(ADMIN_KEY_STORAGE);
          setAdminKey("");
          setAuthed(false);
          throw new Error("Invalid admin key.");
        }
        const message = await res.text();
        throw new Error(message || "Unable to load queue");
      }
      const data = (await res.json()) as QueueItem[];
      setQueue(data);
      setAuthed(true);
      if (options?.persistOnSuccess !== false) {
        window.sessionStorage.setItem(ADMIN_KEY_STORAGE, adminKey.trim());
      }
      if (!selectedId && data[0]?.session_id) {
        setSelectedId(data[0].session_id);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to load queue");
    } finally {
      setLoadingQueue(false);
    }
  }

  useEffect(() => {
    if (!selectedId || !authed) {
      setDetail(null);
      return;
    }
    void loadDetail(selectedId);
  }, [selectedId, authed]);

  async function loadDetail(sessionId: string) {
    setLoadingDetail(true);
    try {
      // Load the full onboarding snapshot for the selected session.
      const res = await fetch(`/api/admin/session/${sessionId}`, {
        headers: { "X-Admin-Key": adminKey.trim() },
      });
      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || "Unable to load session details");
      }
      const data = (await res.json()) as VerificationDetail;
      setDetail(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to load session details");
    } finally {
      setLoadingDetail(false);
    }
  }

  async function handleApprove() {
    if (!selectedId) return;
    try {
      const res = await fetch(`/api/admin/session/${selectedId}/approve`, {
        method: "POST",
        headers: { "X-Admin-Key": adminKey.trim() },
      });
      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || "Unable to approve");
      }
      toast.success("Verification approved.");
      setReason("");
      await refreshQueue();
      if (selectedId) await loadDetail(selectedId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to approve");
    }
  }

  async function handleReject() {
    if (!selectedId) return;
    if (!reason.trim()) {
      toast.error("Rejection reason is required.");
      return;
    }
    try {
      const res = await fetch(`/api/admin/session/${selectedId}/reject`, {
        method: "POST",
        headers: { "X-Admin-Key": adminKey.trim(), "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || "Unable to reject");
      }
      toast.success("Verification rejected.");
      setReason("");
      await refreshQueue();
      if (selectedId) await loadDetail(selectedId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to reject");
    }
  }

  async function openFile(fileId: string) {
    try {
      const res = await fetch(`/api/admin/file/${fileId}`, {
        headers: { "X-Admin-Key": adminKey.trim() },
      });
      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || "Unable to load file");
      }
      // Use a blob URL so the browser can render PDF/images without exposing the file id publicly.
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to open file");
    }
  }

  function handleAdminKeySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextKey = adminKeyInput.trim();
    if (!nextKey) return;
    setAdminKey(nextKey);
    void refreshQueue({ keyOverride: nextKey });
  }

  function handleAdminLogout() {
    window.sessionStorage.removeItem(ADMIN_KEY_STORAGE);
    setAdminKey("");
    setAdminKeyInput("");
    setAuthed(false);
    setQueue([]);
    setSelectedId(null);
    setDetail(null);
    setReason("");
  }

  const selectedItem = useMemo(() => queue.find((item) => item.session_id === selectedId) || null, [queue, selectedId]);

  if (!authed) {
    return (
      <div className="min-h-screen bg-background flex">
        <div className="hidden lg:flex flex-1 items-center justify-center gradient-hero p-12">
          <div className="max-w-md text-primary-foreground">
            <h2 className="text-3xl font-semibold mb-4">Admin verification</h2>
            <p className="text-primary-foreground/80 leading-relaxed">
              Review pending submissions, verify documents, and finalize onboarding.
            </p>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-card">
          <div className="flex items-start gap-3 mb-6">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Back to login"
              onClick={() => (window.location.href = "/login")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Admin verification</h1>
              <p className="text-sm text-muted-foreground">Enter your admin key to continue.</p>
            </div>
          </div>
          <form onSubmit={handleAdminKeySubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin_key">Admin key</Label>
              <Input
                id="admin_key"
                type="password"
                value={adminKeyInput}
                onChange={(e) => setAdminKeyInput(e.target.value)}
                placeholder="ADMIN KEY"
                required
              />
            </div>
            <div className="flex gap-3">
              <Button type="submit" variant="hero" className="flex-1">
                Continue
              </Button>
            </div>
          </form>
        </div>
      </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Verification queue</h1>
            <p className="text-muted-foreground text-sm">Review pending call and ID verifications.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => void refreshQueue()} disabled={loadingQueue}>
              Refresh
            </Button>
            <Button variant="ghost" onClick={handleAdminLogout}>
              Sign out
            </Button>
          </div>
        </div>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="rounded-xl border border-border bg-card p-4 h-[70vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs uppercase text-muted-foreground">Pending</div>
            <div className="text-xs text-muted-foreground">{queue.length} total</div>
          </div>
          {loadingQueue && <div className="text-sm text-muted-foreground">Loading queue...</div>}
          {!loadingQueue && queue.length === 0 && <div className="text-sm text-muted-foreground">No pending reviews.</div>}
          <div className="space-y-3">
            {queue.map((item) => {
              const isActive = item.session_id === selectedId;
              const initials =
                (item.user?.first_name?.[0] || "") + (item.user?.last_name?.[0] || "");
              return (
                <button
                  key={item.session_id}
                  type="button"
                  onClick={() => setSelectedId(item.session_id)}
                  className={cn(
                    "w-full text-left rounded-lg border px-3 py-3 transition",
                    isActive ? "border-primary/40 bg-primary/5" : "border-border hover:bg-muted/30"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-foreground">
                      {initials || "?"}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-foreground text-sm">{item.org?.legal_name || "Unknown org"}</div>
                      <div className="text-xs text-muted-foreground">{item.user?.email || "Unknown email"}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.last_saved_at ? new Date(item.last_saved_at).toLocaleString() : "Updated recently"}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground uppercase">
                      <span>{item.state?.replace("_", " ")}</span>
                      <span>{item.method}</span>
                      <span>{item.risk_level}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 h-[70vh] overflow-y-auto">
          {!selectedItem && <div className="text-sm text-muted-foreground">Select a verification request.</div>}
          {selectedItem && (
            <>
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">{selectedItem.org?.legal_name || "Organization"}</h2>
                  <p className="text-sm text-muted-foreground">
                    {selectedItem.user?.email || "Unknown email"} | {selectedItem.method.toUpperCase()}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  {selectedItem.last_saved_at ? new Date(selectedItem.last_saved_at).toLocaleString() : "Unknown time"}
                </div>
              </div>

              {loadingDetail && <div className="text-sm text-muted-foreground">Loading details...</div>}
              {!loadingDetail && detail && (
                <div className="space-y-6">
                  <section className="rounded-lg border border-border p-4">
                    <div className="text-sm font-semibold text-foreground mb-2">Applicant</div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div>Name: {detail.user?.first_name || "-"} {detail.user?.last_name || ""}</div>
                      <div>Email: {detail.user?.email || "-"}</div>
                      <div>User ID: {detail.user?.id || "-"}</div>
                    </div>
                  </section>

                  <section className="rounded-lg border border-border p-4">
                    <div className="text-sm font-semibold text-foreground mb-2">Session</div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div>Session ID: {detail.session?.id || "-"}</div>
                      <div>Org ID: {detail.org?.id || "-"}</div>
                      <div>State: {detail.session?.state || "-"}</div>
                      <div>Method: {detail.method || "-"}</div>
                      <div>Risk: {detail.session?.risk_level || "-"}</div>
                    </div>
                  </section>

                  <section className="rounded-lg border border-border p-4">
                    <div className="text-sm font-semibold text-foreground mb-2">Business info</div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div>Legal name: {detail.org?.legal_name || "-"}</div>
                      <div>EIN: {detail.org?.ein || "-"}</div>
                      <div>Entity type: {detail.org?.entity_type || "-"}</div>
                      <div>Industry: {detail.org?.industry || "-"}</div>
                      <div>Website: {detail.org?.website || "-"}</div>
                      <div>Address: {formatAddress(detail.org?.address)}</div>
                    </div>
                  </section>

                  <section className="rounded-lg border border-border p-4">
                    <div className="text-sm font-semibold text-foreground mb-2">Identity</div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div>Name: {detail.identity?.full_name || "-"}</div>
                      <div>Title: {detail.identity?.title || "-"}</div>
                      <div>Phone: {detail.identity?.phone || "-"}</div>
                    </div>
                    {detail.identity_document && (
                      <div className="mt-3">
                        <Button variant="outline" size="sm" onClick={() => openFile(detail.identity_document!.file_id)}>
                          View ID document
                        </Button>
                      </div>
                    )}
                  </section>

                  <section className="rounded-lg border border-border p-4">
                    <div className="text-sm font-semibold text-foreground mb-2">Formation documents</div>
                    {detail.formation_documents.length === 0 && (
                      <div className="text-sm text-muted-foreground">No formation documents uploaded.</div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {detail.formation_documents.map((doc) => (
                        <Button key={doc.file_id} variant="outline" size="sm" onClick={() => openFile(doc.file_id)}>
                          {doc.doc_type?.replace(/_/g, " ") || "Document"}
                        </Button>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-lg border border-border p-4">
                    <div className="text-sm font-semibold text-foreground mb-2">Bank rails</div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div>Bank: {detail.payment_account?.bank_name || "-"}</div>
                      <div>Account name: {detail.payment_account?.account_name || "-"}</div>
                      <div>ACH routing: {detail.payment_account?.ach_routing || "-"}</div>
                      <div>ACH account: {detail.payment_account?.ach_account || "-"}</div>
                      <div>Wire routing: {detail.payment_account?.wire_routing || "-"}</div>
                      <div>Wire account: {detail.payment_account?.wire_account || "-"}</div>
                      <div>SWIFT: {detail.payment_account?.swift_bic || "-"}</div>
                      <div>IBAN: {detail.payment_account?.iban || "-"}</div>
                    </div>
                  </section>

                  <section className="rounded-lg border border-border p-4">
                    <div className="text-sm font-semibold text-foreground mb-2">Decision</div>
                    <div className="space-y-3">
                      <Textarea
                        placeholder="Rejection reason (required if rejecting)"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={3}
                      />
                      <div className="flex gap-3">
                        <Button variant="success" onClick={handleApprove}>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Approve
                        </Button>
                        <Button variant="destructive" onClick={handleReject}>
                          <XCircle className="h-4 w-4 mr-2" />
                          Reject
                        </Button>
                      </div>
                      {detail.latest_review?.reason && (
                        <div className="text-xs text-muted-foreground">
                          Last decision: {detail.latest_review?.status || "unknown"} | {detail.latest_review?.reason}
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="rounded-lg border border-border p-4">
                    <div className="text-sm font-semibold text-foreground mb-2">Audit trail</div>
                    {detail.reviews && detail.reviews.length > 0 ? (
                      <div className="space-y-2 text-sm text-muted-foreground">
                        {detail.reviews.map((review, index) => (
                          <div key={`${review.reviewed_at || "review"}-${index}`} className="flex flex-col gap-1">
                            <div>
                              <span className="text-foreground font-medium">{review.status || "unknown"}</span>
                              {" | "}
                              <span className="uppercase">{review.method || "review"}</span>
                              {" | "}
                              <span>{review.reviewed_at ? new Date(review.reviewed_at).toLocaleString() : "unknown time"}</span>
                            </div>
                            {review.reason && <div className="text-xs">{review.reason}</div>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">No reviews yet.</div>
                    )}
                  </section>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function formatAddress(address: any) {
  if (!address) return "-";
  const parts = [address.street1, address.street2, address.city, address.state, address.zip, address.country].filter(Boolean);
  return parts.join(", ") || "-";
}
