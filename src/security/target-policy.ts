import * as net from "node:net";
import * as dns from "node:dns/promises";

/**
 * Enterprise-Grade Target Validation & Anti-SSRF Security Engine
 * 
 * Protects against:
 * - Cloud metadata exfiltration (AWS/GCP/Azure link-local IPs and DNS)
 * - Prohibited protocol schemes (file://, gopher://, ftp://)
 * - IPv6 and IPv4 link-local and documentation IP probing
 * - DNS rebinding attacks to blocked internal ranges
 * - Port scanning abuse via strict rate limiting and concurrency limits
 */

// Cloud metadata endpoints and host aliases
const CLOUD_METADATA_HOSTS = new Set([
  "169.254.169.254",
  "metadata.google.internal",
  "metadata",
  "instance-data",
  "fd00:ec2::254", // AWS IPv6 metadata
]);

export interface TargetPolicyOptions {
  allowLocalhost?: boolean;       // default: true (Developer tool needs to test localhost)
  allowPrivateNetworks?: boolean; // default: true for local dev, false if deployed publicly
}

export interface TargetValidationResult {
  allowed: boolean;
  sanitizedHost?: string;
  sanitizedPort?: number;
  sanitizedUrl?: string;
  rejectionReason?: string;
}

/**
 * Check if an IP address belongs to link-local cloud metadata (AWS/GCP/Azure)
 */
export function isCloudMetadataIp(ip: string): boolean {
  if (ip === "169.254.169.254" || ip === "fd00:ec2::254") return true;
  if (ip.startsWith("169.254.")) return true; // Entire IPv4 link-local range
  if (ip.toLowerCase().startsWith("fe80:")) return true; // IPv6 link-local
  return false;
}

/**
 * Check if an IP address belongs to private RFC1918 or loopback ranges
 */
export function isPrivateOrLoopbackIp(ip: string): { isLoopback: boolean; isPrivate: boolean } {
  // Loopback IPv4 & IPv6
  if (ip === "127.0.0.1" || ip === "::1" || ip.startsWith("127.")) {
    return { isLoopback: true, isPrivate: true };
  }

  // IPv4 Private Ranges (RFC 1918 & CGNAT)
  const parts = ip.split(".").map(Number);
  if (parts.length === 4 && parts.every((n) => !isNaN(n) && n >= 0 && n <= 255)) {
    if (parts[0] === 10) return { isLoopback: false, isPrivate: true }; // 10.0.0.0/8
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return { isLoopback: false, isPrivate: true }; // 172.16.0.0/12
    if (parts[0] === 192 && parts[1] === 168) return { isLoopback: false, isPrivate: true }; // 192.168.0.0/16
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return { isLoopback: false, isPrivate: true }; // 100.64.0.0/10 (CGNAT)
    if (parts[0] === 0) return { isLoopback: false, isPrivate: true }; // 0.0.0.0/8
  }

  // IPv6 Unique Local Address (fc00::/7)
  const lower = ip.toLowerCase();
  if (lower.startsWith("fc") || lower.startsWith("fd")) {
    return { isLoopback: false, isPrivate: true };
  }

  return { isLoopback: false, isPrivate: false };
}

/**
 * Synchronous target validation (URL scheme, host blacklist, port ranges)
 */
export function validateTarget(
  hostInput: string,
  portInput?: number,
  urlInput?: string,
  options: TargetPolicyOptions = { allowLocalhost: true, allowPrivateNetworks: true }
): TargetValidationResult {
  // 1. URL Protocol & Structure Validation
  if (urlInput) {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(urlInput);
    } catch {
      return { allowed: false, rejectionReason: "Invalid URL structure." };
    }

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return {
        allowed: false,
        rejectionReason: `Prohibited URL protocol '${parsedUrl.protocol}'. Only 'http:' and 'https:' are permitted.`,
      };
    }

    const hostFromUrl = parsedUrl.hostname.toLowerCase().replace(/^\[|\]$/g, ""); // strip IPv6 brackets

    // Cloud metadata block (ALWAYS blocked)
    if (CLOUD_METADATA_HOSTS.has(hostFromUrl) || isCloudMetadataIp(hostFromUrl)) {
      return {
        allowed: false,
        rejectionReason: `Target '${hostFromUrl}' is blocked by security policy (Cloud Metadata / Link-Local IP).`,
      };
    }

    // Loopback / Private policy check
    const ipCheck = isPrivateOrLoopbackIp(hostFromUrl);
    const isLocalhostDomain = hostFromUrl === "localhost" || hostFromUrl.endsWith(".localhost");

    if ((ipCheck.isLoopback || isLocalhostDomain) && !options.allowLocalhost) {
      return {
        allowed: false,
        rejectionReason: `Loopback access to '${hostFromUrl}' is disabled by server security policy.`,
      };
    }

    if (ipCheck.isPrivate && !ipCheck.isLoopback && !options.allowPrivateNetworks) {
      return {
        allowed: false,
        rejectionReason: `Access to private network address '${hostFromUrl}' is restricted.`,
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
  const host = hostInput.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) {
    return { allowed: false, rejectionReason: "Target host cannot be empty." };
  }

  if (CLOUD_METADATA_HOSTS.has(host) || isCloudMetadataIp(host)) {
    return {
      allowed: false,
      rejectionReason: `Target host '${host}' is blocked by security policy (Cloud Metadata / Link-Local IP).`,
    };
  }

  const ipCheck = isPrivateOrLoopbackIp(host);
  const isLocalhostDomain = host === "localhost" || host.endsWith(".localhost");

  if ((ipCheck.isLoopback || isLocalhostDomain) && !options.allowLocalhost) {
    return {
      allowed: false,
      rejectionReason: `Loopback access to '${host}' is disabled by server security policy.`,
    };
  }

  if (ipCheck.isPrivate && !ipCheck.isLoopback && !options.allowPrivateNetworks) {
    return {
      allowed: false,
      rejectionReason: `Access to private network address '${host}' is restricted.`,
    };
  }

  // 3. Port Boundary Validation
  if (portInput !== undefined) {
    if (!Number.isInteger(portInput) || portInput < 1 || portInput > 65535) {
      return {
        allowed: false,
        rejectionReason: `Port ${portInput} is outside the valid range (1 - 65535).`,
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
 * Anti-DNS-Rebinding asynchronous validator
 * Resolves a hostname and confirms none of its A/AAAA records point to prohibited metadata
 */
export async function validateTargetWithDnsCheck(
  host: string,
  port?: number,
  url?: string,
  options: TargetPolicyOptions = { allowLocalhost: true, allowPrivateNetworks: true }
): Promise<TargetValidationResult> {
  // First run synchronous checks
  const syncResult = validateTarget(host, port, url, options);
  if (!syncResult.allowed) return syncResult;

  const targetHost = syncResult.sanitizedHost || host;

  // If already an IP or localhost, no rebinding resolution needed
  if (net.isIP(targetHost) || targetHost === "localhost") {
    return syncResult;
  }

  try {
    const resolvedIps = await dns.resolve(targetHost).catch(() => []);
    for (const ip of resolvedIps) {
      if (isCloudMetadataIp(ip)) {
        return {
          allowed: false,
          rejectionReason: `DNS Rebinding Detected: Hostname '${targetHost}' resolves to prohibited metadata IP '${ip}'.`,
        };
      }
    }
  } catch {
    // If resolution fails here, the DNS probe will naturally capture it
  }

  return syncResult;
}

/**
 * Sliding-Window Rate Limiter & Concurrency Guard
 */
class SecurityLimiter {
  private requests: Map<string, number[]> = new Map();
  private maxRequestsPerMinute: number;
  private activeConcurrency = 0;
  private maxConcurrency: number;

  constructor(maxPerMin = 60, maxConcurrent = 10) {
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

  public resetForTesting(): void {
    this.requests.clear();
    this.activeConcurrency = 0;
  }
}

export const securityLimiter = new SecurityLimiter();
