import type { Request, Response, NextFunction } from "express";
import { introspectToken } from "../config/loginradius-client";
import { config } from "../config";
import { userRepository } from "../db/repositories";
import { ForbiddenError, UnauthorizedError } from "../utils/errors";
import type { AuthenticatedUser } from "../types/auth.types";
import { LR_MCP_SCOPE } from "../config/constants";

/**
 * Extract Bearer token from Authorization header
 */
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

function extractLocalScopes(scopes?: string): string[] {
  if (!scopes) {
    return [];
  }

  return scopes
    .split(" ")
    .map((entry) => entry.trim())
    .filter(Boolean);
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

/**
 * Express middleware for LoginRadius token authentication
 * Validates the access token and attaches local user info to request
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = extractBearerToken(req.headers.authorization);

    if (!token) {
      setWwwAuthenticateHeader(res);
      throw new UnauthorizedError("Missing or invalid Authorization header");
    }

    const introspection = await introspectToken(token);

    if (!introspection.active) {
      setWwwAuthenticateHeader(res);
      throw new UnauthorizedError("Token is not active");
    }

    if (introspection.iss && introspection.iss !== config.LR_ISSUER) {
      setWwwAuthenticateHeader(res);
      throw new UnauthorizedError("Token issuer mismatch");
    }

    const lrScopes = extractScopes(introspection.scp);
    if (!lrScopes.includes(LR_MCP_SCOPE)) {
      throw new ForbiddenError(`Missing required scope: ${LR_MCP_SCOPE}`);
    }

    const userInfo = await extractUserInfo(token)
    console.log("userInfo:", userInfo);

    const user = userRepository.findByLrUserIdOrEmail(
      introspection.sub,
      userInfo.email,
    );

    console.log("user:", user);

    if (!user) {
      setWwwAuthenticateHeader(res);
      throw new UnauthorizedError("User not registered");
    }

    if (!user.lrUserId && introspection.sub) {
      userRepository.updateLrUserId(user.userId, introspection.sub);
    }

    // Build authenticated user object from local DB
    const authenticatedUser: AuthenticatedUser = {
      userId: user.userId,
      email: user.email,
      fullName: user.fullName,
      roles: [user.role],
      scopes: extractLocalScopes(user.scopes),
      department: user.department,
      managerId: user.managerId,
    };

    // Attach to request for downstream handlers
    req.user = authenticatedUser;

    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      next(error);
      return;
    }

    if (error instanceof ForbiddenError) {
      next(error);
      return;
    }

    console.error("Auth error:", error);
    setWwwAuthenticateHeader(res);
    next(new UnauthorizedError("Authentication failed"));
  }
}

/**
 * Optional auth middleware - doesn't fail if no token present
 * Useful for endpoints that work differently for authenticated vs anonymous users
 */
export async function optionalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    // No token - continue without auth
    next();
    return;
  }

  // Token present - validate it
  return authMiddleware(req, res, next);
}
