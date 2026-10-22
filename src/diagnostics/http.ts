import * as http from "node:http";
import * as https from "node:https";
import { HttpProbeResult } from "./types.js";

/**
 * HTTP Diagnostic Probe
 * 
 * Measures:
 * 1. True TTFB (Time to First Byte): Time until the first chunk of the response is received
 * 2. Total Request Duration: Time to complete header and body processing
 * 3. Distinguishes transport success from application server errors (5xx)
 */
export async function checkHttp(urlStr: string, timeoutMs = 5000): Promise<HttpProbeResult> {
  const startTime = Date.now();

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlStr);
  } catch {
    return {
      target: urlStr,
      url: urlStr,
      timestamp: new Date().toISOString(),
      durationMs: 0,
      status: "FAILED",
      error: `Invalid URL format: ${urlStr}`,
    };
  }

  const isHttps = parsedUrl.protocol === "https:";
  const client = isHttps ? https : http;

  return new Promise((resolve) => {
    let resolved = false;
    let ttfbRecorded: number | undefined = undefined;

    const req = client.request(
      parsedUrl,
      {
        method: "GET",
        headers: {
          "User-Agent": "PacketPilot-Diagnostic-Engine/1.0",
          Accept: "*/*",
        },
        timeout: timeoutMs,
      },
      (res) => {
        // Measure TTFB as the moment headers/first bytes arrive
        ttfbRecorded = Date.now() - startTime;

        const headers: Record<string, string> = {};
        for (const [key, val] of Object.entries(res.headers)) {
          if (val) {
            headers[key] = Array.isArray(val) ? val.join(", ") : val;
          }
        }

        // Consume body stream so the socket cleans up
        res.on("data", () => {
          if (ttfbRecorded === undefined) {
            ttfbRecorded = Date.now() - startTime;
          }
        });

        res.on("end", () => {
          if (resolved) return;
          resolved = true;
          const totalDurationMs = Date.now() - startTime;
          const statusCode = res.statusCode || 0;
          const isAppError = statusCode >= 500 && statusCode < 600;

          resolve({
            target: urlStr,
            url: urlStr,
            timestamp: new Date().toISOString(),
            durationMs: totalDurationMs,
            totalDurationMs,
            ttfbMs: ttfbRecorded || totalDurationMs,
            status: "SUCCESS",
            statusCode,
            statusText: res.statusMessage,
            headers,
            isApplicationError: isAppError,
          });
        });
      }
    );

    req.on("timeout", () => {
      if (resolved) return;
      resolved = true;
      req.destroy();
      const durationMs = Date.now() - startTime;
      resolve({
        target: urlStr,
        url: urlStr,
        timestamp: new Date().toISOString(),
        durationMs,
        status: "FAILED",
        error: `HTTP request timed out after ${timeoutMs}ms`,
      });
    });

    req.on("error", (err: Error) => {
      if (resolved) return;
      resolved = true;
      const durationMs = Date.now() - startTime;
      resolve({
        target: urlStr,
        url: urlStr,
        timestamp: new Date().toISOString(),
        durationMs,
        status: "FAILED",
        error: err.message,
      });
    });

    req.end();
  });
}
