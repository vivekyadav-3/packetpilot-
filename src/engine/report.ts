import { DiagnosticReport } from "../diagnostics/types.js";
import { checkTcpPort } from "../diagnostics/tcp.js";
import { resolveDns } from "../diagnostics/dns.js";
import { inspectLocalPort } from "../diagnostics/local-port.js";
import { checkHttp } from "../diagnostics/http.js";
import { inspectTls } from "../diagnostics/tls.js";
import { evaluateDiagnosticRules } from "./rules.js";

export interface RunDiagnosticOptions {
  host: string;
  port?: number;
  url?: string;
}

export async function runFullDiagnostic({ host, port, url }: RunDiagnosticOptions): Promise<DiagnosticReport> {
  const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1";

  // Infer URL if port is provided and url is missing, or vice versa
  let targetUrl = url;
  if (!targetUrl && port) {
    const protocol = port === 443 ? "https" : "http";
    targetUrl = `${protocol}://${host}:${port}`;
  }

  let targetPort = port;
  if (!targetPort && targetUrl) {
    try {
      const parsed = new URL(targetUrl);
      if (parsed.port) {
        targetPort = parseInt(parsed.port, 10);
      } else {
        targetPort = parsed.protocol === "https:" ? 443 : 80;
      }
    } catch {
      // invalid URL format, ignore
    }
  }

  const [dnsResult, tcpResult, localPortResult, httpResult, tlsResult] = await Promise.all([
    // DNS probe
    !isLocal ? resolveDns(host) : Promise.resolve(undefined),
    // TCP probe
    targetPort ? checkTcpPort({ host, port: targetPort }) : Promise.resolve(undefined),
    // Local port probe (Windows process detection)
    isLocal && targetPort ? inspectLocalPort(targetPort) : Promise.resolve(undefined),
    // HTTP probe
    targetUrl ? checkHttp(targetUrl) : Promise.resolve(undefined),
    // TLS probe
    targetUrl?.startsWith("https://") || targetPort === 443
      ? inspectTls(host, targetPort || 443)
      : Promise.resolve(undefined),
  ]);

  const probes: DiagnosticReport["probes"] = {
    dns: dnsResult,
    tcp: tcpResult,
    localPort: localPortResult,
    http: httpResult,
    tls: tlsResult,
  };

  const { findings, rulesFired } = evaluateDiagnosticRules(probes, host, targetPort);

  return {
    timestamp: new Date().toISOString(),
    target: { host, port: targetPort, url: targetUrl },
    probes,
    findings,
    rulesFired,
  };
}
