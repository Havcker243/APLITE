/**
 * User profile and organization summary page.
 * Allows updates to profile fields and onboarding metadata.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { AlertCircle, Building2, Calendar, CheckCircle2, Clock, User as UserIcon } from "lucide-react";
import { getCalApi } from "@calcom/embed-react";

import DashboardLayout from "../components/DashboardLayout";
import { YearInput } from "../components/YearInput";
import { onboardingReset, updateOnboardingProfile, updateProfile, User } from "../utils/api";
import { useAuth } from "../utils/auth";
import { CA_PROVINCES, COUNTRIES, isCanada, isUnitedStates, US_STATES } from "../utils/geo";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { cn } from "../utils/cn";
import { toast } from "sonner";
import { normalizeCalLink } from "../utils/cal";

const initialState = {
  company_name: "",
  summary: "",
  established_year: "",
  state: "",
  country: "",
};

export default function ProfilePage() {
  const router = useRouter();
  const { token, loading, profile, refreshProfile } = useAuth();
  const [account, setAccount] = useState<User | null>(null);
  const [onboarding, setOnboarding] = useState<any | null>(null);
  const [organization, setOrganization] = useState<any | null>(null);
  const [stats, setStats] = useState<{ payment_accounts: number; upis: number } | null>(null);
  const [form, setForm] = useState(initialState);
  const [saving, setSaving] = useState(false);

  const calLink = process.env.NEXT_PUBLIC_CAL_LINK || "";
  const calEmbedLink = normalizeCalLink(calLink);

  const isUS = isUnitedStates(form.country);
  const isCA = isCanada(form.country);

  useEffect(() => {
    if (loading) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    void loadProfile();
  }, [loading, token, router]);

  useEffect(() => {
    if (!calEmbedLink) return;
    (async function initCal() {
      const cal = await getCalApi({ namespace: "30min" });
      cal("ui", { hideEventTypeDetails: false, layout: "month_view" });
    })();
  }, [calEmbedLink]);

  async function loadProfile() {
    try {
      const details = await refreshProfile();
      if (!details) {
        toast.error("Unable to load profile");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to load profile");
    }
  }

  useEffect(() => {
    if (!profile) return;
    setAccount(profile.user);
    setOnboarding(profile.onboarding);
    setOrganization(profile.organization);
    setStats(profile.stats);

    const accountProfile = profile.user;
    const org = profile.organization as any;
    const addr = (org?.address as any) || {};
    const formationYear =
      typeof org?.formation_date === "string" && org.formation_date.length >= 4
        ? Number(org.formation_date.slice(0, 4))
        : undefined;

    setForm({
      company_name: accountProfile.company_name || accountProfile.company || org?.legal_name || "",
      summary: accountProfile.summary || org?.description || "",
      established_year: accountProfile.established_year
        ? String(accountProfile.established_year)
        : formationYear
        ? String(formationYear)
        : "",
      state: accountProfile.state || addr.state || "",
      country: accountProfile.country || addr.country || "",
    });
  }, [profile]);

  function handleChange(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEditProfile) {
      toast.error("Complete onboarding before editing your profile.");
      return;
    }
    setSaving(true);
    try {
      const updates: Promise<unknown>[] = [];
      if (organization) {
        updates.push(
          updateOnboardingProfile({
            dba: organization.dba ?? null,
            industry: organization.industry ?? null,
            website: organization.website ?? null,
            description: organization.description ?? null,
            address: organization.address ?? null,
          })
        );
      }
      updates.push(
        updateProfile({
          company_name: form.company_name,
          summary: form.summary,
          established_year: form.established_year ? Number(form.established_year) : undefined,
          state: form.state,
          country: form.country,
        })
      );
      await Promise.all(updates);
      toast.success("Profile updated");
      void loadProfile();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to update profile");
    } finally {
      setSaving(false);
    }
  }

  const onboardingState = useMemo(() => String(onboarding?.state || "NOT_STARTED"), [onboarding]);

  if (!token) return null;

  const createdAt = account?.created_at ? new Date(account.created_at) : null;
  const createdAtLabel = createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt.toLocaleString() : account?.created_at || "-";
  const fullName = account ? `${account.first_name || ""} ${account.last_name || ""}`.trim() : "";
  const displayName = fullName || account?.company_name || account?.company || account?.email || "-";
  const isVerified = onboardingState === "VERIFIED";
  const isPending = onboardingState === "PENDING_CALL" || onboardingState === "PENDING_REVIEW";
  const isRejected = onboardingState === "REJECTED";
  const rejectionReason = profile?.verification_review?.reason || "";
  const canEditProfile = isVerified;

  const orgAddress = organization?.address || {};
  const addressLine = orgAddress
    ? [orgAddress.street1, orgAddress.street2, orgAddress.city, orgAddress.state, orgAddress.zip, orgAddress.country]
        .filter(Boolean)
        .join(", ")
    : "";
  const addressLocked = Boolean(onboarding?.address_locked);
  const orgUpi = organization?.issued_upi || organization?.upi || account?.master_upi || "-";

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="max-w-2xl">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-foreground mb-2">Profile</h1>
            <p className="text-muted-foreground">Your account details and business profile information.</p>
          </div>

          <div
            className={cn(
              "rounded-xl border p-6 mb-6",
              isVerified && "bg-success/5 border-success/20",
              isPending && "bg-warning/5 border-warning/20",
              isRejected && "bg-destructive/5 border-destructive/20",
              !isVerified && !isPending && "bg-muted/50"
            )}
          >
            <div className="flex items-start gap-4">
              <div
                className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center",
                  isVerified && "bg-success/10",
                  isPending && "bg-warning/10",
                  !isVerified && !isPending && "bg-muted"
                )}
              >
                {isVerified ? (
                  <CheckCircle2 className="h-6 w-6 text-success" />
                ) : isPending ? (
                  <Clock className="h-6 w-6 text-warning" />
                ) : isRejected ? (
                  <AlertCircle className="h-6 w-6 text-destructive" />
                ) : (
                  <AlertCircle className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-foreground">
                  {isVerified ? "Verified" : isPending ? "Pending verification" : isRejected ? "Rejected" : "Unverified"}
                </h2>
                <p className="text-muted-foreground mt-1">
                  {isVerified
                    ? "Your business has been verified. You have full access to all features."
                    : isPending
                    ? "Your information is being reviewed. We'll update your status after manual verification."
                    : isRejected
                    ? "Your verification was rejected. Please review the reason and resubmit."
                    : "Complete onboarding to start verification."}
                </p>

                {isPending && onboardingState === "PENDING_CALL" && (
                  <div className="mt-4">
                    {calEmbedLink ? (
                      <Button
                        variant="outline"
                        size="sm"
                        data-cal-namespace="30min"
                        data-cal-link={calEmbedLink}
                        data-cal-config='{"layout":"month_view"}'
                      >
                        <Calendar className="h-4 w-4 mr-2" />
                        Reschedule call
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => router.push("/onboard/step-6")}>
                        <Calendar className="h-4 w-4 mr-2" />
                        Schedule verification call
                      </Button>
                    )}
                  </div>
                )}
                {isRejected && (
                  <div className="mt-4 space-y-3">
                    {rejectionReason && (
                      <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                        {rejectionReason}
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        await onboardingReset();
                        await loadProfile();
                        router.push("/onboard");
                      }}
                    >
                      Restart onboarding
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-card mb-6">
            <div className="px-6 py-4 border-b border-border bg-muted/30 flex items-center gap-3">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold text-foreground">Business Information</h3>
            </div>
            <div className="p-6 space-y-4">
              <ProfileField label="Legal name" value={organization?.legal_name || "-"} />
              <ProfileField label="Entity type" value={organization?.entity_type || "-"} />
              <ProfileField label="Industry" value={organization?.industry || "-"} />
              <ProfileField label="Country" value={orgAddress.country || "-"} />
              <ProfileField label="Address" value={addressLine || "-"} />
              {organization?.website && <ProfileField label="Website" value={organization.website} />}
              {organization?.description && <ProfileField label="Description" value={organization.description} />}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-card mb-6">
            <div className="px-6 py-4 border-b border-border bg-muted/30">
              <h3 className="font-semibold text-foreground">Organization UPI</h3>
            </div>
            <div className="p-6">
              <p className="font-mono text-lg text-foreground">{orgUpi}</p>
              <p className="text-sm text-muted-foreground mt-2">
                This is your organization master payment identifier.
              </p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-card mb-6">
            <div className="px-6 py-4 border-b border-border bg-muted/30 flex items-center gap-3">
              <UserIcon className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold text-foreground">Account Holder</h3>
            </div>
            <div className="p-6 space-y-4">
              <ProfileField label="Full name" value={fullName || "-"} />
              <ProfileField label="Email" value={account?.email || "-"} />
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-card">
            <div className="px-6 py-4 border-b border-border bg-muted/30">
              <h3 className="font-semibold text-foreground">Edit profile</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Signed in as {account?.email || "-"}. Created {createdAtLabel}.
              </p>
            </div>
            <div className="p-6">
              {!canEditProfile && (
                <div className="mb-4 rounded-lg border border-warning/20 bg-warning/5 p-3 text-sm text-warning">
                  Complete onboarding to unlock profile edits.
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-muted-foreground">Business profile</h3>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="dba">DBA (optional)</Label>
                        <Input
                          id="dba"
                          name="dba"
                          value={organization?.dba || ""}
                          onChange={(e) => setOrganization((prev: any) => ({ ...(prev || {}), dba: e.target.value }))}
                          placeholder="Doing business as"
                          disabled={!canEditProfile}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="industry">Industry (optional)</Label>
                        <Input
                          id="industry"
                          name="industry"
                          value={organization?.industry || ""}
                          onChange={(e) => setOrganization((prev: any) => ({ ...(prev || {}), industry: e.target.value }))}
                          placeholder="e.g. Software"
                          disabled={!canEditProfile}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="website">Website (optional)</Label>
                        <Input
                          id="website"
                          name="website"
                          value={organization?.website || ""}
                          onChange={(e) => setOrganization((prev: any) => ({ ...(prev || {}), website: e.target.value }))}
                          placeholder="example.com"
                          disabled={!canEditProfile}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="description">Business Description (optional)</Label>
                        <Textarea
                          id="description"
                          name="description"
                          value={organization?.description || ""}
                          onChange={(e) => setOrganization((prev: any) => ({ ...(prev || {}), description: e.target.value }))}
                          rows={4}
                          placeholder="What does your business do?"
                          disabled={!canEditProfile}
                        />
                      </div>
                      <div className="rounded-lg border border-border bg-muted/30 p-4">
                        <span className="text-sm font-medium text-foreground">Business Address</span>
                        <p className="text-sm text-muted-foreground mt-2">{addressLine || "-"}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {addressLocked ? "Address is locked from onboarding Step 1." : "Address can be updated before it becomes locked."}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-muted-foreground">Public profile</h3>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="company_name">Company Name</Label>
                        <Input
                          id="company_name"
                          name="company_name"
                          value={form.company_name}
                          onChange={handleChange}
                          required
                          disabled={!canEditProfile}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="established_year">Year Established</Label>
                        <YearInput
                          id="established_year"
                          name="established_year"
                          value={form.established_year}
                          onChange={(value) => setForm((p) => ({ ...p, established_year: value }))}
                          disabled={!canEditProfile}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="state">State/Region</Label>
                        <Input
                          id="state"
                          name="state"
                          list={isUS ? "us-states" : isCA ? "ca-provinces" : undefined}
                          value={form.state}
                          onChange={handleChange}
                          placeholder={isUS ? "CA" : isCA ? "ON" : "State / Region"}
                          disabled={!canEditProfile}
                        />
                        {isUS && (
                          <datalist id="us-states">
                            {US_STATES.map((s) => (
                              <option key={s} value={s} />
                            ))}
                          </datalist>
                        )}
                        {isCA && (
                          <datalist id="ca-provinces">
                            {CA_PROVINCES.map((p) => (
                              <option key={p} value={p} />
                            ))}
                          </datalist>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="country">Country</Label>
                        <Input
                          id="country"
                          name="country"
                          list="countries"
                          value={form.country}
                          onChange={(e) => {
                            const value = e.target.value;
                            setForm((prev) => ({ ...prev, country: value, state: "" }));
                          }}
                          required
                          disabled={!canEditProfile}
                        />
                        <datalist id="countries">
                          {COUNTRIES.map((c) => (
                            <option key={c} value={c} />
                          ))}
                        </datalist>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="summary">Public Summary</Label>
                        <Textarea
                          id="summary"
                          name="summary"
                          value={form.summary}
                          onChange={handleChange}
                          rows={4}
                          disabled={!canEditProfile}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button type="submit" variant="hero" disabled={saving || !canEditProfile}>
                    Save Changes
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function ProfileField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn("text-sm font-medium text-foreground text-right max-w-[60%]", mono && "font-mono")}>{value}</span>
    </div>
  );
}
