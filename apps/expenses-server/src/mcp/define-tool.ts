import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ZodRawShape, ZodTypeAny } from "zod";
import type {
  McpToolExtra,
  ToolHandlerNoInput,
  ToolHandlerWithInput,
} from "./types.js";
type ToolDefinition = {
  name: string;
  description: string;
  input?: ZodRawShape | ZodTypeAny;
  scopes?: string[];
  handler: ToolHandlerWithInput<any> | ToolHandlerNoInput;
};

export function defineTool(definition: ToolDefinition) {
  return (server: McpServer): void => {
    server.registerTool(
      definition.name,
      {
        description: definition.description,
        inputSchema: definition.input,
      },
      async (args: unknown, extra: unknown) => {
        const toolExtra = extra as McpToolExtra;

        if (definition.input) {
          const handler = definition.handler as ToolHandlerWithInput<any>;
          return handler(args as any, toolExtra);
        }

        const handler = definition.handler as ToolHandlerNoInput;
        return handler(toolExtra);
      },
    );
  };
}
