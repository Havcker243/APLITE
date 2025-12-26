/** @type {import('next').NextConfig} */
const apiOrigin = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const isProd = process.env.NODE_ENV === "production";

// React Refresh in dev relies on eval; loosen CSP only in development.
const csp = [
  "default-src 'self'",
  `script-src 'self' https://app.cal.com${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigin}`,
  "frame-ancestors 'none'",
  "frame-src 'self' https://cal.com https://app.cal.com",
  "base-uri 'self'",
  `form-action 'self' ${apiOrigin}`,
].join("; ");

const nextConfig = {
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
