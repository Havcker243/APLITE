/**
 * Login page for OTP-based authentication.
 * Collects email and handles the multi-step login flow.
 */

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Shield, Mail, Lock, ArrowRight, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useAuth } from "../utils/auth";
import { getSupabaseClient } from "../utils/supabase";
import { toast } from "sonner";
import { getErrorMessage } from "../utils/notifications";

export default function LoginPage() {
  const router = useRouter();
  const { login: setAuth, token, loading, refreshProfile } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("aplite_auth_storage") : null;
    if (stored === "session") setRememberMe(false);
  }, []);
  // Legacy OTP flow (kept for reference):
  // const [otp, setOtp] = useState("");
  // const [loginId, setLoginId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!token) return;
    const next = typeof router.query.next === "string" ? router.query.next : "/dashboard";
    router.replace(next);
  }, [loading, token, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    /** Authenticate via Supabase and route based on onboarding status. */
    event.preventDefault();
    if (!email || !password) {
      toast.warning("Missing fields", { description: "Please enter your email and password." });
      return;
    }

    setSubmitting(true);
    try {
      // Legacy OTP login flow (kept for reference):
      // const response = await loginStart({ email: email.trim(), password });
      // setLoginId(response.login_id);
      // toast.success("Check your email", { description: "Enter the 6-digit verification code." });

      if (typeof window !== "undefined") {
        window.localStorage.setItem("aplite_auth_storage", rememberMe ? "local" : "session");
      }
      if (typeof window !== "undefined") {
      window.localStorage.setItem("aplite_auth_storage", rememberMe ? "local" : "session");
    }
    const supabase = getSupabaseClient(rememberMe ? "local" : "session");
      if (!supabase) {
        toast.error("Supabase is not configured.");
        return;
      }
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        const message = error.message || "Unable to sign in.";
        if (message.toLowerCase().includes("confirm") && message.toLowerCase().includes("email")) {
          toast.info("Confirm your email", { description: "Please verify your email before signing in." });
          router.push(`/confirm-email?email=${encodeURIComponent(email.trim())}`);
          return;
        }
        throw new Error(message);
      }
      const accessToken = data.session?.access_token;
      if (!accessToken) {
        throw new Error("No session returned.");
      }
      setAuth(accessToken);
      const details = await refreshProfile();
      const status = String(details?.onboarding_status || "NOT_STARTED");
      const next =
        typeof router.query.next === "string"
          ? router.query.next
          : status !== "VERIFIED"
          ? "/onboard"
          : "/dashboard";
      router.push(next);
    } catch (err) {
      toast.error("Login failed", {
        description: getErrorMessage(err, "Unable to start login."),
      });
    } finally {
      setSubmitting(false);
    }
  }

  // Legacy OTP verification flow (kept for reference):
  // async function handleVerify(event: FormEvent<HTMLFormElement>) { ... }

  async function handleOAuth(provider: "google" | "apple") {
    /** Start OAuth sign-in with Supabase. */
    const supabase = getSupabaseClient(rememberMe ? "local" : "session");
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

  async function handleForgotPassword() {
    /** Trigger a Supabase password reset email. */
    if (!email.trim()) {
      toast.warning("Enter your email first.");
      return;
    }
    const supabase = getSupabaseClient(rememberMe ? "local" : "session");
    if (!supabase) {
      toast.error("Supabase is not configured.");
      return;
    }
    const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/login` : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    if (error) {
      toast.error("Reset failed", { description: error.message });
      return;
    }
    toast.success("Check your email", { description: "We sent a password reset link." });
  }

  if (!loading && token) return null;

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <Link href="/" className="inline-flex items-center gap-2 mb-8 text-muted-foreground hover:text-foreground transition-colors">
            <Shield className="h-6 w-6" />
            <span className="font-semibold">Aplite</span>
          </Link>

          <h1 className="text-2xl font-semibold text-foreground mb-2">
            Welcome back
          </h1>
          <p className="text-muted-foreground mb-8">
            Sign in to your account to continue.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button type="button" className="text-sm text-accent hover:underline" onClick={handleForgotPassword}>
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="**************"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
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
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-current"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                />
                Remember me
              </label>
            </div>

            {/* Legacy OTP input (kept for reference) */}
            {/* {loginId && (
              <div className="space-y-2">
                <Label htmlFor="otp">Verification code</Label>
                <Input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(event) => setOtp(event.target.value)}
                  required
                />
              </div>
            )} */}

            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
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

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className="flex items-center justify-center w-full h-11 px-4 bg-background text-foreground border border-border rounded-lg font-medium transition-colors active:opacity-80 active:scale-[0.98]"
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
            <button
              type="button"
              className="flex items-center justify-center w-full h-11 px-4 bg-black text-white border border-black rounded-lg font-medium transition-colors active:opacity-80 active:scale-[0.98]"
              aria-label="Continue with Apple"
              tabIndex={0}
              onClick={() => handleOAuth("apple")}
            >
              <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
              </svg>
              Apple
            </button>
          </div>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link href="/signup" className="text-accent hover:underline font-medium">
              Start verification
            </Link>
          </p>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Admin access?{" "}
            <Link href="/admin/verify" className="text-accent hover:underline font-medium">
              Open admin verification
            </Link>
          </p>
        </div>
      </div>

      {/* Right side - Visual */}
      <div className="hidden lg:flex flex-1 items-center justify-center gradient-hero p-12">
        <div className="max-w-md text-primary-foreground">
          <h2 className="text-3xl font-semibold mb-4">
            Secure payment identifiers
          </h2>
          <p className="text-primary-foreground/80 leading-relaxed">
            Access your dashboard to manage UPIs, payout accounts, and resolution requests. All activity is logged and encrypted.
          </p>
        </div>
      </div>
    </div>
  );
}
