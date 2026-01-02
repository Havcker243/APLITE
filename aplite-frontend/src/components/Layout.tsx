/**
 * Top-level layout wrapper for the app.
 * Waits for auth/profile loading before rendering child routes.
 */

import React, { PropsWithChildren } from "react";
import { useAuth } from "../utils/auth";
import { LoadingScreen } from "./LoadingScreen";

export function Layout({ children }: PropsWithChildren) {
  const { token, isBootstrapping } = useAuth();

  if (token && isBootstrapping) {
    return <LoadingScreen />;
  }

  return <>{children}</>;
}
