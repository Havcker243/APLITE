/** @type {import('next').NextConfig} */
const apiOriginRaw = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const apiOrigin = apiOriginRaw.trim().replace(/\/+$/, "");
const isProd = process.env.NODE_ENV === "production";
const useProxy = process.env.NEXT_PUBLIC_API_PROXY === "1";

// React Refresh in dev relies on eval; loosen CSP only in development.
const csp = [
  "default-src 'self'",
  `script-src 'self' https://app.cal.com${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://app.cal.com https://cal.com https://api.cal.com https://dkmiberadlbashogpdrp.supabase.co https://*.supabase.co " + apiOrigin,
  "frame-ancestors 'none'",
  "frame-src 'self' https://cal.com https://app.cal.com",
  "base-uri 'self'",
  `form-action 'self' ${apiOrigin} https://cal.com https://app.cal.com`,
].join("; ");

const nextConfig = {
  async rewrites() {
    if (!useProxy) return [];
    return [
      {
        source: "/api/:path*",
        destination: `${apiOrigin}/api/:path*`,
      },
      {
        source: "/onboarding/:path*",
        destination: `${apiOrigin}/onboarding/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: csp,
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
