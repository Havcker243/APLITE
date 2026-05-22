/**
 * Navigation link with active/disabled styling helpers.
 * Used by dashboard sidebars and other menu lists.
 */

import Link, { type LinkProps } from "next/link";
import { useRouter } from "next/router";
import { forwardRef } from "react";
import { cn } from "../utils/cn";

type NavLinkProps = LinkProps & {
  className?: string;
  activeClassName?: string;
  pendingClassName?: string;
  children: React.ReactNode;
};

const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(
  ({ className, activeClassName, pendingClassName, href, children, ...props }, ref) => {
    /** Link wrapper that applies active/pending styles. */
    const router = useRouter();
    const path = typeof href === "string" ? href : href.pathname || "";
    const isActive = router.pathname === path;

    return (
      <Link
        ref={ref}
        href={href}
        className={cn(className, isActive && activeClassName, !router.isReady && pendingClassName)}
        {...props}
      >
        {children}
      </Link>
    );
  }
);

NavLink.displayName = "NavLink";

export { NavLink };
