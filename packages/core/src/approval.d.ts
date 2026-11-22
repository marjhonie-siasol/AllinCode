export interface PendingAction {
    id: string;
    serverName: string;
    toolName: string;
    parameters: Record<string, any>;
    timestamp: number;
    status: 'pending' | 'approved' | 'rejected';
}
export type ApprovalHandler = (action: PendingAction) => Promise<boolean>;
export declare class ApprovalManager {
    private pending;
    private autoApprovePatterns;
    isMutation(toolName: string): boolean;
    registerAction(serverName: string, toolName: string, params: Record<string, any>): PendingAction;
    getPending(): PendingAction[];
    resolve(id: string, approved: boolean): boolean;
}
//# sourceMappingURL=approval.d.ts.map