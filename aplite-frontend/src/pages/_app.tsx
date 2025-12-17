import type { AppProps } from "next/app";
import Head from "next/head";

import { Layout } from "../components/Layout";
import "../styles/globals.css";
import { AuthProvider } from "../utils/auth";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <Head>
        <meta name="theme-color" content="#05060a" />
      </Head>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </AuthProvider>
  );
}
