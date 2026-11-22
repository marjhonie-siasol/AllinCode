export interface McpToolProperty {
    type?: string;
    description?: string;
    enum?: string[];
    items?: McpToolProperty;
    properties?: Record<string, McpToolProperty>;
    required?: string[];
}
export interface McpToolInputSchema {
    type: string;
    properties?: Record<string, McpToolProperty>;
    required?: string[];
}
export interface McpToolDefinition {
    name: string;
    description?: string;
    inputSchema?: McpToolInputSchema;
    serverName?: string;
}
export declare function jsonSchemaTypeToTs(prop: McpToolProperty): string;
export declare function generateFunctionSignature(tool: McpToolDefinition): string;
export declare function generateNamespaceDeclaration(serverName: string, tools: McpToolDefinition[]): string;
//# sourceMappingURL=parser.d.ts.map