import React from "react";
import { HistoryItem } from "../types.js";

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryItem[];
  onSelectRun: (item: HistoryItem) => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  history,
  onSelectRun,
}) => {
  if (!isOpen) return null;

  return (
    <div style={{
      position: "fixed",
      top: 0,
      right: 0,
      bottom: 0,
      width: "420px",
      backgroundColor: "var(--bg-sidebar)",
      borderLeft: "1px solid var(--border-card)",
      boxShadow: "-10px 0 30px rgba(0, 0, 0, 0.6)",
      zIndex: 50,
      display: "flex",
      flexDirection: "column",
    }}>
      <div style={{
        padding: "1.25rem 1.5rem",
        borderBottom: "1px solid var(--border-card)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <div>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#f8fafc" }}>
            Diagnostic History
          </h3>
          <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
            Previous runs stored locally in SQLite / JSON
          </span>
        </div>

        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            padding: "0.4rem",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "1rem" }}>
        {history.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--text-dim)", fontSize: "0.85rem" }}>
            No past diagnostic runs recorded yet.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {history.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  onSelectRun(item);
                  onClose();
                }}
                className="glass-panel"
                style={{
                  padding: "1rem",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  borderLeft: item.hasErrors ? "3px solid var(--accent-danger)" : "3px solid var(--accent-success)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-card-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-card)")}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.35rem" }}>
                  <code style={{ fontSize: "0.85rem", color: "#f8fafc", fontWeight: 700 }}>
                    {item.targetHost}:{item.targetPort || "?"}
                  </code>
                  <span className={`badge ${item.hasErrors ? "badge-danger" : "badge-success"}`} style={{ fontSize: "0.65rem" }}>
                    {item.findingsCount} issue{item.findingsCount === 1 ? "" : "s"}
                  </span>
                </div>

                <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                  {new Date(item.timestamp).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
