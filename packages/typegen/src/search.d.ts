import { McpToolDefinition } from './parser.js';
export interface SearchResult {
    toolName: string;
    serverName: string;
    description: string;
    typeSignature: string;
    score: number;
}
export declare class ToolTypeIndex {
    private tools;
    constructor(tools?: McpToolDefinition[]);
    registerTools(tools: McpToolDefinition[]): void;
    search(query: string, limit?: number): SearchResult[];
    getFullDts(): string;
}
//# sourceMappingURL=search.d.ts.map