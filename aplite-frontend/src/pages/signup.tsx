/**
 * Signup page for creating new user accounts.
 * Collects initial identity fields and starts the auth session.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { ArrowRight, Loader2, Lock, Mail, Shield, User, Eye, EyeOff } from "lucide-react";

import { useAuth } from "../utils/auth";
import { getSupabaseClient } from "../utils/supabase";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { toastApiError } from "../utils/notifications";

const initialState = {
  first_name: "",
  last_name: "",
  email: "",
  password: "",
  confirm_password: "",
  accept_terms: false,
};

export default function SignupPage() {
  const router = useRouter();
  const { login, token, loading, refreshProfile } = useAuth();
  const [form, setForm] = useState(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!token) return;
    const next = typeof router.query.next === "string" ? router.query.next : "/dashboard";
    router.replace(next);
  }, [loading, token, router]);

  if (!loading && token) return null;

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    /** Update form state on input changes. */
    const target = event.target;
    const { name, value } = target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    /** Create a Supabase user and route to onboarding. */
    event.preventDefault();
    setSubmitting(true);
    try {
      if (form.password !== form.confirm_password) {
        throw new Error("Passwords do not match.");
      }
      if (form.password.length < 8) {
        throw new Error("Password must be at least 8 characters.");
      }
      if (!form.accept_terms) {
        throw new Error("You must accept the Terms of Service.");
      }
      // Legacy API signup flow (kept for reference):
      // const response = await signup({ ...form });
      // login(response);

      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error("Supabase is not configured.");
      }

      const { data, error } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          data: {
            first_name: form.first_name.trim(),
            last_name: form.last_name.trim(),
          },
        },
      });

      if (error) {
        throw new Error(error.message || "Unable to create account.");
      }

      const accessToken = data.session?.access_token;
      if (accessToken) {
        login(accessToken);
        await refreshProfile();
        router.push("/onboard");
      } else {
        toast.success("Check your email", { description: "Confirm your email to finish creating your account." });
        const email = form.email.trim();
        router.push(`/confirm-email?email=${encodeURIComponent(email)}`);
      }
    } catch (err) {
      toastApiError(err, "Unable to create account");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOAuth(provider: "google" | "apple") {
    /** Start OAuth sign-up with Supabase. */
    const supabase = getSupabaseClient();
    if (!supabase) {
      toast.error("Supabase is not configured.");
      return;
    }
    const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined;
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (error) {
      toast.error("OAuth failed", { description: error.message });
    }
  }

  return (
    <div className="min-h-screen bg-background flex">
      <div className="hidden lg:flex flex-1 items-center justify-center gradient-hero p-12">
        <div className="max-w-md text-primary-foreground">
          <h2 className="text-3xl font-semibold mb-4">Start your verification</h2>
          <p className="text-primary-foreground/80 leading-relaxed mb-6">
            Join businesses that trust Aplite to protect their banking information. Complete verification to unlock secure UPI creation and resolution.
          </p>
          <div className="space-y-3 text-sm text-primary-foreground/70">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground/50" />
              <span>Manual verification process</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground/50" />
              <span>Bank-grade encryption</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground/50" />
              <span>Complete audit logging</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <Link
            href="/"
            className="inline-flex items-center gap-2 mb-8 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Shield className="h-6 w-6" />
            <span className="font-semibold">Aplite</span>
          </Link>

          <h1 className="text-2xl font-semibold text-foreground mb-2">Create your account</h1>
          <p className="text-muted-foreground mb-8">Start the verification process to access Aplite.</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-muted-foreground">Account details</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="first_name">First name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="first_name" name="first_name" value={form.first_name} onChange={handleChange} className="pl-10" required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="last_name">Last name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="last_name" name="last_name" value={form.last_name} onChange={handleChange} className="pl-10" required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Work email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="email" name="email" type="email" autoComplete="email" value={form.email} onChange={handleChange} className="pl-10" required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={handleChange}
                  className="pl-10 pr-10"
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">Minimum 8 characters.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm_password">Confirm password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirm_password"
                  name="confirm_password"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={form.confirm_password}
                  onChange={handleChange}
                  className="pl-10 pr-10"
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="accept_terms"
                checked={form.accept_terms}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, accept_terms: Boolean(checked) }))}
              />
              <Label htmlFor="accept_terms" className="text-sm text-muted-foreground font-normal leading-relaxed cursor-pointer">
                I agree to Aplite&apos;s{" "}
                <Link href="/terms-of-service" className="text-accent hover:underline">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy-policy" className="text-accent hover:underline">
                  Privacy Policy
                </Link>
                , and consent to the verification process.
              </Label>
            </div>

            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                <>
                  Create account
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">or continue with</span>
            </div>
          </div>

          <div className="flex justify-center">
            <button
              type="button"
              className="flex items-center justify-center h-11 px-6 bg-background text-foreground border border-border rounded-lg font-medium transition-colors active:opacity-80 active:scale-[0.98]"
              aria-label="Continue with Google"
              tabIndex={0}
              onClick={() => handleOAuth("google")}
            >
              <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Google
            </button>
          </div>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-accent hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
