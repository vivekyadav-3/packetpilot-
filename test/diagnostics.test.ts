import test from "node:test";
import assert from "node:assert";
import * as http from "node:http";
import * as net from "node:net";
import { evaluateDiagnosticRules } from "../src/engine/rules.js";
import { checkTcpPort } from "../src/diagnostics/tcp.js";
import { checkHttp } from "../src/diagnostics/http.js";
import { inspectLocalPort } from "../src/diagnostics/local-port.js";
import { validateTarget, securityLimiter } from "../src/security/target-policy.js";
import { DiagnosticHistory } from "../src/storage/history.js";
import { DiagnosticReport } from "../src/diagnostics/types.js";

// ============================================================================
// PART 1: CORRELATION ENGINE REGRESSION MATRIX (6 Core Scenarios)
// ============================================================================

test("Matrix 1: No listener + TCP refused -> One unified Service Unavailable incident", () => {
  const { findings, rulesFired } = evaluateDiagnosticRules(
    {
      localPort: {
        target: "localhost:5000",
        port: 5000,
        timestamp: new Date().toISOString(),
        durationMs: 12,
        status: "SUCCESS",
        isListening: false,
      },
      tcp: {
        target: "localhost:5000",
        port: 5000,
        timestamp: new Date().toISOString(),
        durationMs: 8,
        status: "FAILED",
        connected: false,
        isRefused: true,
        isTimeout: false,
      },
    },
    "localhost",
    5000
  );

  assert.strictEqual(findings.length, 1);
  assert.strictEqual(rulesFired.includes("RULE_SERVICE_UNAVAILABLE"), true);
  assert.strictEqual(findings[0].confidence, "HIGH");
  assert.strictEqual(findings[0].structuredEvidence.length, 2);
  assert.ok(findings[0].falsificationCondition.length > 0);
  assert.ok(findings[0].recommendedAction.includes("Start your application"));
});

test("Matrix 2: Listener found + TCP succeeds -> Clean healthy state (0 incidents)", () => {
  const { findings, rulesFired } = evaluateDiagnosticRules(
    {
      localPort: {
        target: "localhost:3000",
        port: 3000,
        timestamp: new Date().toISOString(),
        durationMs: 10,
        status: "SUCCESS",
        isListening: true,
        process: {
          pid: 1234,
          processName: "node.exe",
          protocol: "TCP",
          localAddress: "0.0.0.0",
          localPort: 3000,
          state: "LISTENING",
        },
      },
      tcp: {
        target: "localhost:3000",
        port: 3000,
        timestamp: new Date().toISOString(),
        durationMs: 4,
        status: "SUCCESS",
        connected: true,
        isRefused: false,
        isTimeout: false,
      },
    },
    "localhost",
    3000
  );

  assert.strictEqual(findings.length, 0);
  assert.strictEqual(rulesFired.length, 0);
});

test("Matrix 3: Conflicting evidence (Listener found + TCP refused) -> Flags inconsistency", () => {
  const { findings, rulesFired } = evaluateDiagnosticRules(
    {
      localPort: {
        target: "localhost:8080",
        port: 8080,
        timestamp: new Date().toISOString(),
        durationMs: 14,
        status: "SUCCESS",
        isListening: true,
        process: {
          pid: 5678,
          processName: "python.exe",
          protocol: "TCP",
          localAddress: "127.0.0.1",
          localPort: 8080,
          state: "LISTENING",
        },
      },
      tcp: {
        target: "localhost:8080",
        port: 8080,
        timestamp: new Date().toISOString(),
        durationMs: 3,
        status: "FAILED",
        connected: false,
        isRefused: true,
        isTimeout: false,
      },
    },
    "localhost",
    8080
  );

  assert.strictEqual(findings.length, 1);
  assert.strictEqual(rulesFired.includes("RULE_CONFLICTING_LISTENER_REFUSED"), true);
  assert.strictEqual(findings[0].confidence, "MEDIUM");
  assert.ok(findings[0].title.includes("Conflicting Evidence"));
  assert.ok(findings[0].confidenceRationale.includes("Evidence is conflicting"));
});

test("Matrix 4: TCP timeout -> Diagnoses timeout / packet drop, NOT connection refusal", () => {
  const { findings, rulesFired } = evaluateDiagnosticRules(
    {
      tcp: {
        target: "api.internal:5000",
        port: 5000,
        timestamp: new Date().toISOString(),
        durationMs: 3000,
        status: "FAILED",
        connected: false,
        isRefused: false,
        isTimeout: true,
      },
    },
    "api.internal",
    5000
  );

  assert.strictEqual(findings.length, 1);
  assert.strictEqual(rulesFired.includes("RULE_TCP_CONNECTION_TIMEOUT"), true);
  assert.strictEqual(rulesFired.includes("RULE_SERVICE_UNAVAILABLE"), false);
  assert.strictEqual(findings[0].confidence, "HIGH");
  assert.ok(findings[0].title.includes("Timed Out"));
});

test("Matrix 5: Local inspection skipped -> Diagnoses from available evidence without claiming no listener exists", () => {
  const { findings, rulesFired } = evaluateDiagnosticRules(
    {
      localPort: {
        target: "remote-server:443",
        port: 443,
        timestamp: new Date().toISOString(),
        durationMs: 1,
        status: "SKIPPED",
        isListening: false,
        error: "Non-Windows OS process detection not implemented yet",
      },
      tcp: {
        target: "remote-server:443",
        port: 443,
        timestamp: new Date().toISOString(),
        durationMs: 15,
        status: "FAILED",
        connected: false,
        isRefused: true,
        isTimeout: false,
      },
    },
    "remote-server",
    443
  );

  assert.strictEqual(findings.length, 1);
  assert.strictEqual(rulesFired.includes("RULE_REMOTE_CONNECTION_REFUSED"), true);
  assert.strictEqual(rulesFired.includes("RULE_SERVICE_UNAVAILABLE"), false);
  assert.strictEqual(findings[0].confidence, "MEDIUM");
  assert.ok(findings[0].unavailableChecks.some((c) => c.includes("Local OS Socket")));
});

test("Matrix 6: Internal probe failure -> Reports incomplete diagnostic, not definitive root cause", () => {
  const { findings, rulesFired } = evaluateDiagnosticRules(
    {
      localPort: {
        target: "localhost:5000",
        port: 5000,
        timestamp: new Date().toISOString(),
        durationMs: 5,
        status: "FAILED",
        isListening: false,
        error: "EPERM: Access denied executing netstat binary",
      },
    },
    "localhost",
    5000
  );

  assert.strictEqual(findings.length, 1);
  assert.strictEqual(rulesFired.includes("RULE_PROBE_EXECUTION_FAILURE"), true);
  assert.strictEqual(findings[0].confidence, "LOW");
  assert.ok(findings[0].title.includes("Diagnostic Incomplete"));
});

// ============================================================================
// PART 2: DETERMINISTIC LOCAL SERVER PROBE TESTS (Zero Internet Flakiness)
// ============================================================================

test("Deterministic HTTP Probe: measures True TTFB on local server", async () => {
  const server = http.createServer((_req, res) => {
    // Artificial 50ms processing delay before sending headers
    setTimeout(() => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
    }, 50);
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as net.AddressInfo;
  const testUrl = `http://127.0.0.1:${address.port}/health`;

  try {
    const result = await checkHttp(testUrl, 3000);
    assert.strictEqual(result.status, "SUCCESS");
    assert.strictEqual(result.statusCode, 200);
    assert.ok(result.ttfbMs && result.ttfbMs >= 40, `TTFB should reflect delay, got ${result.ttfbMs}ms`);
    assert.ok(result.totalDurationMs && result.totalDurationMs >= result.ttfbMs);
  } finally {
    server.close();
  }
});

test("Deterministic HTTP Error: classifies HTTP 500 as Application Error", async () => {
  const server = http.createServer((_req, res) => {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Internal Server Error");
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as net.AddressInfo;
  const testUrl = `http://127.0.0.1:${address.port}/crash`;

  try {
    const result = await checkHttp(testUrl, 2000);
    assert.strictEqual(result.statusCode, 500);
    assert.strictEqual(result.isApplicationError, true);

    const { findings, rulesFired } = evaluateDiagnosticRules({ http: result }, "127.0.0.1", address.port);
    assert.ok(rulesFired.includes("RULE_HTTP_SERVER_ERROR"));
    assert.strictEqual(findings[0].severity, "CRITICAL");
  } finally {
    server.close();
  }
});

test("Deterministic TCP Probe: verifies active listener vs closed port", async () => {
  const server = net.createServer((socket) => socket.end());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as net.AddressInfo;

  try {
    // Active listener
    const activeRes = await checkTcpPort({ host: "127.0.0.1", port: address.port });
    assert.strictEqual(activeRes.connected, true);
    assert.strictEqual(activeRes.isRefused, false);
  } finally {
    server.close();
  }

  // Same port now closed
  const closedRes = await checkTcpPort({ host: "127.0.0.1", port: address.port });
  assert.strictEqual(closedRes.connected, false);
  assert.strictEqual(closedRes.isRefused, true);
});

// ============================================================================
// PART 3: SECURITY POLICY & TARGET VALIDATION TESTS
// ============================================================================

test("Security Policy: blocks AWS/GCP cloud metadata endpoints", () => {
  const awsCheck = validateTarget("169.254.169.254", 80);
  assert.strictEqual(awsCheck.allowed, false);
  assert.ok(awsCheck.rejectionReason?.includes("Cloud Metadata"));

  const gcpCheck = validateTarget("metadata.google.internal", 80);
  assert.strictEqual(gcpCheck.allowed, false);

  const fileSchemeCheck = validateTarget("localhost", undefined, "file:///etc/passwd");
  assert.strictEqual(fileSchemeCheck.allowed, false);
  assert.ok(fileSchemeCheck.rejectionReason?.includes("protocol"));
});

test("Security Policy: permits valid local and external development targets", () => {
  const localCheck = validateTarget("localhost", 3000);
  assert.strictEqual(localCheck.allowed, true);
  assert.strictEqual(localCheck.sanitizedPort, 3000);

  const urlCheck = validateTarget("example.com", undefined, "https://api.github.com/events");
  assert.strictEqual(urlCheck.allowed, true);
  assert.strictEqual(urlCheck.sanitizedPort, 443);
});

// ============================================================================
// PART 4: CONCURRENCY-SAFE STORAGE TESTS
// ============================================================================

test("Storage Concurrency: handles concurrent save operations without lost writes", async () => {
  await DiagnosticHistory.clearHistory();

  const mockReport = (idx: number): DiagnosticReport => ({
    timestamp: new Date().toISOString(),
    target: { host: `target-${idx}.local`, port: 8000 + idx },
    probes: {},
    findings: [],
    rulesFired: [],
  });

  // Launch 10 simultaneous saves
  await Promise.all(Array.from({ length: 10 }, (_, i) => DiagnosticHistory.saveRun(mockReport(i))));

  const history = await DiagnosticHistory.getRuns(20);
  assert.strictEqual(history.length, 10, "All 10 concurrent writes must be safely persisted without data loss");
});

// ============================================================================
// PART 5: EXPANDED SECURITY & RATE LIMITING SUITE
// ============================================================================

test("Security Policy: blocks IPv6 link-local and AWS IPv6 metadata", () => {
  const ipv6Meta = validateTarget("fd00:ec2::254", 80);
  assert.strictEqual(ipv6Meta.allowed, false);

  const ipv6LinkLocal = validateTarget("fe80::1ff:feee:a", 80);
  assert.strictEqual(ipv6LinkLocal.allowed, false);
});

test("Security Policy: restricts private RFC1918 ranges when allowPrivateNetworks is false", () => {
  const rfc1918Check = validateTarget("10.0.0.1", 8080, undefined, { allowPrivateNetworks: false });
  assert.strictEqual(rfc1918Check.allowed, false);
  assert.ok(rfc1918Check.rejectionReason?.includes("private network"));

  const cgnatCheck = validateTarget("100.64.0.1", 8080, undefined, { allowPrivateNetworks: false });
  assert.strictEqual(cgnatCheck.allowed, false);
});

test("Security Limiter: enforces sliding-window rate limit", () => {
  securityLimiter.resetForTesting();
  const testIp = "192.0.2.100";

  for (let i = 0; i < 60; i++) {
    const res = securityLimiter.checkRateLimit(testIp);
    assert.strictEqual(res.allowed, true);
  }

  // 61st request in the same minute must be rejected
  const blockedRes = securityLimiter.checkRateLimit(testIp);
  assert.strictEqual(blockedRes.allowed, false);
  assert.ok(blockedRes.retryAfterSeconds && blockedRes.retryAfterSeconds > 0);
  securityLimiter.resetForTesting();
});

test("Security Limiter: manages active concurrency slots", () => {
  securityLimiter.resetForTesting();
  // Acquire max slots (10)
  for (let i = 0; i < 10; i++) {
    assert.strictEqual(securityLimiter.acquireConcurrency(), true);
  }
  // 11th should be denied
  assert.strictEqual(securityLimiter.acquireConcurrency(), false);

  // Release one slot
  securityLimiter.releaseConcurrency();
  assert.strictEqual(securityLimiter.acquireConcurrency(), true);
  securityLimiter.resetForTesting();
});

test("Deterministic HTTP Timeout: handles server stalling beyond timeout", async () => {
  const server = http.createServer((_req, _res) => {
    // Deliberately stall response
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as net.AddressInfo;
  const testUrl = `http://127.0.0.1:${address.port}/stall`;

  try {
    const res = await checkHttp(testUrl, 200); // 200ms timeout
    assert.strictEqual(res.status, "FAILED");
    assert.ok(res.error?.includes("timed out"));
  } finally {
    server.close();
  }
});
