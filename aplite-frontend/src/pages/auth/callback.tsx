/**
 * Supabase OAuth callback handler (Pages Router).
 * Exchanges the auth code for a session, then redirects.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseClient } from "../../utils/supabase";

export default function AuthCallback() {
  const router = useRouter();
  const [message, setMessage] = useState("Completing sign-in...");

  useEffect(() => {
    if (!router.isReady) return;

    (async () => {
      const errorParam = router.query.error_description || router.query.error;
      if (errorParam) {
        setMessage(typeof errorParam === "string" ? errorParam : "Authentication failed.");
        return;
      }

      const code = router.query.code;
      const supabase = getSupabaseClient("local");
      if (!supabase) {
        setMessage("Supabase is not configured. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY.");
        return;
      }
      if (typeof code === "string") {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setMessage(error.message || "Unable to complete sign-in.");
          return;
        }
      } else if (typeof window !== "undefined" && window.location.hash) {
        const hash = new URLSearchParams(window.location.hash.slice(1));
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) {
            setMessage(error.message || "Unable to complete sign-in.");
            return;
          }
        }
      }

      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.replace("/dashboard");
      } else {
        router.replace("/login");
      }
    })();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
