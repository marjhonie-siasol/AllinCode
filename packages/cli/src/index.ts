#!/usr/bin/env node

import { AllInCodeGateway } from '@allincode/gateway';
import readline from 'node:readline';

const BANNER = `
   /\\  _  |  _  _  _   _  _   _  | _ 
  /--\\ | | | | | | |  |  (_) (_| |(/_
  The Programmatic Tool Gateway for AI Agents (v0.1.0)
`;

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

async function runStdioServer() {
  const gateway = new AllInCodeGateway();
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
} else {
  runDemo();
}
