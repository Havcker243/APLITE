import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../utils/auth";

export default function OnboardPage() {
  const { token, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (token) {
      router.replace("/dashboard");
    } else {
      router.replace("/login");
    }
  }, [ready, token]);

  return null;
}
