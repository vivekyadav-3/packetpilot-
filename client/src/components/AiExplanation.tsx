import React, { useState } from "react";
import { DiagnosticReport } from "../types.js";
import { explainReport } from "../api.js";

interface AiExplanationProps {
  report: DiagnosticReport;
  ollamaOnline: boolean;
}

export const AiExplanation: React.FC<AiExplanationProps> = ({ report, ollamaOnline }) => {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExplain = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await explainReport(report);
      if (res.available) {
        setExplanation(res.explanation);
        setModelUsed(res.modelUsed || "qwen2.5:3b");
      } else {
        setError(res.explanation || res.error || "AI service is unavailable.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to contact AI service.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel" style={{
      padding: "1.5rem",
      marginBottom: "1.75rem",
      background: "linear-gradient(180deg, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.6) 100%)",
      border: "1px solid rgba(99, 102, 241, 0.2)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <div style={{
            width: "28px",
            height: "28px",
            borderRadius: "6px",
            background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 10px rgba(99, 102, 241, 0.4)",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2">
              <path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
              <path d="M4 11v2a8 8 0 0 0 16 0v-2" />
              <circle cx="12" cy="14" r="4" />
            </svg>
          </div>
          <div>
            <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#f8fafc" }}>
              Ollama Natural Language Summary
            </h4>
            <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
              Translates raw findings and netstat evidence into developer guidance
            </span>
          </div>
        </div>

        {!explanation && (
          <button
            onClick={handleExplain}
            disabled={loading}
            style={{
              background: "rgba(99, 102, 241, 0.15)",
              color: "#a5b4fc",
              border: "1px solid rgba(99, 102, 241, 0.3)",
              padding: "0.45rem 0.9rem",
              borderRadius: "6px",
              fontSize: "0.8rem",
              fontWeight: 600,
              cursor: loading ? "wait" : "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {loading ? "Generating explanation..." : "Explain Findings"}
          </button>
        )}
      </div>

      {loading && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "1rem 0", color: "#a5b4fc", fontSize: "0.85rem" }}>
          <div style={{
            width: "12px",
            height: "12px",
            borderRadius: "50%",
            backgroundColor: "#818cf8",
            boxShadow: "0 0 10px #818cf8",
          }} className="animate-pulse-slow" />
          <span>Consulting local Ollama model...</span>
        </div>
      )}

      {error && (
        <div style={{
          marginTop: "0.75rem",
          padding: "0.75rem 1rem",
          borderRadius: "8px",
          backgroundColor: "rgba(239, 68, 68, 0.1)",
          border: "1px solid rgba(239, 68, 68, 0.2)",
          color: "#fca5a5",
          fontSize: "0.8rem",
        }}>
          <strong>Note:</strong> {error}
        </div>
      )}

      {explanation && (
        <div style={{ marginTop: "1rem" }}>
          <div style={{
            backgroundColor: "rgba(0, 0, 0, 0.3)",
            borderRadius: "8px",
            padding: "1rem 1.25rem",
            fontSize: "0.9rem",
            lineHeight: 1.6,
            color: "#e2e8f0",
            whiteSpace: "pre-line",
          }}>
            {explanation}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.6rem", fontSize: "0.7rem", color: "var(--text-dim)" }}>
            <span>Model: {modelUsed} (Local)</span>
            <span>Deterministic evidence evaluated prior to generation</span>
          </div>
        </div>
      )}
    </div>
  );
};
