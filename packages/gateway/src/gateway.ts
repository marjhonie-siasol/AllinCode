import { ToolTypeIndex, McpToolDefinition } from '@allincode/typegen';
import { LocalV8Sandbox, ApprovalManager, ToolExecutorFn, ExecutionResult } from '@allincode/core';

export interface GatewayConfig {
  name?: string;
  version?: string;
  tools?: McpToolDefinition[];
  executor?: ToolExecutorFn;
  requireApproval?: boolean;
}

export class AllInCodeGateway {
  public readonly name: string;
  public readonly version: string;
  private typeIndex: ToolTypeIndex;
  private sandbox: LocalV8Sandbox;
  private approvalManager: ApprovalManager;
  private toolsByServer: Record<string, string[]> = {};
  private totalTokensSaved: number = 0;
  private totalExecutions: number = 0;

  constructor(config: GatewayConfig = {}) {
    this.name = config.name || 'AllInCode';
    this.version = config.version || '0.1.0';
    this.typeIndex = new ToolTypeIndex(config.tools || []);
    this.approvalManager = new ApprovalManager();

    const executor: ToolExecutorFn = config.executor || (async (srv, tool, args) => {
      return { success: true, srv, tool, args, timestamp: Date.now() };
    });

    this.sandbox = new LocalV8Sandbox(executor, this.approvalManager);

    if (config.tools) {
      for (const t of config.tools) {
        const srv = t.serverName || 'global';
        if (!this.toolsByServer[srv]) this.toolsByServer[srv] = [];
        this.toolsByServer[srv].push(t.name);
      }
    }
  }

  public registerTool(tool: McpToolDefinition): void {
    this.typeIndex.registerTools([tool]);
    const srv = tool.serverName || 'global';
    if (!this.toolsByServer[srv]) this.toolsByServer[srv] = [];
    this.toolsByServer[srv].push(tool.name);
  }

  public search(query: string) {
    const results = this.typeIndex.search(query);
    const dtsSnippet = results.map(r => `// Service: ${r.serverName}\n${r.typeSignature}`).join('\n\n');
    return {
      query,
      resultsCount: results.length,
      types: dtsSnippet || '// No matching types found. Try searching with broader keywords.'
    };
  }

  public async execute(code: string, options: { timeoutMs?: number; requireApproval?: boolean } = {}): Promise<ExecutionResult> {
    this.totalExecutions++;
    const res = await this.sandbox.execute(code, this.toolsByServer, {
      timeoutMs: options.timeoutMs ?? 5000,
      requireApprovalForMutations: options.requireApproval ?? true
    });

    // Approximate token savings calculation:
    // Traditional MCP baseline: ~350 tokens per tool schema in context.
    const traditionalTokenCost = Object.values(this.toolsByServer).flat().length * 350;
    const allInCodeTokenCost = 800; // Search + execute meta-tool footprint
    this.totalTokensSaved += Math.max(0, traditionalTokenCost - allInCodeTokenCost);

    return res;
  }

  public getStats() {
    return {
      serversCount: Object.keys(this.toolsByServer).length,
      toolsCount: Object.values(this.toolsByServer).flat().length,
      totalExecutions: this.totalExecutions,
      totalTokensSaved: this.totalTokensSaved,
      pendingApprovals: this.approvalManager.getPending()
    };
  }

  public getAppHtml(): string {
    const stats = this.getStats();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>AllInCode Dashboard</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0d1117; color: #c9d1d9; padding: 20px; }
    h1 { color: #ff7a00; font-size: 22px; display: flex; align-items: center; gap: 8px; }
    .badge { background: #5e2bff; color: white; padding: 3px 8px; border-radius: 4px; font-size: 11px; }
    .card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
    .stat-val { font-size: 28px; font-weight: bold; color: #58a6ff; }
    .btn { background: #238636; color: white; border: none; padding: 8px 14px; border-radius: 6px; cursor: pointer; }
    .btn-deny { background: #da3633; }
  </style>
</head>
<body>
  <h1>All In Code <span class="badge">v${this.version}</span></h1>
  <div class="card">
    <div>Total Estimated Tokens Saved</div>
    <div class="stat-val">${stats.totalTokensSaved.toLocaleString()} tokens</div>
    <div style="font-size: 12px; color: #8b949e; margin-top: 4px;">Across ${stats.toolsCount} compressed tools and ${stats.serversCount} services.</div>
  </div>
</body>
</html>`;
  }
}
