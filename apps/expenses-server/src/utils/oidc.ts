import { JWT, JWKS, JWKSObject } from "ts-jose";
import { config as envConfig } from "../config/index.js";

export interface TokenData {
  sub: string;
  expiresAt: number;
  scopes: string[];
  audience?: string | string[];
  act?: { sub: string };
  claims: Record<string, unknown>;
}

interface VerifyOptions {
  audience?: string | string[];
  issuer?: string | string[];
}

export async function verifyIdToken(
  token: string,
  options: VerifyOptions = {},
): Promise<TokenData | null> {
  try {
    const authServerUrl = envConfig.LR_ISSUER;
    const url = authServerUrl.replace(/\/$/, "");

    const configRes = await fetch(`${url}/.well-known/openid-configuration`);
    const oidcConfig = (await configRes.json()) as any;

    const jwksRes = await fetch(oidcConfig.jwks_uri as string);
    const jwksData = await jwksRes.json();
    const jwks = await JWKS.fromObject(jwksData as JWKSObject);

    const defaultIssuers = [
      url,
      "https://dev-vaibhav.devhub.lrinternal.com/service/oauth/",
    ];
    const issuers = options.issuer
      ? Array.isArray(options.issuer)
        ? options.issuer
        : [options.issuer]
      : defaultIssuers;

    const payload = (await JWT.verify(token, jwks, {
      issuer: issuers,
      ...(options.audience ? { audience: options.audience } : {}),
    })) as Record<string, unknown>;

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
      act: payload.act
        ? { sub: (payload.act as Record<string, unknown>).sub as string }
        : undefined,
      claims: payload,
    };
  } catch (err) {
    console.log(err);
    return null;
  }
}
