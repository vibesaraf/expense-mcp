# Phase 0: Project Setup and Configuration

## Overview
This phase sets up the Turborepo monorepo structure with bun workspaces, configures the expense-server app, and establishes all necessary dependencies and configuration files.

## Prerequisites
- Bun installed (latest version)
- Node.js 18+ (for compatibility)
- A Descope account with Project ID and Management Key

---

## Step 1: Verify Monorepo Structure

The existing monorepo structure should be:
```
expense-mcp-demo/
├── apps/
│   └── expense-server/          # MCP + API service (to be created)
├── packages/
│   ├── eslint-config/           # ESLint configs
│   ├── typescript-config/       # TypeScript configs
│   └── ui/                      # Shadcn UI components
├── package.json                 # Root package.json
├── turbo.json                   # Turborepo config
└── bun.lockb                    # Bun lockfile
```

---

## Step 2: Create expense-server App Directory Structure

Create the following structure inside `apps/expense-server/`:

```
apps/expense-server/
├── src/
│   ├── config/
│   │   ├── index.ts             # Configuration loader
│   │   └── constants.ts         # App constants
│   ├── db/
│   │   ├── index.ts             # Database connection
│   │   ├── schema.ts            # SQLite schema definitions
│   │   ├── seed.ts              # Seed data
│   │   └── repositories/
│   │       ├── index.ts         # Repository exports
│   │       ├── user.repository.ts
│   │       ├── expense.repository.ts
│   │       ├── category.repository.ts
│   │       ├── approval.repository.ts
│   │       └── audit.repository.ts
│   ├── middleware/
│   │   ├── index.ts             # Middleware exports
│   │   ├── auth.middleware.ts   # Descope JWT validation
│   │   ├── rbac.middleware.ts   # Role-based access control
│   │   ├── error.middleware.ts  # Error handling
│   │   └── audit.middleware.ts  # Audit logging
│   ├── api/
│   │   ├── index.ts             # API router setup
│   │   ├── routes/
│   │   │   ├── expense.routes.ts
│   │   │   ├── category.routes.ts
│   │   │   └── report.routes.ts
│   │   ├── controllers/
│   │   │   ├── expense.controller.ts
│   │   │   ├── category.controller.ts
│   │   │   └── report.controller.ts
│   │   └── validators/
│   │       ├── expense.validator.ts
│   │       └── report.validator.ts
│   ├── mcp/
│   │   ├── index.ts             # MCP server setup
│   │   └── tools/
│   │       ├── index.ts         # Tool exports
│   │       ├── submit-expense.tool.ts
│   │       ├── list-my-expenses.tool.ts
│   │       ├── list-team-expenses.tool.ts
│   │       ├── approve-expense.tool.ts
│   │       ├── reject-expense.tool.ts
│   │       └── generate-report.tool.ts
│   ├── services/
│   │   ├── expense.service.ts   # Expense business logic
│   │   ├── approval.service.ts  # Approval workflow logic
│   │   └── report.service.ts    # Report generation logic
│   ├── types/
│   │   ├── index.ts             # Type exports
│   │   ├── expense.types.ts
│   │   ├── user.types.ts
│   │   ├── auth.types.ts
│   │   └── api.types.ts
│   ├── utils/
│   │   ├── response.ts          # API response helpers
│   │   ├── errors.ts            # Custom error classes
│   │   └── uuid.ts              # UUID generation
│   └── index.ts                 # Main entry point
├── data/
│   └── .gitkeep                 # SQLite database will be stored here
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

---

## Step 3: Create expense-server package.json

Create `apps/expense-server/package.json`:

```json
{
  "name": "expense-server",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "db:seed": "tsx src/db/seed.ts",
    "db:reset": "rm -f data/expense.db && bun run db:seed",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@descope/node-sdk": "^1.7.20",
    "@descope/mcp-express": "^1.4.1",
    "better-sqlite3": "^11.7.0",
    "express": "^4.21.2",
    "zod": "^3.24.1",
    "uuid": "^11.0.5",
    "cors": "^2.8.5",
    "helmet": "^8.0.0",
    "morgan": "^1.10.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.12",
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/morgan": "^1.9.9",
    "@types/node": "^22.10.5",
    "@types/uuid": "^10.0.0",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "@repo/eslint-config": "workspace:*",
    "@repo/typescript-config": "workspace:*"
  }
}
```

---

## Step 4: Create TypeScript Configuration

Create `apps/expense-server/tsconfig.json`:

```json
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "target": "ES2022",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## Step 5: Create Environment Configuration

Create `apps/expense-server/.env.example`:

```bash
# ======================
# Server Configuration
# ======================
PORT=3000
NODE_ENV=development
SERVER_URL=http://localhost:3000

# ======================
# Descope Configuration
# ======================
# Required: Get from Descope Console -> Project Settings
DESCOPE_PROJECT_ID=your_project_id_here

# Optional: Required only for user management features
DESCOPE_MANAGEMENT_KEY=your_management_key_here

# Optional: Custom base URL (default: https://api.descope.com)
# DESCOPE_BASE_URL=https://api.descope.com

# ======================
# Database Configuration
# ======================
DATABASE_PATH=./data/expense.db

# ======================
# MCP Configuration
# ======================
MCP_SERVER_NAME=Expense Management MCP Server
MCP_SERVER_VERSION=1.0.0

# ======================
# CORS Configuration
# ======================
CORS_ORIGIN=*
```

---

## Step 6: Create Configuration Loader

Create `apps/expense-server/src/config/index.ts`:

```typescript
import { z } from 'zod';

const envSchema = z.object({
  // Server
  PORT: z.string().default('3000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SERVER_URL: z.string().url().default('http://localhost:3000'),
  
  // Descope
  DESCOPE_PROJECT_ID: z.string().min(1, 'DESCOPE_PROJECT_ID is required'),
  DESCOPE_MANAGEMENT_KEY: z.string().optional(),
  DESCOPE_BASE_URL: z.string().url().optional(),
  
  // Database
  DATABASE_PATH: z.string().default('./data/expense.db'),
  
  // MCP
  MCP_SERVER_NAME: z.string().default('Expense Management MCP Server'),
  MCP_SERVER_VERSION: z.string().default('1.0.0'),
  
  // CORS
  CORS_ORIGIN: z.string().default('*'),
});

export type Config = z.infer<typeof envSchema>;

function loadConfig(): Config {
  const result = envSchema.safeParse(process.env);
  
  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(result.error.format());
    process.exit(1);
  }
  
  return result.data;
}

export const config = loadConfig();
```

---

## Step 7: Create Constants File

Create `apps/expense-server/src/config/constants.ts`:

```typescript
// User roles
export const UserRoles = {
  EMPLOYEE: 'employee',
  MANAGER: 'manager',
  FINANCE_ADMIN: 'finance_admin',
} as const;

export type UserRole = typeof UserRoles[keyof typeof UserRoles];

// Expense statuses
export const ExpenseStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  PAID: 'paid',
} as const;

export type ExpenseStatusType = typeof ExpenseStatus[keyof typeof ExpenseStatus];

// Approval actions
export const ApprovalAction = {
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export type ApprovalActionType = typeof ApprovalAction[keyof typeof ApprovalAction];

// OAuth Scopes for MCP
export const McpScopes = {
  EXPENSE_SUBMIT: 'expense:submit',
  EXPENSE_VIEW_OWN: 'expense:view:own',
  EXPENSE_VIEW_TEAM: 'expense:view:team',
  EXPENSE_VIEW_ALL: 'expense:view:all',
  EXPENSE_APPROVE: 'expense:approve',
  EXPENSE_REPORT_GENERATE: 'expense:report:generate',
} as const;

export type McpScope = typeof McpScopes[keyof typeof McpScopes];

// Report types
export const ReportTypes = {
  SUMMARY: 'summary',
  DETAILED: 'detailed',
  BY_CATEGORY: 'by_category',
} as const;

export type ReportType = typeof ReportTypes[keyof typeof ReportTypes];

// Default pagination
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// Expense categories (these will be seeded in DB)
export const DEFAULT_CATEGORIES = [
  { name: 'Meals', description: 'Business meals and client entertainment', requiresReceipt: true, maxAmount: 100 },
  { name: 'Travel', description: 'Transportation and accommodation', requiresReceipt: true, maxAmount: 5000 },
  { name: 'Office Supplies', description: 'Stationery, equipment, etc.', requiresReceipt: false, maxAmount: 500 },
  { name: 'Software', description: 'Software subscriptions and licenses', requiresReceipt: false, maxAmount: 1000 },
  { name: 'Training', description: 'Courses, conferences, certifications', requiresReceipt: true, maxAmount: 3000 },
] as const;
```

---

## Step 8: Create Custom Error Classes

Create `apps/expense-server/src/utils/errors.ts`:

```typescript
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', details?: Record<string, unknown>) {
    super(401, 'UNAUTHORIZED', message, details);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', details?: Record<string, unknown>) {
    super(403, 'FORBIDDEN', message, details);
    this.name = 'ForbiddenError';
  }
}

export class InsufficientPermissionsError extends AppError {
  constructor(
    requiredScope: string,
    userScopes: string[] = [],
    message = 'You do not have permission to access this resource'
  ) {
    super(403, 'INSUFFICIENT_PERMISSIONS', message, {
      required_scope: requiredScope,
      user_scopes: userScopes,
    });
    this.name = 'InsufficientPermissionsError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id 
      ? `${resource} with id '${id}' not found`
      : `${resource} not found`;
    super(404, 'RESOURCE_NOT_FOUND', message, { resource, id });
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(400, 'VALIDATION_ERROR', message, details);
    this.name = 'ValidationError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(409, 'CONFLICT', message, details);
    this.name = 'ConflictError';
  }
}

export class InternalError extends AppError {
  constructor(message = 'Internal server error', details?: Record<string, unknown>) {
    super(500, 'INTERNAL_ERROR', message, details);
    this.name = 'InternalError';
  }
}
```

---

## Step 9: Create API Response Helpers

Create `apps/expense-server/src/utils/response.ts`:

```typescript
import type { Response } from 'express';

export interface SuccessResponse<T> {
  success: true;
  data: T;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

export function sendSuccess<T>(res: Response, data: T, statusCode = 200): void {
  res.status(statusCode).json({
    success: true,
    data,
  } satisfies SuccessResponse<T>);
}

export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: Record<string, unknown>
): void {
  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
    },
  } satisfies ErrorResponse);
}

export function sendCreated<T>(res: Response, data: T): void {
  sendSuccess(res, data, 201);
}

export function sendNoContent(res: Response): void {
  res.status(204).send();
}
```

---

## Step 10: Create UUID Helper

Create `apps/expense-server/src/utils/uuid.ts`:

```typescript
import { v4 as uuidv4 } from 'uuid';

export function generateUUID(): string {
  return uuidv4();
}

export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}
```

---

## Step 11: Create Types Index

Create `apps/expense-server/src/types/index.ts`:

```typescript
export * from './user.types';
export * from './expense.types';
export * from './auth.types';
export * from './api.types';
```

---

## Step 12: Create Main Entry Point (Placeholder)

Create `apps/expense-server/src/index.ts`:

```typescript
import 'dotenv/config';
import { config } from './config';

console.log('🚀 Expense Server Configuration Loaded');
console.log(`   Environment: ${config.NODE_ENV}`);
console.log(`   Port: ${config.PORT}`);
console.log(`   Server URL: ${config.SERVER_URL}`);
console.log(`   Database Path: ${config.DATABASE_PATH}`);
console.log(`   Descope Project ID: ${config.DESCOPE_PROJECT_ID.substring(0, 8)}...`);

// Server setup will be added in Phase 1
console.log('\n✅ Phase 0 Complete - Configuration working!');
console.log('   Run Phase 1 to set up Express server with MCP wrapper.');
```

---

## Step 13: Create .gitkeep for Data Directory

Create `apps/expense-server/data/.gitkeep`:

```
# This directory stores the SQLite database file
# The .db file is git-ignored, but the directory is preserved
```

---

## Step 14: Create README

Create `apps/expense-server/README.md`:

```markdown
# Expense Management Server

A combined MCP + REST API server for expense management with Descope authentication.

## Features

- **MCP Server** at `/mcp` - For AI agent integration
- **REST API** at `/api` - For traditional clients
- **SQLite Database** - Zero configuration, file-based
- **Descope Auth** - JWT validation and RBAC

## Quick Start

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your Descope credentials in `.env`

3. Install dependencies:
   ```bash
   bun install
   ```

4. Seed the database:
   ```bash
   bun run db:seed
   ```

5. Start the development server:
   ```bash
   bun run dev
   ```

## API Endpoints

### REST API (`/api`)

| Method | Endpoint | Description | Required Scope |
|--------|----------|-------------|----------------|
| POST | /api/expenses | Submit expense | expense:submit |
| GET | /api/expenses/me | List own expenses | expense:view:own |
| GET | /api/expenses/team/:teamId | List team expenses | expense:view:team |
| GET | /api/expenses/all | List all expenses | expense:view:all |
| GET | /api/expenses/:id | Get expense details | expense:view:own/team/all |
| POST | /api/expenses/:id/approve | Approve expense | expense:approve |
| POST | /api/expenses/:id/reject | Reject expense | expense:approve |
| POST | /api/expenses/reports/generate | Generate report | expense:report:generate |

### MCP Tools (`/mcp`)

- `submit_expense` - Submit a new expense
- `list_my_expenses` - List user's own expenses
- `list_team_expenses` - List team expenses (managers)
- `approve_expense` - Approve an expense
- `reject_expense` - Reject an expense
- `generate_expense_report` - Generate expense report (finance)

## User Roles

| Role | Permissions |
|------|-------------|
| employee | Submit, view own expenses |
| manager | Submit, view own/team, approve/reject team |
| finance_admin | Full access to all expenses and reports |

## Development

```bash
# Run in development mode
bun run dev

# Reset and reseed database
bun run db:reset

# Type check
bun run typecheck

# Lint
bun run lint
```

## Environment Variables

See `.env.example` for all configuration options.
```

---

## Step 15: Update Root package.json

Ensure the root `package.json` includes the expense-server in workspaces:

```json
{
  "workspaces": [
    "apps/*",
    "packages/*"
  ]
}
```

---

## Verification Steps

After completing Phase 0:

1. Run from monorepo root:
   ```bash
   cd apps/expense-server
   bun install
   ```

2. Create `.env` from `.env.example` and fill in your Descope credentials

3. Run the placeholder entry point:
   ```bash
   bun run dev
   ```

4. You should see:
   ```
   🚀 Expense Server Configuration Loaded
      Environment: development
      Port: 3000
      Server URL: http://localhost:3000
      Database Path: ./data/expense.db
      Descope Project ID: your_pro...

   ✅ Phase 0 Complete - Configuration working!
      Run Phase 1 to set up Express server with MCP wrapper.
   ```

---

## Files Created in This Phase

1. `apps/expense-server/package.json`
2. `apps/expense-server/tsconfig.json`
3. `apps/expense-server/.env.example`
4. `apps/expense-server/README.md`
5. `apps/expense-server/data/.gitkeep`
6. `apps/expense-server/src/config/index.ts`
7. `apps/expense-server/src/config/constants.ts`
8. `apps/expense-server/src/utils/errors.ts`
9. `apps/expense-server/src/utils/response.ts`
10. `apps/expense-server/src/utils/uuid.ts`
11. `apps/expense-server/src/types/index.ts`
12. `apps/expense-server/src/index.ts`