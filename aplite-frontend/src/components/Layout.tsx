import Link from "next/link";
import { useRouter } from "next/router";
import React, { PropsWithChildren, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../utils/auth";
import { fetchProfileDetails } from "../utils/api";

const THEME_STORAGE_KEY = "aplite_theme";

export function Layout({ children }: PropsWithChildren) {
  const router = useRouter();
  const { user, token, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "dark";
    try {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === "dark" || stored === "light") return stored;
    } catch {
      // ignore storage failures
    }
    return "dark";
  });
  const [isVerified, setIsVerified] = useState<boolean>(false);

  const accountLabel = useMemo(() => {
    if (!user) return "";
    const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim();
    return fullName || user.company_name || user.company || user.email;
  }, [user]);

  useEffect(() => {
    if (!token) {
      setIsVerified(false);
      return;
    }
    let canceled = false;
    void fetchProfileDetails()
      .then((details) => {
        if (canceled) return;
        const state = String(details?.onboarding?.state || "NOT_STARTED");
        setIsVerified(state === "VERIFIED");
      })
      .catch(() => {
        if (canceled) return;
        setIsVerified(false);
      });
    return () => {
      canceled = true;
    };
  }, [token]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme === "dark" ? "dark" : "light";
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // ignore storage failures
    }
  }, [theme]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    function onMouseDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (!menuRef.current?.contains(target)) {
        setMenuOpen(false);
      }
    }

    if (!menuOpen) return;
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onMouseDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, [menuOpen]);

  const links = user
    ? isVerified
      ? [
          { href: "/dashboard", label: "Workspace" },
          { href: "/accounts", label: "Accounts" },
          { href: "/resolve", label: "Resolve UPI" },
          { href: "/clients", label: "Directory" },
        ]
      : [
          { href: "/onboard", label: "Onboarding" },
          { href: "/profile", label: "Profile" },
          { href: "/clients", label: "Directory" },
        ]
    : [
        { href: "/", label: "Home" },
        { href: "/clients", label: "Directory" },
        { href: "/login", label: "Login" },
        { href: "/signup", label: "Get Started" },
      ];

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <header className="site-header">
        <Link href={user ? "/dashboard" : "/"} className="logo" aria-label="Aplite home">
          <img src="/logo.png" alt="Aplite" className="logo-img" loading="lazy" decoding="async" />
          <span>Aplite</span>
        </Link>
        <nav className="site-nav" aria-label="Primary navigation">
          {links.map((link) => {
            const active = router.pathname === link.href;
            return (
              <Link key={link.href} href={link.href} className={`nav-link${active ? " nav-link--active" : ""}`}>
                {link.label}
              </Link>
            );
          })}
          <button
            type="button"
            className="nav-link"
            onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            style={{ cursor: "pointer" }}
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>
          {user && (
            <div className="account-menu" ref={menuRef}>
              <button
                type="button"
                className="account-trigger"
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <span className="account-name">{accountLabel}</span>
                <span className="account-caret" aria-hidden="true">
                  ▾
                </span>
              </button>
              {menuOpen && (
                <div className="account-dropdown" role="menu" aria-label="Account menu">
                  <Link href="/profile" role="menuitem" className="account-item" onClick={() => setMenuOpen(false)}>
                    Profile
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    className="account-item"
                    onClick={() => {
                      setMenuOpen(false);
                      logout();
                    }}
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          )}
        </nav>
      </header>
      <main className="site-main" id="main-content">
        {children}
      </main>
      <footer className="site-footer">Unified Payment Identity Platform</footer>
    </div>
  );
}
