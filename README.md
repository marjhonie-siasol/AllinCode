<div align="center">
  <img src="packages/app/public/favicon-512.png" alt="All In Code Logo" width="128" />

  # All In Code

  <p align="center">
    <strong>The Real-Time Agent Interceptor & Deterministic Execution Engine</strong>
  </p>
  <p align="center">
    Pure Rust Boa Isolate Sandbox • Sub-millisecond Execution • Dynamic Agent Wiretap • Human-in-the-Loop Approvals
  </p>
</div>

---

## Overview

**All In Code** replaces prompt-bloating Model Context Protocol (MCP) tool schemas with deterministic, sandboxed execution and real-time agent interception.

Instead of dumping dozens of static JSON tool schemas into an AI model's context window (consuming 35,000+ tokens on every single turn), All In Code:
1. **Dynamic Real-Time Interception**: Passively monitors agent event streams (Google Antigravity, Claude Code, Cursor) and intercepts model switches, prompts, and tool requests.
2. **Intent Pruning & Bypass**: Classifies user prompts. Non-tool prompts receive 100% schema bypass, preserving the entire context window for LLM reasoning.
3. **Pure Rust Sandbox (`boa_engine`)**: Runs model-generated JavaScript code inside a native, sub-millisecond Rust Boa sandbox with zero host bloat.
4. **Interactive Dashboard & Approvals**: Real-time WebSockets telemetry and human-in-the-loop confirmation before destructive actions (e.g. database mutations, Docker builds, API writes).

---

## Architecture

```
+-----------------------------------------------------------------------+
|                       YOUR CODING AGENTS                              |
|                                                                       |
|  [Antigravity IDE]        [Claude Code CLI]        [Cursor / Codex]   |
|   ~/.gemini/antigravity/   ~/.claude/logs/          ~/.cursor/        |
|         |                        |                       |            |
+---------+------------------------+-----------------------+------------+
          |                        |                       |
          v                        v                       v
+-----------------------------------------------------------------------+
|                     ALL IN CODE INTERCEPTOR CORE                      |
|                                                                       |
|   1. REAL-TIME AGENT CRAWLER (`@allincode/gateway`)                   |
|      - Non-blocking byte-offset stream reader                         |
|      - Detects model switches & context window limits in <15ms        |
|      - Intercepts prompt inputs & agent tool requests                 |
|                                                                       |
|   2. RUST ISOLATE DAEMON (`crates/allincode-server`)                  |
|      - Axum v0.8 + Tokio WebSockets (Port 4000)                       |
|      - Embedded Boa JavaScript engine (`boa_engine v0.22.0`)          |
|      - Zero external VM overhead | <15MB RAM footprint                |
|                                                                       |
|   3. TWO STREAM EMITTERS                                              |
|      -> Terminal CLI (`aic`): Live scrolling event wiretap            |
|      -> Web Dashboard (Port 5173): Real-time token analytics & UI     |
+-----------------------------------------------------------------------+
```

---

## Key Benefits

* **Up to 98% Token Reduction**: Eliminates static tool schema injection across turns.
* **Deterministic Sandboxing**: Executes scripts inside an isolated memory space without granting raw shell access.
* **Real-Time Wiretap**: Automatically mirrors live tool calls and agent events without manual configuration.
* **Zero Host Overhead**: Fast compiled Rust daemon running alongside a lightweight Node.js/TypeScript CLI.

---

## Quick Start

### Global Installation
```bash
npm install -g all-in-code
```

### Start Live Interception
```bash
aic
```

### Editor Configuration (Antigravity / Cursor / Claude Desktop)
Add this to your `mcp.json` or `mcp_config.json`:
```json
{
  "mcpServers": {
    "all-in-code": {
      "command": "aic",
      "args": ["serve"]
    }
  }
}
```

---

## Repository Structure

```
├── crates/
│   ├── allincode-core/        # Rust Boa JavaScript isolate engine & runtime
│   └── allincode-server/      # Axum REST & WebSocket daemon (Port 4000)
├── packages/
│   ├── app/                   # React 18 + Tailwind control dashboard (Port 5173)
│   ├── cli/                   # Global terminal command (`aic` / `all-in-code`)
│   ├── gateway/               # Real-time agent crawler & MCP server adapter
│   ├── core/                  # Core orchestration primitives
│   └── typegen/               # TypeScript type extraction and AST parser
├── Cargo.toml                 # Rust workspace configuration
└── package.json               # Monorepo npm workspaces configuration
```

---

## License

This project is licensed under the Apache License 2.0. See the [LICENSE](LICENSE) file for details.
