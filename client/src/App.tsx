import React, { useState, useEffect } from "react";
import { Sidebar } from "./components/Sidebar.js";
import { Header } from "./components/Header.js";
import { DiagnosticForm } from "./components/DiagnosticForm.js";
import { FindingsList } from "./components/FindingsList.js";
import { ProbeResults } from "./components/ProbeResults.js";
import { AiExplanation } from "./components/AiExplanation.js";
import { HistoryDrawer } from "./components/HistoryDrawer.js";
import { runDiagnostic, fetchHistory, fetchSystemStatus } from "./api.js";
import { DiagnosticReport, HistoryItem, SystemStatus } from "./types.js";

export const App: React.FC = () => {
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"diagnose" | "history">("diagnose");

  // Form input presets
  const [currentHost, setCurrentHost] = useState("localhost");
  const [currentPort, setCurrentPort] = useState(5000);

  // Load initial system status and history
  useEffect(() => {
    fetchSystemStatus().then(setSystemStatus).catch(console.error);
    fetchHistory().then(setHistory).catch(console.error);
  }, []);

  const handleRunDiagnostic = async (params: { host: string; port?: number; url?: string }) => {
    setLoading(true);
    try {
      const res = await runDiagnostic(params);
      setReport(res.report);
      // Refresh history
      const updatedHistory = await fetchHistory();
      setHistory(updatedHistory);
    } catch (err: any) {
      alert(`Diagnostic Failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePresetSelect = (host: string, port: number) => {
    setCurrentHost(host);
    setCurrentPort(port);
  };

  const handleSelectHistoryRun = (item: HistoryItem) => {
    setReport(item.report);
    setCurrentHost(item.targetHost);
    if (item.targetPort) setCurrentPort(item.targetPort);
  };

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* Sidebar */}
      <Sidebar
        systemStatus={systemStatus}
        onOpenHistory={() => setIsHistoryOpen(true)}
        historyCount={history.length}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Main Workspace */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100vh", overflowY: "auto" }}>
        <Header systemStatus={systemStatus} onPresetSelect={handlePresetSelect} />

        <main style={{ padding: "2rem", maxWidth: "1200px", width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
          {/* Diagnostic Inputs */}
          <DiagnosticForm
            onRun={handleRunDiagnostic}
            loading={loading}
            defaultHost={currentHost}
            defaultPort={currentPort}
          />

          {/* Results Workspace */}
          {report ? (
            <div>
              {/* Findings & Root Causes */}
              <FindingsList findings={report.findings} />

              {/* Optional Ollama AI Layer */}
              <AiExplanation
                report={report}
                ollamaOnline={systemStatus?.ollamaOnline ?? false}
              />

              {/* Raw Probes & Evidence */}
              <ProbeResults probes={report.probes} />
            </div>
          ) : (
            <div className="glass-panel" style={{
              padding: "4rem 2rem",
              textAlign: "center",
              border: "1px dashed var(--border-card)",
            }}>
              <div style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "rgba(56, 189, 248, 0.1)",
                color: "var(--primary)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "1rem",
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#f8fafc", marginBottom: "0.5rem" }}>
                Ready to Troubleshoot
              </h3>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", maxWidth: "450px", margin: "0 auto" }}>
                Select a target host or port above and click <strong>Run Diagnostics</strong> to inspect local sockets, TCP latency, and diagnose connection errors.
              </p>
            </div>
          )}
        </main>
      </div>

      {/* History Slide-over Drawer */}
      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onSelectRun={handleSelectHistoryRun}
      />
    </div>
  );
};
