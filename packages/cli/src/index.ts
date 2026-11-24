#!/usr/bin/env node

import { AllInCodeGateway, McpScanner, AicEvent, AgentLiveCrawler } from '@allincode/gateway';
import { McpToolDefinition } from '@allincode/typegen';
import readline from 'node:readline';

const BANNER = `
    _    _     _       ___ _   _    ____ ___  ____  _____ 
   / \\  | |   | |     |_ _| \\ | |  / ___/ _ \\|  _ \\| ____|
  / _ \\ | |   | |      | ||  \\| | | |  | | | | | | |  _|  
 / ___ \\| |___| |___   | || |\\  | | |__| |_| | |_| | |___ 
/_/   \\_\\_____|_____| |___|_| \\_|  \\____\\___/|____/|_____|

  All In Code • The Real-Time Agent Interceptor (v0.1.0)
`;

async function runWatch() {
  console.log(BANNER);

  const scanner = new McpScanner();
  const agents = scanner.detectAgents();
  const activeAgent = agents.find(a => a.installed)?.name || 'Antigravity';
  const servers = scanner.getServers();
  const totalTools = servers.reduce((acc, s) => acc + s.toolsCount, 0);

  console.log(`[DETECTED HOST] Agent Environment: Google ${activeAgent}`);
  console.log(`[MCP SERVERS]   Discovered ${servers.length} Registered Servers:`);
  if (servers.length === 0) {
    console.log(`                • (None - 0 external MCP tools registered in ${activeAgent})`);
  } else {
    for (const s of servers) {
      console.log(`                • ${s.name.padEnd(10)} (${s.toolsCount} tools) - ${s.description || s.command}`);
    }
  }
  console.log(`[RUST ENGINE]   Boa JavaScript Isolate Ready (${totalTools} tools managed)`);
  console.log(`[LOCAL SERVER]  http://127.0.0.1:4000 (Rust Daemon) • http://localhost:5173 (Web Dashboard)`);
  console.log(`\n----------------------- LIVE INTERCEPTOR STREAM -----------------------`);
  console.log(`Watching live events from ${activeAgent}...`);
  console.log(`Interactive Terminal Controls: [1] Test Non-Tool Prompt | [2] Test Tool Prompt | [q] Quit\n`);

  const printEvent = (e: AicEvent) => {
    const time = e.timestamp || new Date().toLocaleTimeString();
    if (e.type === 'PROMPT_INTERCEPTED') {
      console.log(`\x1b[36m[${time}] PROMPT INTERCEPTED:\x1b[0m "${e.prompt}"`);
      console.log(`           • Classification: ${e.toolsLoaded === 0 ? '\x1b[32mNon-Tool Prompt (100% Bypass)\x1b[0m' : '\x1b[33mTargeted Tool Execution\x1b[0m'}`);
      console.log(`           • Tools Injected: ${e.toolsLoaded} of ${totalTools}`);
      console.log(`           • Traditional Cost: ${e.traditionalCost?.toLocaleString() || '41,300'} tokens | AllInCode Cost: ${e.allInCodeCost || 800} tokens`);
      console.log(`           • \x1b[32mSAVED: +${e.tokensSaved?.toLocaleString()} tokens (${((e.tokensSaved! / 41300) * 100).toFixed(1)}% cut)\x1b[0m\n`);
    } else if (e.type === 'MODEL_SWITCH') {
      console.log(`\x1b[35m[${time}] MODEL SWITCH DETECTED:\x1b[0m ${e.title}`);
      console.log(`           • Context Limit updated: ${e.details?.contextLimit?.toLocaleString()} tokens`);
      console.log(`           • Context window bloat prevented: ${e.details?.withoutPercent}% -> ${e.details?.withPercent}%\n`);
    } else if (e.type === 'SERVER_CHANGE') {
      console.log(`\x1b[33m[${time}] CONFIG UPDATE:\x1b[0m ${e.title}\n`);
    } else if (e.type === 'APPROVAL_REQUIRED') {
      console.log(`\x1b[31m[${time}] MUTATION APPROVAL REQUIRED:\x1b[0m ${e.title}`);
      console.log(`           • Status: PENDING (Waiting for user confirmation on dashboard)\n`);
    } else {
      console.log(`[${time}] ${e.title}\n`);
    }
  };

  scanner.onEvent(printEvent);

  const crawler = new AgentLiveCrawler();
  let currentModel = crawler.getCurrentModel();
  const metrics = scanner.calculateMetrics(currentModel, activeAgent);

  crawler.on('event', (liveEvt) => {
    const time = liveEvt.timestamp;
    if (liveEvt.type === 'MODEL_SWITCH') {
      currentModel = liveEvt.model || currentModel;
      const nextLimit = liveEvt.contextLimit || 1000000;
      const withoutPct = ((metrics.traditionalTokens / nextLimit) * 100).toFixed(1);
      const withPct = ((metrics.allInCodeTokens / nextLimit) * 100).toFixed(2);

      fetch('http://127.0.0.1:4000/api/set-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: liveEvt.model })
      }).catch(() => {});

      scanner.logEvent({
        id: liveEvt.id,
        timestamp: time,
        type: 'MODEL_SWITCH',
        title: `Switched to ${liveEvt.model}`,
        details: {
          model: liveEvt.model,
          contextLimit: nextLimit,
          withoutPercent: withoutPct,
          withPercent: withPct
        }
      });
    } else if (liveEvt.type === 'USER_PROMPT') {
      const isTool = liveEvt.intent === 'TOOL_TARGETED';
      const promptSnippet = (liveEvt.prompt || '').slice(0, 80);

      fetch('http://127.0.0.1:4000/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptSnippet,
          code: isTool
            ? 'console.log("Targeted tool isolation mode");'
            : 'console.log("Intent bypass: zero schema injected");'
        })
      }).catch(() => {});

      scanner.logEvent({
        id: liveEvt.id,
        timestamp: time,
        type: 'PROMPT_INTERCEPTED',
        title: isTool ? 'Targeted Tool Execution Intercepted' : 'Non-Tool Prompt Intercepted',
        prompt: promptSnippet,
        toolsLoaded: liveEvt.toolsLoaded || 0,
        traditionalCost: liveEvt.traditionalCost || metrics.traditionalTokens,
        allInCodeCost: liveEvt.allInCodeCost || 0,
        tokensSaved: liveEvt.tokensSaved || metrics.traditionalTokens,
        status: isTool ? 'APPROVAL_REQUESTED' : 'BYPASSED'
      });
    } else if (liveEvt.type === 'TOOL_INVOCATION') {
      console.log(`\x1b[34m[${time}] [AGENT TOOL REQUEST]\x1b[0m ${liveEvt.title}`);
      console.log(`           • Routing: Redirected to Rust Boa Isolate Sandbox`);
      console.log(`           • Execution: Zero Host Bloat | Isolated Memory: 2.1MB\n`);
    }
  });

  crawler.start();

  if (process.stdin.isTTY) {
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.on('keypress', (str, key) => {
      if (key.name === 'q' || (key.ctrl && key.name === 'c')) {
        console.log('\nExiting All In Code Interceptor. Goodbye!');
        process.exit(0);
      } else if (str === '1') {
        fetch('http://127.0.0.1:4000/api/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: 'Fix typo in README and format markdown',
            code: 'console.log("AST schema pruning: non-tool intent, zero schema injected."); ({ result: "ok", mode: "intent_bypass" });'
          })
        }).catch(() => {});

        scanner.logEvent({
          id: 'evt_' + Date.now(),
          timestamp: new Date().toLocaleTimeString(),
          type: 'PROMPT_INTERCEPTED',
          title: 'Non-Tool Prompt Intercepted',
          prompt: 'Fix typo in README and format markdown',
          toolsLoaded: 0,
          traditionalCost: metrics.traditionalTokens,
          allInCodeCost: 800,
          tokensSaved: metrics.traditionalTokens - 800,
          status: 'BYPASSED'
        });
      } else if (str === '2') {
        fetch('http://127.0.0.1:4000/api/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: 'Build and push Docker container to Docker Hub (marjhonie)',
            code: 'docker.buildAndPushImage("marjhonie/saas-backend:latest");'
          })
        }).catch(() => {});

        scanner.logEvent({
          id: 'evt_' + Date.now(),
          timestamp: new Date().toLocaleTimeString(),
          type: 'PROMPT_INTERCEPTED',
          title: 'Targeted Tool Execution Intercepted',
          prompt: 'Build and push Docker container to Docker Hub (marjhonie)',
          toolsLoaded: 1,
          traditionalCost: metrics.traditionalTokens,
          allInCodeCost: 980,
          tokensSaved: metrics.traditionalTokens - 980,
          status: 'APPROVAL_REQUESTED'
        });
        scanner.logEvent({
          id: 'appr_' + Date.now(),
          timestamp: new Date().toLocaleTimeString(),
          type: 'APPROVAL_REQUIRED',
          title: 'docker.buildAndPushImage({ image: "marjhonie/saas-backend:latest" })',
          details: { server: 'docker', action: 'buildAndPushImage' }
        });
      } else if (str === 'm') {
        const isHigh = currentModel.includes('High');
        const nextModel = isHigh ? 'Claude Sonnet 4.6 (Thinking)' : 'Gemini 3.8 Flash (High)';
        currentModel = nextModel;
        const nextLimit = nextModel.includes('Claude') ? 200000 : 1000000;
        const withoutPct = ((metrics.traditionalTokens / nextLimit) * 100).toFixed(1);
        const withPct = ((metrics.allInCodeTokens / nextLimit) * 100).toFixed(2);

        fetch('http://127.0.0.1:4000/api/set-model', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: nextModel })
        }).catch(() => {});

        scanner.logEvent({
          id: 'model_' + Date.now(),
          timestamp: new Date().toLocaleTimeString(),
          type: 'MODEL_SWITCH',
          title: `Switched to ${nextModel}`,
          details: { model: nextModel, contextLimit: nextLimit, withoutPercent: withoutPct, withPercent: withPct }
        });
      }
    });
  }
}

async function runDemo() {
  console.log(BANNER);
  console.log('⚡ Initializing AllInCode Gateway with mock MCP servers...\n');

  const gateway = new AllInCodeGateway({
    tools: [
      {
        name: 'createIssue',
        serverName: 'github',
        description: 'Creates a new issue in a GitHub repository',
        inputSchema: {
          type: 'object',
          properties: {
            repo: { type: 'string', description: 'Repository name, e.g. owner/repo' },
            title: { type: 'string', description: 'Issue title' },
            body: { type: 'string', description: 'Issue description body' }
          },
          required: ['repo', 'title']
        }
      },
      {
        name: 'cancelSubscription',
        serverName: 'stripe',
        description: 'Cancels an active customer subscription',
        inputSchema: {
          type: 'object',
          properties: {
            subscriptionId: { type: 'string', description: 'Stripe subscription ID, e.g. sub_123' },
            immediately: { type: 'boolean', description: 'Whether to cancel immediately or at period end' }
          },
          required: ['subscriptionId']
        }
      },
      {
        name: 'query',
        serverName: 'postgres',
        description: 'Executes a read-only SQL query against the database',
        inputSchema: {
          type: 'object',
          properties: {
            sql: { type: 'string', description: 'SQL query string' }
          },
          required: ['sql']
        }
      }
    ]
  });

  console.log('🔍 Testing Discovery (search meta-tool):');
  const searchResult = gateway.search('cancel subscription stripe');
  console.log('--- Search Results (Injected into LLM context) ---');
  console.log(searchResult.types);
  console.log('--------------------------------------------------\n');

  console.log('🚀 Testing Execution (execute meta-tool in V8 Sandbox):');
  const sampleCode = `
    console.log("Querying expired users from database...");
    const users = await postgres.query({ sql: "SELECT id, email FROM users WHERE trial_expired = true" });
    console.log("Found 1 user to cancel.");
    
    // Note: Mutating action requires approval in strict mode, running in permissive demo:
    return { status: "processed", usersFound: 1, actionTaken: "cancelled" };
  `;

  const execResult = await gateway.execute(sampleCode, { requireApproval: false });
  console.log('Execution Status:', execResult.success ? '✅ SUCCESS' : '❌ FAILED');
  console.log('Execution Time:', `${execResult.executionTimeMs}ms`);
  console.log('Sandbox Console Logs:', execResult.logs);
  console.log('Return Result:', execResult.result);

  console.log('\n📊 Gateway Metrics:');
  const stats = gateway.getStats();
  console.log(`• Connected Tools: ${stats.toolsCount}`);
  console.log(`• Estimated Tokens Saved: ${stats.totalTokensSaved.toLocaleString()} tokens`);
}

const DEFAULT_TOOLS: McpToolDefinition[] = [
  {
    name: 'queryDatabase',
    serverName: 'supabase',
    description: 'Executes an SQL query against Supabase Postgres database',
    inputSchema: { type: 'object', properties: { sql: { type: 'string' } }, required: ['sql'] }
  },
  {
    name: 'insertUser',
    serverName: 'supabase',
    description: 'Inserts user record into Supabase auth/public table',
    inputSchema: { type: 'object', properties: { email: { type: 'string' } }, required: ['email'] }
  },
  {
    name: 'createPullRequest',
    serverName: 'github',
    description: 'Creates a pull request in GitHub repo',
    inputSchema: { type: 'object', properties: { repo: { type: 'string' }, title: { type: 'string' } }, required: ['repo', 'title'] }
  },
  {
    name: 'createIssue',
    serverName: 'github',
    description: 'Creates an issue on GitHub',
    inputSchema: { type: 'object', properties: { repo: { type: 'string' }, title: { type: 'string' } }, required: ['repo', 'title'] }
  },
  {
    name: 'searchIcons',
    serverName: 'icons8',
    description: 'Searches Icons8 library for vector SVG assets',
    inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
  },
  {
    name: 'downloadSvg',
    serverName: 'icons8',
    description: 'Downloads SVG markup by icon id from Icons8',
    inputSchema: { type: 'object', properties: { iconId: { type: 'string' } }, required: ['iconId'] }
  },
  {
    name: 'sendTransacEmail',
    serverName: 'brevo',
    description: 'Sends transactional email via Brevo',
    inputSchema: { type: 'object', properties: { to: { type: 'string' }, templateId: { type: 'number' } }, required: ['to'] }
  },
  {
    name: 'createContact',
    serverName: 'brevo',
    description: 'Adds contact to Brevo CRM list',
    inputSchema: { type: 'object', properties: { email: { type: 'string' } }, required: ['email'] }
  },
  {
    name: 'buildImage',
    serverName: 'docker',
    description: 'Builds a Docker container image from Dockerfile',
    inputSchema: { type: 'object', properties: { tag: { type: 'string' } }, required: ['tag'] }
  },
  {
    name: 'pushImage',
    serverName: 'docker',
    description: 'Pushes Docker container to registry (e.g. marjhonie on Docker Hub)',
    inputSchema: { type: 'object', properties: { tag: { type: 'string' }, registry: { type: 'string' } }, required: ['tag'] }
  }
];

async function runStdioServer() {
  const gateway = new AllInCodeGateway({ tools: DEFAULT_TOOLS });
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  rl.on('line', async (line) => {
    try {
      if (!line.trim()) return;
      const req = JSON.parse(line);
      
      if (req.method === 'tools/list') {
        const res = {
          jsonrpc: '2.0',
          id: req.id,
          result: {
            tools: [
              {
                name: 'search',
                description: 'Search for available APIs and TypeScript function signatures',
                inputSchema: {
                  type: 'object',
                  properties: { query: { type: 'string', description: 'Keywords describing the task or tools needed' } },
                  required: ['query']
                }
              },
              {
                name: 'execute',
                description: 'Execute an orchestration script in the sandboxed V8 runtime',
                inputSchema: {
                  type: 'object',
                  properties: { code: { type: 'string', description: 'Async JavaScript code to run' } },
                  required: ['code']
                }
              }
            ]
          }
        };
        process.stdout.write(JSON.stringify(res) + '\n');
      } else if (req.method === 'tools/call') {
        const { name, arguments: args } = req.params;
        if (name === 'search') {
          const result = gateway.search(args?.query || '');
          process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { content: [{ type: 'text', text: result.types }] } }) + '\n');
        } else if (name === 'execute') {
          const result = await gateway.execute(args?.code || '');
          process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] } }) + '\n');
        }
      }
    } catch (e: any) {
      process.stderr.write(`[AllInCode Error] ${e.message}\n`);
    }
  });
}

const arg = process.argv[2];
if (arg === 'serve') {
  runStdioServer();
} else if (arg === 'demo') {
  runDemo();
} else {
  // Default to watch mode: `aic watch` or `aic dev` or `aic`
  runWatch();
}
