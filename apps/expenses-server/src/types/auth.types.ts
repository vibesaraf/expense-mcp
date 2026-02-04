import type { UserRole } from '../config/constants';

/**
 * Authenticated user information extracted from JWT
 */
export interface AuthenticatedUser {
    userId: string;
    email: string;
    name?: string;
    roles: UserRole[];
    scopes: string[];
    department?: string;
    tenantId?: string;
}

/**
 * Extended Express Request with auth info
 */
declare global {
    namespace Express {
        interface Request {
            user?: AuthenticatedUser;
        }
    }
}

/**
 * Descope token claims structure
 */
export interface DescopeTokenClaims {
    sub: string;           // User ID
    email?: string;
    name?: string;
    roles?: string[];
    permissions?: string[];
    tenantIds?: string[];
    amr?: string[];        // Authentication methods
    exp: number;
    iat: number;
    iss: string;
    aud?: string | string[];
}

/**
 * MCP Auth Info from Descope MCP Express
 */
export interface McpAuthInfo {
    clientId: string;
    scopes: string[];
    token?: string;
    claims?: DescopeTokenClaims;
}
