import type { VercelRequest, VercelResponse } from "@vercel/node";
import { startTimer } from "../../lib/clockwork-client.js";
import {
  sendBadRequest,
  sendInternalError,
  sendSuccess,
} from "../../lib/response.js";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
    return;
  }

  const { issueKey, comment } = req.body as {
    issueKey?: string;
    comment?: string;
  };

  if (!issueKey || typeof issueKey !== "string") {
    sendBadRequest(res, "Missing required body field: issueKey");
    return;
  }

  try {
    const timer = await startTimer(issueKey, comment);
    sendSuccess(res, { timer }, 201);
  } catch (err) {
    console.error("[POST /api/timers/start] Error:", err);
    sendInternalError(res, "Failed to start timer");
  }
}
