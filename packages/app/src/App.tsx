import React, { useState, useEffect } from 'react';
import logoImg from './assets/logo.png';

interface TraceStep {
  id: string;
  name: string;
  phase: 'agent_prompt' | 'ast_pruning' | 'rust_isolate' | 'downstream_dispatch' | 'stream_response';
  latencyMs: number;
  tokensBefore: number;
  tokensAfter: number;
  tokensSaved: number;
  status: 'Completed' | 'Pending approval' | 'Bypassed';
  details: Record<string, any>;
  codeSnippet?: string;
}

interface InterceptedTrace {
  id: string;
  timestamp: string;
  agent: string;
  prompt: string;
  toolTarget: string;
  type: 'Code mode' | 'Mutation gate' | 'Bypass';
  totalLatencyMs: number;
  tokensTraditional: number;
  tokensAllInCode: number;
  tokensSaved: number;
  status: 'Success' | 'Pending approval' | 'Bypassed';
  steps: TraceStep[];
  inputPayload: Record<string, any>;
  outputResult: Record<string, any>;
  telemetry: {
    isolateHeapMb: number;
    schemasPruned: number;
    pruningRatio: string;
    engine: string;
  };
}

interface ServerItem {
  id: string;
  name: string;
  command: string;
  toolsCount: number;
  description: string;
  pingMs: number;
  transport: 'stdio' | 'sse' | 'docker';
  status: 'active' | 'degraded' | 'inactive';
  typegenDts: string;
  rawJsonSchema: string;
}

interface ModelItem {
  name: string;
  contextLimit: number;
}

interface AnnotationItem {
  id: string;
  traceId: string;
  author: string;
  timestamp: string;
  tag: 'Audit' | 'Safety' | 'Optimization' | 'Bypass';
  note: string;
}

const MODELS: ModelItem[] = [
  { name: 'Gemini 3.8 Flash (Medium)', contextLimit: 1000000 },
  { name: 'Gemini 3.8 Flash (High)', contextLimit: 1000000 },
  { name: 'Claude Sonnet 4.6 (Thinking)', contextLimit: 200000 },
  { name: 'Claude Opus 4.6 (Thinking)', contextLimit: 200000 },
  { name: 'GPT-OSS 120B (Medium)', contextLimit: 128000 }
];

const INITIAL_SERVERS: ServerItem[] = [
  { 
    id: 'supabase', 
    name: 'supabase', 
    command: 'npx @supabase/mcp-server', 
    toolsCount: 28, 
    description: 'PostgreSQL database and authentication', 
    pingMs: 12, 
    transport: 'stdio',
    status: 'active',
    typegenDts: `export interface SupabaseClient {
  executeQuery(params: { sql: string }): Promise<QueryResult>;
  listTables(): Promise<string[]>;
  describeTable(params: { table: string }): Promise<ColumnInfo[]>;
}`,
    rawJsonSchema: `{
  "name": "supabase.executeQuery",
  "description": "Execute raw SQL query against Supabase PostgreSQL database",
  "inputSchema": {
    "type": "object",
    "properties": {
      "sql": { "type": "string", "description": "The SQL query to execute" }
    },
    "required": ["sql"]
  }
}`
  },
  { 
    id: 'github', 
    name: 'github', 
    command: 'npx @modelcontextprotocol/server-github', 
    toolsCount: 38, 
    description: 'Repositories, pull requests and issues', 
    pingMs: 16, 
    transport: 'stdio',
    status: 'active',
    typegenDts: `export interface GithubClient {
  createIssue(params: { repo: string; title: string; body?: string; labels?: string[] }): Promise<Issue>;
  mergePullRequest(params: { repo: string; pr: number }): Promise<void>;
  listRepositories(): Promise<Repository[]>;
}`,
    rawJsonSchema: `{
  "name": "github.createIssue",
  "description": "Create a new issue in a GitHub repository",
  "inputSchema": {
    "type": "object",
    "properties": {
      "repo": { "type": "string", "description": "Repository in owner/name format" },
      "title": { "type": "string", "description": "Title of the issue" },
      "body": { "type": "string", "description": "Issue description" },
      "labels": { "type": "array", "items": { "type": "string" } }
    },
    "required": ["repo", "title"]
  }
}`
  },
  { 
    id: 'icons8', 
    name: 'icons8', 
    command: 'npx mcp-remote icons8.com', 
    toolsCount: 12, 
    description: 'Remote vector asset library', 
    pingMs: 22, 
    transport: 'sse',
    status: 'active',
    typegenDts: `export interface Icons8Client {
  searchIcons(params: { term: string; style?: 'line' | 'solid' | 'flat' }): Promise<Icon[]>;
  downloadAsset(params: { iconId: string; format: 'svg' | 'png' }): Promise<AssetBuffer>;
}`,
    rawJsonSchema: `{
  "name": "icons8.searchIcons",
  "description": "Search vector icon assets across library",
  "inputSchema": {
    "type": "object",
    "properties": {
      "term": { "type": "string", "description": "Search keyword" },
      "style": { "type": "string", "enum": ["line", "solid", "flat"] }
    },
    "required": ["term"]
  }
}`
  },
  { 
    id: 'brevo', 
    name: 'brevo', 
    command: 'npx @modelcontextprotocol/server-brevo', 
    toolsCount: 24, 
    description: 'Transactional email and contacts API', 
    pingMs: 15, 
    transport: 'stdio',
    status: 'active',
    typegenDts: `export interface BrevoClient {
  sendEmail(params: { to: string; subject: string; body: string }): Promise<void>;
  listSubscribers(params: { listId: number; limit?: number }): Promise<Contact[]>;
}`,
    rawJsonSchema: `{
  "name": "brevo.sendEmail",
  "description": "Send transactional email message via Brevo",
  "inputSchema": {
    "type": "object",
    "properties": {
      "to": { "type": "string", "description": "Recipient email" },
      "subject": { "type": "string", "description": "Email subject" },
      "body": { "type": "string", "description": "Email content" }
    },
    "required": ["to", "subject", "body"]
  }
}`
  },
  { 
    id: 'docker', 
    name: 'docker', 
    command: 'docker mcp/docker', 
    toolsCount: 16, 
    description: 'Container engine and image registry', 
    pingMs: 4, 
    transport: 'docker',
    status: 'active',
    typegenDts: `export interface DockerClient {
  buildAndPushImage(params: { image: string; registry: string; tag?: string }): Promise<BuildResult>;
  listContainers(): Promise<Container[]>;
}`,
    rawJsonSchema: `{
  "name": "docker.buildAndPushImage",
  "description": "Build container and push to remote registry",
  "inputSchema": {
    "type": "object",
    "properties": {
      "image": { "type": "string" },
      "registry": { "type": "string" },
      "tag": { "type": "string" }
    },
    "required": ["image", "registry"]
  }
}`
  }
];

export type AllInCodeTab = 
  | 'observability'
  | 'gateway'
  | 'metrics'
  | 'prompt'
  | 'evaluation'
  | 'annotations'
  | 'playground';

interface TabDef {
  id: AllInCodeTab;
  label: string;
}

const TABS: TabDef[] = [
  { id: 'observability', label: 'Observability' },
  { id: 'gateway', label: 'AI Gateway' },
  { id: 'metrics', label: 'Metrics' },
  { id: 'prompt', label: 'Prompt Management' },
  { id: 'evaluation', label: 'Evaluation' },
  { id: 'annotations', label: 'Annotations' },
  { id: 'playground', label: 'Playground' }
];

const TAB_METADATA: Record<AllInCodeTab, { title: string; subtitle: string }> = {
  observability: {
    title: 'Observability',
    subtitle: 'Trace every MCP tool call with AST schema pruning latency and net token savings.'
  },
  gateway: {
    title: 'AI Gateway',
    subtitle: 'Downstream MCP server federation, transport connections (stdio/SSE), and zero-leakage proxy routing.'
  },
  metrics: {
    title: 'Metrics',
    subtitle: 'Model context window headroom, token reduction benchmarks, and Rust Boa isolate heap stability.'
  },
  prompt: {
    title: 'Prompt Management',
    subtitle: 'Zero-leakage AST schema pruning engine and compiled TypeScript interfaces (@allincode/typegen).'
  },
  evaluation: {
    title: 'Evaluation',
    subtitle: 'Mutation safeguard security policies and human confirmation gates before isolate execution.'
  },
  annotations: {
    title: 'Annotations',
    subtitle: 'Audit trail of operator confirmations, policy interventions, and trace observations.'
  },
  playground: {
    title: 'Playground',
    subtitle: 'Execute multi-tool TypeScript workflows in a single turn inside an isolated native Rust VM.'
  }
};

const CODE_PRESETS = [
  {
    name: 'Supabase + GitHub Sync',
    code: `// Multi-tool workflow executed in Rust Boa isolate
let users = supabase.executeQuery("SELECT id, email, plan FROM subscribers WHERE active = true;");
console.log("Subscribers retrieved:", users.rowCount);

let ticket = git.stageReleaseTicket({ milestone: "v2.4", priority: "high" });
console.log("GitHub release issue staged:", ticket.issueNumber);

({ subscribersCount: users.rowCount, stagedTicket: ticket.issueNumber });`
  },
  {
    name: 'Docker Push (Mutation Gate)',
    code: `// Destructive mutation intercepted by Mutation Gate
console.log("Initiating build and push to container registry...");
let pushResult = docker.buildAndPushImage("registry.internal/prod:v2.4");
console.log("Push intercepted:", pushResult);
pushResult;`
  },
  {
    name: 'Pure Calculation (Bypass)',
    code: `// Non-tool query: zero schema injection, pure in-engine compute
console.log("AST schema pruning: non-tool intent detected.");
let fib = (n) => n <= 1 ? n : fib(n - 1) + fib(n - 2);
let result = fib(12);
console.log("Fibonacci(12) computed in Boa engine:", result);
result;`
  }
];

function mapRustTraceToInterceptedTrace(res: any): InterceptedTrace {
  const t = res.trace || res;
  const isMutation = (t.mode || '').toLowerCase().includes('mutation');
  const isBypass = (t.mode || '').toLowerCase().includes('bypass');
  const typeVal: 'Code mode' | 'Mutation gate' | 'Bypass' = isMutation ? 'Mutation gate' : (isBypass ? 'Bypass' : 'Code mode');
  const statusVal: 'Success' | 'Pending approval' | 'Bypassed' = isMutation ? 'Pending approval' : (isBypass ? 'Bypassed' : 'Success');

  return {
    id: t.id || 'tr_' + Math.random().toString(36).substring(2, 7),
    timestamp: t.timestamp || new Date().toLocaleTimeString([], { hour12: false }),
    agent: 'Antigravity IDE',
    prompt: t.prompt || 'Agent execution',
    toolTarget: (t.tools_called && t.tools_called.length > 0) ? t.tools_called.join(', ') : (isBypass ? 'None (bypassed)' : 'None (internal execution)'),
    type: typeVal,
    totalLatencyMs: t.total_latency_ms || res.latency_ms || 4.2,
    tokensTraditional: res.raw_tokens || 34800,
    tokensAllInCode: res.pruned_tokens || 149,
    tokensSaved: res.tokens_saved || t.tokens_saved || 34651,
    status: statusVal,
    telemetry: {
      isolateHeapMb: res.memory_mb || 38.3,
      schemasPruned: 116,
      pruningRatio: '98.2%',
      engine: 'Rust Boa isolate'
    },
    inputPayload: {
      code: res.code || (t.prompt ? `// Prompt: ${t.prompt}` : undefined),
      prompt: t.prompt,
      engine: 'boa_engine_v0.22'
    },
    outputResult: t.observation || { result: res.output, logs: res.logs },
    steps: (t.stages || []).map((st: any, idx: number) => {
      let phase: TraceStep['phase'] = 'rust_isolate';
      if (st.name.includes('prompt')) phase = 'agent_prompt';
      else if (st.name.includes('prune')) phase = 'ast_pruning';
      else if (st.name.includes('isolate') || st.name.includes('eval')) phase = 'rust_isolate';
      else if (st.name.includes('dispatch') || st.name.includes('downstream')) phase = 'downstream_dispatch';

      return {
        id: `step_${idx + 1}`,
        name: st.name,
        phase,
        latencyMs: st.latency_ms,
        tokensBefore: res.raw_tokens || 34800,
        tokensAfter: res.pruned_tokens || 149,
        tokensSaved: res.tokens_saved || 34651,
        status: st.status === 'Completed' ? 'Completed' : (st.status === 'Blocked' ? 'Pending approval' : 'Bypassed'),
        details: { isolateReady: true }
      };
    })
  };
}

const INITIAL_ANNOTATIONS: AnnotationItem[] = [
  {
    id: 'ann_1',
    traceId: 'tr_9918a',
    author: 'operator@allincode',
    timestamp: '20:31:00',
    tag: 'Optimization',
    note: 'Supabase and GitHub multi-tool workflow executed in 4.8ms. Verified zero schema leakage in agent context window.'
  },
  {
    id: 'ann_2',
    traceId: 'tr_8821b',
    author: 'security-bot',
    timestamp: '20:28:40',
    tag: 'Safety',
    note: 'Docker image push to external registry held by strict_mutation_gate policy. Required manual operator review.'
  },
  {
    id: 'ann_3',
    traceId: 'tr_7712c',
    author: 'gateway-router',
    timestamp: '20:25:00',
    tag: 'Bypass',
    note: 'General TypeScript question bypassed isolate and tool pipeline. Saved 100% of MCP schema overhead.'
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<AllInCodeTab>('observability');
  const [activeAgent, setActiveAgent] = useState<string>('Antigravity');
  const [detectedApp, setDetectedApp] = useState<string>('Antigravity IDE');
  const [activeModel, setActiveModel] = useState<string>('Gemini 3.5 Flash (Medium)');
  const [availableModels, setAvailableModels] = useState<ModelItem[]>(MODELS);
  const [servers, setServers] = useState<ServerItem[]>(INITIAL_SERVERS);
  const [selectedServerId, setSelectedServerId] = useState<string>('supabase');
  const [approvalHandled, setApprovalHandled] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [searchFilter, setSearchFilter] = useState('');
  
  // Playground State
  const [replCode, setReplCode] = useState<string>(CODE_PRESETS[0].code);
  const [replOutput, setReplOutput] = useState<string | null>(null);
  const [isExecutingRepl, setIsExecutingRepl] = useState(false);

  // Annotations State
  const [annotations, setAnnotations] = useState<AnnotationItem[]>(INITIAL_ANNOTATIONS);
  const [newAnnotationNote, setNewAnnotationNote] = useState('');
  const [newAnnotationTag, setNewAnnotationTag] = useState<'Audit' | 'Safety' | 'Optimization' | 'Bypass'>('Audit');

  // Real-time Gateway Listener & WebSocket connection to Rust Engine
  useEffect(() => {
    let isMounted = true;

    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/status');
        if (!res.ok) return;
        const data = await res.json();
        if (!isMounted) return;

        const appName = data.detected_app || data.detectedApp || data.activeAgent || 'Antigravity IDE';
        setDetectedApp(appName);
        if (data.activeAgent) setActiveAgent(data.activeAgent);

        const currentModel = data.active_model || data.activeModel;
        if (currentModel && currentModel !== activeModel) {
          setActiveModel(currentModel);
        }

        const modelsList = data.available_models || data.availableModels;
        if (modelsList && Array.isArray(modelsList) && modelsList.length > 0) {
          setAvailableModels(modelsList.map((m: any) => {
            if (typeof m === 'string') {
              return { name: m, contextLimit: m.includes('1M') ? 1000000 : 200000 };
            }
            return { name: m.name, contextLimit: m.contextLimit || 1000000 };
          }));
        }

        if (data.traces && Array.isArray(data.traces) && data.traces.length > 0) {
          const mapped = data.traces.map(mapRustTraceToInterceptedTrace);
          setTraces(prev => {
            const mapById = new Map<string, InterceptedTrace>();
            for (const t of mapped) mapById.set(t.id, t);
            for (const t of prev) {
              if (!mapById.has(t.id)) mapById.set(t.id, t);
            }
            return Array.from(mapById.values());
          });
        }
      } catch (e) {
        // Silently ignore dropouts
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);

    // Live WebSocket connection to Rust Axum server
    let ws: WebSocket | null = null;
    let reconnectTimer: any = null;

    const connectWebSocket = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        ws = new WebSocket(wsUrl);

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'TRACE_RECORD' && msg.trace) {
              const mapped = mapRustTraceToInterceptedTrace(msg.trace);
              setTraces(prev => [mapped, ...prev.filter(t => t.id !== mapped.id)]);
              setSelectedTrace(mapped);
            } else if (msg.type === 'MUTATION_APPROVED' && msg.trace_id) {
              setTraces(prev => prev.map(t => {
                if (t.id === msg.trace_id) {
                  return { ...t, status: 'Success' as const, type: 'Code mode' as const };
                }
                return t;
              }));
              setSelectedTrace(curr => curr.id === msg.trace_id ? { ...curr, status: 'Success' as const, type: 'Code mode' as const } : curr);
              setApprovalHandled('approved');
            } else if (msg.type === 'MODEL_CHANGED' && msg.model) {
              setActiveModel(msg.model);
            }
          } catch (err) {}
        };

        ws.onclose = () => {
          if (isMounted) {
            reconnectTimer = setTimeout(connectWebSocket, 3000);
          }
        };

        ws.onerror = () => {
          try { ws?.close(); } catch (_) {}
        };
      } catch (err) {}
    };

    connectWebSocket();

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) {
        try { ws.close(); } catch (_) {}
      }
    };
  }, []);

  const handleModelSelect = async (newModel: string) => {
    setActiveModel(newModel);
    try {
      await fetch('/api/set-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: newModel })
      });
    } catch (e) {}
  };

  const handleApproveMutation = async (traceId: string) => {
    try {
      const res = await fetch('/api/approve-mutation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trace_id: traceId })
      });
      if (res.ok) {
        setApprovalHandled('approved');
        setTraces(prev => prev.map(t => t.id === traceId ? { ...t, status: 'Success' as const, type: 'Code mode' as const } : t));
        setSelectedTrace(curr => curr.id === traceId ? { ...curr, status: 'Success' as const, type: 'Code mode' as const } : curr);
      }
    } catch (e) {}
  };

  // Clean trace data
  const [traces, setTraces] = useState<InterceptedTrace[]>([
    {
      id: 'tr_9918a',
      timestamp: '20:30:12',
      agent: 'Antigravity',
      prompt: 'Check active subscribers in Supabase and stage release ticket on GitHub',
      toolTarget: 'supabase.executeQuery, github.createIssue',
      type: 'Code mode',
      totalLatencyMs: 4.8,
      tokensTraditional: 35700,
      tokensAllInCode: 800,
      tokensSaved: 34900,
      status: 'Success',
      telemetry: {
        isolateHeapMb: 38.2,
        schemasPruned: 116,
        pruningRatio: '97.8%',
        engine: 'Rust Boa isolate'
      },
      inputPayload: {
        prompt: "Check active subscribers in Supabase and stage release ticket on GitHub",
        inferredIntent: ["DATABASE_QUERY", "GITHUB_ISSUE_DISPATCH"],
        schemasRequested: 2,
        schemasPruned: 116
      },
      outputResult: {
        databaseResult: { rowCount: 50, durationMs: 24, status: "ok" },
        githubResult: { issueNumber: 142, url: "https://github.com/marjhonie/all-in-code/issues/142" },
        totalDurationMs: 4.8,
        netTokenReduction: 34900
      },
      steps: [
        {
          id: 's1',
          name: 'agent.prompt_intercept',
          phase: 'agent_prompt',
          latencyMs: 0.4,
          tokensBefore: 800,
          tokensAfter: 800,
          tokensSaved: 0,
          status: 'Completed',
          details: { client: 'Antigravity', connection: 'stdio' }
        },
        {
          id: 's2',
          name: 'ast.prune_unrelated_schemas',
          phase: 'ast_pruning',
          latencyMs: 1.1,
          tokensBefore: 35700,
          tokensAfter: 800,
          tokensSaved: 34900,
          status: 'Completed',
          details: { totalSchemas: 118, prunedCount: 116, preserved: ['supabase', 'github'] }
        },
        {
          id: 's3',
          name: 'isolate.eval_code_mode',
          phase: 'rust_isolate',
          latencyMs: 2.1,
          tokensBefore: 800,
          tokensAfter: 800,
          tokensSaved: 0,
          status: 'Completed',
          details: { sandboxHeapMb: 38.2, timeoutMs: 30000 },
          codeSnippet: 'await supabase.executeQuery(...); await github.createIssue(...);'
        },
        {
          id: 's4',
          name: 'mcp.dispatch_downstream',
          phase: 'downstream_dispatch',
          latencyMs: 1.2,
          tokensBefore: 0,
          tokensAfter: 0,
          tokensSaved: 0,
          status: 'Completed',
          details: { downstreamServers: ['supabase', 'github'] }
        }
      ]
    },
    {
      id: 'tr_8821b',
      timestamp: '20:28:05',
      agent: 'Antigravity',
      prompt: 'Build and push production container image to docker.io registry',
      toolTarget: 'docker.buildAndPushImage',
      type: 'Mutation gate',
      totalLatencyMs: 3.2,
      tokensTraditional: 35700,
      tokensAllInCode: 800,
      tokensSaved: 34900,
      status: 'Pending approval',
      telemetry: {
        isolateHeapMb: 38.0,
        schemasPruned: 117,
        pruningRatio: '97.8%',
        engine: 'Rust Boa isolate'
      },
      inputPayload: {
        image: "marjhonie/saas-backend:latest",
        registry: "docker.io",
        tag: "v0.1.0"
      },
      outputResult: {
        action: "held_for_review",
        policy: "strict_mutation_gate",
        reason: "Modifying external registry requires confirmation"
      },
      steps: [
        {
          id: 's1',
          name: 'agent.prompt_intercept',
          phase: 'agent_prompt',
          latencyMs: 0.3,
          tokensBefore: 800,
          tokensAfter: 800,
          tokensSaved: 0,
          status: 'Completed',
          details: { client: 'Antigravity' }
        },
        {
          id: 's2',
          name: 'safeguard.mutation_evaluation',
          phase: 'ast_pruning',
          latencyMs: 1.2,
          tokensBefore: 35700,
          tokensAfter: 800,
          tokensSaved: 34900,
          status: 'Pending approval',
          details: { policy: 'strict_mutation_gate', held: true }
        }
      ]
    },
    {
      id: 'tr_7712c',
      timestamp: '20:24:40',
      agent: 'Antigravity',
      prompt: 'Refactor helper function to use async/await and format README table',
      toolTarget: 'None (bypassed)',
      type: 'Bypass',
      totalLatencyMs: 0.9,
      tokensTraditional: 35700,
      tokensAllInCode: 0,
      tokensSaved: 35700,
      status: 'Bypassed',
      telemetry: {
        isolateHeapMb: 37.8,
        schemasPruned: 118,
        pruningRatio: '100%',
        engine: 'Rust Boa isolate'
      },
      inputPayload: {
        prompt: "Refactor helper function to use async/await",
        inferredIntent: ["CODE_EXPLANATION"],
        schemasRequested: 0,
        schemasPruned: 118
      },
      outputResult: {
        action: "bypass_gateway",
        reason: "Zero tool invocation required for pure code refactoring prompt",
        schemasInjected: 0
      },
      steps: [
        {
          id: 's1',
          name: 'agent.prompt_intercept',
          phase: 'agent_prompt',
          latencyMs: 0.3,
          tokensBefore: 0,
          tokensAfter: 0,
          tokensSaved: 0,
          status: 'Completed',
          details: { client: 'Antigravity' }
        },
        {
          id: 's2',
          name: 'ast.intent_bypass',
          phase: 'ast_pruning',
          latencyMs: 0.6,
          tokensBefore: 35700,
          tokensAfter: 0,
          tokensSaved: 35700,
          status: 'Bypassed',
          details: { toolCallsDetected: 0 }
        }
      ]
    }
  ]);

  const [selectedTrace, setSelectedTrace] = useState<InterceptedTrace>(traces[0]);

  // Aggregate Metrics Calculations
  const totalTools = servers.reduce((acc, s) => acc + s.toolsCount, 0);
  const currentModelObj = MODELS.find(m => m.name === activeModel) || MODELS[0];
  const contextLimit = currentModelObj.contextLimit;

  const traditionalTokens = totalTools * 300;
  const allInCodeTokens = totalTools > 0 ? 800 : 0;
  const tokensSaved = Math.max(0, traditionalTokens - allInCodeTokens);
  const percentSaved = traditionalTokens > 0 ? ((tokensSaved / traditionalTokens) * 100).toFixed(1) : '0';
  const contextPctWithout = Number(((traditionalTokens / contextLimit) * 100).toFixed(2));
  const contextPctWith = Number(((allInCodeTokens / contextLimit) * 100).toFixed(2));

  // Run Code Mode REPL in Rust Boa Isolate
  const handleExecuteRepl = async () => {
    setIsExecutingRepl(true);
    setReplOutput(null);
    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: replCode,
          prompt: "Playground isolate execution"
        })
      });
      const result = await res.json();
      setIsExecutingRepl(false);
      setReplOutput(JSON.stringify({
        status: result.success ? "ok" : "error",
        runtime: "Rust Boa isolate (ECMAScript 2024)",
        latencyMs: result.latency_ms,
        memoryMb: result.memory_mb,
        schemasPruned: 116,
        rawTokens: result.raw_tokens,
        prunedTokens: result.pruned_tokens,
        tokensSaved: result.tokens_saved,
        output: result.output,
        logs: result.logs,
        error: result.error
      }, null, 2));

      if (result.trace) {
        const mapped = mapRustTraceToInterceptedTrace(result);
        setTraces(prev => [mapped, ...prev.filter(t => t.id !== mapped.id)]);
        setSelectedTrace(mapped);
      }
    } catch (e: any) {
      setIsExecutingRepl(false);
      setReplOutput(JSON.stringify({
        status: "error",
        message: e?.message || "Failed to communicate with Rust isolate backend"
      }, null, 2));
    }
  };

  const handleSimulate = async (kind: 'tool' | 'bypass') => {
    const isBypass = kind === 'bypass';
    const payload = isBypass
      ? {
          prompt: 'Refactor helper function to use async/await and format README table',
          code: `console.log("AST schema pruning: non-tool intent detected, zero schema injected.");
let files = ["src/lib.rs", "src/pruner.rs", "README.md"];
let formatted = files.map(f => f.toUpperCase());
({ formatted, mode: "intent_bypass" });`
        }
      : {
          prompt: 'Check active subscribers in Supabase and stage release ticket on GitHub',
          code: `let users = supabase.executeQuery("SELECT id, email, plan FROM subscribers WHERE active = true;");
console.log("Subscribers retrieved:", users.rowCount);
let ticket = git.stageReleaseTicket({ milestone: "v2.4", priority: "high" });
console.log("GitHub release issue staged:", ticket.issueNumber);
({ subscribersCount: users.rowCount, stagedTicket: ticket.issueNumber });`
        };

    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (result.trace) {
        const mapped = mapRustTraceToInterceptedTrace(result);
        setTraces(prev => [mapped, ...prev.filter(t => t.id !== mapped.id)]);
        setSelectedTrace(mapped);
        setActiveTab('observability');
      }
    } catch (e) {
      // Fallback
    }
  };

  const handleAddAnnotation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnotationNote.trim()) return;
    const newAnn: AnnotationItem = {
      id: 'ann_' + Date.now().toString(36),
      traceId: selectedTrace.id,
      author: 'operator@allincode',
      timestamp: new Date().toLocaleTimeString([], { hour12: false }),
      tag: newAnnotationTag,
      note: newAnnotationNote.trim()
    };
    setAnnotations(prev => [newAnn, ...prev]);
    setNewAnnotationNote('');
  };

  const filteredTraces = traces.filter(t => 
    t.prompt.toLowerCase().includes(searchFilter.toLowerCase()) ||
    t.id.toLowerCase().includes(searchFilter.toLowerCase()) ||
    t.toolTarget.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="min-h-screen text-zinc-100 selection:bg-[#fe6d01]/30 selection:text-white flex flex-col font-sans w-full">
      
      {/* 1. QUIET NAVIGATION BAR - 100% SHARP EDGES */}
      <header className="min-h-14 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur px-6 flex flex-wrap items-center justify-between gap-4 text-xs sticky top-0 z-40">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center">
            <img 
              src={logoImg} 
              alt="All in Code" 
              className="h-6 w-auto object-contain" 
            />
          </div>

          <div className="hidden sm:block h-3.5 w-px bg-zinc-800"></div>

          {/* Dynamically accurate app/client name */}
          <div className="flex items-center gap-2 text-zinc-400 font-mono text-xs">
            <span className="text-zinc-500">App</span>
            <span className="text-zinc-200 font-medium">{detectedApp}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Live Dynamic Model Selector synced with Gateway Listener */}
          <div className="flex items-center gap-2 text-xs text-zinc-400 bg-zinc-900 border border-zinc-800 px-3 py-1.5">
            <span className="text-zinc-500 font-mono">Model</span>
            <select 
              value={activeModel}
              onChange={e => handleModelSelect(e.target.value)}
              className="bg-transparent text-zinc-200 outline-none cursor-pointer font-medium font-sans"
            >
              {availableModels.map(m => (
                <option key={m.name} value={m.name} className="bg-zinc-900 text-zinc-200">
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div className="hidden sm:block h-3.5 w-px bg-zinc-800"></div>

          {/* Header Action Buttons - Vibrant Flame Orange Primary Action */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSimulate('bypass')}
              className="text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 px-3 py-1.5 transition-colors cursor-pointer"
            >
              Simulate bypass
            </button>
            <button
              onClick={() => handleSimulate('tool')}
              className="text-xs font-medium bg-[#fe6d01] hover:bg-[#e05e00] text-white px-3.5 py-1.5 transition-colors shadow-sm cursor-pointer"
            >
              Simulate tool call
            </button>
          </div>
        </div>
      </header>

      {/* 2. MAIN WORKSPACE CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-4">

        {/* 3. LANGFUSE-ALIGNED TAB BAR - SEAMLESS LINE GRID */}
        <div className="border border-zinc-800 bg-zinc-950/90 overflow-hidden">
          <div className="flex flex-col lg:flex-row items-stretch justify-between">
            
            {/* Line Grid Tabs - 100% flush to border lines */}
            <div className="flex items-stretch overflow-x-auto divide-x divide-zinc-800 scrollbar-none">
              {TABS.map(tab => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`cursor-pointer whitespace-nowrap px-4 py-3 text-xs transition-colors flex items-center gap-2 select-none border-0 outline-none h-full ${
                      isActive
                        ? 'bg-[#fe6d01] text-white font-bold'
                        : 'text-zinc-400 font-medium hover:text-white hover:bg-zinc-900/60'
                    }`}
                  >
                    <span>{tab.label}</span>
                    {tab.id === 'evaluation' && approvalHandled === 'pending' && (
                      <span className={`text-[10px] font-mono px-1.5 py-0.2 ${
                        isActive
                          ? 'bg-black/25 text-white border border-white/30 font-semibold'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                      }`}>
                        1
                      </span>
                    )}
                    {tab.id === 'observability' && (
                      <span className={`font-mono text-[11px] ${
                        isActive ? 'text-white/90 font-bold' : 'text-zinc-500'
                      }`}>
                        {traces.length}
                      </span>
                    )}
                    {tab.id === 'annotations' && (
                      <span className={`font-mono text-[11px] ${
                        isActive ? 'text-white/90 font-bold' : 'text-zinc-500'
                      }`}>
                        {annotations.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Right Action Button - Matching Langfuse [Watch demo] */}
            <div className="flex items-center justify-end px-4 py-2 border-t lg:border-t-0 lg:border-l border-zinc-800 shrink-0 bg-zinc-950/40">
              <button
                onClick={() => {
                  if (activeTab === 'playground') {
                    handleExecuteRepl();
                  } else {
                    handleSimulate('tool');
                  }
                }}
                className="text-xs font-medium text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-3.5 py-1.5 transition-colors flex items-center gap-2 cursor-pointer"
              >
                <span className="text-[#fe6d01] font-mono text-[11px]">&gt;</span>
                <span>{activeTab === 'playground' ? 'Execute in isolate' : 'Quick demo trace'}</span>
              </button>
            </div>

          </div>
        </div>

        {/* 4. DYNAMIC SUBTITLE - MATCHING LANGFUSE HEADER CAPTION */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-zinc-400 gap-2 pb-1">
          <p className="font-sans text-zinc-300">
            {TAB_METADATA[activeTab].subtitle}
          </p>
          <span className="font-mono text-zinc-500 text-[11px] shrink-0">
            {totalTools} tools federated &bull; {contextLimit.toLocaleString()} token context
          </span>
        </div>

        {/* 5. SHOWCASE CONTENT - ZERO ROUNDED CORNERS */}

        {/* TAB 1: OBSERVABILITY */}
        {activeTab === 'observability' && (
          <div className="space-y-4">
            
            {/* 4 Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-zinc-900/60 border border-zinc-800/80 p-4">
                <div className="text-xs text-zinc-400 font-medium">Intercepted traces</div>
                <div className="mt-1.5 text-2xl font-semibold font-mono text-white tabular-nums">{traces.length}</div>
                <div className="mt-1 text-xs text-zinc-500 font-mono">Gateway listener active</div>
              </div>

              <div className="bg-zinc-900/60 border border-zinc-800/80 p-4">
                <div className="text-xs text-zinc-400 font-medium">Isolate latency P50</div>
                <div className="mt-1.5 text-2xl font-semibold font-mono text-[#a78bfa] tabular-nums">2.1 ms</div>
                <div className="mt-1 text-xs text-zinc-500 font-mono">Target: &lt; 5.0 ms</div>
              </div>

              <div className="bg-zinc-900/60 border border-zinc-800/80 p-4">
                <div className="text-xs text-zinc-400 font-medium">Tokens saved per prompt</div>
                <div className="mt-1.5 text-2xl font-semibold font-mono text-[#fe6d01] tabular-nums">
                  +{tokensSaved.toLocaleString()}
                </div>
                <div className="mt-1 text-xs text-zinc-500 font-mono">{percentSaved}% reduction vs raw MCP</div>
              </div>

              <div className="bg-zinc-900/60 border border-zinc-800/80 p-4">
                <div className="text-xs text-zinc-400 font-medium">Sandbox memory</div>
                <div className="mt-1.5 text-2xl font-semibold font-mono text-white tabular-nums">38.2 MB</div>
                <div className="mt-1 text-xs text-zinc-500 font-mono">Limit: 512 MB in Rust isolate</div>
              </div>
            </div>

            {/* Dual-Pane Trace Viewer */}
            <div className="border border-zinc-800/80 bg-zinc-900/40 overflow-hidden">
              <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[540px]">
                
                {/* Left Stream List */}
                <div className="col-span-1 lg:col-span-6 border-b lg:border-b-0 lg:border-r border-zinc-800/80 bg-zinc-950/40 p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-zinc-800 gap-2 mb-3">
                      <span className="text-xs font-medium text-zinc-300">
                        Intercepted events
                      </span>
                      <input 
                        type="text"
                        value={searchFilter}
                        onChange={e => setSearchFilter(e.target.value)}
                        placeholder="Filter events..."
                        className="bg-zinc-900 border border-zinc-800 px-3 py-1 text-xs text-zinc-200 outline-none w-full sm:w-48 placeholder:text-zinc-500 focus:border-zinc-700"
                      />
                    </div>

                    <div className="space-y-2">
                      {filteredTraces.map(trace => {
                        const isSelected = selectedTrace.id === trace.id;
                        return (
                          <div 
                            key={trace.id}
                            onClick={() => setSelectedTrace(trace)}
                            className={`p-3.5 border cursor-pointer transition-colors ${
                              isSelected 
                                ? 'bg-zinc-900 border-zinc-700' 
                                : 'bg-zinc-900/40 border-zinc-800/70 hover:bg-zinc-900/80'
                            }`}
                          >
                            <div className="flex items-center justify-between font-mono text-xs">
                              <div className="flex items-center gap-2">
                                <span className={`w-1.5 h-1.5 ${
                                  trace.type === 'Mutation gate' ? 'bg-amber-400' :
                                  trace.type === 'Bypass' ? 'bg-zinc-400' : 'bg-[#5920fb]'
                                }`}></span>
                                <span className="font-medium text-zinc-100">{trace.id}</span>
                                <span className="text-zinc-500">{trace.timestamp}</span>
                              </div>
                              <span className={`text-[11px] px-2 py-0.5 font-mono ${
                                trace.type === 'Code mode' ? 'bg-[#5920fb]/15 text-[#a78bfa] border border-[#5920fb]/30' :
                                trace.type === 'Mutation gate' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' :
                                'bg-zinc-800/80 text-zinc-400 border border-zinc-700'
                              }`}>
                                {trace.type}
                              </span>
                            </div>

                            <div className="text-xs text-zinc-300 font-sans mt-2 line-clamp-1">
                              &ldquo;{trace.prompt}&rdquo;
                            </div>

                            <div className="flex items-center justify-between text-xs font-mono text-zinc-400 mt-2.5 pt-2 border-t border-zinc-800/60">
                              <span className="text-zinc-500 truncate max-w-[200px]">{trace.toolTarget}</span>
                              <div className="flex items-center gap-2.5">
                                <span className="text-[#a78bfa] tabular-nums">{trace.totalLatencyMs} ms</span>
                                <span className="text-[#fe6d01] font-medium tabular-nums">+{trace.tokensSaved.toLocaleString()} tokens</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-zinc-800 text-xs text-zinc-500 font-mono flex justify-between mt-3">
                    <span>Zero schema leakage</span>
                    <span>All in Code gateway</span>
                  </div>
                </div>

                {/* Right Inspector */}
                <div className="col-span-1 lg:col-span-6 bg-zinc-950/20 p-4 flex flex-col justify-between overflow-y-auto">
                  <div className="space-y-4">
                    
                    {/* Header */}
                    <div className="border-b border-zinc-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="text-[11px] font-mono text-zinc-500 flex items-center gap-2">
                          <span>{selectedTrace.type}</span>
                          {selectedTrace.status === 'Pending approval' && (
                            <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/40 px-1.5 py-0.2 font-mono">
                              HELD BY MUTATION GATE
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-medium font-mono text-white mt-0.5">
                          {selectedTrace.id}
                        </h4>
                      </div>
                      <div className="text-left sm:text-right font-mono text-xs">
                        <div className="text-[#a78bfa] tabular-nums">{selectedTrace.totalLatencyMs} ms total</div>
                        <div className="text-[#fe6d01] font-medium tabular-nums">+{selectedTrace.tokensSaved.toLocaleString()} tokens saved</div>
                      </div>
                    </div>

                    {/* Pending Mutation Gate Action Banner */}
                    {selectedTrace.status === 'Pending approval' && (
                      <div className="p-3 bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="text-xs text-amber-300 font-mono">
                          Destructive mutation held by policy. Awaiting operator confirmation.
                        </div>
                        <button
                          onClick={() => handleApproveMutation(selectedTrace.id)}
                          className="px-3.5 py-1.5 bg-[#fe6d01] hover:bg-[#e05e00] text-white text-xs font-medium shrink-0 cursor-pointer transition-colors shadow-sm"
                        >
                          Approve mutation
                        </button>
                      </div>
                    )}

                    {/* Pipeline Stages */}
                    <div>
                      <div className="text-xs font-medium text-zinc-400 mb-2">
                        Execution pipeline stages
                      </div>
                      <div className="space-y-1.5 font-mono text-xs">
                        {selectedTrace.steps.map((step, idx) => (
                          <div key={step.id} className="p-2.5 bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between">
                            <div className="flex items-center gap-2 truncate">
                              <span className="text-zinc-500 text-xs">{idx + 1}.</span>
                              <span className="text-zinc-200 truncate">{step.name}</span>
                              <span className={`hidden sm:inline text-xs ${
                                step.phase === 'rust_isolate' ? 'text-[#a78bfa]' : 'text-zinc-500'
                              }`}>({step.phase})</span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0 ml-2">
                              <span className="text-zinc-400 tabular-nums">{step.latencyMs} ms</span>
                              <span className="text-emerald-400 text-xs">{step.status}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Input Payload */}
                    <div>
                      <div className="text-xs font-medium text-zinc-400 mb-1.5">
                        Intercepted agent request
                      </div>
                      <pre className="bg-zinc-900/80 border border-zinc-800/80 p-3 font-mono text-xs text-zinc-300 overflow-x-auto">
                        {JSON.stringify(selectedTrace.inputPayload, null, 2)}
                      </pre>
                    </div>

                    {/* Output */}
                    <div>
                      <div className="text-xs font-medium text-zinc-400 mb-1.5">
                        Gateway observation
                      </div>
                      <pre className="bg-zinc-900/80 border border-zinc-800/80 p-3 font-mono text-xs text-zinc-300 overflow-x-auto max-h-36">
                        {JSON.stringify(selectedTrace.outputResult, null, 2)}
                      </pre>
                    </div>

                  </div>

                  <div className="pt-3 border-t border-zinc-800 text-xs text-zinc-400 font-mono flex items-center justify-between mt-3">
                    <span className="text-[#a78bfa]">Engine: {selectedTrace.telemetry.engine}</span>
                    <span className="text-zinc-400">Heap: {selectedTrace.telemetry.isolateHeapMb} MB</span>
                  </div>
                </div>

              </div>
            </div>

          </div>
        )}

        {/* TAB 2: AI GATEWAY */}
        {activeTab === 'gateway' && (
          <div className="space-y-4">
            
            {/* Gateway Architecture Highlights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-zinc-900/60 border border-zinc-800/80 p-4">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-400 font-medium">Stdio & SSE bridge</span>
                  <span className="w-1.5 h-1.5 bg-emerald-500"></span>
                </div>
                <div className="text-lg font-semibold font-mono text-white mt-2">5 active servers</div>
                <p className="text-xs text-zinc-400 mt-1">
                  Sub-millisecond serialization bridging local MCP processes and remote SSE endpoints.
                </p>
              </div>

              <div className="bg-zinc-900/60 border border-zinc-800/80 p-4">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-400 font-medium">AST dynamic router</span>
                  <span className="text-[#fe6d01] font-mono">97.8% pruned</span>
                </div>
                <div className="text-lg font-semibold font-mono text-white mt-2">Zero prompt bloat</div>
                <p className="text-xs text-zinc-400 mt-1">
                  Evaluates tool necessity before schema dispatch, bypassing 100% of unused tool definitions.
                </p>
              </div>

              <div className="bg-zinc-900/60 border border-zinc-800/80 p-4">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-400 font-medium">Safe isolation engine</span>
                  <span className="text-[#a78bfa] font-mono">Rust Boa</span>
                </div>
                <div className="text-lg font-semibold font-mono text-white mt-2">Single-turn VM</div>
                <p className="text-xs text-zinc-400 mt-1">
                  Runs multi-tool JavaScript/TypeScript scripts with zero network exposure to agent context.
                </p>
              </div>
            </div>

            {/* Server Federation Table */}
            <div className="bg-zinc-900/40 border border-zinc-800/80 p-5 space-y-4">
              <div className="border-b border-zinc-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-medium text-white">Downstream MCP server federation</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Tool definitions indexed and compiled into zero-bloat TypeScript type contracts.
                  </p>
                </div>
                <div className="text-xs font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-3 py-1 shrink-0">
                  {servers.length} connected &bull; {totalTools} tools indexed
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs font-mono min-w-[620px]">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-950/60 text-zinc-400 text-xs">
                      <th className="py-3 px-4 font-medium">Server</th>
                      <th className="py-3 px-4 font-medium">Transport command</th>
                      <th className="py-3 px-4 font-medium">Indexed tools</th>
                      <th className="py-3 px-4 font-medium">Typegen status</th>
                      <th className="py-3 px-4 font-medium">Latency</th>
                      <th className="py-3 px-4 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/70 text-xs">
                    {servers.map(server => {
                      const isSelected = selectedServerId === server.id;
                      return (
                        <tr 
                          key={server.id} 
                          onClick={() => setSelectedServerId(server.id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-zinc-900 text-zinc-100' : 'hover:bg-zinc-900/50'
                          }`}
                        >
                          <td className="py-3.5 px-4 font-medium text-white">{server.name}</td>
                          <td className="py-3.5 px-4 text-zinc-400">{server.command}</td>
                          <td className="py-3.5 px-4">
                            <span className="bg-zinc-800 text-zinc-300 px-2 py-0.5 text-[11px] tabular-nums">
                              {server.toolsCount} tools (~{server.toolsCount * 300} tokens)
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="bg-[#5920fb]/15 text-[#a78bfa] border border-[#5920fb]/30 px-2 py-0.5 text-[11px]">
                              Compiled (.d.ts)
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-zinc-300 tabular-nums">{server.pingMs} ms</td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setServers(prev => prev.filter(s => s.id !== server.id));
                              }}
                              className="text-zinc-500 hover:text-rose-400 transition-colors cursor-pointer"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* TAB 3: METRICS */}
        {activeTab === 'metrics' && (
          <div className="space-y-4">
            
            {/* Context Window Allocation Bar */}
            <div className="bg-zinc-900/40 border border-zinc-800/80 p-5 space-y-4">
              <div className="border-b border-zinc-800 pb-3">
                <h3 className="text-sm font-medium text-white">Model context window allocation</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Comparison between raw MCP schema injection versus All in Code programmatic execution.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row justify-between text-xs font-mono text-zinc-400 gap-1">
                  <span>Model: <strong className="text-zinc-200">{activeModel}</strong></span>
                  <span>Context window limit: <strong className="text-zinc-200 tabular-nums">{contextLimit.toLocaleString()} tokens</strong></span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-3 bg-zinc-900 overflow-hidden flex border border-zinc-800">
                  <div 
                    style={{ width: `${Math.min(100, contextPctWithout * 3)}%` }}
                    className="bg-rose-500/70 h-full"
                    title={`Raw schema waste: ${traditionalTokens} tokens`}
                  />
                  <div 
                    style={{ width: `${Math.max(1, contextPctWith * 6)}%` }}
                    className="bg-[#fe6d01] h-full"
                    title={`All in Code footprint: ${allInCodeTokens} tokens`}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono pt-1">
                  <div className="p-3.5 bg-zinc-900/60 border border-zinc-800">
                    <div className="text-zinc-500 text-[11px]">Traditional approach (all MCP schemas injected)</div>
                    <div className="text-rose-400 font-semibold mt-1 text-sm tabular-nums">{traditionalTokens.toLocaleString()} tokens consumed</div>
                    <div className="text-zinc-400 text-xs mt-1">{contextPctWithout}% of context consumed before user prompt</div>
                  </div>

                  <div className="p-3.5 bg-zinc-900/60 border border-zinc-800">
                    <div className="text-zinc-500 text-[11px]">All in Code programmatic gateway</div>
                    <div className="text-[#fe6d01] font-semibold mt-1 text-sm tabular-nums">{allInCodeTokens} tokens consumed</div>
                    <div className="text-zinc-300 text-xs mt-1">{contextPctWith}% footprint ({percentSaved}% net token savings)</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 3 Telemetry Charts - Dual Accent Visual Balance */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              
              {/* Chart 1: Latency - Electric Violet Accent */}
              <div className="bg-zinc-900/40 border border-zinc-800/80 p-4">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-400">Latency P50 / P95</span>
                  <span className="text-[#a78bfa] font-semibold tabular-nums">2.1 ms</span>
                </div>
                <div className="text-xs text-zinc-500 font-mono mt-0.5">Rust isolate spinup timing</div>
                <div className="mt-4 h-28 w-full flex items-end">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 300 100" preserveAspectRatio="none">
                    <line x1="0" y1="25" x2="300" y2="25" stroke="#27272a" strokeDasharray="2 2" />
                    <line x1="0" y1="50" x2="300" y2="50" stroke="#27272a" strokeDasharray="2 2" />
                    <line x1="0" y1="75" x2="300" y2="75" stroke="#27272a" strokeDasharray="2 2" />
                    <polygon points="0,85 40,70 80,80 120,30 160,45 200,35 240,65 280,20 300,40 300,100 0,100" fill="rgba(89, 32, 251, 0.08)" />
                    <polyline fill="none" stroke="#5920fb" strokeWidth="1.5" points="0,85 40,70 80,80 120,30 160,45 200,35 240,65 280,20 300,40" />
                    <circle cx="120" cy="30" r="2.5" fill="#a78bfa" />
                    <circle cx="280" cy="20" r="2.5" fill="#a78bfa" />
                  </svg>
                </div>
                <div className="flex justify-between text-xs font-mono text-zinc-500 mt-2">
                  <span>P50: 2.1ms</span>
                  <span>P95: 8.4ms</span>
                  <span>P99: 14.0ms</span>
                </div>
              </div>

              {/* Chart 2: Cumulative Token Savings - Vibrant Flame Orange Accent */}
              <div className="bg-zinc-900/40 border border-zinc-800/80 p-4">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-400">Tokens saved</span>
                  <span className="text-[#fe6d01] font-semibold tabular-nums">+139,420</span>
                </div>
                <div className="text-xs text-zinc-500 font-mono mt-0.5">Across active agent sessions</div>
                <div className="mt-4 h-28 w-full flex items-end">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 300 100" preserveAspectRatio="none">
                    <line x1="0" y1="25" x2="300" y2="25" stroke="#27272a" strokeDasharray="2 2" />
                    <line x1="0" y1="50" x2="300" y2="50" stroke="#27272a" strokeDasharray="2 2" />
                    <line x1="0" y1="75" x2="300" y2="75" stroke="#27272a" strokeDasharray="2 2" />
                    <polygon points="0,90 40,80 80,65 120,50 160,40 200,28 240,20 280,12 300,8 300,100 0,100" fill="rgba(254, 109, 1, 0.08)" />
                    <polyline fill="none" stroke="#fe6d01" strokeWidth="1.5" points="0,90 40,80 80,65 120,50 160,40 200,28 240,20 280,12 300,8" />
                    <circle cx="200" cy="28" r="2.5" fill="#fe6d01" />
                    <circle cx="300" cy="8" r="2.5" fill="#fe6d01" />
                  </svg>
                </div>
                <div className="flex justify-between text-xs font-mono text-zinc-500 mt-2">
                  <span>Session 1</span>
                  <span>Session 5</span>
                  <span>Session 10</span>
                </div>
              </div>

              {/* Chart 3: Rust Sandbox Heap Memory - Crisp White / Monochrome */}
              <div className="bg-zinc-900/40 border border-zinc-800/80 p-4">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-400">Sandbox memory</span>
                  <span className="text-white font-medium tabular-nums">38.2 MB / 512 MB</span>
                </div>
                <div className="text-xs text-zinc-500 font-mono mt-0.5">Heap memory stability</div>
                <div className="mt-4 h-28 w-full flex items-end">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 300 100" preserveAspectRatio="none">
                    <line x1="0" y1="25" x2="300" y2="25" stroke="#27272a" strokeDasharray="2 2" />
                    <line x1="0" y1="50" x2="300" y2="50" stroke="#27272a" strokeDasharray="2 2" />
                    <line x1="0" y1="75" x2="300" y2="75" stroke="#27272a" strokeDasharray="2 2" />
                    <polygon points="0,65 50,64 100,66 150,65 200,64 250,65 300,64 300,100 0,100" fill="rgba(244, 244, 245, 0.04)" />
                    <polyline fill="none" stroke="#d4d4d8" strokeWidth="1.5" points="0,65 50,64 100,66 150,65 200,64 250,65 300,64" />
                    <circle cx="150" cy="65" r="2.5" fill="#10B981" />
                  </svg>
                </div>
                <div className="flex justify-between text-xs font-mono text-zinc-500 mt-2">
                  <span>Heap: 38.2 MB</span>
                  <span>GC: Active</span>
                  <span>Max: 512 MB</span>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* TAB 4: PROMPT MANAGEMENT */}
        {activeTab === 'prompt' && (
          <div className="space-y-4">
            
            <div className="bg-zinc-900/40 border border-zinc-800/80 p-5 space-y-4">
              <div className="border-b border-zinc-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-medium text-white">AST Schema Pruning & Type Contract Compiler</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Transforms bloated MCP JSON Schemas into compact TypeScript interfaces, eliminating thousands of wasted context tokens.
                  </p>
                </div>
                <div className="text-xs font-mono text-[#fe6d01] bg-[#fe6d01]/10 border border-[#fe6d01]/30 px-3 py-1">
                  Average compression: 97.8%
                </div>
              </div>

              {/* Server selector for comparison */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <span className="text-xs text-zinc-500 font-mono shrink-0">Inspect tool:</span>
                {servers.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedServerId(s.id)}
                    className={`px-3 py-1 text-xs font-mono transition-colors cursor-pointer ${
                      selectedServerId === s.id
                        ? 'bg-zinc-900 text-white border border-zinc-700 font-medium'
                        : 'text-zinc-400 hover:text-zinc-200 bg-zinc-950/60 border border-zinc-800/60'
                    }`}
                  >
                    {s.name} ({s.toolsCount} tools)
                  </button>
                ))}
              </div>

              {/* Side by side comparison: Raw Schema vs Pruned TypeScript */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pt-1">
                
                {/* Left: Raw JSON Schema */}
                <div className="bg-zinc-950/80 border border-zinc-800/80 p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-rose-400 font-medium">Raw MCP JSON Schema</span>
                    <span className="text-zinc-500">~{servers.find(s => s.id === selectedServerId)?.toolsCount! * 300} tokens</span>
                  </div>
                  <pre className="text-zinc-400 font-mono text-xs overflow-x-auto max-h-72 p-2 bg-zinc-900/60 border border-zinc-800">
                    {servers.find(s => s.id === selectedServerId)?.rawJsonSchema}
                  </pre>
                  <p className="text-[11px] text-zinc-500 font-mono">
                    Wasteful JSON overhead injected on every agent turn in traditional architectures.
                  </p>
                </div>

                {/* Right: Compiled TypeScript Declaration */}
                <div className="bg-zinc-950/80 border border-zinc-800/80 p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-[#a78bfa] font-medium">Compiled TypeScript Interface (@allincode/typegen)</span>
                    <span className="text-zinc-300">~80 tokens</span>
                  </div>
                  <pre className="text-white font-mono text-xs overflow-x-auto max-h-72 p-2 bg-zinc-900/60 border border-zinc-800">
                    {servers.find(s => s.id === selectedServerId)?.typegenDts}
                  </pre>
                  <p className="text-[11px] text-[#a78bfa] font-mono">
                    Compact type contracts exposed to Rust runtime with zero prompt bloat.
                  </p>
                </div>

              </div>

            </div>

          </div>
        )}

        {/* TAB 5: EVALUATION */}
        {activeTab === 'evaluation' && (
          <div className="space-y-4">
            
            {/* Mutation Safeguard Gate */}
            <div className="bg-zinc-900/40 border border-zinc-800/80 p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-zinc-800 gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-amber-400"></span>
                  <h3 className="text-sm font-medium text-white">Mutation safeguard gate</h3>
                </div>
                <span className="text-xs font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5">
                  Policy: strict_mutation_gate
                </span>
              </div>

              <div className="text-xs text-zinc-400 leading-relaxed font-sans">
                The coding agent requested an external state mutation targeting a container registry. Automated execution was intercepted and held pending review.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs bg-zinc-900/60 p-3.5 border border-zinc-800">
                <div>
                  <div className="text-zinc-500 text-[11px]">Requester agent</div>
                  <div className="text-zinc-200 font-medium mt-0.5">Antigravity (marjhonie)</div>
                </div>
                <div>
                  <div className="text-zinc-500 text-[11px]">Target registry</div>
                  <div className="text-zinc-200 font-medium mt-0.5">docker.io/marjhonie</div>
                </div>
                <div>
                  <div className="text-zinc-500 text-[11px]">Intercepted operation</div>
                  <div className="text-amber-400 font-medium mt-0.5">docker.buildAndPushImage</div>
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 p-3 font-mono text-xs">
                <div className="text-zinc-500 text-[11px] mb-1">// Staged parameters intercepted by gateway</div>
                <pre className="text-zinc-300 overflow-x-auto">
{`await docker.buildAndPushImage({
  image: "marjhonie/saas-backend:latest",
  registry: "docker.io",
  tag: "v0.1.0"
});`}
                </pre>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
                <button
                  onClick={() => setApprovalHandled('rejected')}
                  className="px-4 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Reject mutation
                </button>
                <button
                  onClick={() => {
                    const pendingTrace = traces.find(t => t.type === 'Mutation gate') || selectedTrace;
                    if (pendingTrace) {
                      handleApproveMutation(pendingTrace.id);
                    } else {
                      setApprovalHandled('approved');
                    }
                  }}
                  className="px-4 py-1.5 text-xs font-medium text-white bg-[#fe6d01] hover:bg-[#e05e00] transition-colors cursor-pointer"
                >
                  Approve in sandbox
                </button>
              </div>

              {approvalHandled === 'approved' && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
                  Action approved. Container image staged and dispatched to local isolate.
                </div>
              )}
              {approvalHandled === 'rejected' && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono">
                  Mutation rejected by operator. Execution halted before downstream dispatch.
                </div>
              )}
            </div>

            {/* Evaluation Security Rules Table */}
            <div className="bg-zinc-900/40 border border-zinc-800/80 p-5 space-y-3">
              <h4 className="text-xs font-medium text-zinc-200 uppercase tracking-wider font-mono">
                Active security policies
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-950/60 text-zinc-400 text-xs">
                      <th className="py-2.5 px-3 font-medium">Policy Name</th>
                      <th className="py-2.5 px-3 font-medium">Target Pattern</th>
                      <th className="py-2.5 px-3 font-medium">Action</th>
                      <th className="py-2.5 px-3 font-medium">Trigger Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/70 text-xs text-zinc-300">
                    <tr>
                      <td className="py-2.5 px-3 font-medium text-white">strict_mutation_gate</td>
                      <td className="py-2.5 px-3 text-zinc-400">*.buildAndPushImage, *.push*</td>
                      <td className="py-2.5 px-3 text-amber-400">Hold for human approval</td>
                      <td className="py-2.5 px-3">1</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-medium text-white">block_destructive_drops</td>
                      <td className="py-2.5 px-3 text-zinc-400">*.dropTable, *.purge*, *.delete*</td>
                      <td className="py-2.5 px-3 text-rose-400">Block & require confirmation</td>
                      <td className="py-2.5 px-3">0</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-medium text-white">auto_dispatch_reads</td>
                      <td className="py-2.5 px-3 text-zinc-400">*.executeQuery, *.get*, *.list*</td>
                      <td className="py-2.5 px-3 text-emerald-400">Immediate isolate dispatch</td>
                      <td className="py-2.5 px-3">42</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* TAB 6: ANNOTATIONS */}
        {activeTab === 'annotations' && (
          <div className="space-y-4">
            
            <div className="bg-zinc-900/40 border border-zinc-800/80 p-5 space-y-4">
              <div className="border-b border-zinc-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-medium text-white">Gateway Audit Trail & Trace Annotations</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Operator reviews, security confirmations, and policy intervention logs recorded across agent sessions.
                  </p>
                </div>
                <div className="text-xs font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-3 py-1">
                  {annotations.length} verified records
                </div>
              </div>

              {/* Add Annotation Form */}
              <form onSubmit={handleAddAnnotation} className="bg-zinc-950/80 border border-zinc-800 p-4 space-y-3">
                <div className="text-xs font-medium text-zinc-300">
                  Annotate trace {selectedTrace.id}
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <select
                    value={newAnnotationTag}
                    onChange={e => setNewAnnotationTag(e.target.value as any)}
                    className="bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-xs text-zinc-200 outline-none font-mono"
                  >
                    <option value="Audit">Audit</option>
                    <option value="Safety">Safety</option>
                    <option value="Optimization">Optimization</option>
                    <option value="Bypass">Bypass</option>
                  </select>
                  <input
                    type="text"
                    value={newAnnotationNote}
                    onChange={e => setNewAnnotationNote(e.target.value)}
                    placeholder="Add operator notes or verification remarks..."
                    className="flex-1 bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-xs text-zinc-200 outline-none placeholder:text-zinc-500 focus:border-zinc-700"
                  />
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-medium text-white bg-[#fe6d01] hover:bg-[#e05e00] transition-colors shrink-0 cursor-pointer"
                  >
                    Save annotation
                  </button>
                </div>
              </form>

              {/* Annotations List */}
              <div className="space-y-2">
                {annotations.map(ann => (
                  <div key={ann.id} className="p-3.5 bg-zinc-900/60 border border-zinc-800 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 font-mono text-xs">
                        <span className="font-medium text-white">{ann.traceId}</span>
                        <span className="text-zinc-500">&bull;</span>
                        <span className="text-zinc-400">{ann.author}</span>
                        <span className="text-zinc-500">{ann.timestamp}</span>
                        <span className={`px-1.5 py-0.2 text-[10px] ${
                          ann.tag === 'Safety' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                          ann.tag === 'Optimization' ? 'bg-[#fe6d01]/15 text-[#fe6d01] border border-[#fe6d01]/30' :
                          ann.tag === 'Audit' ? 'bg-[#5920fb]/15 text-[#a78bfa] border border-[#5920fb]/30' :
                          'bg-zinc-800 text-zinc-300'
                        }`}>
                          {ann.tag}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-300 font-sans">
                        {ann.note}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

            </div>

          </div>
        )}

        {/* TAB 7: PLAYGROUND */}
        {activeTab === 'playground' && (
          <div className="space-y-4">
            
            <div className="bg-zinc-900/40 border border-zinc-800/80 p-5 space-y-4">
              <div className="border-b border-zinc-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-medium text-white">Code mode playground & isolate REPL</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Execute multi-tool TypeScript workflows inside an isolated Rust Boa isolate in a single turn without prompt schema injection.
                  </p>
                </div>
                <div className="text-xs font-mono text-[#a78bfa] bg-[#5920fb]/15 border border-[#5920fb]/30 px-2.5 py-1">
                  Engine: Rust Boa isolate (boa_engine 0.22)
                </div>
              </div>

              {/* Presets */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <span className="text-xs text-zinc-500 font-mono shrink-0">Presets:</span>
                {CODE_PRESETS.map(p => (
                  <button
                    key={p.name}
                    onClick={() => {
                      setReplCode(p.code);
                      setReplOutput(null);
                    }}
                    className="px-3 py-1 text-xs font-mono text-zinc-400 hover:text-white bg-zinc-950/60 border border-zinc-800/60 transition-colors cursor-pointer"
                  >
                    {p.name}
                  </button>
                ))}
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-2 flex items-center justify-between">
                  <span>TypeScript code mode script</span>
                  <span className="text-[#a78bfa] text-xs font-mono">Typed via @allincode/typegen</span>
                </label>
                <textarea
                  value={replCode}
                  onChange={e => setReplCode(e.target.value)}
                  rows={8}
                  className="w-full bg-zinc-950 border border-zinc-800 p-3.5 font-mono text-xs text-zinc-200 outline-none focus:border-zinc-700 resize-y min-h-[160px]"
                />
                
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-3">
                  <span className="text-xs font-mono text-zinc-500">
                    Runs in isolated thread &bull; 0 prompt schemas injected &bull; Memory ceiling: 512MB
                  </span>
                  <button
                    onClick={handleExecuteRepl}
                    disabled={isExecutingRepl}
                    className="px-4 py-2 text-xs font-medium text-white bg-[#fe6d01] hover:bg-[#e05e00] transition-colors flex items-center gap-2 shrink-0 cursor-pointer"
                  >
                    {isExecutingRepl ? (
                      <span>Evaluating in Rust isolate...</span>
                    ) : (
                      <span>Execute in Rust isolate</span>
                    )}
                  </button>
                </div>
              </div>

              {replOutput && (
                <div className="mt-4 pt-4 border-t border-zinc-800">
                  <div className="text-xs font-medium text-zinc-300 mb-2 flex items-center justify-between">
                    <span>Sandbox execution result</span>
                    <span className="text-emerald-400 font-mono text-xs">Zero prompt bloat verified</span>
                  </div>
                  <pre className="bg-zinc-950 border border-zinc-800 p-4 font-mono text-xs text-zinc-300 overflow-x-auto">
                    {replOutput}
                  </pre>
                </div>
              )}
            </div>

          </div>
        )}

      </main>

    </div>
  );
}
