import * as dns from "node:dns/promises";
import { DnsProbeResult, DnsRecordResult } from "./types.js";

export async function resolveDns(hostname: string): Promise<DnsProbeResult> {
  const startTime = Date.now();
  const records: DnsRecordResult[] = [];
  let errorType: DnsProbeResult["errorType"] = undefined;
  let errorMessage: string | undefined = undefined;

  // Try direct DNS query for IPv4 (A records)
  try {
    const ipv4List = await dns.resolve4(hostname);
    for (const ip of ipv4List) {
      records.push({ family: 4, address: ip });
    }
  } catch {
    // Ignore individual resolve error and fall back to lookup
  }

  // Try direct DNS query for IPv6 (AAAA records)
  try {
    const ipv6List = await dns.resolve6(hostname);
    for (const ip of ipv6List) {
      records.push({ family: 6, address: ip });
    }
  } catch {
    // Ignore individual resolve error and fall back to lookup
  }

  // Fallback to OS resolver (getaddrinfo) if resolve4/6 yield nothing or failed
  if (records.length === 0) {
    try {
      const lookupResult = await dns.lookup(hostname, { all: true });
      for (const res of lookupResult) {
        if (!records.some((r) => r.address === res.address)) {
          records.push({ family: res.family as 4 | 6, address: res.address });
        }
      }
    } catch (err: any) {
      errorMessage = err.message;
      if (err.code === "ENOTFOUND") errorType = "ENOTFOUND";
      else if (err.code === "ETIMEOUT") errorType = "ETIMEOUT";
      else if (err.code === "EAI_AGAIN") errorType = "EAI_AGAIN";
      else errorType = "UNKNOWN";
    }
  }

  const durationMs = Date.now() - startTime;

  return {
    target: hostname,
    hostname,
    timestamp: new Date().toISOString(),
    durationMs,
    status: records.length > 0 ? "SUCCESS" : "FAILED",
    records,
    error: records.length > 0 ? undefined : errorMessage,
    errorType: records.length > 0 ? undefined : errorType,
  };
}
