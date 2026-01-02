/**
 * Normalize Cal.com links for embed usage.
 * Embed expects "username/event-slug" (no protocol, domain, or query).
 */
export function normalizeCalLink(raw: string): string {
  const value = (raw || "").trim();
  if (!value) return "";
  return value
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/^cal\.com\//i, "")
    .split("?", 1)[0]
    .split("#", 1)[0]
    .replace(/^\/+/, "")
    .trim();
}
