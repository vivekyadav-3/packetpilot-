import { HttpProbeResult } from "./types.js";

export async function checkHttp(url: string, timeoutMs = 5000): Promise<HttpProbeResult> {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      redirect: "manual",
    });
    clearTimeout(timeoutId);
    const durationMs = Date.now() - startTime;

    const headers: Record<string, string> = {};
    res.headers.forEach((val, key) => {
      headers[key] = val;
    });

    return {
      target: url,
      url,
      timestamp: new Date().toISOString(),
      durationMs,
      status: "SUCCESS",
      statusCode: res.status,
      statusText: res.statusText,
      headers,
      ttfbMs: durationMs,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    return {
      target: url,
      url,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      status: "FAILED",
      error: err.name === "AbortError" ? `Request timed out after ${timeoutMs}ms` : err.message,
    };
  }
}
