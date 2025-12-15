import Link from "next/link";
import { useRouter } from "next/router";
import React, { PropsWithChildren } from "react";
import { useAuth } from "../utils/auth";

export function Layout({ children }: PropsWithChildren) {
  const router = useRouter();
  const { user, logout } = useAuth();

  const links = user
    ? [
        { href: "/", label: "Home" },
        { href: "/dashboard", label: "Dashboard" },
      ]
    : [
        { href: "/", label: "Home" },
        { href: "/login", label: "Login" },
        { href: "/signup", label: "Get Started" },
      ];

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="logo">
          <span className="logo-dot" />
          <span>Aplite</span>
        </div>
        <nav className="site-nav">
          {links.map((link) => {
            const active = router.pathname === link.href;
            return (
              <Link key={link.href} href={link.href} className={`nav-link${active ? " nav-link--active" : ""}`}>
                {link.label}
              </Link>
            );
          })}
          {user && (
            <button
              type="button"
              className="nav-link"
              style={{ border: "none", background: "transparent", cursor: "pointer" }}
              onClick={logout}
            >
              Logout
            </button>
          )}
        </nav>
      </header>
      <main className="site-main">{children}</main>
      <footer className="site-footer">Unified Payment Identity Platform</footer>
    </div>
  );
}
