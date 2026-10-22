import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { checkTcpPort } from "../diagnostics/tcp.js";
import { resolveDns } from "../diagnostics/dns.js";
import { inspectLocalPort } from "../diagnostics/local-port.js";
import { checkHttp } from "../diagnostics/http.js";
import { inspectTls } from "../diagnostics/tls.js";
import { runFullDiagnostic } from "../engine/report.js";

// Initialize MCP Server
const server = new McpServer({
  name: "packetpilot-mcp",
  version: "1.0.0",
});

// Tool 1: inspect_local_port
server.tool(
  "inspect_local_port",
  "Inspect whether a local port is listening on the host machine and identify the owning process and PID",
  {
    port: z.number().int().min(1).max(65535).describe("Port number to inspect (e.g., 3000, 5000, 8080)"),
  },
  async ({ port }) => {
    const result = await inspectLocalPort(port);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);

// Tool 2: check_tcp_port
server.tool(
  "check_tcp_port",
  "Test TCP connection to a host and port, distinguishing between connection refused (ECONNREFUSED) and timeout",
  {
    host: z.string().describe("Target hostname or IP address (e.g. localhost, 127.0.0.1, example.com)"),
    port: z.number().int().min(1).max(65535).describe("TCP port number (e.g. 80, 443, 5000)"),
    timeoutMs: z.number().optional().describe("Connection timeout in milliseconds (default: 3000)"),
  },
  async ({ host, port, timeoutMs }) => {
    const result = await checkTcpPort({ host, port, timeoutMs });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);

// Tool 3: resolve_dns
server.tool(
  "resolve_dns",
  "Resolve IPv4 (A) and IPv6 (AAAA) DNS records for a given hostname and check resolution timing",
  {
    hostname: z.string().describe("Hostname to resolve (e.g. google.com, localhost)"),
  },
  async ({ hostname }) => {
    const result = await resolveDns(hostname);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);

// Tool 4: check_http
server.tool(
  "check_http",
  "Send an HTTP GET request to check response code, headers, and time to first byte (TTFB)",
  {
    url: z.string().url().describe("Full HTTP/HTTPS URL (e.g. http://localhost:5000/api/health)"),
    timeoutMs: z.number().optional().describe("Request timeout in milliseconds (default: 5000)"),
  },
  async ({ url, timeoutMs }) => {
    const result = await checkHttp(url, timeoutMs);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);

// Tool 5: inspect_tls
server.tool(
  "inspect_tls",
  "Inspect TLS certificate expiration, authorization status, subject, issuer, and SANs",
  {
    hostname: z.string().describe("Target hostname (e.g. github.com)"),
    port: z.number().optional().describe("Target TLS port (default: 443)"),
    timeoutMs: z.number().optional().describe("Handshake timeout in milliseconds (default: 4000)"),
  },
  async ({ hostname, port, timeoutMs }) => {
    const result = await inspectTls(hostname, port || 443, timeoutMs);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);

// Tool 6: run_full_diagnostic
server.tool(
  "run_full_diagnostic",
  "Run the complete suite of network probes against a target host/port/URL and return deterministic root-cause findings",
  {
    host: z.string().describe("Target host (e.g. localhost or api.service.com)"),
    port: z.number().optional().describe("Target port (e.g. 5000)"),
    url: z.string().optional().describe("Full URL to test HTTP layer (e.g. http://localhost:5000)"),
  },
  async ({ host, port, url }) => {
    const report = await runFullDiagnostic({ host, port, url });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(report, null, 2),
        },
      ],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("PacketPilot MCP Server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error in MCP server:", err);
  process.exit(1);
});
