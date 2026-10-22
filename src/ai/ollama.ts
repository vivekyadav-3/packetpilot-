import { DiagnosticReport } from "../diagnostics/types.js";

export interface OllamaConfig {
  baseUrl: string;
  model: string;
  enabled: boolean;
  timeoutMs: number;
}

const DEFAULT_CONFIG: OllamaConfig = {
  baseUrl: process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434",
  model: process.env.OLLAMA_MODEL || "qwen2.5:3b",
  enabled: process.env.ENABLE_AI !== "false",
  timeoutMs: 60000,
};

export interface AiExplanationResponse {
  available: boolean;
  explanation: string;
  modelUsed?: string;
  error?: string;
}

/**
 * Check if the local Ollama instance is reachable
 */
export async function checkOllamaAvailability(baseUrl = DEFAULT_CONFIG.baseUrl): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${baseUrl}/api/tags`, { signal: controller.signal });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Generate a concise, plain-English explanation of the diagnostic report using Ollama
 */
export async function explainReportWithOllama(
  report: DiagnosticReport,
  config: Partial<OllamaConfig> = {}
): Promise<AiExplanationResponse> {
  const mergedConfig: OllamaConfig = { ...DEFAULT_CONFIG, ...config };

  if (!mergedConfig.enabled) {
    return {
      available: false,
      explanation: "AI explanation is disabled by configuration.",
    };
  }

  const isOllamaUp = await checkOllamaAvailability(mergedConfig.baseUrl);
  if (!isOllamaUp) {
    return {
      available: false,
      explanation:
        "Ollama is currently unreachable on " +
        mergedConfig.baseUrl +
        ". Ensure Ollama is running ('ollama serve') to get natural language explanations.",
    };
  }

  // Construct a strict, grounded prompt based only on deterministic findings
  const systemPrompt = `You are PacketPilot's network assistant. Your job is to explain the provided deterministic network diagnostic report in simple, clear, technical English.
CRITICAL RULES:
1. Do NOT invent causes not backed by the report.
2. Stick strictly to the evidence provided.
3. Be concise (2-4 bullet points max).
4. Clearly state what is broken, why, and the exact command or action to fix it.`;

  const userContent = JSON.stringify({
    target: report.target,
    findings: report.findings,
    probes_summary: {
      localPort: report.probes.localPort ? {
        isListening: report.probes.localPort.isListening,
        process: report.probes.localPort.process?.processName,
        pid: report.probes.localPort.process?.pid,
      } : undefined,
      tcp: report.probes.tcp ? {
        connected: report.probes.tcp.connected,
        refused: report.probes.tcp.isRefused,
        timeout: report.probes.tcp.isTimeout,
      } : undefined,
      dns: report.probes.dns ? {
        status: report.probes.dns.status,
        records: report.probes.dns.records,
      } : undefined,
      http: report.probes.http ? {
        statusCode: report.probes.http.statusCode,
      } : undefined,
      tls: report.probes.tls ? {
        authorized: report.probes.tls.authorized,
        daysRemaining: report.probes.tls.daysRemaining,
      } : undefined,
    },
  }, null, 2);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), mergedConfig.timeoutMs);

    const response = await fetch(`${mergedConfig.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: mergedConfig.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Please explain this network diagnostic report:\n\n${userContent}` },
        ],
        stream: false,
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      return {
        available: false,
        explanation: `Ollama returned an error (${response.status}): ${errText}`,
        error: errText,
      };
    }

    const data: any = await response.json();
    return {
      available: true,
      explanation: data.message?.content || "No explanation generated.",
      modelUsed: mergedConfig.model,
    };
  } catch (err: any) {
    return {
      available: false,
      explanation: `Failed to communicate with Ollama: ${err.message}`,
      error: err.message,
    };
  }
}
