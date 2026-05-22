/**
 * Admin API proxy for onboarding file downloads.
 * Forwards file requests to the backend with admin credentials.
 */

import type { NextApiRequest, NextApiResponse } from "next";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const NGROK_SKIP_HEADER: Record<string, string> = API_BASE_URL.includes("ngrok-free.dev")
  ? { "ngrok-skip-browser-warning": "true" }
  : {};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ detail: "Method not allowed" });
  }

  const { file_id } = req.query;
  if (!file_id || Array.isArray(file_id)) {
    return res.status(400).json({ detail: "Missing file id" });
  }

  const adminKey = req.headers["x-admin-key"];
  if (!adminKey || Array.isArray(adminKey)) {
    return res.status(400).json({ detail: "Missing admin key" });
  }
  const headerKey = String(adminKey).trim();

  try {
    const headers: Record<string, string> = { ...NGROK_SKIP_HEADER };
    headers["X-Admin-Key"] = headerKey;
    const response = await fetch(`${API_BASE_URL}/api/admin/verification/file/${encodeURIComponent(file_id)}`, {
      headers,
    });
    res.status(response.status);
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === "transfer-encoding") return;
      res.setHeader(key, value);
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    return res.send(buffer);
  } catch {
    return res.status(500).json({ detail: "Unable to load file" });
  }
}
