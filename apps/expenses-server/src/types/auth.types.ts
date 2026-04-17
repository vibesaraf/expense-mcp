import type { UserRole } from "../config/constants.js";

/**
 * Authenticated user information extracted from LoginRadius token
 * and enriched from the local user database
 */
export interface AuthenticatedUser {
  userId: string;
  email: string;
  fullName: string;
  roles: UserRole[];
  scopes: string[];
  department?: string;
  managerId?: string;
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
