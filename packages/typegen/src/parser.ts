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

export function jsonSchemaTypeToTs(prop: McpToolProperty): string {
  if (!prop) return 'any';
  
  if (prop.enum && prop.enum.length > 0) {
    return prop.enum.map(e => JSON.stringify(e)).join(' | ');
  }

  switch (prop.type) {
    case 'string':
      return 'string';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array':
      return prop.items ? `${jsonSchemaTypeToTs(prop.items)}[]` : 'any[]';
    case 'object':
      if (prop.properties) {
        const fields = Object.entries(prop.properties).map(([k, v]) => {
          const isReq = prop.required?.includes(k);
          return `${k}${isReq ? '' : '?'}: ${jsonSchemaTypeToTs(v)}`;
        });
        return `{ ${fields.join('; ')} }`;
      }
      return 'Record<string, any>';
    default:
      return 'any';
  }
}

export function generateFunctionSignature(tool: McpToolDefinition): string {
  const doc = tool.description ? `  /**\n   * ${tool.description.replace(/\n/g, '\n   * ')}\n   */\n` : '';
  
  let paramsType = 'Record<string, any>';
  if (tool.inputSchema?.properties && Object.keys(tool.inputSchema.properties).length > 0) {
    const fields = Object.entries(tool.inputSchema.properties).map(([name, prop]) => {
      const isRequired = tool.inputSchema?.required?.includes(name);
      const propDoc = prop.description ? `    /** ${prop.description} */\n    ` : '    ';
      return `${propDoc}${name}${isRequired ? '' : '?'}: ${jsonSchemaTypeToTs(prop)};`;
    });
    paramsType = `{\n${fields.join('\n')}\n  }`;
  } else if (!tool.inputSchema || !tool.inputSchema.properties || Object.keys(tool.inputSchema.properties).length === 0) {
    paramsType = 'void | Record<string, any>';
  }

  return `${doc}  function ${tool.name}(params?: ${paramsType}): Promise<any>;`;
}

export function generateNamespaceDeclaration(serverName: string, tools: McpToolDefinition[]): string {
  const funcs = tools.map(t => generateFunctionSignature(t)).join('\n\n');
  return `export namespace ${serverName} {\n${funcs}\n}`;
}
