import React from "react";
import { DiagnosticReport } from "../types.js";

interface ProbeResultsProps {
  probes: DiagnosticReport["probes"];
}

export const ProbeResults: React.FC<ProbeResultsProps> = ({ probes }) => {
  return (
    <div>
      <h3 style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.875rem" }}>
        Probe Diagnostics & Raw Evidence
      </h3>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
        {/* Local Port Inspector */}
        {probes.localPort && (
          <div className="glass-panel" style={{ padding: "1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#f8fafc" }}>
                Local Port Inspector
              </span>
              <span className={`badge ${probes.localPort.isListening ? "badge-success" : "badge-danger"}`}>
                {probes.localPort.isListening ? "Listening" : "Not Listening"}
              </span>
            </div>

            <div style={{ fontSize: "0.8rem", display: "flex", flexDirection: "column", gap: "0.4rem", color: "var(--text-muted)" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Port:</span>
                <code style={{ color: "#f8fafc" }}>{probes.localPort.port}</code>
              </div>
              {probes.localPort.process ? (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Process Name:</span>
                    <strong style={{ color: "var(--primary)" }}>{probes.localPort.process.processName}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>PID:</span>
                    <code style={{ color: "#f8fafc" }}>{probes.localPort.process.pid}</code>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Local Binding:</span>
                    <code style={{ color: "#f8fafc" }}>{probes.localPort.process.localAddress}</code>
                  </div>
                </>
              ) : (
                <div style={{ color: "var(--text-dim)", fontStyle: "italic", marginTop: "0.25rem" }}>
                  No active socket found in Windows netstat table.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TCP Connection Probe */}
        {probes.tcp && (
          <div className="glass-panel" style={{ padding: "1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#f8fafc" }}>
                TCP Connectivity
              </span>
              <span className={`badge ${probes.tcp.connected ? "badge-success" : "badge-danger"}`}>
                {probes.tcp.connected ? "Connected" : probes.tcp.isRefused ? "Refused" : probes.tcp.isTimeout ? "Timeout" : "Failed"}
              </span>
            </div>

            <div style={{ fontSize: "0.8rem", display: "flex", flexDirection: "column", gap: "0.4rem", color: "var(--text-muted)" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Socket Latency:</span>
                <code style={{ color: "#f8fafc" }}>{probes.tcp.durationMs}ms</code>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Connection Refused:</span>
                <code style={{ color: probes.tcp.isRefused ? "var(--accent-danger)" : "#f8fafc" }}>
                  {String(probes.tcp.isRefused)}
                </code>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Timeout Triggered:</span>
                <code style={{ color: probes.tcp.isTimeout ? "var(--accent-danger)" : "#f8fafc" }}>
                  {String(probes.tcp.isTimeout)}
                </code>
              </div>
            </div>
          </div>
        )}

        {/* DNS Diagnostics Probe */}
        {probes.dns && (
          <div className="glass-panel" style={{ padding: "1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#f8fafc" }}>
                DNS Diagnostics
              </span>
              <span className={`badge ${probes.dns.status === "SUCCESS" ? "badge-success" : "badge-danger"}`}>
                {probes.dns.status}
              </span>
            </div>

            <div style={{ fontSize: "0.8rem", display: "flex", flexDirection: "column", gap: "0.4rem", color: "var(--text-muted)" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Resolution Time:</span>
                <code style={{ color: "#f8fafc" }}>{probes.dns.durationMs}ms</code>
              </div>
              <div>
                <span>Resolved Records:</span>
                {probes.dns.records.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem", marginTop: "0.3rem" }}>
                    {probes.dns.records.map((r, i) => (
                      <code key={i} style={{ color: "#38bdf8", fontSize: "0.75rem", background: "rgba(0,0,0,0.3)", padding: "2px 4px", borderRadius: "3px" }}>
                        IPv{r.family}: {r.address}
                      </code>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: "var(--accent-danger)", fontSize: "0.75rem", marginTop: "0.25rem" }}>
                    {probes.dns.error || "No addresses found"}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* HTTP Probe */}
        {probes.http && (
          <div className="glass-panel" style={{ padding: "1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#f8fafc" }}>
                HTTP Request Probe
              </span>
              <span className={`badge ${probes.http.statusCode && probes.http.statusCode < 400 ? "badge-success" : "badge-warning"}`}>
                {probes.http.statusCode ? `HTTP ${probes.http.statusCode}` : "Failed"}
              </span>
            </div>

            <div style={{ fontSize: "0.8rem", display: "flex", flexDirection: "column", gap: "0.4rem", color: "var(--text-muted)" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>TTFB Response:</span>
                <code style={{ color: "#f8fafc" }}>{probes.http.ttfbMs ?? probes.http.durationMs}ms</code>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Status Text:</span>
                <span style={{ color: "#f8fafc" }}>{probes.http.statusText || "N/A"}</span>
              </div>
            </div>
          </div>
        )}

        {/* TLS Probe */}
        {probes.tls && (
          <div className="glass-panel" style={{ padding: "1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#f8fafc" }}>
                TLS Certificate
              </span>
              <span className={`badge ${probes.tls.authorized ? "badge-success" : "badge-danger"}`}>
                {probes.tls.authorized ? "Trusted" : "Invalid/Untrusted"}
              </span>
            </div>

            <div style={{ fontSize: "0.8rem", display: "flex", flexDirection: "column", gap: "0.4rem", color: "var(--text-muted)" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Days Remaining:</span>
                <code style={{ color: probes.tls.daysRemaining && probes.tls.daysRemaining > 15 ? "#34d399" : "var(--accent-danger)" }}>
                  {probes.tls.daysRemaining ?? "N/A"} days
                </code>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Issuer:</span>
                <span style={{ color: "#f8fafc" }}>{probes.tls.issuer || "Unknown"}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
