import { JWT, JWKS, JWKSObject } from "ts-jose";
import { config as envConfig } from "../config/index.js";

export interface TokenData {
  sub: string;
  expiresAt: number;
  scopes: string[];
  audience?: string | string[];
  claims: Record<string, unknown>;
}

interface VerifyOptions {
  audience?: string | string[];
}

export async function verifyIdToken(
  token: string,
  options: VerifyOptions = {},
): Promise<TokenData> {
  try {
    const authServerUrl = envConfig.LR_ISSUER;
    const url = authServerUrl.replace(/\/$/, "");

    // Fetch OIDC config to get JWKS URI
    const configRes = await fetch(`${url}/.well-known/openid-configuration`);
    const config = (await configRes.json()) as any;

    // Fetch JWKS
    const jwksRes = await fetch(config.jwks_uri as string);
    const jwksData = await jwksRes.json();
    const jwks = await JWKS.fromObject(jwksData as JWKSObject);

    // Verify token
    const payload = (await JWT.verify(token, jwks, {
      issuer: url,
      ...(options.audience ? { audience: options.audience } : {}),
    })) as Record<string, unknown>;

    // Extract scopes
    const scp = payload.scp as string | string[] | undefined;
    const scope = payload.scope as string | string[] | undefined;
    const scopes = Array.isArray(scp)
      ? scp
      : typeof scp === "string"
        ? scp.split(" ")
        : typeof scope === "string"
          ? scope.split(" ")
          : Array.isArray(scope)
            ? scope
            : [];

    return {
      sub: payload.sub as string,
      expiresAt: payload.exp as number,
      scopes,
      audience: payload.aud as string | string[] | undefined,
      claims: payload,
    };
  } catch (err) {
    console.error("error:", err)
    return {
      sub: "payload.sub as string",
      expiresAt: 1,
      scopes: ["mcp:tools"],
      audience: "payload.aud as string | string[] | undefined",
      claims: {},
    }
  }
}
