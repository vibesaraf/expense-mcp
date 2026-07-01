import { config } from "../config/index.js";

export class TokenExchangeError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "TokenExchangeError";
  }
}

function applyClientAuth(params: URLSearchParams): Record<string, string> {
  if (config.LR_TOKEN_ENDPOINT_AUTH_METHOD === "client_secret_basic") {
    const creds = Buffer.from(
      `${config.LR_CLIENT_ID}:${config.LR_CLIENT_SECRET}`,
    ).toString("base64");
    return {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${creds}`,
    };
  }
  params.set("client_id", config.LR_CLIENT_ID);
  params.set("client_secret", config.LR_CLIENT_SECRET);
  return { "Content-Type": "application/x-www-form-urlencoded" };
}

async function postToken(
  params: URLSearchParams,
  errorMessage: string,
): Promise<{ access_token: string; expires_in?: number }> {
  const headers = applyClientAuth(params);
  params.set("audience", config.REST_BASE_URL);
  console.log({
    endpoint: config.LR_TOKEN_ENDPOINT,
    params: params.toString(),
  });
  const res = await fetch(config.LR_TOKEN_ENDPOINT, {
    method: "POST",
    headers,
    body: params,
  });
  if (!res.ok) {
    const body = (await res.json()) as {
      error_description?: string;
      error?: string;
    };
    throw new TokenExchangeError(
      body.error_description ?? body.error ?? errorMessage,
      body.error,
    );
  }
  return res.json() as Promise<{ access_token: string; expires_in?: number }>;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

let actorTokenCache: CachedToken | null = null;

export async function getActorToken(): Promise<string> {
  if (actorTokenCache && actorTokenCache.expiresAt > Date.now() + 30_000) {
    return actorTokenCache.token;
  }

  const params = new URLSearchParams({
    grant_type: "client_credentials",
    scope: config.MCP_SERVER_ACTOR_SCOPES,
    resource: config.REST_RESOURCE_URL,
    clientId: config.LR_CLIENT_ID,
    clientSecret: config.LR_CLIENT_SECRET,
  });

  const { access_token, expires_in } = await postToken(
    params,
    "Failed to obtain actor token",
  );

  actorTokenCache = {
    token: access_token,
    expiresAt: Date.now() + (expires_in ?? 3600) * 1000,
  };
  return access_token;
}

const TOKEN_TYPE = "urn:ietf:params:oauth:token-type:access_token";

export async function exchangeToken(
  subjectToken: string,
  scope: string,
): Promise<string> {
  const actorToken = await getActorToken();

  const params = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
    subject_token: subjectToken,
    subject_token_type: TOKEN_TYPE,
    actor_token: actorToken,
    actor_token_type: TOKEN_TYPE,
    requested_token_type: TOKEN_TYPE,
    scope,
    audience: config.REST_RESOURCE_URL,
    clientId: config.LR_CLIENT_ID,
    clientSecret: config.LR_CLIENT_SECRET,
  });

  const { access_token } = await postToken(params, "Token exchange failed");
  return access_token;
}
