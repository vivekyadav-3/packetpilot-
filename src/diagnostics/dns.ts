import * as dns from "node:dns/promises";
import { DnsProbeResult, DnsRecordResult, DnsQueryOutcome } from "./types.js";

/**
 * Enhanced DNS Diagnostics Probe
 * 
 * Preserves individual resolve4() and resolve6() outcomes and distinguishes:
 * - Successful records
 * - NODATA: Name exists, but requested address family has no records (ENODATA)
 * - FAILED: Resolver error, timeout, or name does not exist (ENOTFOUND, ETIMEOUT)
 * - Fallback to OS getaddrinfo
 */
export async function resolveDns(hostname: string): Promise<DnsProbeResult> {
  const startTime = Date.now();
  const records: DnsRecordResult[] = [];

  let ipv4Outcome: DnsQueryOutcome = { status: "FAILED", records: [] };
  let ipv6Outcome: DnsQueryOutcome = { status: "FAILED", records: [] };
  let finalErrorType: DnsProbeResult["errorType"] = undefined;
  let finalErrorMessage: string | undefined = undefined;

  // 1. Direct IPv4 Query (A records)
  try {
    const ipv4List = await dns.resolve4(hostname);
    ipv4Outcome = { status: "SUCCESS", records: ipv4List };
    for (const ip of ipv4List) {
      records.push({ family: 4, address: ip });
    }
  } catch (err: any) {
    if (err.code === "ENODATA") {
      ipv4Outcome = { status: "NODATA", records: [], error: "No IPv4 A records found for hostname" };
    } else {
      ipv4Outcome = { status: "FAILED", records: [], error: `${err.code || "ERROR"}: ${err.message}` };
    }
  }

  // 2. Direct IPv6 Query (AAAA records)
  try {
    const ipv6List = await dns.resolve6(hostname);
    ipv6Outcome = { status: "SUCCESS", records: ipv6List };
    for (const ip of ipv6List) {
      records.push({ family: 6, address: ip });
    }
  } catch (err: any) {
    if (err.code === "ENODATA") {
      ipv6Outcome = { status: "NODATA", records: [], error: "No IPv6 AAAA records found for hostname" };
    } else {
      ipv6Outcome = { status: "FAILED", records: [], error: `${err.code || "ERROR"}: ${err.message}` };
    }
  }

  // 3. Fallback to OS resolver (getaddrinfo) if resolve4 & resolve6 both yielded 0 records
  if (records.length === 0) {
    try {
      const lookupResult = await dns.lookup(hostname, { all: true });
      for (const res of lookupResult) {
        if (!records.some((r) => r.address === res.address)) {
          records.push({ family: res.family as 4 | 6, address: res.address });
        }
      }
    } catch (err: any) {
      finalErrorMessage = err.message;
      if (err.code === "ENOTFOUND") finalErrorType = "ENOTFOUND";
      else if (err.code === "ETIMEOUT") finalErrorType = "ETIMEOUT";
      else if (err.code === "EAI_AGAIN") finalErrorType = "EAI_AGAIN";
      else finalErrorType = "UNKNOWN";
    }
  }

  const durationMs = Date.now() - startTime;
  const isSuccess = records.length > 0;

  return {
    target: hostname,
    hostname,
    timestamp: new Date().toISOString(),
    durationMs,
    status: isSuccess ? "SUCCESS" : "FAILED",
    records,
    ipv4Query: ipv4Outcome,
    ipv6Query: ipv6Outcome,
    error: isSuccess ? undefined : finalErrorMessage || ipv4Outcome.error || ipv6Outcome.error,
    errorType: isSuccess ? undefined : finalErrorType,
  };
}
