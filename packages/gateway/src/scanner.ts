import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface DiscoveredServer {
  id: string;
  name: string;
  command: string;
  args?: string[];
  toolsCount: number;
  description?: string;
  source: string;
}

export interface ModelProfile {
  name: string;
  contextLimit: number;
  description: string;
}

export const AGENT_MODELS: Record<string, ModelProfile[]> = {
  Antigravity: [
    { name: 'Gemini 3.8 Flash (High)', contextLimit: 1000000, description: '1M tokens context, deep reasoning' },
    { name: 'Gemini 3.8 Flash (Medium)', contextLimit: 1000000, description: 'Active Model (1M tokens context)' },
    { name: 'Gemini 3.8 Flash (Low)', contextLimit: 1000000, description: '1M tokens context, fast response' },
    { name: 'Claude Sonnet 4.6 (Thinking)', contextLimit: 200000, description: '200k tokens context' },
    { name: 'Claude Opus 4.6 (Thinking)', contextLimit: 200000, description: '200k tokens context' },
    { name: 'GPT-OSS 120B (Medium)', contextLimit: 128000, description: '128k tokens context' },
  ],
  'Claude Code': [
    { name: 'Claude Sonnet 4.6 (Thinking)', contextLimit: 200000, description: '200k tokens context' },
    { name: 'Claude Opus 4.6 (Thinking)', contextLimit: 200000, description: '200k tokens context' },
  ],
  Cursor: [
    { name: 'Claude Sonnet 4.6', contextLimit: 200000, description: '200k tokens context' },
    { name: 'GPT-OSS 120B', contextLimit: 128000, description: '128k tokens context' },
  ],
  Codex: [
    { name: 'GPT-OSS 120B (Medium)', contextLimit: 128000, description: '128k tokens context' },
  ]
};

export interface AicEvent {
  id: string;
  timestamp: string;
  type: 'PROMPT_INTERCEPTED' | 'MODEL_SWITCH' | 'SERVER_CHANGE' | 'APPROVAL_REQUIRED' | 'ACTION_APPROVED';
  title: string;
  prompt?: string;
  toolsLoaded?: number;
  tokensSaved?: number;
  traditionalCost?: number;
  allInCodeCost?: number;
  status?: string;
  details?: Record<string, any>;
}

export class McpScanner {
  private configPath: string;
  private eventsPath: string;
  private servers: Map<string, DiscoveredServer> = new Map();
  private listeners: Array<() => void> = [];
  private eventListeners: Array<(event: AicEvent) => void> = [];

  constructor(customConfigPath?: string) {
    let resolvedConfig = customConfigPath;
    if (!resolvedConfig) {
      if (fs.existsSync(path.resolve(process.cwd(), 'aic.config.json'))) {
        resolvedConfig = path.resolve(process.cwd(), 'aic.config.json');
      } else {
        let cur = __dirname;
        for (let i = 0; i < 6; i++) {
          const candidate = path.join(cur, 'aic.config.json');
          if (fs.existsSync(candidate)) {
            resolvedConfig = candidate;
            break;
          }
          cur = path.dirname(cur);
        }
      }
    }
    this.configPath = resolvedConfig || path.resolve(process.cwd(), 'aic.config.json');
    this.eventsPath = path.resolve(path.dirname(this.configPath), 'aic.events.json');
    this.scan();
    this.setupWatcher();
  }

  public detectAgents(): { name: string; installed: boolean; path?: string }[] {
    const home = os.homedir();
    const antigravityPath = path.join(home, '.gemini', 'antigravity', 'mcp_config.json');
    const claudePath = path.join(home, '.claude.json');
    const cursorPath = path.join(home, '.cursor', 'mcp.json');

    return [
      { name: 'Antigravity', installed: fs.existsSync(antigravityPath), path: antigravityPath },
      { name: 'Claude Code', installed: fs.existsSync(claudePath), path: claudePath },
      { name: 'Cursor', installed: fs.existsSync(cursorPath), path: cursorPath },
      { name: 'Codex', installed: true, path: 'Integrated Developer Environment' },
    ];
  }

  public scan(): Map<string, DiscoveredServer> {
    this.servers.clear();

    // 1. Scan Antigravity mcp_config.json (both ~/.gemini/antigravity and ~/.gemini/config)
    const antigravityPaths = [
      path.join(os.homedir(), '.gemini', 'antigravity', 'mcp_config.json'),
      path.join(os.homedir(), '.gemini', 'config', 'mcp_config.json')
    ];
    for (const p of antigravityPaths) {
      if (fs.existsSync(p)) {
        try {
          const raw = fs.readFileSync(p, 'utf8');
          const parsed = JSON.parse(raw);
          if (parsed && parsed.mcpServers && typeof parsed.mcpServers === 'object') {
            for (const [name, cfg] of Object.entries<any>(parsed.mcpServers)) {
              if (name !== 'all-in-code' && !this.servers.has(name)) {
                this.servers.set(name, {
                  id: name,
                  name,
                  command: cfg.command || 'npx',
                  args: cfg.args || [],
                  toolsCount: cfg.toolsCount || (name === 'icons8' ? 12 : (name === 'supabase' ? 28 : (name === 'github' ? 38 : (name === 'brevo' ? 24 : 15)))),
                  description: cfg.description || `Antigravity Config (${name})`,
                  source: p
                });
              }
            }
          }
        } catch (e) {}
      }
    }

    // 2. Scan Cursor mcp.json
    const cursorPath = path.join(os.homedir(), '.cursor', 'mcp.json');
    if (fs.existsSync(cursorPath)) {
      try {
        const raw = fs.readFileSync(cursorPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && parsed.mcpServers && typeof parsed.mcpServers === 'object') {
          for (const [name, cfg] of Object.entries<any>(parsed.mcpServers)) {
            if (name !== 'all-in-code' && !this.servers.has(name)) {
              this.servers.set(name, {
                id: name,
                name,
                command: cfg.command || 'npx',
                args: cfg.args || [],
                toolsCount: cfg.toolsCount || 15,
                description: `Cursor MCP (${name})`,
                source: cursorPath
              });
            }
          }
        }
      } catch (e) {}
    }

    // 3. Scan Claude Code / Desktop
    const claudePaths = [
      path.join(os.homedir(), '.claude.json'),
      path.join(process.env.APPDATA || '', 'Claude', 'claude_desktop_config.json')
    ];
    for (const cp of claudePaths) {
      if (cp && fs.existsSync(cp)) {
        try {
          const raw = fs.readFileSync(cp, 'utf8');
          const parsed = JSON.parse(raw);
          if (parsed && parsed.mcpServers && typeof parsed.mcpServers === 'object') {
            for (const [name, cfg] of Object.entries<any>(parsed.mcpServers)) {
              if (name !== 'all-in-code' && !this.servers.has(name)) {
                this.servers.set(name, {
                  id: name,
                  name,
                  command: cfg.command || 'npx',
                  args: cfg.args || [],
                  toolsCount: cfg.toolsCount || 15,
                  description: `Claude MCP (${name})`,
                  source: cp
                });
              }
            }
          }
        } catch (e) {}
      }
    }

    return this.servers;
  }

  public getServers(): DiscoveredServer[] {
    return Array.from(this.servers.values());
  }

  public addServer(server: DiscoveredServer): void {
    this.servers.set(server.name, server);
    this.persist();
    this.logEvent({
      id: 'srv_' + Date.now(),
      timestamp: new Date().toLocaleTimeString(),
      type: 'SERVER_CHANGE',
      title: `Added MCP Server: ${server.name} (${server.toolsCount} tools)`,
      details: { server: server.name, tools: server.toolsCount }
    });
  }

  public removeServer(name: string): boolean {
    const deleted = this.servers.delete(name);
    if (deleted) {
      this.persist();
      this.logEvent({
        id: 'srv_' + Date.now(),
        timestamp: new Date().toLocaleTimeString(),
        type: 'SERVER_CHANGE',
        title: `Removed MCP Server: ${name}`,
        details: { server: name }
      });
    }
    return deleted;
  }

  private persist(): void {
    try {
      const obj: Record<string, any> = {};
      for (const [name, s] of this.servers.entries()) {
        obj[name] = {
          command: s.command,
          args: s.args,
          toolsCount: s.toolsCount,
          description: s.description
        };
      }
      const existing = fs.existsSync(this.configPath) ? JSON.parse(fs.readFileSync(this.configPath, 'utf8')) : {};
      const full = {
        client: existing.client || {
          agent: 'Antigravity',
          model: 'Gemini 3.8 Flash (Medium)',
          contextLimit: 1000000
        },
        servers: obj
      };
      fs.writeFileSync(this.configPath, JSON.stringify(full, null, 2), 'utf8');
      this.notifyListeners();
    } catch (e) {}
  }

  public detectActiveModel(agentName: string = 'Antigravity'): string {
    if (agentName === 'Antigravity') {
      try {
        const brainDir = path.join(os.homedir(), '.gemini', 'antigravity', 'brain');
        if (fs.existsSync(brainDir)) {
          const convs = fs.readdirSync(brainDir)
            .map(c => {
              const tPath = path.join(brainDir, c, '.system_generated', 'logs', 'transcript.jsonl');
              try {
                if (fs.existsSync(tPath)) {
                  return { path: tPath, mtime: fs.statSync(tPath).mtimeMs };
                }
              } catch (e) {}
              return null;
            })
            .filter((c): c is { path: string; mtime: number } => Boolean(c));
          convs.sort((a, b) => b.mtime - a.mtime);

          for (const conv of convs) {
            const transcriptPath = conv.path;
            if (fs.existsSync(transcriptPath)) {
              const stat = fs.statSync(transcriptPath);
              const readStart = Math.max(0, stat.size - 64 * 1024);
              const fd = fs.openSync(transcriptPath, 'r');
              const length = stat.size - readStart;
              const buf = Buffer.alloc(length);
              fs.readSync(fd, buf, 0, length, readStart);
              fs.closeSync(fd);

              const content = buf.toString('utf8');
              const lines = content.split('\n').filter(Boolean);
              for (let i = lines.length - 1; i >= 0; i--) {
                try {
                  const entry = JSON.parse(lines[i]);
                  const text = entry.content || '';
                  if (text.includes('Model Selection')) {
                    const match = text.match(/Model Selection.*? from (?:.*?) to (.*?)\.\s*(?:No need|<\/USER_SETTINGS_CHANGE>|$)/s);
                    if (match && match[1]) {
                      return match[1].trim();
                    }
                  }
                } catch (e) {}
              }
            }
          }
        }
      } catch (e) {}
      return 'Gemini 3.8 Flash (High)';
    }

    if (agentName === 'Claude Code') {
      return 'Claude Sonnet 4.6 (Thinking)';
    }
    if (agentName === 'Cursor') {
      return 'Claude Sonnet 4.6';
    }
    return 'GPT-OSS 120B (Medium)';
  }

  public calculateMetrics(modelName: string, agentName: string = 'Antigravity') {
    const models = AGENT_MODELS[agentName] || AGENT_MODELS['Antigravity'];
    const selectedModel = models.find(m => m.name.toLowerCase() === modelName.toLowerCase()) || models[0];
    const contextLimit = selectedModel.contextLimit;

    const totalTools = Array.from(this.servers.values()).reduce((acc, s) => acc + (s.toolsCount || 15), 0);
    const traditionalTokens = totalTools * 350;
    const allInCodeTokens = totalTools > 0 ? 800 : 0;
    const tokensSaved = Math.max(0, traditionalTokens - allInCodeTokens);
    const percentSaved = traditionalTokens > 0 ? ((tokensSaved / traditionalTokens) * 100).toFixed(1) : '0';

    const contextPercentWithout = ((traditionalTokens / contextLimit) * 100).toFixed(2);
    const contextPercentWith = ((allInCodeTokens / contextLimit) * 100).toFixed(2);

    return {
      agent: agentName,
      model: selectedModel.name,
      contextLimit,
      totalServers: this.servers.size,
      totalTools,
      traditionalTokens,
      allInCodeTokens,
      tokensSaved,
      percentSaved,
      contextPercentWithout,
      contextPercentWith
    };
  }

  public getEvents(): AicEvent[] {
    if (fs.existsSync(this.eventsPath)) {
      try {
        return JSON.parse(fs.readFileSync(this.eventsPath, 'utf8'));
      } catch (e) {}
    }
    return [];
  }

  public logEvent(event: AicEvent): void {
    const events = this.getEvents();
    events.unshift(event);
    if (events.length > 50) events.length = 50;
    try {
      fs.writeFileSync(this.eventsPath, JSON.stringify(events, null, 2), 'utf8');
    } catch (e) {}

    for (const fn of this.eventListeners) {
      try { fn(event); } catch (e) {}
    }
  }

  public onEvent(fn: (event: AicEvent) => void): void {
    this.eventListeners.push(fn);
  }

  public onUpdate(fn: () => void): void {
    this.listeners.push(fn);
  }

  private notifyListeners(): void {
    for (const fn of this.listeners) {
      try { fn(); } catch (e) {}
    }
  }

  private lastEventId: string = '';

  private setupWatcher(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        fs.watch(this.configPath, (eventType) => {
          if (eventType === 'change') {
            this.scan();
            this.notifyListeners();
          }
        });
      }
    } catch (e) {}

    try {
      if (!fs.existsSync(this.eventsPath)) {
        fs.writeFileSync(this.eventsPath, '[]', 'utf8');
      }

      fs.watch(this.eventsPath, (eventType) => {
        if (eventType === 'change') {
          const events = this.getEvents();
          if (events.length > 0) {
            const latest = events[0];
            if (latest.id !== this.lastEventId) {
              this.lastEventId = latest.id;
              for (const fn of this.eventListeners) {
                try { fn(latest); } catch (e) {}
              }
            }
          }
        }
      });
    } catch (e) {}
  }
}
