/**
 * Password reset page. Handles the Supabase recovery link callback and
 * lets the user choose a new password.
 */

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Shield, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { getSupabaseClient } from "../utils/supabase";
import { toast } from "sonner";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    // Supabase embeds the recovery token in the URL hash on redirect.
    // onAuthStateChange fires with SIGNED_IN + type=RECOVERY once parsed.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!password.trim()) {
      toast.warning("Enter a new password.");
      return;
    }
    if (password.length < 8) {
      toast.warning("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.warning("Passwords do not match.");
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      toast.error("Supabase is not configured.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw new Error(error.message);
      toast.success("Password updated. Please sign in.");
      router.push("/login");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unable to update password.";
      toast.error("Reset failed", { description: msg });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex">
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <Link href="/" className="inline-flex items-center gap-2 mb-8 text-muted-foreground hover:text-foreground transition-colors">
            <Shield className="h-6 w-6" />
            <span className="font-semibold">Aplite</span>
          </Link>

          <h1 className="text-2xl font-semibold text-foreground mb-2">Set a new password</h1>
          <p className="text-muted-foreground mb-8">
            {ready
              ? "Choose a new password for your account."
              : "Opening your reset link..."}
          </p>

          {ready && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirm"
                    type={showPassword ? "text" : "password"}
                    placeholder="Repeat your password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <Button type="submit" variant="hero" size="lg" className="w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update password"
                )}
              </Button>
            </form>
          )}

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Back to{" "}
            <Link href="/login" className="text-accent hover:underline font-medium">
              sign in
            </Link>
          </p>
        </div>
      </div>

      <div className="hidden lg:flex flex-1 items-center justify-center gradient-hero p-12">
        <div className="max-w-md text-primary-foreground">
          <h2 className="text-3xl font-semibold mb-4">Secure your account</h2>
          <p className="text-primary-foreground/80 leading-relaxed">
            Choose a strong, unique password. Your payment identity and bank details are protected behind it.
          </p>
        </div>
      </div>
    </div>
  );
}
