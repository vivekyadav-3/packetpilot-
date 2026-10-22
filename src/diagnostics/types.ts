export type CheckStatus = "SUCCESS" | "FAILED" | "SKIPPED";

export interface BaseProbeResult {
  target: string;
  timestamp: string;
  durationMs: number;
  status: CheckStatus;
  error?: string;
}

export interface TcpProbeResult extends BaseProbeResult {
  port: number;
  connected: boolean;
  isRefused: boolean;
  isTimeout: boolean;
}

export interface DnsRecordResult {
  family: 4 | 6;
  address: string;
}

export interface DnsProbeResult extends BaseProbeResult {
  hostname: string;
  records: DnsRecordResult[];
  errorType?: "ENOTFOUND" | "ETIMEOUT" | "EAI_AGAIN" | "UNKNOWN";
}

export interface LocalPortProcessInfo {
  pid: number;
  processName: string;
  protocol: "TCP" | "UDP";
  localAddress: string;
  localPort: number;
  state: string;
}

export interface LocalPortProbeResult extends BaseProbeResult {
  port: number;
  isListening: boolean;
  process?: LocalPortProcessInfo;
}

export interface HttpProbeResult extends BaseProbeResult {
  url: string;
  statusCode?: number;
  statusText?: string;
  headers?: Record<string, string>;
  ttfbMs?: number;
}

export interface TlsProbeResult extends BaseProbeResult {
  hostname: string;
  port: number;
  authorized: boolean;
  authorizationError?: string;
  validFrom?: string;
  validTo?: string;
  daysRemaining?: number;
  issuer?: string;
  subject?: string;
  sans?: string[];
}

export interface StructuredEvidence {
  probeId: "localPort" | "tcp" | "dns" | "http" | "tls";
  status: CheckStatus;
  observation: string;
  rawCode?: string;
}

export type ConfidenceCategory = "HIGH" | "MEDIUM" | "LOW";

export interface DiagnosticIncident {
  id: string;
  ruleId: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
  confidence: ConfidenceCategory;
  confidenceRationale: string;
  title: string;
  inferredCause: string;
  observedFacts: string[];
  structuredEvidence: StructuredEvidence[];
  unavailableChecks: string[];
  recommendedAction: string;
  verification: string;
  falsificationCondition: string;

  // Backward-compatibility aliases
  code?: string;
  evidence?: string;
  likelyCause?: string;
  suggestedFix?: string;
  verificationStep?: string;
  confidenceScore?: number;
}

export type DiagnosticFinding = DiagnosticIncident;

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
  findings: DiagnosticIncident[];
  rulesFired: string[];
}
