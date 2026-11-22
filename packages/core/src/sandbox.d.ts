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
export declare class LocalV8Sandbox {
    private approvalManager;
    private toolExecutor;
    constructor(toolExecutor: ToolExecutorFn, approvalManager?: ApprovalManager);
    execute(code: string, services: Record<string, string[]>, options?: ExecutionOptions): Promise<ExecutionResult>;
}
//# sourceMappingURL=sandbox.d.ts.map