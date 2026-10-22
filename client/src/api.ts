import { DiagnosticReport, HistoryItem, SystemStatus } from "./types.js";

const BASE_URL = "";

export async function runDiagnostic(params: {
  host: string;
  port?: number;
  url?: string;
}): Promise<{ report: DiagnosticReport; historyId: string }> {
  const res = await fetch(`${BASE_URL}/api/diagnose`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Diagnostic run failed" }));
    throw new Error(err.error || `HTTP error ${res.status}`);
  }

  return res.json();
}

export async function explainReport(report: DiagnosticReport): Promise<{
  available: boolean;
  explanation: string;
  modelUsed?: string;
  error?: string;
}> {
  const res = await fetch(`${BASE_URL}/api/explain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ report }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to generate AI explanation" }));
    throw new Error(err.error || `HTTP error ${res.status}`);
  }

  return res.json();
}

export async function fetchHistory(): Promise<HistoryItem[]> {
  const res = await fetch(`${BASE_URL}/api/history`);
  if (!res.ok) throw new Error("Failed to load diagnostic history");
  return res.json();
}

export async function fetchSystemStatus(): Promise<SystemStatus> {
  const res = await fetch(`${BASE_URL}/api/status`);
  if (!res.ok) throw new Error("Failed to load system status");
  return res.json();
}
