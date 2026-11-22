export interface PendingAction {
  id: string;
  serverName: string;
  toolName: string;
  parameters: Record<string, any>;
  timestamp: number;
  status: 'pending' | 'approved' | 'rejected';
}

export type ApprovalHandler = (action: PendingAction) => Promise<boolean>;

export class ApprovalManager {
  private pending: Map<string, PendingAction> = new Map();
  private autoApprovePatterns: RegExp[] = [/^get/, /^list/, /^search/, /^find/, /^read/, /^describe/];

  public isMutation(toolName: string): boolean {
    const isReadOnly = this.autoApprovePatterns.some(pattern => pattern.test(toolName.toLowerCase()));
    return !isReadOnly;
  }

  public registerAction(serverName: string, toolName: string, params: Record<string, any>): PendingAction {
    const id = `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const action: PendingAction = {
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

  public getPending(): PendingAction[] {
    return Array.from(this.pending.values()).filter(a => a.status === 'pending');
  }

  public resolve(id: string, approved: boolean): boolean {
    const action = this.pending.get(id);
    if (!action) return false;
    action.status = approved ? 'approved' : 'rejected';
    return true;
  }
}
