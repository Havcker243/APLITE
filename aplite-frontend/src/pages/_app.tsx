import type { AppProps } from "next/app";

import { Layout } from "../components/Layout";
import "../styles/globals.css";
import { AuthProvider } from "../utils/auth";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </AuthProvider>
  );
}
