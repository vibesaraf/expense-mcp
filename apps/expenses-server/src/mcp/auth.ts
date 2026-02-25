import type { Request, Response, NextFunction } from "express";
import { config } from "../config";
import { userRepository } from "../db/repositories";
import type { McpAuthInfo } from "./types";
import { verifyIdToken, type TokenData } from "../utils/oidc";
import { deriveRolesFromScopes } from "../middleware/rbac.middleware";

function extractBearerToken(authHeader?: string): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.substring(7);
}

function getProtectedResourceMetadataUrl(): string {
  const baseUrl = config.MCP_RESOURCE_URL.replace(/\/mcp$/, "");
  return `${baseUrl}/.well-known/oauth-protected-resource`;
}

function setWwwAuthenticateHeader(res: Response): void {
  const metadataUrl = getProtectedResourceMetadataUrl();
  res.set(
    "WWW-Authenticate",
    `Bearer realm="expense-mcp", resource_metadata="${metadataUrl}"`,
  );
}

function buildAuthInfo(
  token: string,
  tokenData: TokenData,
  user: { userId: string; email: string; fullName: string },
): McpAuthInfo {
  return {
    token,
    clientId: user.userId,
    scopes: tokenData.scopes,
    roles: deriveRolesFromScopes(tokenData.scopes),
    expiresAt: tokenData.expiresAt,
    claims: {
      ...tokenData.claims,
      email: user.email,
      name: user.fullName,
    },
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
    const tokenData = await verifyIdToken(token, {
      audience: config.MCP_RESOURCE_URL,
    });

    const lrScopes = tokenData.scopes;
    const email = tokenData.claims.email as string | undefined;
    const user = userRepository.findByLrUserIdOrEmail(tokenData.sub, email);

    if (!user) {
      setWwwAuthenticateHeader(res);
      res.status(401).json({ error: "User not registered" });
      return;
    }

    const authInfo = buildAuthInfo(token, tokenData, {
      userId: user.userId,
      email: user.email,
      fullName: user.fullName,
    });

    (req as Request & { auth?: McpAuthInfo }).auth = authInfo;

    next();
  } catch (error) {
    console.error("MCP auth error:", error);
    setWwwAuthenticateHeader(res);
    res.status(401).json({ error: "Authentication failed" });
  }
}
