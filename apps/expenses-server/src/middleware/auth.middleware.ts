import type { Request, Response, NextFunction } from "express";
import { scalekitClient } from "../config/scalekit";
import { UnauthorizedError } from "../utils/errors";
import type {
  AuthenticatedUser,
  ScalekitTokenClaims,
} from "../types/auth.types";
import { UserRoles, type UserRole } from "../config/constants";

/**
 * Extract Bearer token from Authorization header
 */
function extractBearerToken(authHeader?: string): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Map Scalekit roles to application roles
 */
function mapScalekitRoles(roles?: string[]): UserRole[] {
  if (!roles || roles.length === 0) {
    return [UserRoles.EMPLOYEE]; // Default role
  }

  const validRoles: UserRole[] = [];
  for (const role of roles) {
    const normalizedRole = role.toLowerCase();
    if (
      normalizedRole === "finance_admin" ||
      normalizedRole === "finance-admin" ||
      normalizedRole === "financeadmin"
    ) {
      validRoles.push(UserRoles.FINANCE_ADMIN);
    } else if (normalizedRole === "manager") {
      validRoles.push(UserRoles.MANAGER);
    } else if (normalizedRole === "employee") {
      validRoles.push(UserRoles.EMPLOYEE);
    }
  }

  return validRoles.length > 0 ? validRoles : [UserRoles.EMPLOYEE];
}

function decodeJwtClaims(token: string): ScalekitTokenClaims {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new UnauthorizedError("Invalid access token format");
  }

  const payloadPart = parts[1];
  if (!payloadPart) {
    throw new UnauthorizedError("Invalid access token payload");
  }

  try {
    const payload = Buffer.from(payloadPart, "base64url").toString("utf-8");
    return JSON.parse(payload) as ScalekitTokenClaims;
  } catch (error) {
    throw new UnauthorizedError("Invalid access token payload");
  }
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

function extractRoles(claims: ScalekitTokenClaims): string[] {
  const rawRoles = claims.roles ?? claims.role;
  if (!rawRoles) {
    return [];
  }

  if (Array.isArray(rawRoles)) {
    return rawRoles.filter(Boolean);
  }

  return [rawRoles];
}

/**
 * Express middleware for JWT authentication using Scalekit
 * Validates the access token and attaches user info to request
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = extractBearerToken(req.headers.authorization);

    if (!token) {
      throw new UnauthorizedError("Missing or invalid Authorization header");
    }

    // Validate the access token with Scalekit
    await scalekitClient.validateAccessToken(token);

    // Extract claims from the validated token
    const claims = decodeJwtClaims(token);

    // Build authenticated user object
    const authenticatedUser: AuthenticatedUser = {
      userId: claims.sub,
      email: claims.email || "",
      name: claims.name,
      roles: mapScalekitRoles(extractRoles(claims)),
      scopes: extractScopes(claims.scope),
      tenantId: claims.tenantId || claims.tenant_id || claims.tenant,
    };

    // Attach to request for downstream handlers
    req.user = authenticatedUser;

    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      next(error);
      return;
    }

    // Handle Scalekit SDK errors
    console.error("Auth error:", error);
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
