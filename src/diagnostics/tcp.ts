import * as net from "node:net";
import { TcpProbeResult } from "./types.js";

export interface CheckTcpOptions {
  host: string;
  port: number;
  timeoutMs?: number;
}

export async function checkTcpPort({
  host,
  port,
  timeoutMs = 3000,
}: CheckTcpOptions): Promise<TcpProbeResult> {
  const startTime = Date.now();

  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isRefused = false;
    let isTimeout = false;
    let resolved = false;

    socket.setTimeout(timeoutMs);

    socket.connect(port, host, () => {
      if (resolved) return;
      resolved = true;
      const durationMs = Date.now() - startTime;
      socket.destroy();
      resolve({
        target: `${host}:${port}`,
        port,
        timestamp: new Date().toISOString(),
        durationMs,
        status: "SUCCESS",
        connected: true,
        isRefused: false,
        isTimeout: false,
      });
    });

    socket.on("timeout", () => {
      if (resolved) return;
      resolved = true;
      isTimeout = true;
      const durationMs = Date.now() - startTime;
      socket.destroy();
      resolve({
        target: `${host}:${port}`,
        port,
        timestamp: new Date().toISOString(),
        durationMs,
        status: "FAILED",
        connected: false,
        isRefused: false,
        isTimeout: true,
        error: `Connection timed out after ${timeoutMs}ms`,
      });
    });

    socket.on("error", (err: NodeJS.ErrnoException) => {
      if (resolved) return;
      resolved = true;
      const durationMs = Date.now() - startTime;
      if (err.code === "ECONNREFUSED") {
        isRefused = true;
      }

      socket.destroy();
      resolve({
        target: `${host}:${port}`,
        port,
        timestamp: new Date().toISOString(),
        durationMs,
        status: "FAILED",
        connected: false,
        isRefused,
        isTimeout,
        error: err.message,
      });
    });
  });
}
