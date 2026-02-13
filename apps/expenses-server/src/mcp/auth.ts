import type { Request, Response, NextFunction } from "express";
import {
  introspectToken,
  type IntrospectionResponse,
} from "../config/loginradius-client";
import { config } from "../config";
import { userRepository } from "../db/repositories";
import { LR_MCP_SCOPE } from "../config/constants";
import type { McpAuthInfo } from "./types";

function extractBearerToken(authHeader?: string): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.substring(7);
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

function extractLocalScopes(scopes?: string): string[] {
  if (!scopes) {
    return [];
  }

  return scopes
    .split(" ")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

async function extractUserInfo(token: string): Promise<{ email?: string }> {
  const baseUrl = `${config.LR_ISSUER}/userinfo?access_token=${token}`;

  const url = new URL(baseUrl);

  const data = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!data.ok) {
    throw new Error(`Failed to fetch user info: ${data.statusText}`);
  }

  const userInfo = await data.json() as any;
  return {
    email: userInfo.email || ""
  };  
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
  introspection: IntrospectionResponse,
  user: { userId: string; email: string; fullName: string; scopes: string },
): McpAuthInfo {
  return {
    token,
    clientId: user.userId,
    scopes: extractLocalScopes(user.scopes),
    expiresAt: introspection.exp,
    claims: {
      ...introspection,
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
    const introspection = await introspectToken(token);

    if (!introspection.active) {
      setWwwAuthenticateHeader(res);
      res.status(401).json({ error: "Token is not active" });
      return;
    }

    if (introspection.iss && introspection.iss !== config.LR_ISSUER) {
      setWwwAuthenticateHeader(res);
      res.status(401).json({ error: "Token issuer mismatch" });
      return;
    }

    const lrScopes = extractScopes(introspection.scp);
    if (!lrScopes.includes(LR_MCP_SCOPE)) {
      res
        .status(403)
        .json({ error: `Missing required scope: ${LR_MCP_SCOPE}` });
      return;
    }
    const userInfo = await extractUserInfo(token)
    console.log("userInfo:", userInfo);
    const user = userRepository.findByLrUserIdOrEmail(
      introspection.sub,
      userInfo.email,
    );

    if (!user) {
      setWwwAuthenticateHeader(res);
      res.status(401).json({ error: "User not registered" });
      return;
    }

    if (!user.lrUserId && introspection.sub) {
      userRepository.updateLrUserId(user.userId, introspection.sub);
    }

    const authInfo = buildAuthInfo(token, introspection, {
      userId: user.userId,
      email: user.email,
      fullName: user.fullName,
      scopes: user.scopes,
    });
    (req as Request & { auth?: McpAuthInfo }).auth = authInfo;
    next();
  } catch (error) {
    console.error("MCP auth error:", error);
    setWwwAuthenticateHeader(res);
    res.status(401).json({ error: "Authentication failed" });
  }
}
