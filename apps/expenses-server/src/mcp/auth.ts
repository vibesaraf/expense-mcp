import type { Request, Response, NextFunction } from "express";
import { scalekitClient } from "../config/scalekit";
import type { ScalekitTokenClaims } from "../types/auth.types";
import type { McpAuthInfo } from "./types";
import { config } from "../config";

function extractBearerToken(authHeader?: string): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.substring(7);
}

function decodeJwtClaims(token: string): ScalekitTokenClaims {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid access token format");
  }

  const payloadPart = parts[1];
  if (!payloadPart) {
    throw new Error("Invalid access token payload");
  }

  const payload = Buffer.from(payloadPart, "base64url").toString("utf-8");
  return JSON.parse(payload) as ScalekitTokenClaims;
}

function extractScopes(scope?: string | string[]): string[] {
  if (!scope) {
    return [];
  }

  if (Array.isArray(scope)) {
    return scope.filter(Boolean);
  }

  return scope
    .split(" ")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function getProtectedResourceMetadataUrl(): string {
  const baseUrl = config.MCP_SERVER_URL.endsWith("/")
    ? config.MCP_SERVER_URL
    : `${config.MCP_SERVER_URL}/`;
  return new URL(".well-known/oauth-protected-resource", baseUrl).toString();
}

function setWwwAuthenticateHeader(res: Response): void {
  const metadataUrl = getProtectedResourceMetadataUrl();
  res.set(
    "WWW-Authenticate",
    `Bearer realm="MCP", resource_metadata="${metadataUrl}"`,
  );
}

function buildAuthInfo(token: string): McpAuthInfo {
  const claims = decodeJwtClaims(token);

  return {
    token,
    clientId: claims.sub,
    scopes: extractScopes(claims.scope),
    expiresAt: claims.exp,
    claims,
  };
}

export async function mcpAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    setWwwAuthenticateHeader(res);
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  try {
    await scalekitClient.validateAccessToken(token);
    const authInfo = buildAuthInfo(token);
    (req as Request & { auth?: McpAuthInfo }).auth = authInfo;
    next();
  } catch (error) {
    console.error("MCP auth error:", error);
    setWwwAuthenticateHeader(res);
    res.status(401).json({ error: "Authentication failed" });
  }
}
