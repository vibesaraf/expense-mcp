import type { Request, Response, NextFunction } from "express";
import { config } from "../config";
import { userRepository } from "../db/repositories";
import { ForbiddenError, UnauthorizedError } from "../utils/errors";
import type { AuthenticatedUser } from "../types/auth.types";
import { verifyIdToken } from "../utils/oidc";
import { deriveRolesFromScopes } from "./rbac.middleware";

/**
 * Extract Bearer token from Authorization header
 */
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

    const tokenData = await verifyIdToken(token, {
      audience: config.SERVER_URL,
    });

    const lrScopes = tokenData.scopes;

    const email = tokenData.claims.email as string | undefined;
    const user = userRepository.findByLrUserIdOrEmail(tokenData.sub, email);

    if (!user) {
      setWwwAuthenticateHeader(res);
      throw new UnauthorizedError("User not registered");
    }

    // Build authenticated user object from local DB
    const authenticatedUser: AuthenticatedUser = {
      userId: user.userId,
      email: user.email,
      fullName: user.fullName,
      roles: deriveRolesFromScopes(lrScopes),
      scopes: lrScopes,
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
