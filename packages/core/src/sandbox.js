"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalV8Sandbox = void 0;
const node_vm_1 = __importDefault(require("node:vm"));
const approval_js_1 = require("./approval.js");
class LocalV8Sandbox {
    approvalManager;
    toolExecutor;
    constructor(toolExecutor, approvalManager) {
        this.toolExecutor = toolExecutor;
        this.approvalManager = approvalManager || new approval_js_1.ApprovalManager();
    }
    async execute(code, services, options = {}) {
        const timeoutMs = options.timeoutMs ?? 5000;
        const logs = [];
        const startTime = Date.now();
        let pendingApproval;
        // Create sandbox context with sandboxed services proxy
        const serviceProxies = {};
        for (const [serverName, toolNames] of Object.entries(services)) {
            serviceProxies[serverName] = {};
            for (const tool of toolNames) {
                serviceProxies[serverName][tool] = async (args = {}) => {
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
                log: (...args) => logs.push(args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')),
                error: (...args) => logs.push(`[ERROR] ${args.map(a => String(a)).join(' ')}`),
                warn: (...args) => logs.push(`[WARN] ${args.map(a => String(a)).join(' ')}`)
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
        const vmContext = node_vm_1.default.createContext(sandboxContext, {
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
            const script = new node_vm_1.default.Script(wrappedCode);
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
        }
        catch (err) {
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
exports.LocalV8Sandbox = LocalV8Sandbox;
//# sourceMappingURL=sandbox.js.map