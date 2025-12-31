/**
 * Authenticated app layout with sidebar navigation.
 * Controls theme toggling, navigation state, and verification gating.
 */

import React, { PropsWithChildren, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  Building2,
  Clock,
  CreditCard,
  FileText,
  Key,
  LayoutDashboard,
  LogOut,
  Moon,
  Search,
  Shield,
  Sun,
  User,
} from "lucide-react";

import { Button } from "./ui/button";
import { cn } from "../utils/cn";
import { useAuth } from "../utils/auth";
import VerificationBadge from "./VerificationBadge";

type NavItem = {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const THEME_STORAGE_KEY = "aplite_theme";

const getNavItems = (status: string): NavItem[] => {
  if (status === "VERIFIED") {
    return [
      { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { path: "/accounts", label: "Accounts", icon: CreditCard },
      { path: "/upis", label: "UPIs", icon: Key },
      { path: "/clients", label: "Clients", icon: Building2 },
      { path: "/resolve", label: "Resolve / Lookup", icon: Search },
      { path: "/profile", label: "Profile", icon: User },
    ];
  }

  return [
    { path: "/onboard", label: "Onboard", icon: FileText },
    { path: "/onboard/pending", label: "Pending", icon: Clock },
    { path: "/profile", label: "Profile", icon: User },
    { path: "/clients", label: "Clients", icon: Building2 },
  ];
};

export default function DashboardLayout({ children }: PropsWithChildren) {
  const router = useRouter();
  const { user, logout, profile } = useAuth();
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const onboardingStatus = useMemo(
    () => String(profile?.onboarding_status || "UNVERIFIED").toUpperCase(),
    [profile]
  );
  const navItems = useMemo(() => getNavItems(onboardingStatus), [onboardingStatus]);
  const isVerified = onboardingStatus === "VERIFIED";

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === "dark" || stored === "light") {
        setTheme(stored);
      }
    } catch {
      // ignore storage failures
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // ignore storage failures
    }
  }, [theme]);

  useEffect(() => {
    if (!isVerified && theme !== "light") {
      setTheme("light");
    }
  }, [isVerified, theme]);
  function handleLogout() {
    logout();
    router.push("/login");
  }

  function isNavDisabled(path: string) {
    const pendingStates = new Set(["PENDING_CALL", "PENDING_REVIEW"]);
    if (path === "/onboard/pending" && !pendingStates.has(onboardingStatus)) return true;
    if (path === "/onboard" && ["VERIFIED", "PENDING_CALL", "PENDING_REVIEW"].includes(onboardingStatus)) return true;
    return false;
  }

  return (
    <div className="min-h-screen bg-background flex">
      <a href="#dashboard-content" className="sr-only">
        Skip to content
      </a>
      <aside className="w-64 bg-card border-r border-border flex flex-col">
        <div className="h-16 px-6 flex items-center border-b border-border">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="font-semibold text-foreground">Aplite</span>
          </Link>
        </div>

        <div className="px-4 py-4 border-b border-border">
          <VerificationBadge status={onboardingStatus} />
        </div>

        <nav className="flex-1 p-4 space-y-1" aria-label="Dashboard navigation">
          {navItems.map(({ path, label, icon: Icon }) => {
            const isActive = router.pathname === path;
            const disabled = isNavDisabled(path);
            const classes = cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
              isActive
                ? "bg-secondary text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
              disabled && "opacity-50 cursor-not-allowed pointer-events-none"
            );

            if (disabled) {
              return (
                <span key={path} className={classes}>
                  <Icon className="h-4 w-4" />
                  {label}
                </span>
              );
            }

            return (
              <Link key={path} href={path} className={classes}>
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          {isVerified && (
            <button
              type="button"
              onClick={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors mb-3"
            >
              {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              {theme === "light" ? "Dark mode" : "Light mode"}
            </button>
          )}

          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
              <User className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{user?.email || "User"}</p>
            </div>
          </div>

          <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign out
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto" id="dashboard-content">
        {children}
      </main>
    </div>
  );
}
