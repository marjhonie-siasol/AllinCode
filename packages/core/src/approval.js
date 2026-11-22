"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApprovalManager = void 0;
class ApprovalManager {
    pending = new Map();
    autoApprovePatterns = [/^get/, /^list/, /^search/, /^find/, /^read/, /^describe/];
    isMutation(toolName) {
        const isReadOnly = this.autoApprovePatterns.some(pattern => pattern.test(toolName.toLowerCase()));
        return !isReadOnly;
    }
    registerAction(serverName, toolName, params) {
        const id = `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const action = {
            id,
            serverName,
            toolName,
            parameters: params,
            timestamp: Date.now(),
            status: 'pending'
        };
        this.pending.set(id, action);
        return action;
    }
    getPending() {
        return Array.from(this.pending.values()).filter(a => a.status === 'pending');
    }
    resolve(id, approved) {
        const action = this.pending.get(id);
        if (!action)
            return false;
        action.status = approved ? 'approved' : 'rejected';
        return true;
    }
}
exports.ApprovalManager = ApprovalManager;
//# sourceMappingURL=approval.js.map