import type { NextApiRequest, NextApiResponse } from "next";
import { Buffer } from "buffer";

/**
 * Read raw request body (when bodyParser is disabled).
 */
async function getRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    // `req` is an IncomingMessage underneath
    (req as any)
      .on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      })
      .on("end", () => {
        resolve(Buffer.concat(chunks));
      })
      .on("error", (err: Error) => {
        reject(err);
      });
  });
}

export async function proxyRequest(
  req: NextApiRequest,
  res: NextApiResponse,
  baseUrl: string | undefined,
  path: string
) {
  if (!baseUrl) {
    console.error("[PROXY] Missing baseUrl for path", path);
    res.status(500).json({ error: "Target base URL not configured" });
    return;
  }

  // Preserve original query string (?a=1&b=2)
  const urlObj = new URL(req.url ?? "", "http://localhost");
  const search = urlObj.search; // includes '?' or empty

  // Append search to path if it doesn't already contain "?"
  let finalPath = path;
  if (search && !path.includes("?")) {
    finalPath += search;
  }

  const targetUrl = `${baseUrl.replace(/\/+$/, "")}/${finalPath.replace(
    /^\/+/,
    ""
  )}`;

  const { method, headers } = req;

  const init: RequestInit = {
    method,
    headers: {
      ...headers,
      host: undefined,
      "accept-encoding": "gzip,deflate,br",
    } as any,
  };

  // For non-GET/HEAD, forward raw body as-is
  if (method !== "GET" && method !== "HEAD") {
    const rawBody = await getRawBody(req);

    if (rawBody.length > 0) {
      (init as any).body = rawBody;
      // keep original content-type / content-length
    }
  }

  const response = await fetch(targetUrl, init);

  res.status(response.status);

  // CRITICAL: Forward ALL headers from backend (including x-session_id, st-access-token, etc.)
  response.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (
      lower === "transfer-encoding" ||
      lower === "content-encoding" ||
      lower === "content-length"
    ) {
      return;
    }
    res.setHeader(key, value);
  });

  const bodyBuffer = Buffer.from(await response.arrayBuffer());

  // Only log errors (non-2xx status codes) to reduce noise
  if (response.status >= 400) {
    console.error("[PROXY] Error:", {
      targetUrl,
      status: response.status,
      method
    });
  }

  res.send(bodyBuffer);
}


