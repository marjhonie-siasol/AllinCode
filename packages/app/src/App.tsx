import React, { useState } from 'react';

interface PendingAction {
  id: string;
  server: string;
  tool: string;
  parameters: Record<string, any>;
  timestamp: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'approvals' | 'types'>('overview');
  const [pendingApprovals, setPendingApprovals] = useState<PendingAction[]>([
    {
      id: 'act_demo_1',
      server: 'stripe',
      tool: 'cancelSubscription',
      parameters: { subscriptionId: 'sub_9182', immediately: true },
      timestamp: 'Just now'
    }
  ]);
  const [stats, setStats] = useState({
    traditionalTokens: 84500,
    allInCodeTokens: 1120,
    connectedServers: 4,
    compressedTools: 155
  });

  const tokensSaved = stats.traditionalTokens - stats.allInCodeTokens;
  const percentSaved = ((tokensSaved / stats.traditionalTokens) * 100).toFixed(1);

  const handleAction = (id: string, approved: boolean) => {
    setPendingApprovals(prev => prev.filter(a => a.id !== id));
    alert(approved ? '✅ Action Approved! Executing in sandbox.' : '❌ Action Denied.');
  };

  return (
    <div style={{
      fontFamily: 'system-ui, -apple-system, sans-serif',
      backgroundColor: '#0d1117',
      color: '#c9d1d9',
      minHeight: '100vh',
      padding: '16px',
      boxSizing: 'border-box'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #30363d', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#ff7a00', letterSpacing: '-0.5px' }}>ALL IN CODE</span>
          <span style={{ fontSize: '11px', background: '#5e2bff', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>v0.1.0</span>
        </div>
        <div style={{ fontSize: '12px', color: '#3fb950', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3fb950', display: 'inline-block' }}></span>
          Gateway Active
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', margin: '14px 0', borderBottom: '1px solid #21262d', paddingBottom: '8px' }}>
        <button
          onClick={() => setActiveTab('overview')}
          style={{
            background: activeTab === 'overview' ? '#21262d' : 'transparent',
            color: activeTab === 'overview' ? '#58a6ff' : '#8b949e',
            border: 'none',
            padding: '6px 12px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '13px'
          }}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('approvals')}
          style={{
            background: activeTab === 'approvals' ? '#21262d' : 'transparent',
            color: activeTab === 'approvals' ? '#58a6ff' : '#8b949e',
            border: 'none',
            padding: '6px 12px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '13px',
            position: 'relative'
          }}
        >
          Approvals
          {pendingApprovals.length > 0 && (
            <span style={{ marginLeft: '6px', backgroundColor: '#d29922', color: '#0d1117', fontSize: '10px', padding: '1px 5px', borderRadius: '10px', fontWeight: 'bold' }}>
              {pendingApprovals.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('types')}
          style={{
            background: activeTab === 'types' ? '#21262d' : 'transparent',
            color: activeTab === 'types' ? '#58a6ff' : '#8b949e',
            border: 'none',
            padding: '6px 12px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '13px'
          }}
        >
          SDK Types
        </button>
      </div>

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <div>
          {/* Token Savings Card */}
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '16px', marginBottom: '14px' }}>
            <div style={{ fontSize: '12px', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Live Token Optimization</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '6px' }}>
              <span style={{ fontSize: '32px', fontWeight: 'bold', color: '#3fb950' }}>{percentSaved}%</span>
              <span style={{ fontSize: '14px', color: '#8b949e' }}>Token Reduction</span>
            </div>
            <div style={{ fontSize: '12px', color: '#8b949e', marginTop: '6px' }}>
              Saved <strong>{tokensSaved.toLocaleString()}</strong> tokens across {stats.compressedTools} tools.
            </div>
          </div>

          {/* Connected Servers */}
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '14px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px' }}>Connected Downstream Servers ({stats.connectedServers})</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div style={{ background: '#0d1117', border: '1px solid #30363d', padding: '8px 10px', borderRadius: '6px', fontSize: '12px' }}>
                <div style={{ fontWeight: 600, color: '#f0f6fc' }}>github</div>
                <div style={{ color: '#8b949e', fontSize: '11px' }}>35 tools (compressed)</div>
              </div>
              <div style={{ background: '#0d1117', border: '1px solid #30363d', padding: '8px 10px', borderRadius: '6px', fontSize: '12px' }}>
                <div style={{ fontWeight: 600, color: '#f0f6fc' }}>stripe</div>
                <div style={{ color: '#8b949e', fontSize: '11px' }}>80 tools (compressed)</div>
              </div>
              <div style={{ background: '#0d1117', border: '1px solid #30363d', padding: '8px 10px', borderRadius: '6px', fontSize: '12px' }}>
                <div style={{ fontWeight: 600, color: '#f0f6fc' }}>postgres</div>
                <div style={{ color: '#8b949e', fontSize: '11px' }}>15 tools (compressed)</div>
              </div>
              <div style={{ background: '#0d1117', border: '1px solid #30363d', padding: '8px 10px', borderRadius: '6px', fontSize: '12px' }}>
                <div style={{ fontWeight: 600, color: '#f0f6fc' }}>linear</div>
                <div style={{ color: '#8b949e', fontSize: '11px' }}>25 tools (compressed)</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Approvals */}
      {activeTab === 'approvals' && (
        <div>
          {pendingApprovals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 10px', color: '#8b949e', fontSize: '13px' }}>
              🎉 No pending approvals. Safe executions run automatically.
            </div>
          ) : (
            pendingApprovals.map(action => (
              <div key={action.id} style={{ background: '#161b22', border: '1px solid #d29922', borderRadius: '8px', padding: '14px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', background: '#d29922', color: '#0d1117', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                    MUTATION ACTION
                  </span>
                  <span style={{ fontSize: '11px', color: '#8b949e' }}>{action.timestamp}</span>
                </div>
                <div style={{ marginTop: '8px', fontSize: '14px', fontWeight: 600, color: '#f0f6fc' }}>
                  {action.server}.{action.tool}()
                </div>
                <pre style={{ background: '#0d1117', padding: '8px', borderRadius: '4px', fontSize: '11px', color: '#8b949e', overflowX: 'auto', marginTop: '6px' }}>
                  {JSON.stringify(action.parameters, null, 2)}
                </pre>
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <button
                    onClick={() => handleAction(action.id, false)}
                    style={{ flex: 1, background: '#21262d', border: '1px solid #30363d', color: '#f85149', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
                  >
                    Deny
                  </button>
                  <button
                    onClick={() => handleAction(action.id, true)}
                    style={{ flex: 1, background: '#238636', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
                  >
                    Approve Action
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab: SDK Types */}
      {activeTab === 'types' && (
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '12px' }}>
          <div style={{ fontSize: '12px', color: '#8b949e', marginBottom: '8px' }}>Generated TypeScript SDKs for your AI model:</div>
          <pre style={{ background: '#0d1117', padding: '10px', borderRadius: '6px', fontSize: '11px', color: '#58a6ff', overflowX: 'auto', margin: 0 }}>
{`// Auto-generated by AllInCode
import { github } from "services/github";
import { stripe } from "services/stripe";
import { postgres } from "services/postgres";

// Model writes standard async JS code:
const users = await postgres.query({ sql: "..." });
await stripe.cancelSubscription({ subscriptionId: users[0].id });`}
          </pre>
        </div>
      )}
    </div>
  );
}
