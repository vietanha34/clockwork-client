import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getWorklogs } from "../lib/clockwork-client.js";
import {
  sendBadRequest,
  sendInternalError,
  sendSuccess,
} from "../lib/response.js";
import type { WorklogsResponse } from "../lib/types.js";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
    return;
  }

  const { userEmail, date } = req.query;

  if (!userEmail || typeof userEmail !== "string") {
    sendBadRequest(res, "Missing required query parameter: userEmail");
    return;
  }

  const targetDate =
    typeof date === "string"
      ? date
      : new Date().toISOString().split("T")[0] ?? "";

  try {
    const worklogs = await getWorklogs(userEmail, targetDate);

    const response: WorklogsResponse = {
      worklogs,
      total: worklogs.length,
      date: targetDate,
      userEmail,
    };

    sendSuccess(res, response);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[GET /api/worklogs] Error:", err);
    sendInternalError(res, "Failed to fetch worklogs");
  }
}
