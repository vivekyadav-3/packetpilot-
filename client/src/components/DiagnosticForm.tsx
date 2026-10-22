import React, { useState } from "react";

interface DiagnosticFormProps {
  onRun: (params: { host: string; port?: number; url?: string }) => void;
  loading: boolean;
  defaultHost?: string;
  defaultPort?: number;
}

export const DiagnosticForm: React.FC<DiagnosticFormProps> = ({
  onRun,
  loading,
  defaultHost = "localhost",
  defaultPort = 5000,
}) => {
  const [host, setHost] = useState(defaultHost);
  const [port, setPort] = useState<number | string>(defaultPort);
  const [url, setUrl] = useState("");
  const [useUrl, setUseUrl] = useState(false);

  // Sync state if defaults change from preset clicks
  React.useEffect(() => {
    setHost(defaultHost);
    setPort(defaultPort);
  }, [defaultHost, defaultPort]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (useUrl && url.trim()) {
      try {
        const parsed = new URL(url.trim());
        onRun({
          host: parsed.hostname,
          port: parsed.port ? parseInt(parsed.port, 10) : parsed.protocol === "https:" ? 443 : 80,
          url: url.trim(),
        });
      } catch {
        alert("Please enter a valid URL (e.g. http://localhost:5000/api/users)");
      }
    } else {
      onRun({
        host: host.trim(),
        port: port ? parseInt(String(port), 10) : undefined,
      });
    }
  };

  return (
    <div className="glass-panel" style={{ padding: "1.5rem", marginBottom: "1.75rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
        <div>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#f8fafc" }}>
            Run Network Diagnostic
          </h2>
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
            Inspect local sockets, verify TCP connectivity, test DNS resolution, and evaluate root cause.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8rem", color: "var(--text-muted)" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={useUrl}
              onChange={(e) => setUseUrl(e.target.checked)}
              style={{ accentColor: "var(--primary)" }}
            />
            <span>Full HTTP URL Mode</span>
          </label>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {!useUrl ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 180px auto", gap: "1rem", alignItems: "flex-end" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "0.4rem" }}>
                Target Host or Domain
              </label>
              <input
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="localhost, 127.0.0.1, api.domain.com"
                required
                style={{
                  width: "100%",
                  padding: "0.65rem 0.85rem",
                  borderRadius: "8px",
                  border: "1px solid var(--border-card)",
                  backgroundColor: "rgba(0, 0, 0, 0.4)",
                  color: "#f8fafc",
                  fontSize: "0.9rem",
                  fontFamily: "var(--font-mono)",
                  outline: "none",
                }}
                onFocus={(e) => (e.target.style.borderColor = "var(--border-focus)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border-card)")}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "0.4rem" }}>
                Port
              </label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="5000"
                min="1"
                max="65535"
                required
                style={{
                  width: "100%",
                  padding: "0.65rem 0.85rem",
                  borderRadius: "8px",
                  border: "1px solid var(--border-card)",
                  backgroundColor: "rgba(0, 0, 0, 0.4)",
                  color: "#f8fafc",
                  fontSize: "0.9rem",
                  fontFamily: "var(--font-mono)",
                  outline: "none",
                }}
                onFocus={(e) => (e.target.style.borderColor = "var(--border-focus)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border-card)")}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="glow-btn"
              style={{
                height: "42px",
                padding: "0 1.5rem",
                borderRadius: "8px",
                fontWeight: 700,
                fontSize: "0.875rem",
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              {loading ? (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  <span>Probing...</span>
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  <span>Run Diagnostics</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "1rem", alignItems: "flex-end" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "0.4rem" }}>
                Target Endpoint URL
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="http://localhost:5000/api/v1/health"
                required
                style={{
                  width: "100%",
                  padding: "0.65rem 0.85rem",
                  borderRadius: "8px",
                  border: "1px solid var(--border-card)",
                  backgroundColor: "rgba(0, 0, 0, 0.4)",
                  color: "#f8fafc",
                  fontSize: "0.9rem",
                  fontFamily: "var(--font-mono)",
                  outline: "none",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="glow-btn"
              style={{
                height: "42px",
                padding: "0 1.5rem",
                borderRadius: "8px",
                fontWeight: 700,
                fontSize: "0.875rem",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Probing..." : "Run Diagnostics"}
            </button>
          </div>
        )}
      </form>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
