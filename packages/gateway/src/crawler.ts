import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { EventEmitter } from 'node:events';

export interface AgentLiveEvent {
  id: string;
  timestamp: string;
  type: 'MODEL_SWITCH' | 'USER_PROMPT' | 'TOOL_INVOCATION' | 'HEARTBEAT';
  agent: string;
  title: string;
  model?: string;
  contextLimit?: number;
  prompt?: string;
  intent?: 'NON_TOOL' | 'TOOL_TARGETED';
  tools?: string[];
  toolsLoaded?: number;
  traditionalCost?: number;
  allInCodeCost?: number;
  tokensSaved?: number;
  details?: Record<string, any>;
}

export class AgentLiveCrawler extends EventEmitter {
  private activeAgent: string = 'Antigravity';
  private currentModel: string = 'Gemini 3.8 Flash (High)';
  private isWatching: boolean = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private watchedFilePath: string | null = null;
  private lastReadOffset: number = 0;
  private seenStepIndexes: Set<number> = new Set();
  private cursorPath: string;
  private claudePath: string;

  constructor() {
    super();
    this.cursorPath = path.join(os.homedir(), '.cursor');
    this.claudePath = path.join(os.homedir(), '.claude');
  }

  public start(): void {
    if (this.isWatching) return;
    this.isWatching = true;

    this.attachToActiveAgentTranscript();

    // Fast non-blocking polling fallback across platforms in addition to fs.watch
    this.checkInterval = setInterval(() => {
      this.pollActiveAgent();
    }, 400);
  }

  public stop(): void {
    this.isWatching = false;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  public getCurrentModel(): string {
    return this.currentModel;
  }

  public getActiveAgent(): string {
    return this.activeAgent;
  }

  private attachToActiveAgentTranscript(): void {
    const brainDir = path.join(os.homedir(), '.gemini', 'antigravity', 'brain');
    if (!fs.existsSync(brainDir)) return;

    try {
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

      if (convs.length > 0) {
        const target = convs[0].path;
        this.watchedFilePath = target;
        try {
          const stat = fs.statSync(target);
          // Read the tail portion on initial attachment to detect initial active model
          const readStart = Math.max(0, stat.size - 64 * 1024);
          this.lastReadOffset = stat.size;
          this.parseInitialState(target, readStart, stat.size);
        } catch (e) {}
      }
    } catch (e) {}
  }

  private parseInitialState(filePath: string, start: number, end: number): void {
    try {
      const fd = fs.openSync(filePath, 'r');
      const length = end - start;
      const buffer = Buffer.alloc(length);
      fs.readSync(fd, buffer, 0, length, start);
      fs.closeSync(fd);

      const lines = buffer.toString('utf8').split('\n').filter(Boolean);
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const entry = JSON.parse(lines[i]);
          if (entry.step_index !== undefined) {
            this.seenStepIndexes.add(entry.step_index);
          }
          if (!this.currentModel || this.currentModel === 'Gemini 3.8 Flash (High)') {
            const detected = this.extractModelChange(entry.content || '');
            if (detected) {
              this.currentModel = detected;
            }
          }
        } catch (e) {}
      }
    } catch (e) {}
  }

  private pollActiveAgent(): void {
    const brainDir = path.join(os.homedir(), '.gemini', 'antigravity', 'brain');
    if (!fs.existsSync(brainDir)) return;

    try {
      // Find the most recently touched transcript
      const convs = fs.readdirSync(brainDir)
        .map(c => {
          const tPath = path.join(brainDir, c, '.system_generated', 'logs', 'transcript.jsonl');
          try {
            if (fs.existsSync(tPath)) {
              return { path: tPath, mtime: fs.statSync(tPath).mtimeMs, size: fs.statSync(tPath).size };
            }
          } catch (e) {}
          return null;
        })
        .filter((c): c is { path: string; mtime: number; size: number } => Boolean(c));

      convs.sort((a, b) => b.mtime - a.mtime);
      if (convs.length === 0) return;

      const newest = convs[0];

      // If switched to a new transcript
      if (newest.path !== this.watchedFilePath) {
        this.watchedFilePath = newest.path;
        this.lastReadOffset = Math.max(0, newest.size - 32 * 1024);
      }

      if (newest.size > this.lastReadOffset) {
        const bytesToRead = newest.size - this.lastReadOffset;
        const buffer = Buffer.alloc(bytesToRead);
        const fd = fs.openSync(newest.path, 'r');
        fs.readSync(fd, buffer, 0, bytesToRead, this.lastReadOffset);
        fs.closeSync(fd);
        this.lastReadOffset = newest.size;

        const text = buffer.toString('utf8');
        const lines = text.split('\n').filter(Boolean);

        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            this.processTranscriptEntry(entry);
          } catch (e) {}
        }
      }
    } catch (e) {}
  }

  private processTranscriptEntry(entry: any): void {
    if (entry.step_index !== undefined && this.seenStepIndexes.has(entry.step_index)) {
      return;
    }
    if (entry.step_index !== undefined) {
      this.seenStepIndexes.add(entry.step_index);
    }

    const content = entry.content || '';

    // 1. Check for Model Selection change
    const modelChangedTo = this.extractModelChange(content);
    if (modelChangedTo && modelChangedTo !== this.currentModel) {
      const oldModel = this.currentModel;
      this.currentModel = modelChangedTo;
      const contextLimit = this.calculateContextLimit(this.currentModel);

      const evt: AgentLiveEvent = {
        id: 'mdl_' + Date.now(),
        timestamp: new Date().toLocaleTimeString(),
        type: 'MODEL_SWITCH',
        agent: 'Antigravity',
        title: `Switched model: ${oldModel} -> ${modelChangedTo}`,
        model: modelChangedTo,
        contextLimit,
        details: {
          previousModel: oldModel,
          newModel: modelChangedTo,
          contextLimit
        }
      };
      this.emit('event', evt);
    }

    // 2. Check for User Prompt
    if (entry.type === 'USER_INPUT' && content) {
      const promptMatch = content.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/);
      const userPrompt = promptMatch ? promptMatch[1].trim() : '';

      if (userPrompt) {
        const isToolTargeted = /(build|docker|deploy|execute|database|postgres|push|github|pr|commit|curl)/i.test(userPrompt);
        const traditionalCost = 35700;
        const allInCodeCost = isToolTargeted ? 980 : 0;
        const tokensSaved = traditionalCost - allInCodeCost;

        const evt: AgentLiveEvent = {
          id: 'prm_' + Date.now(),
          timestamp: new Date().toLocaleTimeString(),
          type: 'USER_PROMPT',
          agent: 'Antigravity',
          title: 'User Prompt Intercepted',
          prompt: userPrompt,
          intent: isToolTargeted ? 'TOOL_TARGETED' : 'NON_TOOL',
          toolsLoaded: isToolTargeted ? 1 : 0,
          traditionalCost,
          allInCodeCost,
          tokensSaved,
          details: {
            step_index: entry.step_index
          }
        };
        this.emit('event', evt);
      }
    }

    // 3. Check for Tool Invocations
    if (entry.type === 'PLANNER_RESPONSE' && entry.tool_calls && Array.isArray(entry.tool_calls)) {
      const toolNames = entry.tool_calls.map((t: any) => t.name);
      const evt: AgentLiveEvent = {
        id: 'tool_' + Date.now(),
        timestamp: new Date().toLocaleTimeString(),
        type: 'TOOL_INVOCATION',
        agent: 'Antigravity',
        title: `Agent Tool Request: ${toolNames.join(', ')}`,
        tools: toolNames,
        details: {
          step_index: entry.step_index,
          tool_calls: entry.tool_calls
        }
      };
      this.emit('event', evt);
    }
  }

  private extractModelChange(content: string): string | null {
    if (!content.includes('Model Selection')) return null;
    const match = content.match(/Model Selection.*? from (?:.*?) to (.*?)\.\s*(?:No need|<\/USER_SETTINGS_CHANGE>|$)/s);
    if (match && match[1]) {
      return match[1].trim();
    }
    return null;
  }

  private calculateContextLimit(model: string): number {
    const lower = model.toLowerCase();
    if (lower.includes('claude')) return 200000;
    if (lower.includes('gemini')) return 1000000;
    if (lower.includes('gpt')) return 128000;
    return 1000000;
  }
}
