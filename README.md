# 🧭 PacketPilot

> **Local-first Network Diagnostics and Troubleshooting Platform for Developers**

PacketPilot solves everyday local network and backend issues (like `ERR_CONNECTION_REFUSED`, port collisions, loopback binding mismatches, and DNS family quirks) through **deterministic evidence-based checks first**, augmented by optional local AI explanations via Ollama.

---

## 🏗️ Architecture

```
packetpilot/
├── src/
│   ├── diagnostics/           # Network & OS probes
│   │   ├── types.ts           # Shared TypeScript interfaces
│   │   ├── tcp.ts             # TCP socket connection & timeout analysis
│   │   ├── dns.ts             # IPv4 (A) & IPv6 (AAAA) dual resolution
│   │   ├── local-port.ts      # Windows netstat & tasklist PID inspector
│   │   ├── http.ts            # TTFB, response codes & header inspector
│   │   └── tls.ts             # SSL/TLS cert validation & expiry inspector
│   ├── engine/
│   │   ├── rules.ts           # Deterministic root-cause evaluation rules
│   │   └── report.ts          # Probe orchestrator & report aggregator
│   ├── mcp/
│   │   └── server.ts          # Official TypeScript MCP Stdio Server
│   ├── api/
│   │   └── routes.ts          # Express REST API routes
│   ├── storage/
│   │   └── history.ts         # Persistent diagnostic history storage
│   ├── ai/
│   │   └── ollama.ts          # Optional local Ollama LLM integration
│   ├── cli.ts                 # Terminal diagnostic runner
│   └── server.ts              # Express API server entrypoint
├── client/                    # Dark developer-focused React dashboard
│   ├── src/
│   │   ├── components/        # Sidebar, Header, Form, Findings, Cards
│   │   ├── App.tsx            # Main diagnostics dashboard
│   │   └── index.css          # Glassmorphism styling & tokens
│   └── vite.config.ts         # Vite configuration with API proxy
└── test/
    └── diagnostics.test.ts    # Unit test suite
```

---

## 🚀 Quick Start

### 1. Install Dependencies
```powershell
# Root backend dependencies
npm install

# Frontend dashboard dependencies
cd client
npm install
cd ..
```

---

### 2. Run via CLI
Diagnose any port or host immediately:
```powershell
# Check a closed or active port
npm start localhost 5000

# With optional Ollama explanation (requires local Ollama running)
npm start localhost 5000 --ai
```

---

### 3. Run the Web Dashboard
Open two terminal windows:

**Terminal 1 (Backend API):**
```powershell
npm run server
```
*API will run at `http://localhost:4000`*

**Terminal 2 (React Frontend):**
```powershell
cd client
npm run dev
```
*Dashboard will open at `http://localhost:3000`*

---

### 4. Run as an MCP Server
PacketPilot provides standard Model Context Protocol (MCP) tools over stdio:
```powershell
npm run mcp
```

#### Available MCP Tools:
- `inspect_local_port`: Detects listening ports, process name, and PID on Windows.
- `check_tcp_port`: Tests TCP connection, measuring latency and distinguishing ECONNREFUSED from timeouts.
- `resolve_dns`: Resolves IPv4 and IPv6 records with resolution timing.
- `check_http`: Tests HTTP status codes, headers, and TTFB.
- `inspect_tls`: Validates TLS certificates and expiry days.
- `run_full_diagnostic`: Runs all probes and returns structured root-cause findings.

---

### 5. Running Tests
```powershell
npm test
```
All unit tests verify:
- Deterministic rule engine logic
- Closed & open port diagnostics
- DNS resolution fallbacks
- HTTP 404 & server error categorization

---

## 🛡️ Safety & Local-First Philosophy
- **Local Isolation:** Process detection is scoped strictly to local system sockets.
- **No Hallucinations:** Root cause findings are derived 100% from deterministic network probes before being handed to Ollama.
- **Works Offline:** If Ollama is offline or disabled, PacketPilot operates completely without degradation.
