import { exec } from "node:child_process";
import { promisify } from "node:util";
import { LocalPortProbeResult, LocalPortProcessInfo } from "./types.js";

const execAsync = promisify(exec);

async function getProcessNameWindows(pid: number): Promise<string> {
  try {
    const { stdout } = await execAsync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`);
    const line = stdout.trim();
    if (!line || line.startsWith("INFO:")) return "Unknown";
    // CSV output format: "image.exe","pid","session name","session#","mem usage"
    const match = line.split(",")[0]?.replace(/^"|"$/g, "");
    return match || "Unknown";
  } catch {
    return "Unknown";
  }
}

export async function inspectLocalPort(port: number): Promise<LocalPortProbeResult> {
  const startTime = Date.now();
  const isWindows = process.platform === "win32";

  if (!isWindows) {
    return {
      target: `localhost:${port}`,
      port,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      status: "SKIPPED",
      isListening: false,
      error: "Non-Windows OS process detection not implemented yet",
    };
  }

  try {
    // netstat -ano returns: Proto Local-Address Foreign-Address State PID
    const { stdout } = await execAsync(`netstat -ano -p tcp`);
    const lines = stdout.split("\r\n");

    let foundInfo: LocalPortProcessInfo | undefined = undefined;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith("TCP")) continue;

      const parts = line.split(/\s+/);
      if (parts.length < 5) continue;

      const [protocol, localAddr, foreignAddr, state, pidStr] = parts;

      const lastColonIndex = localAddr.lastIndexOf(":");
      if (lastColonIndex === -1) continue;

      const parsedPort = parseInt(localAddr.slice(lastColonIndex + 1), 10);
      const parsedAddress = localAddr.slice(0, lastColonIndex);

      if (parsedPort === port && state.toUpperCase() === "LISTENING") {
        const pid = parseInt(pidStr, 10);
        const processName = await getProcessNameWindows(pid);

        foundInfo = {
          pid,
          processName,
          protocol: "TCP",
          localAddress: parsedAddress,
          localPort: parsedPort,
          state,
        };
        break;
      }
    }

    const durationMs = Date.now() - startTime;
    return {
      target: `localhost:${port}`,
      port,
      timestamp: new Date().toISOString(),
      durationMs,
      status: "SUCCESS",
      isListening: !!foundInfo,
      process: foundInfo,
    };
  } catch (err: any) {
    return {
      target: `localhost:${port}`,
      port,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      status: "FAILED",
      isListening: false,
      error: err.message,
    };
  }
}
