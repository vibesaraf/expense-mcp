# Phase 1: Express Server with MCP Wrapper Setup

## Overview
This phase sets up the Express server with the Descope MCP Express wrapper, configures all middleware, and establishes the dual endpoint architecture (`/mcp` for MCP and `/api` for REST).

## Prerequisites
- Phase 0 completed
- Descope project created with Project ID
- `.env` file configured

---

## Step 1: Create Type Definitions

### Create `apps/expense-server/src/types/auth.types.ts`:

```typescript
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
      auth?: AuthenticatedUser;
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
```

### Create `apps/expense-server/src/types/user.types.ts`:

```typescript
import type { UserRole } from '../config/constants';

export interface User {
  userId: string;
  email: string;
  fullName: string;
  role: UserRole;
  department?: string;
  managerId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  userId: string;
  email: string;
  fullName: string;
  role: UserRole;
  department?: string;
  managerId?: string;
}

export interface UpdateUserInput {
  email?: string;
  fullName?: string;
  role?: UserRole;
  department?: string;
  managerId?: string;
}
```

### Create `apps/expense-server/src/types/expense.types.ts`:

```typescript
import type { ExpenseStatusType } from '../config/constants';

export interface Expense {
  expenseId: string;
  submitterId: string;
  categoryId: number;
  amount: number;
  currency: string;
  description: string;
  expenseDate: string;  // YYYY-MM-DD format
  receiptUrl?: string;
  status: ExpenseStatusType;
  submittedAt: Date;
  updatedAt: Date;
}

export interface ExpenseWithCategory extends Expense {
  categoryName: string;
}

export interface ExpenseWithSubmitter extends ExpenseWithCategory {
  submitter: {
    userId: string;
    fullName: string;
    email: string;
    department?: string;
  };
}

export interface ExpenseWithApprovalHistory extends ExpenseWithSubmitter {
  approvalHistory: ApprovalHistoryItem[];
}

export interface ApprovalHistoryItem {
  approver: {
    userId: string;
    fullName: string;
    email: string;
  };
  action: 'approved' | 'rejected';
  notes?: string;
  approvedAt: Date;
}

export interface CreateExpenseInput {
  categoryId: number;
  amount: number;
  currency?: string;
  description: string;
  expenseDate: string;
  receiptUrl?: string;
}

export interface ExpenseCategory {
  categoryId: number;
  categoryName: string;
  description?: string;
  requiresReceipt: boolean;
  maxAmount?: number;
  createdAt: Date;
}

export interface ExpenseApproval {
  approvalId: number;
  expenseId: string;
  approverId: string;
  action: 'approved' | 'rejected';
  notes?: string;
  approvedAt: Date;
}

export interface AuditLog {
  logId: number;
  userId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}
```

### Create `apps/expense-server/src/types/api.types.ts`:

```typescript
import type { ExpenseStatusType, ReportType } from '../config/constants';

// Query parameters
export interface ExpenseQueryParams {
  status?: ExpenseStatusType[];
  fromDate?: string;
  toDate?: string;
  categoryId?: number[];
  page?: number;
  limit?: number;
}

export interface AllExpensesQueryParams extends ExpenseQueryParams {
  department?: string[];
  submitterId?: string;
}

// Request bodies
export interface ApproveExpenseBody {
  notes?: string;
}

export interface RejectExpenseBody {
  reason: string;
}

export interface GenerateReportBody {
  reportType: ReportType;
  fromDate: string;
  toDate: string;
  department?: string;
  status?: ExpenseStatusType;
  format?: 'json' | 'csv' | 'pdf';
}

// Response types
export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
}

export interface ExpenseSummary {
  totalAmount: number;
  pendingAmount: number;
  approvedAmount: number;
  rejectedAmount?: number;
  paidAmount?: number;
}

export interface ExpenseListResponse {
  expenses: Array<{
    expenseId: string;
    category: string;
    amount: number;
    currency: string;
    description: string;
    expenseDate: string;
    receiptUrl?: string;
    status: ExpenseStatusType;
    submittedAt: string;
    submitter?: {
      userId: string;
      fullName: string;
      email: string;
    };
  }>;
  pagination: PaginationInfo;
  summary: ExpenseSummary;
}

export interface ReportResponse {
  reportId: string;
  reportType: ReportType;
  period: {
    fromDate: string;
    toDate: string;
  };
  filters: {
    department?: string;
    status?: ExpenseStatusType;
  };
  summary: {
    totalExpenses: number;
    totalAmount: number;
    currency: string;
    byCategory: Record<string, number>;
    byStatus: Record<string, number>;
    byDepartment?: Record<string, number>;
  };
  expenses?: Array<{
    expenseId: string;
    submitter: string;
    category: string;
    amount: number;
    status: ExpenseStatusType;
    expenseDate: string;
  }>;
  generatedAt: string;
  generatedBy: {
    userId: string;
    fullName: string;
  };
}
```

---

## Step 2: Create Descope Client Initialization

Create `apps/expense-server/src/config/descope.ts`:

```typescript
import DescopeClient from '@descope/node-sdk';
import { DescopeMcpProvider } from '@descope/mcp-express';
import { config } from './index';
import { McpScopes } from './constants';

/**
 * Initialize Descope client for session validation
 */
export const descopeClient = DescopeClient({
  projectId: config.DESCOPE_PROJECT_ID,
  ...(config.DESCOPE_MANAGEMENT_KEY && { managementKey: config.DESCOPE_MANAGEMENT_KEY }),
  ...(config.DESCOPE_BASE_URL && { baseUrl: config.DESCOPE_BASE_URL }),
});

/**
 * Initialize Descope MCP Provider for MCP server
 */
export const descopeMcpProvider = new DescopeMcpProvider({
  projectId: config.DESCOPE_PROJECT_ID,
  serverUrl: config.SERVER_URL,
  ...(config.DESCOPE_BASE_URL && { baseUrl: config.DESCOPE_BASE_URL }),
  verifyTokenOptions: {
    // All scopes that our MCP server supports
    requiredScopes: [], // Don't require any scopes by default, check per-tool
  },
});

/**
 * Get all supported MCP scopes
 */
export function getSupportedScopes(): string[] {
  return Object.values(McpScopes);
}
```

---

## Step 3: Create Express Middleware

### Create `apps/expense-server/src/middleware/error.middleware.ts`:

```typescript
import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { AppError } from '../utils/errors';
import { sendError } from '../utils/response';
import { config } from '../config';

/**
 * Global error handler middleware
 */
export const errorHandler: ErrorRequestHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error('Error:', err);

  // Handle known application errors
  if (err instanceof AppError) {
    sendError(res, err.statusCode, err.code, err.message, err.details);
    return;
  }

  // Handle Zod validation errors
  if (err.name === 'ZodError') {
    const zodError = err as unknown as { errors: Array<{ path: string[]; message: string }> };
    sendError(res, 400, 'VALIDATION_ERROR', 'Invalid request data', {
      errors: zodError.errors,
    });
    return;
  }

  // Handle JWT/Auth errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    sendError(res, 401, 'UNAUTHORIZED', 'Invalid or expired token');
    return;
  }

  // Handle unknown errors
  const message = config.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;

  sendError(res, 500, 'INTERNAL_ERROR', message, 
    config.NODE_ENV === 'development' ? { stack: err.stack } : undefined
  );
};

/**
 * Not found handler for unmatched routes
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  sendError(res, 404, 'NOT_FOUND', `Route ${req.method} ${req.path} not found`);
};
```

### Create `apps/expense-server/src/middleware/auth.middleware.ts`:

```typescript
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
    req.auth = authenticatedUser;
    
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
```

### Create `apps/expense-server/src/middleware/rbac.middleware.ts`:

```typescript
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { 
  ForbiddenError, 
  InsufficientPermissionsError, 
  UnauthorizedError 
} from '../utils/errors';
import { UserRoles, type UserRole, type McpScope } from '../config/constants';

/**
 * Middleware to require specific roles
 */
export function requireRoles(...allowedRoles: UserRole[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(new UnauthorizedError('Authentication required'));
      return;
    }

    const userRoles = req.auth.roles;
    const hasAllowedRole = userRoles.some(role => allowedRoles.includes(role));

    if (!hasAllowedRole) {
      next(new ForbiddenError(
        `This action requires one of the following roles: ${allowedRoles.join(', ')}`,
        {
          required_roles: allowedRoles,
          user_roles: userRoles,
        }
      ));
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
    if (!req.auth) {
      next(new UnauthorizedError('Authentication required'));
      return;
    }

    const userScopes = req.auth.scopes;
    const missingScopes = requiredScopes.filter(scope => !userScopes.includes(scope));

    if (missingScopes.length > 0) {
      next(new InsufficientPermissionsError(
        missingScopes[0],
        userScopes,
        `Missing required scopes: ${missingScopes.join(', ')}`
      ));
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
    if (!req.auth) {
      next(new UnauthorizedError('Authentication required'));
      return;
    }

    const userScopes = req.auth.scopes;
    const hasAnyScope = anyOfScopes.some(scope => userScopes.includes(scope));

    if (!hasAnyScope) {
      next(new InsufficientPermissionsError(
        anyOfScopes[0],
        userScopes,
        `Requires at least one of: ${anyOfScopes.join(', ')}`
      ));
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
  return hasRole(user, UserRoles.MANAGER) || hasRole(user, UserRoles.FINANCE_ADMIN);
}
```

### Create `apps/expense-server/src/middleware/audit.middleware.ts`:

```typescript
import type { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Middleware to log API requests for audit purposes
 * In production, this would write to the audit_log table
 */
export function auditMiddleware(action: string, resourceType: string): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Store audit info on request for later logging
    (req as Request & { auditInfo?: AuditInfo }).auditInfo = {
      action,
      resourceType,
      resourceId: req.params.id || req.params.expenseId,
      userId: req.auth?.userId,
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      timestamp: new Date(),
    };

    // Log on response finish
    res.on('finish', () => {
      const auditInfo = (req as Request & { auditInfo?: AuditInfo }).auditInfo;
      if (auditInfo && auditInfo.userId) {
        // In production, this would insert into audit_log table
        console.log(`[AUDIT] ${auditInfo.action} on ${auditInfo.resourceType}:${auditInfo.resourceId || 'N/A'} by ${auditInfo.userId} - Status: ${res.statusCode}`);
      }
    });

    next();
  };
}

interface AuditInfo {
  action: string;
  resourceType: string;
  resourceId?: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}
```

### Create `apps/expense-server/src/middleware/index.ts`:

```typescript
export { authMiddleware, optionalAuthMiddleware } from './auth.middleware';
export { 
  requireRoles, 
  requireScopes, 
  requireAnyScope,
  requireManager,
  requireFinanceAdmin,
  hasRole,
  isFinanceAdmin,
  isManagerOrHigher,
} from './rbac.middleware';
export { errorHandler, notFoundHandler } from './error.middleware';
export { auditMiddleware } from './audit.middleware';
```

---

## Step 4: Create MCP Server Setup (Placeholder)

Create `apps/expense-server/src/mcp/index.ts`:

```typescript
import { descopeMcpAuthRouter } from '@descope/mcp-express';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { descopeMcpProvider } from '../config/descope';

/**
 * Register all MCP tools
 * Tools will be implemented in Phase 6
 */
function registerTools(server: McpServer): void {
  // Placeholder - tools will be registered in Phase 6
  console.log('📦 MCP Tools registration placeholder');
  console.log('   Tools will be implemented in Phase 6');
  
  // For now, we'll just log that the server is ready
  // The actual tool implementations will be added in Phase 6
}

/**
 * Create the MCP router with Descope authentication
 */
export function createMcpRouter() {
  return descopeMcpAuthRouter(registerTools, descopeMcpProvider);
}
```

---

## Step 5: Create API Router Setup (Placeholder)

Create `apps/expense-server/src/api/index.ts`:

```typescript
import { Router } from 'express';
import type { Request, Response } from 'express';

const apiRouter = Router();

/**
 * API Health check endpoint
 */
apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
  });
});

/**
 * API Info endpoint
 */
apiRouter.get('/', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      name: 'Expense Management API',
      version: '1.0.0',
      endpoints: {
        expenses: '/api/expenses',
        categories: '/api/categories',
        reports: '/api/expenses/reports',
      },
      documentation: '/api/docs',
    },
  });
});

// Placeholder message for unimplemented routes
apiRouter.all('*', (req: Request, res: Response) => {
  res.status(501).json({
    success: false,
    error: {
      code: 'NOT_IMPLEMENTED',
      message: `API endpoint ${req.method} ${req.path} will be implemented in Phase 4`,
    },
  });
});

export { apiRouter };
```

---

## Step 6: Create Main Server Entry Point

Update `apps/expense-server/src/index.ts`:

```typescript
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { config } from './config';
import { createMcpRouter } from './mcp';
import { apiRouter } from './api';
import { errorHandler, notFoundHandler } from './middleware';

// Create Express app
const app = express();

// ===================
// Security Middleware
// ===================
app.use(helmet({
  contentSecurityPolicy: config.NODE_ENV === 'production',
}));

// ===================
// CORS Configuration
// ===================
app.use(cors({
  origin: config.CORS_ORIGIN === '*' ? '*' : config.CORS_ORIGIN.split(','),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// ===================
// Request Parsing
// ===================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ===================
// Request Logging
// ===================
if (config.NODE_ENV !== 'test') {
  app.use(morgan(config.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// ===================
// Health Check (before auth)
// ===================
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
  });
});

// ===================
// MCP Server Endpoint
// ===================
// The MCP router handles:
// - POST /mcp - MCP protocol endpoint (requires Bearer token)
// - GET /.well-known/oauth-protected-resource - Resource metadata
// - GET /.well-known/oauth-authorization-server - Auth server metadata
app.use(createMcpRouter());

// ===================
// REST API Endpoints
// ===================
app.use('/api', apiRouter);

// ===================
// Error Handling
// ===================
app.use(notFoundHandler);
app.use(errorHandler);

// ===================
// Start Server
// ===================
const PORT = config.PORT;

app.listen(PORT, () => {
  console.log('\n🚀 Expense Management Server Started');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   Environment:     ${config.NODE_ENV}`);
  console.log(`   Server URL:      ${config.SERVER_URL}`);
  console.log(`   Health Check:    ${config.SERVER_URL}/health`);
  console.log('');
  console.log('   📡 MCP Endpoint:');
  console.log(`      POST ${config.SERVER_URL}/mcp`);
  console.log('');
  console.log('   🌐 REST API:');
  console.log(`      ${config.SERVER_URL}/api`);
  console.log('');
  console.log('   🔐 OAuth Metadata:');
  console.log(`      ${config.SERVER_URL}/.well-known/oauth-protected-resource`);
  console.log(`      ${config.SERVER_URL}/.well-known/oauth-authorization-server`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

export { app };
```

---

## Step 7: Verification

After completing Phase 1:

1. Install dependencies (from monorepo root):
   ```bash
   bun install
   ```

2. Start the server:
   ```bash
   cd apps/expense-server
   bun run dev
   ```

3. Test health endpoint:
   ```bash
   curl http://localhost:3000/health
   ```
   Expected response:
   ```json
   {
     "status": "healthy",
     "timestamp": "2026-02-03T...",
     "environment": "development"
   }
   ```

4. Test API info endpoint:
   ```bash
   curl http://localhost:3000/api
   ```

5. Test MCP metadata endpoint:
   ```bash
   curl http://localhost:3000/.well-known/oauth-protected-resource
   ```

6. Test MCP endpoint (should require auth):
   ```bash
   curl -X POST http://localhost:3000/mcp \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
   ```
   Expected: 401 Unauthorized (no token)

---

## Files Created/Modified in This Phase

1. `apps/expense-server/src/types/auth.types.ts`
2. `apps/expense-server/src/types/user.types.ts`
3. `apps/expense-server/src/types/expense.types.ts`
4. `apps/expense-server/src/types/api.types.ts`
5. `apps/expense-server/src/config/descope.ts`
6. `apps/expense-server/src/middleware/error.middleware.ts`
7. `apps/expense-server/src/middleware/auth.middleware.ts`
8. `apps/expense-server/src/middleware/rbac.middleware.ts`
9. `apps/expense-server/src/middleware/audit.middleware.ts`
10. `apps/expense-server/src/middleware/index.ts`
11. `apps/expense-server/src/mcp/index.ts`
12. `apps/expense-server/src/api/index.ts`
13. `apps/expense-server/src/index.ts` (updated)

---

## Next Steps

Proceed to **Phase 2: Database Design and SQLite Setup** to:
- Set up SQLite with better-sqlite3
- Create all database tables
- Implement seed data for categories and test users