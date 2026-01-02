/**
 * Admin API proxy for onboarding session details.
 * Fetches session data from the backend using the admin key.
 */

import type { NextApiRequest, NextApiResponse } from "next";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ detail: "Method not allowed" });
  }

  const { id } = req.query;
  if (!id || Array.isArray(id)) {
    return res.status(400).json({ detail: "Missing session id" });
  }

  const adminKey = req.headers["x-admin-key"];
  if (!adminKey || Array.isArray(adminKey)) {
    return res.status(400).json({ detail: "Missing admin key" });
  }
  const headerKey = String(adminKey).trim();

  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/verification/${encodeURIComponent(id)}`, {
      headers: { "X-Admin-Key": headerKey },
    });
    const text = await response.text();
    res.status(response.status).send(text);
  } catch {
    res.status(500).json({ detail: "Unable to load session" });
  }
}
