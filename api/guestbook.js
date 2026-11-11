// Vercel function serving /api/guestbook.
import { addCacheTag, dangerouslyDeleteByTag } from "@vercel/functions";
import { cacheTag, recentEntries, submitEntry } from "./_lib/guestbook.js";

const maxBodyLength = 4096;

/**
 * The entry list is cached at Vercel's edge so the database wakes rarely,
 * which keeps it within Neon's free compute allowance. The cache is deleted
 * whenever a note is posted or removed, so changes still appear at once; the
 * one-hour limit only matters if that deletion fails.
 */
const listCacheHeaders = {
  "Cache-Control": "public, max-age=0, must-revalidate",
  "Vercel-CDN-Cache-Control": "max-age=3600",
};

function json(status, data, headers = { "Cache-Control": "no-store" }) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

function sameOrigin(request) {
  const origin = request.headers.get("origin");
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Vercel sets these headers itself, so clients cannot spoof them. */
function clientAddress(request) {
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown"
  );
}

export async function GET() {
  try {
    const entries = await recentEntries();
    await addCacheTag(cacheTag);
    return json(200, { entries }, listCacheHeaders);
  } catch (error) {
    console.error(error);
    return json(500, { error: "Could not load entries." });
  }
}

export async function POST(request) {
  if (!sameOrigin(request))
    return json(403, { error: "Request origin not allowed." });
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return json(400, { error: "Could not process request." });

  const text = await request.text();
  if (text.length > maxBodyLength)
    return json(400, { error: "Note is too long." });

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return json(400, { error: "Could not process request." });
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    return json(400, { error: "Invalid note." });

  let result;
  try {
    result = await submitEntry(body, clientAddress(request));
  } catch (error) {
    console.error(error);
    return json(500, { error: "Could not save your note." });
  }
  if ("error" in result) return json(result.status, { error: result.error });

  if (result.posted) {
    try {
      await dangerouslyDeleteByTag(cacheTag);
    } catch (error) {
      // The note is saved; it appears once the cached list expires.
      console.error(error);
    }
  }
  return json(201, { accepted: true });
}
