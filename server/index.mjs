import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { publicEntries, submitEntry } from "./guestbook.mjs";

const root = resolve(process.env.PUBLIC_DIR || "dist");
const port = Number(process.env.PORT || 8080);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function baseHeaders(response) {
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  );
  response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  response.setHeader(
    "Permissions-Policy",
    "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  );
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
}

function json(response, status, data) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(data));
}

function clientAddress(request) {
  if (process.env.TRUST_PROXY === "1") {
    const forwarded = request.headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded)
      return forwarded.split(",")[0].trim();
  }
  return request.socket.remoteAddress || "unknown";
}

async function readJson(request) {
  if (!request.headers["content-type"]?.startsWith("application/json"))
    throw new Error("Expected JSON.");
  let text = "";
  for await (const chunk of request) {
    text += chunk;
    if (text.length > 4096) throw new Error("Note is too long.");
  }
  const value = JSON.parse(text);
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid note.");
  return value;
}

async function serveStatic(pathname, response) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    json(response, 400, { error: "Invalid path." });
    return;
  }
  const file = resolve(root, `.${decoded === "/" ? "/index.html" : decoded}`);
  if (!file.startsWith(root + sep)) {
    json(response, 404, { error: "Not found." });
    return;
  }
  try {
    const info = await stat(file);
    if (!info.isFile()) throw new Error("Not a file");
    const ext = file.slice(file.lastIndexOf("."));
    if (!mime[ext]) throw new Error("Unsupported file");
    response.writeHead(200, {
      "Content-Type": mime[ext],
      "Content-Length": info.size,
      "Cache-Control": decoded.startsWith("/_astro/")
        ? "public, max-age=31536000, immutable"
        : "public, max-age=0, must-revalidate",
    });
    response.end(await readFile(file));
  } catch {
    json(response, 404, { error: "Not found." });
  }
}

createServer(async (request, response) => {
  baseHeaders(response);
  const url = new URL(request.url || "/", "http://localhost");
  try {
    if (
      url.pathname === "/health" &&
      ["GET", "HEAD"].includes(request.method || "")
    )
      return json(response, 200, { ok: true });
    if (url.pathname === "/api/guestbook" && request.method === "GET")
      return json(response, 200, { entries: publicEntries() });
    if (url.pathname === "/api/guestbook" && request.method === "POST") {
      const origin = request.headers.origin;
      const host = request.headers.host;
      if (!origin || new URL(origin).host !== host)
        return json(response, 403, { error: "Request origin not allowed." });
      const result = submitEntry(
        await readJson(request),
        clientAddress(request),
      );
      return json(
        response,
        result.error ? (result.rateLimited ? 429 : 400) : 202,
        result.error ? { error: result.error } : { accepted: true },
      );
    }
    if (request.method === "GET" || request.method === "HEAD")
      return await serveStatic(url.pathname, response);
    return json(response, 405, { error: "Method not allowed." });
  } catch (error) {
    console.error(error);
    return json(
      response,
      error instanceof SyntaxError ||
        error.message === "Expected JSON." ||
        error.message === "Note is too long."
        ? 400
        : 500,
      { error: "Could not process request." },
    );
  }
}).listen(port, "0.0.0.0", () => console.log(`Site listening on port ${port}`));
