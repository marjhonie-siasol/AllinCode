import vm from 'node:vm';
import { ApprovalManager, PendingAction } from './approval.js';

export interface ExecutionOptions {
  timeoutMs?: number;
  requireApprovalForMutations?: boolean;
}

export interface ExecutionResult {
  success: boolean;
  result?: any;
  logs: string[];
  error?: string;
  executionTimeMs: number;
  pausedForApproval?: PendingAction;
}

export type ToolExecutorFn = (serverName: string, toolName: string, args: Record<string, any>) => Promise<any>;

export class LocalV8Sandbox {
  private approvalManager: ApprovalManager;
  private toolExecutor: ToolExecutorFn;

  constructor(toolExecutor: ToolExecutorFn, approvalManager?: ApprovalManager) {
    this.toolExecutor = toolExecutor;
    this.approvalManager = approvalManager || new ApprovalManager();
  }

  public async execute(
    code: string,
    services: Record<string, string[]>,
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    const timeoutMs = options.timeoutMs ?? 5000;
    const logs: string[] = [];
    const startTime = Date.now();
    let pendingApproval: PendingAction | undefined;

    // Create sandbox context with sandboxed services proxy
    const serviceProxies: Record<string, any> = {};

    for (const [serverName, toolNames] of Object.entries(services)) {
      serviceProxies[serverName] = {};
      for (const tool of toolNames) {
        serviceProxies[serverName][tool] = async (args: Record<string, any> = {}) => {
          if (options.requireApprovalForMutations && this.approvalManager.isMutation(tool)) {
            const action = this.approvalManager.registerAction(serverName, tool, args);
            pendingApproval = action;
            throw new Error(`EXECUTION_PAUSED_FOR_APPROVAL: ${action.id}`);
          }
          return await this.toolExecutor(serverName, tool, args);
        };
      }
    }

    const sandboxContext = {
      ...serviceProxies,
      console: {
        log: (...args: any[]) => logs.push(args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')),
        error: (...args: any[]) => logs.push(`[ERROR] ${args.map(a => String(a)).join(' ')}`),
        warn: (...args: any[]) => logs.push(`[WARN] ${args.map(a => String(a)).join(' ')}`)
      },
      // Safe primitives
      setTimeout,
      clearTimeout,
      JSON,
      Math,
      Date,
      Promise,
      Array,
      Object,
      String,
      Number,
      Boolean,
      RegExp,
      Map,
      Set
    };

    const vmContext = vm.createContext(sandboxContext, {
      codeGeneration: {
        strings: false,
        wasm: false
      }
    });

    // Wrap in async IIFE
    const wrappedCode = `
      (async () => {
        ${code}
      })()
    `;

    try {
      const script = new vm.Script(wrappedCode);
      const executionPromise = script.runInContext(vmContext, {
        timeout: timeoutMs
      });

      const result = await executionPromise;
      return {
        success: true,
        result,
        logs,
        executionTimeMs: Date.now() - startTime
      };
    } catch (err: any) {
      if (pendingApproval) {
        return {
          success: false,
          logs,
          pausedForApproval: pendingApproval,
          error: 'Execution paused awaiting human approval.',
          executionTimeMs: Date.now() - startTime
        };
      }

      return {
        success: false,
        logs,
        error: err.message || String(err),
        executionTimeMs: Date.now() - startTime
      };
    }
  }
}
