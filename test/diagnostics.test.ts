import test from "node:test";
import assert from "node:assert";
import { evaluateDiagnosticRules } from "../src/engine/rules.js";
import { resolveDns } from "../src/diagnostics/dns.js";
import { inspectLocalPort } from "../src/diagnostics/local-port.js";

// ============================================================================
// DIAGNOSTIC REGRESSION TEST MATRIX
// Tests handling of consistent, conflicting, missing, and failing probe states
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
  assert.strictEqual(findings[0].confidence, "MEDIUM"); // Defensible: conflicting evidence cannot be High
  assert.ok(findings[0].title.includes("Conflicting Evidence"));
  assert.ok(findings[0].confidenceRationale.includes("Evidence is conflicting"));
  assert.ok(findings[0].inferredCause.includes("python.exe"));
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
  assert.strictEqual(rulesFired.includes("RULE_SERVICE_UNAVAILABLE"), false); // Must not mistake timeout for missing process
  assert.strictEqual(findings[0].confidence, "HIGH");
  assert.ok(findings[0].title.includes("Timed Out"));
  assert.ok(findings[0].inferredCause.includes("firewall"));
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
  assert.strictEqual(rulesFired.includes("RULE_SERVICE_UNAVAILABLE"), false); // Did NOT assert "no local listener"
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

// Basic live probe tests
test("Live DNS Probe: resolves known domain with getaddrinfo fallback", async () => {
  const res = await resolveDns("one.one.one.one");
  assert.strictEqual(res.status, "SUCCESS");
  assert.ok(res.records.length > 0);
});

test("Live Local Port Probe: handles unused port gracefully", async () => {
  const res = await inspectLocalPort(59871);
  assert.strictEqual(res.status, "SUCCESS");
  assert.strictEqual(res.isListening, false);
});
