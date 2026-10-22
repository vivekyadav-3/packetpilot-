import React, { useState } from "react";
import { DiagnosticFinding } from "../types.js";

interface FindingsListProps {
  findings: DiagnosticFinding[];
}

export const FindingsList: React.FC<FindingsListProps> = ({ findings }) => {
  const [expandedWhy, setExpandedWhy] = useState<Record<string, boolean>>({});

  const toggleWhy = (id: string) => {
    setExpandedWhy((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (findings.length === 0) {
    return (
      <div className="glass-panel" style={{
        padding: "1.75rem",
        marginBottom: "1.75rem",
        borderLeft: "4px solid var(--accent-success)",
        backgroundColor: "rgba(16, 185, 129, 0.05)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            backgroundColor: "rgba(16, 185, 129, 0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--accent-success)",
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#34d399" }}>
              All Diagnostic Checks Passed
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              Target host is reachable, listening socket is healthy, and no connection errors were observed.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: "1.75rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.875rem" }}>
        <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Root-Cause Diagnoses ({findings.length} Incident{findings.length === 1 ? "" : "s"})
        </h3>
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
          Defensible Categorical Confidence
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {findings.map((f, idx) => {
          const isCritical = f.severity?.toUpperCase() === "CRITICAL" || f.severity === "critical";
          const isWarning = f.severity?.toUpperCase() === "WARNING" || f.severity === "warning";
          const borderColor = isCritical ? "var(--accent-danger)" : isWarning ? "var(--accent-warning)" : "var(--accent-info)";

          const conf = (f.confidence || "MEDIUM").toUpperCase();
          const confidenceColor = conf === "HIGH" ? "#10b981" : conf === "MEDIUM" ? "#f59e0b" : "#6366f1";
          const facts = f.observedFacts && f.observedFacts.length > 0 ? f.observedFacts : f.evidence ? [f.evidence] : [];
          const incidentKey = f.ruleId || f.code || String(idx);
          const isWhyOpen = !!expandedWhy[incidentKey];

          return (
            <div
              key={incidentKey}
              className="glass-panel"
              style={{
                padding: "1.5rem",
                borderLeft: `4px solid ${borderColor}`,
                position: "relative",
              }}
            >
              {/* Header: Title, Severity, and Defensible Confidence Category */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1rem" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.3rem" }}>
                    <span className={`badge ${isCritical ? "badge-danger" : isWarning ? "badge-warning" : "badge-info"}`}>
                      {f.severity}
                    </span>

                    <span style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.35rem",
                      padding: "0.2rem 0.6rem",
                      borderRadius: "9999px",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      backgroundColor: "rgba(0, 0, 0, 0.4)",
                      color: confidenceColor,
                      border: `1px solid ${confidenceColor}40`,
                      letterSpacing: "0.04em",
                    }}>
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: confidenceColor }} />
                      {conf} CONFIDENCE
                    </span>
                  </div>

                  <h4 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#f8fafc" }}>
                    {f.title}
                  </h4>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <code style={{ fontSize: "0.75rem", color: "var(--text-dim)", background: "rgba(0,0,0,0.3)", padding: "3px 8px", borderRadius: "4px" }}>
                    {f.ruleId || f.code}
                  </code>
                </div>
              </div>

              {/* Inferred Cause Banner */}
              <div style={{
                backgroundColor: "rgba(15, 23, 42, 0.6)",
                border: "1px solid rgba(255, 255, 255, 0.06)",
                borderRadius: "8px",
                padding: "0.85rem 1rem",
                marginBottom: "1.25rem",
              }}>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>
                  Inferred Root Cause (Strong Explanation)
                </div>
                <div style={{ fontSize: "0.9rem", color: "#f1f5f9", fontWeight: 500, lineHeight: 1.5 }}>
                  {f.inferredCause || f.likelyCause}
                </div>
              </div>

              {/* 2-Column Grid: Observed Evidence vs Recommended Action */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.25rem", marginBottom: "1.25rem" }}>
                {/* Column 1: Observed Supporting Facts */}
                <div>
                  <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.6rem" }}>
                    Observed Supporting Facts ({facts.length})
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {facts.map((fact, factIdx) => (
                      <div
                        key={factIdx}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "0.6rem",
                          fontSize: "0.8rem",
                          color: "var(--text-muted)",
                          background: "rgba(0,0,0,0.25)",
                          padding: "0.6rem 0.75rem",
                          borderRadius: "6px",
                          border: "1px solid rgba(255,255,255,0.03)",
                        }}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" style={{ flexShrink: 0, marginTop: "2px" }}>
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span>{fact}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Column 2: Single Unified Action & Verification */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <div style={{
                    backgroundColor: "rgba(56, 189, 248, 0.06)",
                    border: "1px solid rgba(56, 189, 248, 0.2)",
                    borderRadius: "8px",
                    padding: "0.85rem 1rem",
                  }}>
                    <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Unified Recommended Action
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "#f8fafc", marginTop: "0.3rem", lineHeight: 1.5, fontWeight: 500 }}>
                      {f.recommendedAction || f.suggestedFix}
                    </div>
                  </div>

                  <div style={{
                    backgroundColor: "rgba(0, 0, 0, 0.2)",
                    borderRadius: "8px",
                    padding: "0.75rem 1rem",
                    border: "1px solid rgba(255, 255, 255, 0.04)",
                  }}>
                    <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Verification Step
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                      {f.verification || f.verificationStep}
                    </div>
                  </div>
                </div>
              </div>

              {/* "Why this diagnosis?" Transparency Section Toggle */}
              <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.06)", paddingTop: "0.875rem" }}>
                <button
                  onClick={() => toggleWhy(incidentKey)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--primary)",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    padding: 0,
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    style={{
                      transform: isWhyOpen ? "rotate(90deg)" : "none",
                      transition: "transform 0.2s ease",
                    }}
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  <span>{isWhyOpen ? "Hide Diagnostic Rationale" : "Why this diagnosis? (Inspection & Falsification)"}</span>
                </button>

                {isWhyOpen && (
                  <div style={{
                    marginTop: "0.85rem",
                    padding: "1rem",
                    backgroundColor: "rgba(0, 0, 0, 0.35)",
                    borderRadius: "8px",
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                    fontSize: "0.8rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                  }}>
                    <div>
                      <strong style={{ color: "#f8fafc" }}>Rule Evaluated: </strong>
                      <code style={{ color: "var(--primary)" }}>{f.ruleId || f.code}</code>
                    </div>

                    {f.confidenceRationale && (
                      <div>
                        <strong style={{ color: "#f8fafc" }}>Confidence Rationale ({conf}): </strong>
                        <span style={{ color: "var(--text-muted)" }}>{f.confidenceRationale}</span>
                      </div>
                    )}

                    {f.unavailableChecks && f.unavailableChecks.length > 0 && (
                      <div>
                        <strong style={{ color: "#f8fafc" }}>Checks Unavailable / Skipped: </strong>
                        <ul style={{ paddingLeft: "1.2rem", marginTop: "0.25rem", color: "var(--text-dim)" }}>
                          {f.unavailableChecks.map((u, i) => (
                            <li key={i}>{u}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {f.falsificationCondition && (
                      <div style={{
                        backgroundColor: "rgba(245, 158, 11, 0.08)",
                        border: "1px solid rgba(245, 158, 11, 0.2)",
                        borderRadius: "6px",
                        padding: "0.6rem 0.75rem",
                        color: "#fde68a",
                      }}>
                        <strong>How to disprove this conclusion: </strong>
                        <span>{f.falsificationCondition}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
