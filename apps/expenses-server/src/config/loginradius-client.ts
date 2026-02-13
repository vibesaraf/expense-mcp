import { getLoginRadiusConfig } from "./loginradius.js";

export interface IntrospectionResponse {
  active: boolean;
  sub?: string;
  email?: string;
  scp?: string;
  iss?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
  client_id?: string;
  token_type?: string;
}

export async function introspectToken(
  accessToken: string,
): Promise<IntrospectionResponse> {
  const config = getLoginRadiusConfig();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  let body: Record<string, string>;

  if (config.LR_TOKEN_ENDPOINT_AUTH_METHOD === "client_secret_basic") {
    const credentials = Buffer.from(
      `${config.LR_CLIENT_ID}:${config.LR_CLIENT_SECRET}`,
    ).toString("base64");
    headers.Authorization = `Basic ${credentials}`;
    body = {
      token: accessToken,
      token_type_hint: "access_token",
    };
  } else {
    body = {
      token: accessToken,
      token_type_hint: "access_token",
      client_id: config.LR_CLIENT_ID,
      client_secret: config.LR_CLIENT_SECRET,
    };
  }

  const response = await fetch(config.LR_INTROSPECT_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(
      `Introspection request failed: ${response.status} ${response.statusText}`,
    );
  }

  return response.json() as Promise<IntrospectionResponse>;
}

export async function validateAccessToken(
  accessToken: string,
): Promise<IntrospectionResponse> {
  const result = await introspectToken(accessToken);

  if (!result.active) {
    throw new Error("Access token is not active");
  }

  return result;
}
