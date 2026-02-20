import { createMCPClient } from "@ai-sdk/mcp";
import type { MCPServerConfig } from "@/lib/types";
import {
  createOAuthProvider,
  defaultRedirectUrl,
} from "@/lib/mcp-auth-provider";
import { getTokenStatus } from "@/lib/oauth-store";

type MCPClient = Awaited<ReturnType<typeof createMCPClient>>;

export async function createMcpClients(
  servers: MCPServerConfig[],
): Promise<MCPClient[]> {
  const eligibleServers = servers.filter((server) => server.enabled);

  const clients = await Promise.all(
    eligibleServers.map(async (server) => {
      if (server.authType === "oauth") {
        const status = await getTokenStatus(server.url);
        if (status.status === "missing") {
          throw new Error(
            `OAuth connection required for ${server.name || server.url}.`,
          );
        }

        return createMCPClient({
          transport: {
            type: "http",
            url: server.url,
            authProvider: createOAuthProvider({
              serverUrl: server.url,
              oauthConfig: server.oauthConfig,
              redirectUrl: defaultRedirectUrl(),
              allowRedirect: false
            }),
          },
        });
      }

      return createMCPClient({
        transport: {
          type: "http",
          url: server.url,
          headers:
            server.authType === "bearer" && server.apiKey
              ? { Authorization: `Bearer ${server.apiKey}` }
              : undefined,
        },
      });
    }),
  );

  return clients;
}

export async function collectMcpTools(
  clients: MCPClient[],
): Promise<Record<string, any>> {
  if (clients.length === 0) return {};

  const toolSets = await Promise.all(clients.map((client) => client.tools()));
  return Object.assign({}, ...toolSets);
}

export async function closeMcpClients(clients: MCPClient[]) {
  await Promise.allSettled(clients.map((client) => client.close()));
}
