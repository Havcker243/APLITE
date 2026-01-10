/**
 * UPI resolution page for looking up payment identifiers.
 * Provides a form and result display for resolve responses.
 */

import { useRouter } from "next/router";
import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Key,
  Loader2,
  Search,
  Shield,
} from "lucide-react";

import DashboardLayout from "../components/DashboardLayout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  fetchPublicClients,
  lookupMasterUpi,
  resolveUPI,
  MasterUpiLookupResult,
  ResolveResult,
} from "../utils/api";
import { useAuth } from "../utils/auth";
import { toast } from "sonner";
import { toastApiError } from "../utils/notifications";

const UPI_CORE_PATTERN = /^[A-Z0-9]{14}$/;

function normalizeUpi(input: string) {
  /** Normalize UPI input to uppercase alphanumeric. */
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export default function ResolvePage() {
  const { token, loading, profile } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<"resolve" | "lookup" | "master">("resolve");

  const [upiInput, setUpiInput] = useState("");
  const [isResolving, setIsResolving] = useState(false);
  const [result, setResult] = useState<ResolveResult | null>(null);

  const [orgInput, setOrgInput] = useState("");
  const [orgResult, setOrgResult] = useState<any | null>(null);
  const [orgLoading, setOrgLoading] = useState(false);

  const [masterUpiInput, setMasterUpiInput] = useState("");
  const [masterResult, setMasterResult] = useState<MasterUpiLookupResult | null>(null);
  const [masterLoading, setMasterLoading] = useState(false);

  const onboardingStatus = useMemo(() => String(profile?.onboarding_status || "UNVERIFIED").toUpperCase(), [profile]);
  const isVerified = onboardingStatus === "VERIFIED";

  useEffect(() => {
    if (loading) return;
    if (!token) {
      router.replace("/login");
    }
  }, [loading, token, router]);

  useEffect(() => {
    const queryMode = typeof router.query.mode === "string" ? router.query.mode : "resolve";
    const nextMode = queryMode === "lookup" || queryMode === "master" ? queryMode : "resolve";
    setMode(nextMode);
  }, [router.query.mode]);

  if (!token) return null;

  function handleModeChange(nextMode: string) {
    /** Switch between resolve/lookup/master modes. */
    if (nextMode !== "resolve" && nextMode !== "lookup" && nextMode !== "master") return;
    setMode(nextMode);
    void router.push(`/resolve?mode=${nextMode}`);
  }

  async function handleResolveUPI() {
    /** Resolve a UPI into payout coordinates (verified users only). */
    if (!upiInput.trim()) return;
    setResult(null);

    if (!isVerified) {
      toast.error("Your account must be verified to resolve UPIs.");
      return;
    }
    const normalized = normalizeUpi(upiInput.trim());
    if (!UPI_CORE_PATTERN.test(normalized)) {
      toast.error("Enter a valid UPI (14 letters/numbers).");
      return;
    }

    setIsResolving(true);
    try {
      const response = await resolveUPI({ upi: normalized, rail: "ACH" });
      setResult(response);
    } catch (err) {
      toastApiError(err, "Unable to resolve UPI");
    } finally {
      setIsResolving(false);
    }
  }

  async function handleLookupOrg() {
    /** Lookup a public organization by name. */
    if (!orgInput.trim()) return;
    setOrgResult(null);
    setOrgLoading(true);
    try {
      const response = await fetchPublicClients(orgInput.trim());
      const normalized = (response || []).map((client: any) => {
        const name = client.company_name || client.legal_name || "Unnamed client";
        const country = client.country || "";
        const industry = client.industry || "";
        const website = client.website || "";
        const description = client.description || client.summary || "";
        const masterUPI = client.upi || client.master_upi || "";
        return { ...client, name, country, industry, website, description, masterUPI };
      });
      setOrgResult(normalized[0] || null);
      if (!normalized[0]) {
        toast.error("No organization found.");
      }
    } catch (err) {
      toastApiError(err, "Unable to lookup organization.");
    } finally {
      setOrgLoading(false);
    }
  }

  async function handleLookupMasterUPI() {
    /** Lookup a master UPI and list associated orgs. */
    if (!masterUpiInput.trim()) return;
    setMasterResult(null);
    const normalized = normalizeUpi(masterUpiInput.trim());
    if (!UPI_CORE_PATTERN.test(normalized)) {
      toast.error("Enter a valid master UPI (14 letters/numbers).");
      return;
    }
    setMasterLoading(true);
    try {
      const response = await lookupMasterUpi(normalized);
      setMasterResult(response);
    } catch (err) {
      toastApiError(err, "Unable to lookup master UPI");
    } finally {
      setMasterLoading(false);
    }
  }

  const accountNumber =
    result?.coordinates?.account_number ||
    result?.coordinates?.ach_account ||
    result?.coordinates?.wire_account ||
    result?.coordinates?.iban ||
    "";
  const routingNumber =
    result?.coordinates?.ach_routing ||
    result?.coordinates?.wire_routing ||
    result?.coordinates?.routing_number ||
    "";
  const swiftCode =
    result?.coordinates?.swift || result?.coordinates?.swift_bic || "";
  const businessAddressParts = [
    result?.business?.street1,
    result?.business?.street2,
    result?.business?.city,
    result?.business?.state,
    result?.business?.country,
  ].filter(Boolean);
  const businessAddress = businessAddressParts.length ? businessAddressParts.join(", ") : "";

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="max-w-2xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-foreground mb-2">
              Resolve / Lookup
            </h1>
            <p className="text-muted-foreground">
              Look up payment details, organizations, or master UPIs.
            </p>
          </div>

          {/* Verification warning */}
          {!isVerified && (
            <div className="bg-warning/10 border border-warning/20 rounded-xl p-4 mb-8 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Verification required</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  UPI resolution requires verification. Organization lookups are available to all users.
                </p>
              </div>
            </div>
          )}

          <Tabs value={mode} onValueChange={handleModeChange} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="resolve">Resolve UPI</TabsTrigger>
              <TabsTrigger value="lookup">Lookup Org</TabsTrigger>
              <TabsTrigger value="master">Master UPI</TabsTrigger>
            </TabsList>

            {/* Resolve UPI Tab */}
            <TabsContent value="resolve">
              <div className="bg-card border border-border rounded-xl p-6 shadow-card">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="upi-input">Enter UPI</Label>
                    <div className="flex gap-3">
                      <Input
                        id="upi-input"
                        placeholder="14-character UPI"
                        value={upiInput}
                        onChange={(e) => setUpiInput(e.target.value.toUpperCase())}
                        className="font-mono"
                        disabled={!isVerified}
                      />
                      <Button 
                        variant="hero" 
                        onClick={handleResolveUPI}
                        disabled={!isVerified || isResolving || !upiInput.trim()}
                      >
                        {isResolving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Search className="h-4 w-4 mr-2" />
                            Resolve
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* UPI Result */}
              {result && (
                <div className="mt-6 rounded-xl border p-6 animate-fade-in bg-success/5 border-success/20">
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <CheckCircle2 className="h-5 w-5 text-success" />
                      <span className="font-semibold text-foreground">Resolved successfully</span>
                    </div>

                    <div className="bg-card border border-border rounded-lg p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground uppercase tracking-wide">
                          Secure payout details
                        </span>
                      </div>

                      <div className="space-y-3">
                        {result.business?.legal_name && (
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Business name</span>
                            <span className="text-sm font-medium text-foreground">{result.business.legal_name}</span>
                          </div>
                        )}
                        {businessAddress && (
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Business address</span>
                            <span className="text-sm font-medium text-foreground text-right">{businessAddress}</span>
                          </div>
                        )}
                        {result.business?.website && (
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Website</span>
                            <a
                              href={result.business.website}
                              className="text-sm font-medium text-accent hover:underline"
                              target="_blank"
                              rel="noreferrer"
                            >
                              {result.business.website}
                            </a>
                          </div>
                        )}
                        {result.coordinates?.bank_name && (
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Bank name</span>
                            <span className="text-sm font-medium text-foreground">{result.coordinates.bank_name}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Rail type</span>
                          <span className="text-sm font-medium text-foreground">{result.rail}</span>
                        </div>
                        {accountNumber && (
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Account number</span>
                            <span className="text-sm font-mono font-medium text-foreground">
                              {accountNumber}
                            </span>
                          </div>
                        )}
                        {routingNumber && (
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Routing number</span>
                            <span className="text-sm font-mono font-medium text-foreground">
                              {routingNumber}
                            </span>
                          </div>
                        )}
                        {swiftCode && (
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">SWIFT code</span>
                            <span className="text-sm font-mono font-medium text-foreground">
                              {swiftCode}
                            </span>
                          </div>
                        )}
                        {result.coordinates?.iban && (
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">IBAN</span>
                            <span className="text-sm font-mono font-medium text-foreground">
                              {result.coordinates.iban}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground mt-4 flex items-center gap-2">
                      <Shield className="h-3 w-3" />
                      This resolution has been logged for audit purposes.
                    </p>
                  </div>
                </div>
              )}

            </TabsContent>

            {/* Lookup Org Tab */}
            <TabsContent value="lookup">
              <div className="bg-card border border-border rounded-xl p-6 shadow-card">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Organization name</Label>
                    <div className="flex gap-3">
                      <Input
                        placeholder="Search by name..."
                        value={orgInput}
                        onChange={(e) => setOrgInput(e.target.value)}
                      />
                      <Button variant="hero" onClick={handleLookupOrg} disabled={orgLoading}>
                        {orgLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Building2 className="h-4 w-4 mr-2" />}
                        Lookup
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {orgResult && (
                <div className="mt-6 bg-card border border-border rounded-xl p-6 animate-fade-in">
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <span className="font-semibold text-foreground">{orgResult.name}</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <p>
                      <span className="text-muted-foreground">Industry:</span> {orgResult.industry || "-"}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Country:</span> {orgResult.country || "-"}
                    </p>
                    {orgResult.website && (
                      <p>
                        <span className="text-muted-foreground">Website:</span> {orgResult.website}
                      </p>
                    )}
                    {orgResult.description && (
                      <p>
                        <span className="text-muted-foreground">Description:</span> {orgResult.description}
                      </p>
                    )}
                    {orgResult.masterUPI && (
                      <p>
                        <span className="text-muted-foreground">Master UPI:</span> <code className="font-mono">{orgResult.masterUPI}</code>
                      </p>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Master UPI Tab */}
            <TabsContent value="master">
              <div className="bg-card border border-border rounded-xl p-6 shadow-card">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Master UPI</Label>
                    <div className="flex gap-3">
                      <Input
                        placeholder="14-character UPI"
                        value={masterUpiInput}
                        onChange={(e) => setMasterUpiInput(e.target.value.toUpperCase())}
                        className="font-mono"
                      />
                      <Button variant="hero" onClick={handleLookupMasterUPI} disabled={masterLoading}>
                        {masterLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Key className="h-4 w-4 mr-2" />}
                        Lookup
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {masterResult && (
                <div className="mt-6 bg-card border border-border rounded-xl p-6 animate-fade-in">
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <span className="font-semibold text-foreground">
                      {masterResult.owner.company_name || "Owner profile"}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <p>
                      <span className="text-muted-foreground">Industry:</span> -
                    </p>
                    <p>
                      <span className="text-muted-foreground">Country:</span> {masterResult.owner.country || "-"}
                    </p>
                    {masterResult.owner.summary && (
                      <p>
                        <span className="text-muted-foreground">Description:</span> {masterResult.owner.summary}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Info */}
          <div className="mt-8 p-4 bg-muted/50 rounded-lg border border-border">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Security:</strong> All resolutions are logged for audit and compliance. Only verified businesses can resolve UPIs to payout details.
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
