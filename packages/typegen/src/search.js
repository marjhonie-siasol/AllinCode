"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolTypeIndex = void 0;
const parser_js_1 = require("./parser.js");
class ToolTypeIndex {
    tools = [];
    constructor(tools = []) {
        this.tools = tools;
    }
    registerTools(tools) {
        this.tools.push(...tools);
    }
    search(query, limit = 8) {
        const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
        if (tokens.length === 0) {
            return this.tools.slice(0, limit).map(t => ({
                toolName: t.name,
                serverName: t.serverName || 'global',
                description: t.description || '',
                typeSignature: (0, parser_js_1.generateFunctionSignature)(t),
                score: 1.0
            }));
        }
        const scored = this.tools.map(tool => {
            let score = 0;
            const name = tool.name.toLowerCase();
            const server = (tool.serverName || '').toLowerCase();
            const desc = (tool.description || '').toLowerCase();
            for (const token of tokens) {
                if (name === token)
                    score += 10;
                else if (name.includes(token))
                    score += 5;
                if (server.includes(token))
                    score += 3;
                if (desc.includes(token))
                    score += 2;
            }
            return {
                toolName: tool.name,
                serverName: tool.serverName || 'global',
                description: tool.description || '',
                typeSignature: (0, parser_js_1.generateFunctionSignature)(tool),
                score
            };
        });
        return scored
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }
    getFullDts() {
        const byServer = {};
        for (const t of this.tools) {
            const s = t.serverName || 'global';
            if (!byServer[s])
                byServer[s] = [];
            byServer[s].push(t);
        }
        return Object.entries(byServer)
            .map(([srv, tools]) => {
            const funcs = tools.map(t => (0, parser_js_1.generateFunctionSignature)(t)).join('\n\n');
            return `export namespace ${srv} {\n${funcs}\n}`;
        })
            .join('\n\n');
    }
}
exports.ToolTypeIndex = ToolTypeIndex;
//# sourceMappingURL=search.js.map