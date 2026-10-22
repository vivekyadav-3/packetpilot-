import React from "react";
import { SystemStatus } from "../types.js";

interface SidebarProps {
  systemStatus: SystemStatus | null;
  onOpenHistory: () => void;
  historyCount: number;
  activeTab: "diagnose" | "history";
  setActiveTab: (tab: "diagnose" | "history") => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  systemStatus,
  onOpenHistory,
  historyCount,
  activeTab,
  setActiveTab,
}) => {
  return (
    <aside style={{
      width: "280px",
      minWidth: "280px",
      backgroundColor: "var(--bg-sidebar)",
      borderRight: "1px solid var(--border-card)",
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      padding: "1.5rem 1.25rem",
      boxSizing: "border-box",
    }}>
      {/* Brand Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "2rem" }}>
        <div style={{
          width: "38px",
          height: "38px",
          borderRadius: "10px",
          background: "linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 0 16px rgba(56, 189, 248, 0.4)",
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
          </svg>
        </div>
        <div>
          <h1 style={{ fontSize: "1.2rem", fontWeight: 800, letterSpacing: "-0.02em", color: "#f8fafc" }}>
            PacketPilot
          </h1>
          <span style={{ fontSize: "0.7rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
            Local Network Diagnostics
          </span>
        </div>
      </div>

      {/* Navigation Buttons */}
      <nav style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "2rem" }}>
        <button
          onClick={() => setActiveTab("diagnose")}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.75rem 1rem",
            borderRadius: "8px",
            border: "1px solid",
            borderColor: activeTab === "diagnose" ? "rgba(56, 189, 248, 0.3)" : "transparent",
            backgroundColor: activeTab === "diagnose" ? "rgba(56, 189, 248, 0.1)" : "transparent",
            color: activeTab === "diagnose" ? "var(--primary)" : "var(--text-muted)",
            fontSize: "0.875rem",
            fontWeight: 600,
            cursor: "pointer",
            textAlign: "left",
            transition: "all 0.15s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
            <span>Live Workspace</span>
          </div>
          <span style={{ fontSize: "0.7rem", background: "rgba(56,189,248,0.2)", padding: "2px 6px", borderRadius: "4px" }}>
            Active
          </span>
        </button>

        <button
          onClick={() => onOpenHistory()}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.75rem 1rem",
            borderRadius: "8px",
            border: "1px solid transparent",
            backgroundColor: "transparent",
            color: "var(--text-muted)",
            fontSize: "0.875rem",
            fontWeight: 600,
            cursor: "pointer",
            textAlign: "left",
            transition: "all 0.15s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>Run History</span>
          </div>
          {historyCount > 0 && (
            <span style={{ fontSize: "0.75rem", background: "rgba(255,255,255,0.1)", color: "#e2e8f0", padding: "1px 7px", borderRadius: "9999px" }}>
              {historyCount}
            </span>
          )}
        </button>
      </nav>

      {/* Probes Capability Status */}
      <div style={{
        marginTop: "auto",
        borderTop: "1px solid var(--border-card)",
        paddingTop: "1.25rem",
      }}>
        <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.875rem" }}>
          Engine Probes Status
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem", fontSize: "0.8rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "var(--text-muted)" }}>TCP / Port Checks</span>
            <span className="badge badge-success">Ready</span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "var(--text-muted)" }}>DNS Diagnostics</span>
            <span className="badge badge-success">Ready</span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "var(--text-muted)" }}>TLS Inspection</span>
            <span className="badge badge-success">Ready</span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "var(--text-muted)" }}>Local Port & PID</span>
            <span className="badge badge-success">Windows API</span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem", paddingTop: "0.5rem", borderTop: "1px dashed rgba(255,255,255,0.06)" }}>
            <span style={{ color: "var(--text-muted)" }}>Ollama AI Explainer</span>
            {systemStatus?.ollamaOnline ? (
              <span className="badge badge-info">Online</span>
            ) : (
              <span className="badge" style={{ background: "rgba(148, 163, 184, 0.15)", color: "#94a3b8" }}>Standby</span>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};
