import { DiagnosticIncident, DiagnosticReport, StructuredEvidence } from "../diagnostics/types.js";

/**
 * Smarter Root-Cause Correlation Engine
 * 
 * Design Principles:
 * 1. Categorical, Defensible Confidence (HIGH, MEDIUM, LOW) with explicit rationale.
 * 2. Correlates multi-probe evidence and handles conflicting / missing probe states.
 * 3. Stable Rule IDs and structured evidence tracking.
 * 4. Clear falsification conditions (how to disprove or verify the diagnosis).
 */
export function evaluateDiagnosticRules(
  probes: DiagnosticReport["probes"],
  host: string,
  port?: number
): { findings: DiagnosticIncident[]; rulesFired: string[] } {
  const findings: DiagnosticIncident[] = [];
  const rulesFired: string[] = [];

  const unavailableChecks: string[] = [];
  if (!probes.localPort || probes.localPort.status === "SKIPPED") {
    unavailableChecks.push("Local OS Socket & Process Inspector (Remote host or non-Windows system)");
  }
  if (!probes.dns) {
    unavailableChecks.push("DNS Resolution (Target was loopback/IP)");
  }
  if (!probes.http) {
    unavailableChecks.push("HTTP Application Probe (No URL specified)");
  }
  if (!probes.tls) {
    unavailableChecks.push("TLS Certificate Inspection (Target was not HTTPS / port 443)");
  }

  // =========================================================================
  // SCENARIO 1: Conflicting Evidence (Listener Found BUT TCP Refused)
  // Process is listening in OS table, yet TCP handshake received ECONNREFUSED!
  // =========================================================================
  if (probes.localPort?.isListening && probes.tcp?.isRefused && port) {
    const ruleId = "RULE_CONFLICTING_LISTENER_REFUSED";
    rulesFired.push(ruleId);

    const proc = probes.localPort.process;
    const structuredEvidence: StructuredEvidence[] = [
      {
        probeId: "localPort",
        status: "SUCCESS",
        observation: `Process '${proc?.processName}' (PID ${proc?.pid}) is registered as LISTENING on ${proc?.localAddress}:${port}.`,
        rawCode: "LISTENING",
      },
      {
        probeId: "tcp",
        status: "FAILED",
        observation: `TCP connection to ${host}:${port} actively refused by host or OS kernel (ECONNREFUSED).`,
        rawCode: "ECONNREFUSED",
      },
    ];

    findings.push({
      id: `incident-${ruleId}-${port}`,
      ruleId,
      severity: "CRITICAL",
      confidence: "MEDIUM",
      confidenceRationale: "Evidence is conflicting: a process holds the listening socket in the OS table, but the TCP stack refused the connection. This typically indicates an interface mismatch (IPv4 vs IPv6), connection backlog saturation, or local security software blocking the loopback.",
      title: `Conflicting Evidence: Process Listening but Connection Refused on ${port}`,
      inferredCause: `Application '${proc?.processName}' (PID ${proc?.pid}) is listening on ${proc?.localAddress}, but rejected connection from target '${host}'. Common cause is binding to '127.0.0.1' while client attempts '::1' (or vice-versa), or local endpoint protection.`,
      observedFacts: structuredEvidence.map((e) => e.observation),
      structuredEvidence,
      unavailableChecks,
      recommendedAction: `Check the exact binding address of PID ${proc?.pid}. Ensure your client and server agree on IPv4 (127.0.0.1) or IPv6 (::1), or bind the server to '0.0.0.0' for dual-stack.`,
      verification: `Connect directly to ${proc?.localAddress}:${port} to confirm whether the specific bound interface responds.`,
      falsificationCondition: `Successfully establishing a TCP connection to '${proc?.localAddress}:${port}' proves an address-family or interface mismatch rather than a process failure.`,
      // Legacy compatibility
      code: ruleId,
      evidence: structuredEvidence.map((e) => e.observation).join("; "),
      likelyCause: `Interface binding mismatch on PID ${proc?.pid}.`,
      suggestedFix: `Bind server to 0.0.0.0 or match interface '${host}'.`,
      verificationStep: `Test connection to ${proc?.localAddress}:${port}.`,
    });

    return { findings, rulesFired };
  }

  // =========================================================================
  // SCENARIO 2: Service Unavailable (Both Local & TCP Agree)
  // No listener in OS socket table + TCP handshake actively refused
  // =========================================================================
  // Only consider local port missing if the probe actually succeeded in checking
  const localMissing = probes.localPort && probes.localPort.status === "SUCCESS" && !probes.localPort.isListening && !!port;
  const tcpRefused = !!probes.tcp?.isRefused;

  if (localMissing && tcpRefused && port) {
    const ruleId = "RULE_SERVICE_UNAVAILABLE";
    rulesFired.push(ruleId);

    const structuredEvidence: StructuredEvidence[] = [
      {
        probeId: "localPort",
        status: "SUCCESS",
        observation: `Local OS socket inspection found no active listening socket on port ${port}.`,
        rawCode: "NO_LISTENER",
      },
      {
        probeId: "tcp",
        status: "FAILED",
        observation: `TCP connection to ${host}:${port} actively refused by host or OS kernel (ECONNREFUSED).`,
        rawCode: "ECONNREFUSED",
      },
    ];

    findings.push({
      id: `incident-${ruleId}-${port}`,
      ruleId,
      severity: "CRITICAL",
      confidence: "HIGH",
      confidenceRationale: "Both the OS kernel socket table and the network TCP probe independently corroborate that no application is accepting connections on this port.",
      title: `No Service Running on Port ${port}`,
      inferredCause: `Your backend service is not running or terminated prematurely. It has not opened a listening socket on port ${port}.`,
      observedFacts: structuredEvidence.map((e) => e.observation),
      structuredEvidence,
      unavailableChecks,
      recommendedAction: `Start your application (e.g., 'npm run dev' or 'node server.js') and check the terminal for uncaught startup errors or port configuration mismatches.`,
      verification: `Re-run PacketPilot to confirm that an active socket enters LISTENING state and completes the TCP handshake.`,
      falsificationCondition: `A process appearing in the socket table or accepting a TCP connection immediately disproves this diagnosis.`,
      code: ruleId,
      evidence: structuredEvidence.map((e) => e.observation).join("; "),
      likelyCause: `Backend application is not running or crashed.`,
      suggestedFix: `Start your server application.`,
      verificationStep: `Re-run PacketPilot port check.`,
    });
  }

  // =========================================================================
  // SCENARIO 3: Remote / Skipped Local Inspection + TCP Refused
  // Missing evidence != negative evidence: do NOT claim "no process exists"
  // =========================================================================
  else if (tcpRefused && port && (!probes.localPort || probes.localPort.status === "SKIPPED")) {
    const ruleId = "RULE_REMOTE_CONNECTION_REFUSED";
    rulesFired.push(ruleId);

    const structuredEvidence: StructuredEvidence[] = [
      {
        probeId: "tcp",
        status: "FAILED",
        observation: `TCP connection to ${host}:${port} was rejected with ECONNREFUSED.`,
        rawCode: "ECONNREFUSED",
      },
    ];

    findings.push({
      id: `incident-${ruleId}-${port}`,
      ruleId,
      severity: "CRITICAL",
      confidence: "MEDIUM",
      confidenceRationale: "The TCP connection was refused by the target host. However, local process inspection was skipped (remote target or unprivileged host), so the process state cannot be verified directly.",
      title: `Connection Refused by Remote Host (${host}:${port})`,
      inferredCause: `The remote host at ${host} is reachable, but refused connection on port ${port}. The remote daemon may be stopped or bound to loopback only on that host.`,
      observedFacts: structuredEvidence.map((e) => e.observation),
      structuredEvidence,
      unavailableChecks,
      recommendedAction: `Verify that the remote service on ${host} is running and that its port ${port} is open and listening.`,
      verification: `Log in to ${host} or query its remote health endpoint.`,
      falsificationCondition: `The remote host accepting a TCP connection on port ${port} disproves this diagnosis.`,
      code: ruleId,
      evidence: `TCP connection to ${host}:${port} rejected with ECONNREFUSED.`,
      likelyCause: `Remote service is stopped or port is closed.`,
      suggestedFix: `Verify service status on remote host.`,
      verificationStep: `Retry TCP connection.`,
    });
  }

  // =========================================================================
  // SCENARIO 4: TCP Connection Timeout (Firewall / Dropped Packets)
  // Distinct from connection refusal!
  // =========================================================================
  if (probes.tcp?.isTimeout && port) {
    const ruleId = "RULE_TCP_CONNECTION_TIMEOUT";
    rulesFired.push(ruleId);

    const structuredEvidence: StructuredEvidence[] = [
      {
        probeId: "tcp",
        status: "FAILED",
        observation: `TCP connection to ${host}:${port} timed out after ${probes.tcp.durationMs}ms without receiving a response.`,
        rawCode: "ETIMEDOUT",
      },
    ];
    if (probes.dns?.status === "SUCCESS") {
      structuredEvidence.push({
        probeId: "dns",
        status: "SUCCESS",
        observation: `DNS resolved '${host}' to ${probes.dns.records.map((r) => r.address).join(", ")}.`,
      });
    }

    findings.push({
      id: `incident-${ruleId}-${port}`,
      ruleId,
      severity: "CRITICAL",
      confidence: "HIGH",
      confidenceRationale: "Packets were transmitted but received no response before timeout. This differs from connection refusal (which immediately returns ECONNREFUSED).",
      title: `TCP Connection Timed Out to ${host}:${port}`,
      inferredCause: `Connection attempt timed out without response. Likely causes include a packet-filtering firewall, network routing failure, an unresponsive or offline host, or network packet drop.`,
      observedFacts: structuredEvidence.map((e) => e.observation),
      structuredEvidence,
      unavailableChecks,
      recommendedAction: `Inspect local firewall rules, network routing, or cloud security group inbound rules for port ${port}.`,
      verification: `Test port reachability via PowerShell 'Test-NetConnection -ComputerName ${host} -Port ${port}'.`,
      falsificationCondition: `Receiving an immediate ECONNREFUSED or completing the handshake disproves an unroutable/packet-dropping condition.`,
      code: ruleId,
      evidence: `Connection timed out after ${probes.tcp.durationMs}ms.`,
      likelyCause: `Packet-dropping firewall, routing failure, or offline host.`,
      suggestedFix: `Check firewall and network routing for port ${port}.`,
      verificationStep: `Test connection with Test-NetConnection.`,
    });
  }

  // =========================================================================
  // SCENARIO 5: Interface Binding Mismatch (127.0.0.1 vs 0.0.0.0)
  // =========================================================================
  if (probes.localPort?.isListening && probes.localPort.process && port) {
    const bindAddr = probes.localPort.process.localAddress;
    const isTargetExternal = host === "0.0.0.0" || host.startsWith("192.168.") || host.startsWith("10.") || host.startsWith("172.");

    if (bindAddr === "127.0.0.1" && isTargetExternal) {
      const ruleId = "RULE_BIND_ADDRESS_RESTRICTION";
      rulesFired.push(ruleId);

      const proc = probes.localPort.process;
      const structuredEvidence: StructuredEvidence[] = [
        {
          probeId: "localPort",
          status: "SUCCESS",
          observation: `Process '${proc.processName}' (PID ${proc.pid}) is bound exclusively to loopback (${bindAddr}:${port}).`,
        },
      ];

      findings.push({
        id: `incident-${ruleId}-${port}`,
        ruleId,
        severity: "WARNING",
        confidence: "HIGH",
        confidenceRationale: "OS socket inspection explicitly confirms loopback-only binding on 127.0.0.1 while the target is an external interface.",
        title: `Service Bound Exclusively to Localhost (${bindAddr})`,
        inferredCause: `Application '${proc.processName}' is running, but bound to 127.0.0.1. Incoming requests from Docker containers, LAN devices, or emulators will be dropped.`,
        observedFacts: structuredEvidence.map((e) => e.observation),
        structuredEvidence,
        unavailableChecks,
        recommendedAction: `Change your server configuration to bind to host '0.0.0.0' instead of '127.0.0.1'.`,
        verification: `Verify that PacketPilot detects '0.0.0.0' as the listening localAddress.`,
        falsificationCondition: `Connecting from an external client successfully disproves a loopback restriction.`,
        code: ruleId,
        evidence: `Bound exclusively to 127.0.0.1.`,
        likelyCause: `Server bound to loopback.`,
        suggestedFix: `Bind to 0.0.0.0.`,
        verificationStep: `Verify binding in netstat.`,
      });
    }
  }

  // =========================================================================
  // SCENARIO 6: DNS Resolution Failure
  // =========================================================================
  if (probes.dns && probes.dns.status === "FAILED") {
    const ruleId = "RULE_DNS_LOOKUP_FAILURE";
    rulesFired.push(ruleId);

    const structuredEvidence: StructuredEvidence[] = [
      {
        probeId: "dns",
        status: "FAILED",
        observation: `DNS resolution for '${host}' failed: ${probes.dns.error || "No A or AAAA records found"}.`,
        rawCode: probes.dns.errorType || "ENOTFOUND",
      },
    ];

    findings.push({
      id: `incident-${ruleId}-${host}`,
      ruleId,
      severity: "CRITICAL",
      confidence: "HIGH",
      confidenceRationale: "The system DNS resolver returned a definitive lookup failure error.",
      title: `DNS Resolution Failed for ${host}`,
      inferredCause: `The hostname '${host}' cannot be resolved to an IP address. It may be misspelled, the DNS server unreachable, or the local hosts file missing an entry.`,
      observedFacts: structuredEvidence.map((e) => e.observation),
      structuredEvidence,
      unavailableChecks,
      recommendedAction: `Check the spelling of '${host}' or test manual resolution using 'nslookup ${host}'.`,
      verification: `Re-run the DNS probe after verifying network connectivity.`,
      falsificationCondition: `Successful lookup returning a valid IP address disproves a DNS issue.`,
      code: ruleId,
      evidence: probes.dns.error || "DNS resolution failed.",
      likelyCause: `Unresolvable hostname.`,
      suggestedFix: `Check hostname spelling.`,
      verificationStep: `Test with nslookup.`,
    });
  }

  // =========================================================================
  // SCENARIO 7: HTTP 404 Route Not Found
  // =========================================================================
  if (probes.http?.statusCode === 404) {
    const ruleId = "RULE_HTTP_ROUTE_NOT_FOUND";
    rulesFired.push(ruleId);

    const structuredEvidence: StructuredEvidence[] = [
      {
        probeId: "http",
        status: "SUCCESS",
        observation: `Server responded with HTTP 404 Not Found for ${probes.http.url}.`,
        rawCode: "404",
      },
    ];
    if (probes.tcp?.connected) {
      structuredEvidence.push({
        probeId: "tcp",
        status: "SUCCESS",
        observation: `TCP socket connection succeeded in ${probes.tcp.durationMs}ms.`,
      });
    }

    findings.push({
      id: `incident-${ruleId}`,
      ruleId,
      severity: "WARNING",
      confidence: "HIGH",
      confidenceRationale: "Server is healthy and responding, but the specific URL endpoint path is not registered.",
      title: `Endpoint Not Found (HTTP 404)`,
      inferredCause: `The backend application is running properly, but the requested path or route is not registered in the API router.`,
      observedFacts: structuredEvidence.map((e) => e.observation),
      structuredEvidence,
      unavailableChecks,
      recommendedAction: `Verify the route definitions in your backend code (e.g. check for missing '/api/' prefix or typo).`,
      verification: `Send a GET request to the corrected endpoint path.`,
      falsificationCondition: `Receiving HTTP 200 or another valid status code disproves an unregistered route.`,
      code: ruleId,
      evidence: `HTTP 404 returned while TCP connection succeeded.`,
      likelyCause: `Route not registered.`,
      suggestedFix: `Verify route definitions.`,
      verificationStep: `Retry request with valid path.`,
    });
  }

  // =========================================================================
  // SCENARIO 7b: HTTP 5xx Application / Gateway Error
  // Distinguishes transport success from application server crashes
  // =========================================================================
  if (probes.http?.statusCode && probes.http.statusCode >= 500) {
    const ruleId = "RULE_HTTP_SERVER_ERROR";
    rulesFired.push(ruleId);

    const isGateway = probes.http.statusCode === 502 || probes.http.statusCode === 504;
    const structuredEvidence: StructuredEvidence[] = [
      {
        probeId: "http",
        status: "SUCCESS",
        observation: `HTTP server returned error status ${probes.http.statusCode} (${probes.http.statusText || "Server Error"}).`,
        rawCode: String(probes.http.statusCode),
      },
    ];

    findings.push({
      id: `incident-${ruleId}`,
      ruleId,
      severity: "CRITICAL",
      confidence: "HIGH",
      confidenceRationale: "Network transport connection succeeded, but the application server returned a 5xx fatal error code.",
      title: `Application Server Error (HTTP ${probes.http.statusCode})`,
      inferredCause: isGateway
        ? `The upstream reverse proxy (e.g. NGINX) is running, but cannot communicate with the backend application daemon.`
        : `An unhandled exception or crash occurred within the backend request handler code.`,
      observedFacts: structuredEvidence.map((e) => e.observation),
      structuredEvidence,
      unavailableChecks,
      recommendedAction: isGateway
        ? `Verify that the upstream backend daemon is running and reachable by the proxy.`
        : `Inspect application server logs and stack traces for uncaught runtime exceptions.`,
      verification: `Send a request to the endpoint after resolving the application exception.`,
      falsificationCondition: `Receiving HTTP 200 disproves an application crash.`,
      code: ruleId,
      evidence: `HTTP ${probes.http.statusCode} returned.`,
      likelyCause: `Unhandled application exception or gateway timeout.`,
      suggestedFix: `Inspect application logs.`,
      verificationStep: `Retry request.`,
    });
  }

  // =========================================================================
  // SCENARIO 8: TLS Certificate Invalid / Expired
  // =========================================================================
  if (probes.tls && !probes.tls.authorized && probes.tls.status === "SUCCESS") {
    const isExpired = probes.tls.daysRemaining !== undefined && probes.tls.daysRemaining <= 0;
    const ruleId = isExpired ? "RULE_TLS_CERT_EXPIRED" : "RULE_TLS_CERT_UNTRUSTED";
    rulesFired.push(ruleId);

    const structuredEvidence: StructuredEvidence[] = [
      {
        probeId: "tls",
        status: "FAILED",
        observation: `TLS validation failed: ${probes.tls.authorizationError || "Untrusted certificate"}.`,
        rawCode: probes.tls.authorizationError,
      },
    ];
    if (probes.tls.daysRemaining !== undefined) {
      structuredEvidence.push({
        probeId: "tls",
        status: "SUCCESS",
        observation: `Certificate has ${probes.tls.daysRemaining} days remaining (expiry: ${probes.tls.validTo || "unknown"}).`,
      });
    }

    findings.push({
      id: `incident-${ruleId}`,
      ruleId,
      severity: "CRITICAL",
      confidence: "HIGH",
      confidenceRationale: "Direct TLS handshake evaluation returned certificate authorization failure.",
      title: isExpired ? `TLS Certificate Expired` : `TLS Certificate Untrusted / Self-Signed`,
      inferredCause: isExpired
        ? `The SSL/TLS certificate has passed its validity expiration date.`
        : `The certificate is self-signed, issued by an untrusted Root CA, or has a hostname mismatch.`,
      observedFacts: structuredEvidence.map((e) => e.observation),
      structuredEvidence,
      unavailableChecks,
      recommendedAction: isExpired
        ? `Renew the SSL/TLS certificate for ${host}.`
        : `Install the Root CA in your operating system trust store or generate a certificate matching '${host}'.`,
      verification: `Re-run TLS check to confirm 'authorized' returns true.`,
      falsificationCondition: `Completing the TLS handshake with authorized=true disproves a certificate failure.`,
      code: ruleId,
      evidence: probes.tls.authorizationError || "TLS certificate invalid.",
      likelyCause: isExpired ? "Expired certificate." : "Untrusted certificate authority.",
      suggestedFix: "Renew certificate or install root CA.",
      verificationStep: "Re-run TLS check.",
    });
  }

  // =========================================================================
  // SCENARIO 9: Internal Probe Failure (Incomplete Diagnostic)
  // =========================================================================
  const failedProbes = Object.entries(probes).filter(([key, p]) => {
    if (!p || p.status !== "FAILED") return false;
    if ("isRefused" in p || "isTimeout" in p) return false;
    if (key === "dns") return false;
    // An HTTP fetch failure when the TCP port is already closed/unreachable is expected downstream behavior
    if (key === "http" && (probes.tcp?.isRefused || probes.tcp?.isTimeout || probes.localPort?.isListening === false)) {
      return false;
    }
    return true;
  });
  if (failedProbes.length > 0) {
    const ruleId = "RULE_PROBE_EXECUTION_FAILURE";
    rulesFired.push(ruleId);

    const structuredEvidence: StructuredEvidence[] = failedProbes.map(([key, p]) => ({
      probeId: key as any,
      status: "FAILED",
      observation: `Probe '${key}' failed to execute: ${p?.error || "Unknown error"}.`,
      rawCode: "PROBE_ERROR",
    }));

    findings.push({
      id: `incident-${ruleId}`,
      ruleId,
      severity: "WARNING",
      confidence: "LOW",
      confidenceRationale: "An internal diagnostic probe failed to complete execution. Conclusions are tentative.",
      title: `Diagnostic Incomplete: Internal Probe Failure`,
      inferredCause: `One or more diagnostic probes encountered an execution error and could not collect evidence.`,
      observedFacts: structuredEvidence.map((e) => e.observation),
      structuredEvidence,
      unavailableChecks,
      recommendedAction: `Inspect probe error messages and verify process permissions.`,
      verification: `Re-run diagnostics.`,
      falsificationCondition: `All probes completing successfully disproves an internal probe error.`,
      code: ruleId,
      evidence: `Probe execution failed.`,
      likelyCause: `Diagnostic execution error.`,
      suggestedFix: `Verify permissions.`,
      verificationStep: `Re-run diagnostics.`,
    });
  }

  return { findings, rulesFired };
}
