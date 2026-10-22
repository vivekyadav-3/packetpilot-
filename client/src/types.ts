export type CheckStatus = "SUCCESS" | "FAILED" | "SKIPPED";

export interface TcpProbeResult {
  target: string;
  port: number;
  durationMs: number;
  status: CheckStatus;
  connected: boolean;
  isRefused: boolean;
  isTimeout: boolean;
  error?: string;
}

export interface DnsRecordResult {
  family: 4 | 6;
  address: string;
}

export interface DnsProbeResult {
  target: string;
  hostname: string;
  durationMs: number;
  status: CheckStatus;
  records: DnsRecordResult[];
  error?: string;
  errorType?: string;
}

export interface LocalPortProcessInfo {
  pid: number;
  processName: string;
  protocol: "TCP" | "UDP";
  localAddress: string;
  localPort: number;
  state: string;
}

export interface LocalPortProbeResult {
  target: string;
  port: number;
  durationMs: number;
  status: CheckStatus;
  isListening: boolean;
  process?: LocalPortProcessInfo;
  error?: string;
}

export interface HttpProbeResult {
  target: string;
  url: string;
  durationMs: number;
  status: CheckStatus;
  statusCode?: number;
  statusText?: string;
  headers?: Record<string, string>;
  ttfbMs?: number;
  error?: string;
}

export interface TlsProbeResult {
  target: string;
  hostname: string;
  port: number;
  durationMs: number;
  status: CheckStatus;
  authorized: boolean;
  authorizationError?: string;
  validFrom?: string;
  validTo?: string;
  daysRemaining?: number;
  issuer?: string;
  subject?: string;
  sans?: string[];
  error?: string;
}

export interface DiagnosticFinding {
  code: string;
  severity: "critical" | "warning" | "info";
  ruleId?: string;
  confidence: "HIGH" | "MEDIUM" | "LOW" | "high" | "medium" | "low";
  confidenceRationale?: string;
  title: string;
  inferredCause: string;
  observedFacts: string[];
  structuredEvidence?: Array<{
    probeId: string;
    status: string;
    observation: string;
    rawCode?: string;
  }>;
  unavailableChecks?: string[];
  recommendedAction: string;
  verification?: string;
  verificationStep?: string;
  falsificationCondition?: string;
  // Legacy aliases
  confidenceScore?: number;
  evidence?: string;
  likelyCause?: string;
  suggestedFix?: string;
}

export interface DiagnosticReport {
  timestamp: string;
  target: {
    host: string;
    port?: number;
    url?: string;
  };
  probes: {
    dns?: DnsProbeResult;
    tcp?: TcpProbeResult;
    localPort?: LocalPortProbeResult;
    http?: HttpProbeResult;
    tls?: TlsProbeResult;
  };
  findings: DiagnosticFinding[];
  rulesFired?: string[];
}

export interface HistoryItem {
  id: string;
  timestamp: string;
  targetHost: string;
  targetPort?: number;
  targetUrl?: string;
  hasErrors: boolean;
  findingsCount: number;
  report: DiagnosticReport;
}

export interface SystemStatus {
  name: string;
  version: string;
  platform: string;
  arch: string;
  ollamaOnline: boolean;
  model: string;
}
