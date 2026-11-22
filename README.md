<div align="center">
  <img src="assets/logo.png" alt="All In Code Logo" width="600" />

  <p align="center">
    The programmatic tool gateway and runtime for AI agents.
  </p>
</div>

---

## Overview

All In Code replaces long lists of Model Context Protocol (MCP) tool schemas with sandboxed code execution.

Instead of sending dozens of JSON tool schemas into an AI model's context window, All In Code provides two core tools:
* **search**: Finds available APIs and TypeScript function signatures on demand.
* **execute**: Runs model-generated JavaScript code inside an isolated V8 sandbox.

---

## Why It Matters

* **Lower Token Usage**: Reduces prompt token overhead by more than 90% by eliminating large tool lists.
* **Faster Workflows**: Multi-step operations, loops, and data filtering run directly in the sandbox instead of requiring multiple chat turns.
* **Safer Execution**: Destructive actions can pause execution and request human confirmation before proceeding.

---

## Quick Start

### Run with npx
```bash
npx all-in-code
```

### Editor Configuration (Cursor / Claude Desktop / Antigravity)
Add this to your `mcp.json`:
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

## Repository Structure

* `packages/core`: V8 sandbox execution runtime and approval management.
* `packages/typegen`: Schema parser and TypeScript type discovery index.
* `packages/gateway`: MCP server exposing the search and execute tools.
* `packages/cli`: The command line tool (`aic` / `all-in-code`).
* `packages/app`: In-editor control dashboard (SEP-1865).
* `apps/web`: Project website and documentation.

---

## License

This project is licensed under the Apache License 2.0. See the [LICENSE](LICENSE) file for details.
