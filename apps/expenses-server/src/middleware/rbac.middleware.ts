import type { Request, Response, NextFunction, RequestHandler } from "express";
import {
  ForbiddenError,
  UnauthorizedError,
} from "../utils/errors.js";
import { UserRoles, type UserRole, type McpScope } from "../config/constants.js";

const FINANCE_ADMIN_SCOPES: McpScope[] = [
  "expense:view:all",
  "expense:report:generate",
];

const MANAGER_SCOPES: McpScope[] = ["expense:view:team", "expense:approve"];

export function deriveRolesFromScopes(scopes: string[]): UserRole[] {
  if (
    scopes.some((scope) => FINANCE_ADMIN_SCOPES.includes(scope as McpScope))
  ) {
    return [UserRoles.FINANCE_ADMIN];
  }

  if (scopes.some((scope) => MANAGER_SCOPES.includes(scope as McpScope))) {
    return [UserRoles.MANAGER];
  }

  return [UserRoles.EMPLOYEE];
}

/**
 * Middleware to require specific roles
 */
export function requireRoles(...allowedRoles: UserRole[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError("Authentication required"));
      return;
    }

    const userRoles = req.user.roles;
    const hasAllowedRole = userRoles.some((role) =>
      allowedRoles.includes(role),
    );

    if (!hasAllowedRole) {
      next(
        new ForbiddenError(
          `This action requires one of the following roles: ${allowedRoles.join(", ")}`,
          {
            required_roles: allowedRoles,
            user_roles: userRoles,
          },
        ),
      );
      return;
    }

    next();
  };
}

/**
 * Middleware to require specific scopes
 */
export function requireScopes(...requiredScopes: McpScope[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError("Authentication required"));
      return;
    }

    const userScopes = req.user.scopes;
    const missingScopes = requiredScopes.filter(
      (scope) => !userScopes.includes(scope),
    );

    if (missingScopes.length > 0) {
      next(new ForbiddenError("You do not have permission to access this resource"));
      return;
    }

    next();
  };
}

/**
 * Middleware to require at least one of the specified scopes
 */
export function requireAnyScope(...anyOfScopes: McpScope[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError("Authentication required"));
      return;
    }

    const userScopes = req.user.scopes;
    const hasAnyScope = anyOfScopes.some((scope) => userScopes.includes(scope));

    if (!hasAnyScope) {
      next(new ForbiddenError("You do not have permission to access this resource"));
      return;
    }

    next();
  };
}

/**
 * Check if user is a manager
 */
export function requireManager(): RequestHandler {
  return requireRoles(UserRoles.MANAGER, UserRoles.FINANCE_ADMIN);
}

/**
 * Check if user is a finance admin
 */
export function requireFinanceAdmin(): RequestHandler {
  return requireRoles(UserRoles.FINANCE_ADMIN);
}

/**
 * Helper to check if a user has a specific role (non-middleware)
 */
export function hasRole(user: { roles: UserRole[] }, role: UserRole): boolean {
  return user.roles.includes(role);
}

/**
 * Helper to check if user is finance admin (non-middleware)
 */
export function isFinanceAdmin(user: { roles: UserRole[] }): boolean {
  return hasRole(user, UserRoles.FINANCE_ADMIN);
}

/**
 * Helper to check if user is manager or higher (non-middleware)
 */
export function isManagerOrHigher(user: { roles: UserRole[] }): boolean {
  return (
    hasRole(user, UserRoles.MANAGER) || hasRole(user, UserRoles.FINANCE_ADMIN)
  );
}
