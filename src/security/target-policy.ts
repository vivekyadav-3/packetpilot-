import { z } from "zod";

/**
 * Target Validation & Security Policy
 * 
 * Prevents SSRF attacks, cloud metadata exfiltration (169.254.169.254),
 * dangerous protocol injection, and denial-of-service via malformed targets.
 */

// Blocked cloud metadata & reserved dangerous IPs
const BLOCKED_HOSTS = new Set([
  "169.254.169.254",         // AWS/GCP/Azure link-local instance metadata
  "metadata.google.internal", // GCP metadata DNS
  "instance-data",            // AWS legacy metadata alias
  "0.0.0.0",                  // Direct bind-all address target
]);

export interface TargetValidationResult {
  allowed: boolean;
  sanitizedHost?: string;
  sanitizedPort?: number;
  sanitizedUrl?: string;
  rejectionReason?: string;
}

export function validateTarget(
  hostInput: string,
  portInput?: number,
  urlInput?: string
): TargetValidationResult {
  // 1. URL Protocol & Structure Validation
  if (urlInput) {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(urlInput);
    } catch {
      return { allowed: false, rejectionReason: "Invalid URL format." };
    }

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return {
        allowed: false,
        rejectionReason: `Prohibited URL protocol '${parsedUrl.protocol}'. Only 'http:' and 'https:' are permitted.`,
      };
    }

    // Host extraction from URL
    const hostFromUrl = parsedUrl.hostname.toLowerCase();
    if (BLOCKED_HOSTS.has(hostFromUrl) || hostFromUrl.startsWith("169.254.")) {
      return {
        allowed: false,
        rejectionReason: `Target host '${hostFromUrl}' is blocked by security policy (Cloud Metadata / Link-Local IP).`,
      };
    }

    const portFromUrl = parsedUrl.port
      ? parseInt(parsedUrl.port, 10)
      : parsedUrl.protocol === "https:"
      ? 443
      : 80;

    return {
      allowed: true,
      sanitizedHost: hostFromUrl,
      sanitizedPort: portFromUrl,
      sanitizedUrl: parsedUrl.toString(),
    };
  }

  // 2. Direct Hostname Validation
  const host = hostInput.trim().toLowerCase();
  if (!host) {
    return { allowed: false, rejectionReason: "Target host cannot be empty." };
  }

  if (BLOCKED_HOSTS.has(host) || host.startsWith("169.254.")) {
    return {
      allowed: false,
      rejectionReason: `Target host '${host}' is blocked by security policy (Cloud Metadata / Link-Local IP).`,
    };
  }

  // 3. Port Boundary Validation
  if (portInput !== undefined) {
    if (!Number.isInteger(portInput) || portInput < 1 || portInput > 65535) {
      return {
        allowed: false,
        rejectionReason: `Port ${portInput} is outside the valid TCP range (1 - 65535).`,
      };
    }
  }

  return {
    allowed: true,
    sanitizedHost: host,
    sanitizedPort: portInput,
  };
}

/**
 * Lightweight In-Memory Sliding-Window Rate Limiter & Concurrency Guard
 */
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private maxRequestsPerMinute: number;
  private activeConcurrency = 0;
  private maxConcurrency: number;

  constructor(maxPerMin = 40, maxConcurrent = 5) {
    this.maxRequestsPerMinute = maxPerMin;
    this.maxConcurrency = maxConcurrent;
  }

  public checkRateLimit(clientIp: string): { allowed: boolean; retryAfterSeconds?: number } {
    const now = Date.now();
    const windowStart = now - 60000;

    let timestamps = this.requests.get(clientIp) || [];
    timestamps = timestamps.filter((t) => t > windowStart);

    if (timestamps.length >= this.maxRequestsPerMinute) {
      const oldest = timestamps[0];
      const retryAfter = Math.ceil((oldest + 60000 - now) / 1000);
      return { allowed: false, retryAfterSeconds: Math.max(1, retryAfter) };
    }

    timestamps.push(now);
    this.requests.set(clientIp, timestamps);
    return { allowed: true };
  }

  public acquireConcurrency(): boolean {
    if (this.activeConcurrency >= this.maxConcurrency) {
      return false;
    }
    this.activeConcurrency++;
    return true;
  }

  public releaseConcurrency(): void {
    if (this.activeConcurrency > 0) {
      this.activeConcurrency--;
    }
  }
}

export const securityLimiter = new RateLimiter();
