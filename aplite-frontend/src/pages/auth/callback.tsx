/**
 * Supabase OAuth callback handler (Pages Router).
 * Exchanges the auth code for a session, then redirects.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../utils/supabase";

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
      if (typeof code === "string") {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setMessage(error.message || "Unable to complete sign-in.");
          return;
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
