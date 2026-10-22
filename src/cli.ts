import { runFullDiagnostic } from "./engine/report.js";
import { explainReportWithOllama } from "./ai/ollama.js";
import { validateTarget } from "./security/target-policy.js";

async function main() {
  const targetHost = process.argv[2] || "localhost";
  const targetPort = parseInt(process.argv[3] || "5000", 10);
  const withAi = process.argv.includes("--ai");

  console.log(`\n=============================================================`);
  console.log(` 🧭 PacketPilot: Local-first Network Diagnostics Platform`);
  console.log(` Target: ${targetHost}:${targetPort}`);
  console.log(`=============================================================\n`);

  const validation = validateTarget(targetHost, targetPort);
  if (!validation.allowed) {
    console.error(`❌ Security Policy Error: ${validation.rejectionReason}\n`);
    process.exit(1);
  }

  const report = await runFullDiagnostic({
    host: validation.sanitizedHost || targetHost,
    port: validation.sanitizedPort ?? targetPort,
  });

  console.log("PROBES EXECUTED:");
  if (report.probes.localPort) {
    const lp = report.probes.localPort;
    console.log(` [Local Port]  Listening: ${lp.isListening ? "YES" : "NO"}`);
    if (lp.process) {
      console.log(`               Process:   ${lp.process.processName} (PID: ${lp.process.pid})`);
      console.log(`               Bound:     ${lp.process.localAddress}:${lp.process.localPort}`);
      console.log(`               State:     ${lp.process.state}`);
    }
  }

  if (report.probes.tcp) {
    const tcp = report.probes.tcp;
    console.log(` [TCP Check]   Connected: ${tcp.connected} (${tcp.durationMs}ms)`);
    if (!tcp.connected) {
      console.log(`               Refused:   ${tcp.isRefused}`);
      console.log(`               Timeout:   ${tcp.isTimeout}`);
    }
  }

  if (report.probes.dns) {
    const dns = report.probes.dns;
    console.log(` [DNS Lookup]  Status:    ${dns.status} (${dns.durationMs}ms)`);
    if (dns.records.length > 0) {
      console.log(`               Records:   ${dns.records.map((r) => `${r.address} (IPv${r.family})`).join(", ")}`);
    } else if (dns.error) {
      console.log(`               Error:     ${dns.error}`);
    }
  }

  console.log("\nCORRELATED ROOT-CAUSE INCIDENTS:");
  if (report.findings.length === 0) {
    console.log(" ✨ All checks passed! No networking issues detected on this target.");
  } else {
    report.findings.forEach((finding, idx) => {
      console.log(`\n ${idx + 1}. [${finding.severity.toUpperCase()}] ${finding.title}`);
      if (finding.confidenceScore !== undefined) {
        console.log(`    Confidence:     ${finding.confidence.toUpperCase()} (${finding.confidenceScore}%)`);
      }
      console.log(`    Inferred Cause: ${finding.inferredCause || finding.likelyCause}`);
      console.log(`    Observed Facts:`);
      (finding.observedFacts || [finding.evidence]).forEach((fact) => {
        console.log(`      • ${fact}`);
      });
      console.log(`    Recommended:    ${finding.recommendedAction || finding.suggestedFix}`);
      console.log(`    Verification:   ${finding.verificationStep}`);
    });
  }

  if (withAi) {
    console.log("\n-------------------------------------------------------------");
    console.log(" 🤖 AI EXPLANATION (Ollama):");
    console.log("-------------------------------------------------------------");
    const aiRes = await explainReportWithOllama(report);
    console.log(aiRes.explanation);
  }

  console.log("\n=============================================================\n");
}

main().catch(console.error);
