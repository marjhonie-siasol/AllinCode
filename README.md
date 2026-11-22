<div align="center">
  <img src="assets/logo.png" alt="All In Code Logo" width="600" />
  
  <p align="center">
    <strong>Why click 500 JSON buttons when it could be All In Code?</strong>
  </p>

  <p align="center">
    The high-speed Programmatic Tool Gateway & Sandbox for AI Agents.<br />
    Compresses bloated Model Context Protocol (MCP) tool catalogs into sub-10ms sandboxed TypeScript execution.
  </p>

  <p align="center">
    <a href="#key-features">Key Features</a> •
    <a href="#architecture">Architecture</a> •
    <a href="#quick-start">Quick Start</a> •
    <a href="#mcp-app-control-plane">In-Editor UI</a> •
    <a href="#license">License</a>
  </p>

  <p align="center">
    <img src="https://img.shields.io/badge/License-Apache_2.0-blue.svg" alt="License: Apache 2.0" />
    <img src="https://img.shields.io/badge/MCP-SEP--1865_Compliant-orange.svg" alt="MCP Compliant" />
    <img src="https://img.shields.io/badge/TypeScript-Strict-3178C6.svg" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Cold_Start-<5ms-success.svg" alt="Sub-5ms" />
  </p>
</div>

---

## ⚡ The Problem: Tool Bloat & The "Context Tax"

When you connect 4 or 5 traditional MCP servers (GitHub, Stripe, Postgres, Linear, Slack) to an AI coding editor (Cursor, Claude Desktop, Antigravity):
* **Context Window Overload:** Hundreds of JSON-RPC schemas inject **50,000+ to 100,000+ tokens** into every single message prompt before you even begin.
* **Degraded Intelligence:** LLMs struggle to pick the right function out of a 200-item dropdown menu.
* **Slow, Expensive Loops:** Multi-step operations require 10 to 15 slow chat rounds, transferring raw megabytes of intermediate JSON across the network.

## 🚀 The Solution: All In Code

Instead of flooding the LLM with 200 rigid JSON buttons, **All In Code** provides:
1. **Two Meta-Tools Only:** `search(query)` for dynamic type discovery and `execute(code)` for execution.
2. **Dynamic TypeScript SDK Synthesis:** Automatically compiles downstream MCP schemas into clean, strongly typed TypeScript namespaces (`import { stripe, github }`).
3. **Sub-10ms V8 Isolates:** Runs AI-generated orchestration scripts inside lightweight, zero-trust sandboxes (Cloudflare Dynamic Workers on the edge, or `isolated-vm` locally).
4. **Intermediate Data Pruning:** Data filtering, loops, and math run in memory inside the sandbox. Only the final synthesized result enters the LLM's context window.
5. **Human-in-the-Loop Interception:** Destructive mutations (e.g. `cancelSubscription`, `deleteRow`) pause execution and request approval in the built-in side-pane UI.

---

## 📐 Architecture

```text
[ AI Editor (Cursor / Claude / Antigravity) ]
                     │
                     ▼ (search & execute)
┌────────────────────────────────────────────────────────┐
│ ALL IN CODE GATEWAY                                    │
│ ├── Ingestion Layer: Connects downstream MCP servers   │
│ ├── TypeGen Synthesizer: Compiles JSON -> .d.ts        │
│ ├── Zero-Trust V8 Sandbox: 5ms ephemeral isolates      │
│ └── Approval Engine: Intercepts mutations & replays    │
└────────────────────────────────────────────────────────┘
                     │
                     ▼ (Out-of-band authenticated RPC)
[ Downstream Services: GitHub • Stripe • Postgres • Custom APIs ]
```

---

## 🛠️ Monorepo Structure

* **`packages/core`**: The execution sandbox, isolate drivers, and RPC supervisor.
* **`packages/typegen`**: The schema parser, TypeScript AST generator, and BM25 search index.
* **`packages/gateway`**: The MCP server exposing `search`, `execute`, and the `ui://` endpoint.
* **`packages/app`**: In-editor React + Vite MCP App dashboard (SEP-1865).
* **`packages/cli`**: The `aic` command-line utility (`npx all-in-code`).
* **`apps/web`**: Official landing page and documentation (Next.js 15).

---

## 🚦 Quick Start

### 1. Run with npx (Zero Installation)
```bash
npx all-in-code init
```

### 2. Manual Config (for Cursor / Claude Desktop)
Add to your `mcp.json`:
```json
{
  "mcpServers": {
    "all-in-code": {
      "command": "npx",
      "args": ["-y", "all-in-code", "serve"]
    }
  }
}
```

---

## 📄 License

Licensed under the **Apache License, Version 2.0**. See [LICENSE](LICENSE) for details.
