/**
 * Custom Document for global HTML metadata and social tags.
 * Controls head tags rendered on every page.
 */

import { Head, Html, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta charSet="UTF-8" />
        <meta name="description" content="Aplite helps verified businesses share secure payment identifiers." />
        <meta name="author" content="Aplite" />

        <meta property="og:title" content="Aplite" />
        <meta property="og:description" content="Secure payment identifiers for verified businesses." />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/og.png" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@Aplite" />
        <meta name="twitter:image" content="/og.png" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
