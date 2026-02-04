import type { Request, Response, NextFunction } from 'express';
import { descopeClient } from '../config/descope';
import { UnauthorizedError } from '../utils/errors';
import type { AuthenticatedUser, DescopeTokenClaims } from '../types/auth.types';
import { UserRoles, type UserRole } from '../config/constants';

/**
 * Extract Bearer token from Authorization header
 */
function extractBearerToken(authHeader?: string): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    return authHeader.substring(7);
}

/**
 * Map Descope roles to application roles
 */
function mapDescopeRoles(roles?: string[]): UserRole[] {
    if (!roles || roles.length === 0) {
        return [UserRoles.EMPLOYEE]; // Default role
    }

    const validRoles: UserRole[] = [];
    for (const role of roles) {
        const normalizedRole = role.toLowerCase();
        if (normalizedRole === 'finance_admin' || normalizedRole === 'finance-admin' || normalizedRole === 'financeadmin') {
            validRoles.push(UserRoles.FINANCE_ADMIN);
        } else if (normalizedRole === 'manager') {
            validRoles.push(UserRoles.MANAGER);
        } else if (normalizedRole === 'employee') {
            validRoles.push(UserRoles.EMPLOYEE);
        }
    }

    return validRoles.length > 0 ? validRoles : [UserRoles.EMPLOYEE];
}

/**
 * Express middleware for JWT authentication using Descope
 * Validates the session token and attaches user info to request
 */
export async function authMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const token = extractBearerToken(req.headers.authorization);

        if (!token) {
            throw new UnauthorizedError('Missing or invalid Authorization header');
        }

        // Validate the session with Descope
        const authInfo = await descopeClient.validateSession(token);

        if (!authInfo || !authInfo.token) {
            throw new UnauthorizedError('Invalid session token');
        }

        // Extract claims from the validated token
        const claims = authInfo.token as unknown as DescopeTokenClaims;

        // Build authenticated user object
        const authenticatedUser: AuthenticatedUser = {
            userId: claims.sub,
            email: claims.email || '',
            name: claims.name,
            roles: mapDescopeRoles(claims.roles),
            scopes: claims.permissions || [],
            tenantId: claims.tenantIds?.[0],
        };

        // Attach to request for downstream handlers
        req.user = authenticatedUser;

        next();
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            next(error);
            return;
        }

        // Handle Descope SDK errors
        console.error('Auth error:', error);
        next(new UnauthorizedError('Authentication failed'));
    }
}

/**
 * Optional auth middleware - doesn't fail if no token present
 * Useful for endpoints that work differently for authenticated vs anonymous users
 */
export async function optionalAuthMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
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
