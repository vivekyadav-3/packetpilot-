import { Router, Request, Response } from "express";
import { z } from "zod";
import { runFullDiagnostic } from "../engine/report.js";
import { checkTcpPort } from "../diagnostics/tcp.js";
import { resolveDns } from "../diagnostics/dns.js";
import { inspectLocalPort } from "../diagnostics/local-port.js";
import { checkHttp } from "../diagnostics/http.js";
import { inspectTls } from "../diagnostics/tls.js";
import { explainReportWithOllama, checkOllamaAvailability } from "../ai/ollama.js";
import { DiagnosticHistory } from "../storage/history.js";
import { validateTarget, securityLimiter } from "../security/target-policy.js";

export const apiRouter = Router();

// Validation Schemas
const DiagnoseSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535).optional(),
  url: z.string().url().optional(),
});

function getSingleQueryString(param: unknown): string | undefined {
  if (Array.isArray(param)) return String(param[0]);
  if (typeof param === "string") return param;
  return undefined;
}

// Full Diagnostic with Security Hardening
apiRouter.post("/diagnose", async (req: Request, res: Response) => {
  const clientIp = req.ip || req.socket.remoteAddress || "127.0.0.1";

  // Rate Limiting Check
  const rateCheck = securityLimiter.checkRateLimit(clientIp);
  if (!rateCheck.allowed) {
    return res.status(429).json({
      error: `Rate limit exceeded. Please wait ${rateCheck.retryAfterSeconds} seconds before launching more diagnostics.`,
    });
  }

  // Concurrency Guard
  if (!securityLimiter.acquireConcurrency()) {
    return res.status(503).json({
      error: "Server diagnostic concurrency limit reached. Please retry in a few moments.",
    });
  }

  try {
    const parsed = DiagnoseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid parameters", details: parsed.error.format() });
    }

    const { host, port, url } = parsed.data;

    // Security & Target Policy Validation
    const validation = validateTarget(host, port, url);
    if (!validation.allowed) {
      return res.status(403).json({
        error: "Security Policy Violation",
        reason: validation.rejectionReason,
      });
    }

    const report = await runFullDiagnostic({
      host: validation.sanitizedHost || host,
      port: validation.sanitizedPort ?? port,
      url: validation.sanitizedUrl ?? url,
    });

    // Save to history
    const historyItem = await DiagnosticHistory.saveRun(report);

    return res.json({
      report,
      historyId: historyItem.id,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  } finally {
    securityLimiter.releaseConcurrency();
  }
});

// Ollama Explanation
apiRouter.post("/explain", async (req: Request, res: Response) => {
  try {
    const { report } = req.body;
    if (!report) {
      return res.status(400).json({ error: "Missing diagnostic report in request body." });
    }

    const explanation = await explainReportWithOllama(report);
    return res.json(explanation);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// History List
apiRouter.get("/history", async (_req: Request, res: Response) => {
  try {
    const runs = await DiagnosticHistory.getRuns(50);
    return res.json(runs);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

apiRouter.get("/history/:id", async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const item = await DiagnosticHistory.getRunById(id);
    if (!item) {
      return res.status(404).json({ error: "Diagnostic run not found." });
    }
    return res.json(item);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Individual Probes with Target Validation
apiRouter.get("/probe/local-port", async (req: Request, res: Response) => {
  const portStr = getSingleQueryString(req.query.port);
  const port = parseInt(portStr || "", 10);
  const validation = validateTarget("localhost", port);
  if (!validation.allowed) {
    return res.status(403).json({ error: validation.rejectionReason });
  }
  const result = await inspectLocalPort(validation.sanitizedPort!);
  return res.json(result);
});

apiRouter.get("/probe/tcp", async (req: Request, res: Response) => {
  const host = getSingleQueryString(req.query.host) || "localhost";
  const portStr = getSingleQueryString(req.query.port);
  const port = parseInt(portStr || "", 10);
  const validation = validateTarget(host, port);
  if (!validation.allowed) {
    return res.status(403).json({ error: validation.rejectionReason });
  }
  const result = await checkTcpPort({ host: validation.sanitizedHost!, port: validation.sanitizedPort! });
  return res.json(result);
});

apiRouter.get("/probe/dns", async (req: Request, res: Response) => {
  const host = getSingleQueryString(req.query.host);
  if (!host) {
    return res.status(400).json({ error: "Host parameter is required" });
  }
  const validation = validateTarget(host);
  if (!validation.allowed) {
    return res.status(403).json({ error: validation.rejectionReason });
  }
  const result = await resolveDns(validation.sanitizedHost!);
  return res.json(result);
});

apiRouter.get("/probe/http", async (req: Request, res: Response) => {
  const url = getSingleQueryString(req.query.url);
  if (!url) {
    return res.status(400).json({ error: "URL parameter is required" });
  }
  const validation = validateTarget("localhost", undefined, url);
  if (!validation.allowed) {
    return res.status(403).json({ error: validation.rejectionReason });
  }
  const result = await checkHttp(validation.sanitizedUrl!);
  return res.json(result);
});

apiRouter.get("/probe/tls", async (req: Request, res: Response) => {
  const host = getSingleQueryString(req.query.host);
  const portStr = getSingleQueryString(req.query.port);
  const port = parseInt(portStr || "443", 10);
  if (!host) {
    return res.status(400).json({ error: "Host parameter is required" });
  }
  const validation = validateTarget(host, port);
  if (!validation.allowed) {
    return res.status(403).json({ error: validation.rejectionReason });
  }
  const result = await inspectTls(validation.sanitizedHost!, validation.sanitizedPort!);
  return res.json(result);
});

// System Status
apiRouter.get("/status", async (_req: Request, res: Response) => {
  const ollamaOnline = await checkOllamaAvailability();
  return res.json({
    name: "PacketPilot Core",
    version: "1.0.0",
    platform: process.platform,
    arch: process.arch,
    ollamaOnline,
    model: process.env.OLLAMA_MODEL || "qwen2.5:3b",
  });
});
