import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import {
  streamText,
  convertToModelMessages,
  stepCountIs,
  type UIMessage,
} from "ai";
import { resolveModelConfig, type ModelConfig } from "@/lib/models";
import { closeMcpClients, collectMcpTools, createMcpClients } from "@/lib/mcp";
import type { MCPServerConfig } from "@/lib/types";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const {
    messages = [],
    model,
    mcpServers = [],
  } = (await req.json()) as {
    messages?: UIMessage[];
    model?: ModelConfig;
    mcpServers?: MCPServerConfig[];
  };

  const resolvedModel = resolveModelConfig(model);

  let modelInstance;

  switch (resolvedModel.provider) {
    case "openai":
      modelInstance = openai(resolvedModel.modelId);
      break;
    case "google":
      modelInstance = google(resolvedModel.modelId);
      break;
    case "anthropic":
    default:
      modelInstance = anthropic(resolvedModel.modelId);
      break;
  }

  let mcpClients = [] as Awaited<ReturnType<typeof createMcpClients>>;
  let tools = {} as Awaited<ReturnType<typeof collectMcpTools>>;

  try {
    mcpClients = await createMcpClients(
      Array.isArray(mcpServers) ? mcpServers : [],
    );
    tools = await collectMcpTools(mcpClients);
  } catch (error) {
    await closeMcpClients(mcpClients);
    throw error;
  }

  const result = streamText({
    model: modelInstance,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(10),
    onFinish: async () => {
      await closeMcpClients(mcpClients);
    },
  });

  return result.toUIMessageStreamResponse({
    onError: (error) =>
      error instanceof Error ? error.message : "An error occurred.",
  });
}
