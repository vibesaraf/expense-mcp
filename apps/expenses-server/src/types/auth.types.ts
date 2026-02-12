import type { UserRole } from "../config/constants";

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
 * Scalekit token claims structure
 */
export interface ScalekitTokenClaims {
  sub: string; // User ID
  email?: string;
  name?: string;
  scope?: string | string[];
  roles?: string[];
  role?: string;
  tenantId?: string;
  tenant_id?: string;
  tenant?: string;
  exp: number;
  iat: number;
  iss: string;
  aud?: string | string[];
}
