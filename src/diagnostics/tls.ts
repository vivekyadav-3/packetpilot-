import * as tls from "node:tls";
import { TlsProbeResult } from "./types.js";

function formatCertField(val: string | string[] | undefined): string | undefined {
  if (Array.isArray(val)) return val.join(", ");
  return val;
}

export async function inspectTls(hostname: string, port = 443, timeoutMs = 4000): Promise<TlsProbeResult> {
  const startTime = Date.now();

  return new Promise((resolve) => {
    let resolved = false;

    const socket = tls.connect(
      {
        host: hostname,
        port,
        servername: hostname,
        timeout: timeoutMs,
        rejectUnauthorized: false, // We inspect even invalid/self-signed certs to report exact errors
      },
      () => {
        if (resolved) return;
        resolved = true;
        const cert = socket.getPeerCertificate(true);
        const authorized = socket.authorized;
        const authError = socket.authorizationError ? String(socket.authorizationError) : undefined;
        const durationMs = Date.now() - startTime;

        let daysRemaining: number | undefined;
        if (cert.valid_to) {
          const expiryTime = new Date(cert.valid_to).getTime();
          daysRemaining = Math.floor((expiryTime - Date.now()) / (1000 * 60 * 60 * 24));
        }

        socket.destroy();
        resolve({
          target: `${hostname}:${port}`,
          hostname,
          port,
          timestamp: new Date().toISOString(),
          durationMs,
          status: "SUCCESS",
          authorized,
          authorizationError: authError,
          validFrom: cert.valid_from,
          validTo: cert.valid_to,
          daysRemaining,
          issuer: typeof cert.issuer === "object" ? formatCertField(cert.issuer?.O || cert.issuer?.CN) : undefined,
          subject: typeof cert.subject === "object" ? formatCertField(cert.subject?.CN) : undefined,
          sans: cert.subjectaltname?.split(", ").map((s) => s.replace("DNS:", "")),
        });
      }
    );

    socket.on("timeout", () => {
      if (resolved) return;
      resolved = true;
      socket.destroy();
      resolve({
        target: `${hostname}:${port}`,
        hostname,
        port,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        status: "FAILED",
        authorized: false,
        error: `TLS handshake timed out after ${timeoutMs}ms`,
      });
    });

    socket.on("error", (err) => {
      if (resolved) return;
      resolved = true;
      socket.destroy();
      resolve({
        target: `${hostname}:${port}`,
        hostname,
        port,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        status: "FAILED",
        authorized: false,
        error: err.message,
      });
    });
  });
}
