/**
 * Next.js app entrypoint for global providers and layout.
 * Wires auth/onboarding context, global styles, and toast UI.
 */

import type { AppProps } from "next/app";
import Head from "next/head";

import { Layout } from "../components/Layout";
import "../styles/globals.css";
import { AuthProvider } from "../utils/auth";
import { OnboardingProvider } from "../utils/onboardingWizard";
import { Toaster } from "../components/ui/sonner";
import { AppDataProvider } from "../utils/appData";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <Head>
        <meta name="theme-color" content="#05060a" />
      </Head>
      <AppDataProvider>
        <OnboardingProvider>
          <Layout>
            <Component {...pageProps} />
          </Layout>
          <Toaster />
        </OnboardingProvider>
      </AppDataProvider>
    </AuthProvider>
  );
}
