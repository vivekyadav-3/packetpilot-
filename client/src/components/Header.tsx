import React from "react";
import { SystemStatus } from "../types.js";

interface HeaderProps {
  systemStatus: SystemStatus | null;
  onPresetSelect: (host: string, port: number) => void;
}

export const Header: React.FC<HeaderProps> = ({ systemStatus, onPresetSelect }) => {
  return (
    <header style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "1rem 2rem",
      borderBottom: "1px solid var(--border-card)",
      backgroundColor: "rgba(9, 13, 22, 0.8)",
      backdropFilter: "blur(8px)",
      position: "sticky",
      top: 0,
      zIndex: 20,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <span style={{ fontSize: "0.8rem", color: "var(--text-dim)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Common Presets:
        </span>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {[
            { label: "Express (5000)", host: "localhost", port: 5000 },
            { label: "Vite (3000)", host: "localhost", port: 3000 },
            { label: "Next.js (3000)", host: "localhost", port: 3000 },
            { label: "API (8080)", host: "localhost", port: 8080 },
          ].map((preset) => (
            <button
              key={preset.label}
              onClick={() => onPresetSelect(preset.host, preset.port)}
              style={{
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "6px",
                padding: "0.3rem 0.65rem",
                color: "var(--text-muted)",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--primary)";
                e.currentTarget.style.color = "#f8fafc";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)";
                e.currentTarget.style.color = "var(--text-muted)";
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        {systemStatus && (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.35rem 0.75rem",
            background: "rgba(255, 255, 255, 0.03)",
            borderRadius: "6px",
            border: "1px solid rgba(255, 255, 255, 0.06)",
            fontSize: "0.75rem",
            color: "var(--text-muted)",
          }}>
            <span style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              backgroundColor: "var(--accent-success)",
              boxShadow: "0 0 8px #10b981",
            }} />
            <span>Node Core: Windows {systemStatus.arch}</span>
          </div>
        )}
      </div>
    </header>
  );
};
