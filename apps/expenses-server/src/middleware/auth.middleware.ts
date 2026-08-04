import type { Request, Response, NextFunction } from "express";
import { config } from "../config/index.js";
import { userRepository } from "../db/repositories/index.js";
import { ForbiddenError, UnauthorizedError } from "../utils/errors.js";
import type { AuthenticatedUser } from "../types/auth.types.js";
import { verifyIdToken } from "../utils/oidc.js";
import { deriveRolesFromScopes } from "./rbac.middleware.js";

function extractBearerToken(authHeader?: string): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.split(" ")[1] as string;
}

function extractToken(req: Request): string | null {
  const bearer = extractBearerToken(req.headers.authorization);
  if (bearer) return bearer;
  return (req.cookies?.[config.COOKIE_NAME] as string | undefined) ?? null;
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = extractToken(req);

    if (!token) {
      throw new UnauthorizedError("Missing or invalid Authorization header");
    }
    // REST accepts user tokens from the OIDC app issuer plus service tokens
    // minted by the token-exchange (service) issuer.
    const tokenData = await verifyIdToken(token, {
      audience: config.REST_RESOURCE_URL,
      issuer: [config.LR_ISSUER, config.LR_SERVICE_ISSUER],
    });
    if (!tokenData) {
      throw new UnauthorizedError("Invalid token");
    }

    const user = userRepository.findByLrUserIdOrEmail(tokenData.sub, "");

    if (!user) {
      throw new UnauthorizedError("User not registered");
    }

    const authenticatedUser: AuthenticatedUser = {
      userId: user.userId,
      email: user.email,
      fullName: user.fullName,
      roles: deriveRolesFromScopes(tokenData.scopes),
      scopes: tokenData.scopes,
      department: user.department,
      managerId: user.managerId,
    };

    req.user = authenticatedUser;
    req.actorId = tokenData.act?.sub?.replace(/@client$/, "");

    next();
  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
      next(error);
      return;
    }

    next(new UnauthorizedError("Authentication failed"));
  }
}

export async function optionalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = extractToken(req);

  if (!token) {
    next();
    return;
  }

  return authMiddleware(req, res, next);
}
