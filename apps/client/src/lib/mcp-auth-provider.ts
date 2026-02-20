import type {
  OAuthClientInformation,
  OAuthClientMetadata,
  OAuthClientProvider,
  OAuthTokens,
} from "@ai-sdk/mcp";
import type { MCPOAuthConfig } from "@/lib/types";
import {
  clearClientInformation,
  clearPendingAuth,
  clearTokens,
  getClientInformation,
  getPendingAuth,
  getStoredTokens,
  saveClientInformation,
  savePendingAuth,
  saveTokens,
} from "@/lib/oauth-store";

export class OAuthRedirectRequiredError extends Error {
  authorizationUrl: URL;

  constructor(message: string, authorizationUrl: URL) {
    super(message);
    this.authorizationUrl = authorizationUrl;
    this.name = "OAuthRedirectRequiredError";
  }
}

type OAuthProviderOptions = {
  serverUrl: string;
  oauthConfig?: MCPOAuthConfig;
  redirectUrl: string;
  scope?: string;
  state?: string;
  allowRedirect?: boolean;
  onRedirect?: (authorizationUrl: URL) => void;
};

function buildClientMetadata(
  redirectUrl: string,
  options: {
    scope?: string;
    clientName?: string;
    tokenEndpointAuthMethod?: string;
  },
): OAuthClientMetadata {
  return {
    redirect_uris: [redirectUrl],
    response_types: ["code"],
    grant_types: ["authorization_code", "refresh_token"],
    client_name: options.clientName ?? "MCP Chat Client",
    scope: options.scope,
    token_endpoint_auth_method: options.tokenEndpointAuthMethod,
  };
}

export function defaultRedirectUrl() {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    "http://localhost:3000";
  return `${baseUrl}/api/mcp/oauth/callback`;
}

export function createOAuthProvider({
  serverUrl,
  oauthConfig,
  redirectUrl,
  scope,
  state,
  allowRedirect = false,
  onRedirect,
}: OAuthProviderOptions): OAuthClientProvider {
  const resolvedState = state ?? crypto.randomUUID();
  const tokenEndpointAuthMethod = oauthConfig?.clientSecret
    ? "client_secret_basic"
    : "none";

  const clientMetadata = buildClientMetadata(redirectUrl, {
    scope,
    tokenEndpointAuthMethod,
  });

  const provider: OAuthClientProvider = {
    async tokens() {
      const stored = await getStoredTokens(serverUrl);
      return stored?.tokens;
    },
    async saveTokens(tokens: OAuthTokens) {
      await saveTokens(serverUrl, tokens);
    },
    async redirectToAuthorization(authorizationUrl: URL) {
      if (onRedirect) {
        onRedirect(authorizationUrl);
        return;
      }

      if (!allowRedirect) {
        throw new OAuthRedirectRequiredError(
          "OAuth authorization required.",
          authorizationUrl,
        );
      }

      throw new OAuthRedirectRequiredError(
        "OAuth authorization required.",
        authorizationUrl,
      );
    },
    async saveCodeVerifier(codeVerifier: string) {
      await savePendingAuth({
        state: resolvedState,
        serverUrl,
        codeVerifier,
        redirectUrl,
        createdAt: Date.now(),
      });
    },
    async codeVerifier() {
      const pending = await getPendingAuth(resolvedState);
      if (!pending) {
        throw new Error("No pending OAuth request found.");
      }
      return pending.codeVerifier;
    },
    async invalidateCredentials(scopeToInvalidate) {
      if (scopeToInvalidate === "all" || scopeToInvalidate === "tokens") {
        await clearTokens(serverUrl);
      }
      if (scopeToInvalidate === "all" || scopeToInvalidate === "client") {
        await clearClientInformation(serverUrl);
      }
      if (scopeToInvalidate === "all" || scopeToInvalidate === "verifier") {
        await clearPendingAuth(resolvedState);
      }
    },
    get redirectUrl() {
      return redirectUrl;
    },
    get clientMetadata() {
      return clientMetadata;
    },
    async clientInformation() {
      if (oauthConfig?.clientId) {
        return {
          client_id: oauthConfig.clientId,
          client_secret: oauthConfig.clientSecret,
        } satisfies OAuthClientInformation;
      }

      return await getClientInformation(serverUrl);
    },
    async saveClientInformation(clientInformation: OAuthClientInformation) {
      await saveClientInformation(serverUrl, clientInformation);
    },
  };

  provider.state = async () => resolvedState;

  return provider;
}
