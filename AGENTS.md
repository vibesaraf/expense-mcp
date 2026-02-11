# Expense MCP Demo - AI Agent Guide

> **This document provides comprehensive guidance for AI agents (like Claude) working on this codebase.**

## Project Overview

**Expense Management System** - A Model Context Protocol (MCP) enabled expense tracking application built with modern TypeScript tooling.

- **Architecture**: Turborepo monorepo
- **Current Phase**: Phase 3 (Database repository layer complete)
- **Repository Structure**: Workspaces (`apps/*`, `packages/*`)

---

## Technology Stack

### Core Technologies

- **Runtime**: Node.js >=18
- **Package Manager**: Bun 1.3.6
- **Monorepo Tool**: Turborepo 2.8.2
- **Language**: TypeScript 5.9.x
- **Module System**: ES Modules (`"type": "module"`)

### Backend Stack

- **Framework**: Express 5.2.1
- **Authentication**: Descope Node SDK + MCP Express wrapper
- **MCP Protocol**: @modelcontextprotocol/sdk 1.25.3
- **Database**: SQLite (better-sqlite3 12.6.2)
- **Validation**: Zod 4.3.6
- **Security**: Helmet 8.1.0, CORS 2.8.6
- **Logging**: Morgan (HTTP request logger)

### Frontend Stack (Shared UI Package)

- **UI Library**: React 19.2.0
- **Component Library**: Custom shared components (@expense/ui)

### Code Quality

- **Linting**: ESLint 9.39.1
- **Formatting**: Prettier 3.7.4
- **Type Checking**: TypeScript strict mode

---

## Workspace Structure

### Apps Workspace (`apps/*`)

#### `apps/expenses-server`

- **Type**: Node.js Express backend
- **Purpose**: Main server with MCP and REST API endpoints
- **Module Type**: ES Modules
- **Entry Point**: `src/index.ts`
- **Key Features**:
  - MCP endpoint at `/mcp` (Model Context Protocol)
  - REST API at `/api/*`
  - OAuth metadata endpoints at `/.well-known/*`
  - Descope authentication integration

**Directory Structure**:

```
apps/expenses-server/
├── src/
│   ├── api/                    # REST API routes
│   │   ├── controllers/        # Request handlers
│   │   ├── routes/             # Route definitions
│   │   ├── validators/         # Request validation schemas
│   │   └── index.ts            # API router with health and info endpoints
│   ├── config/                 # Configuration
│   │   ├── index.ts            # Main config (env variables)
│   │   ├── constants.ts        # App constants (roles, statuses, scopes)
│   │   └── descope.ts          # Descope auth client & MCP provider
│   ├── db/                     # Database setup and seed scripts
│   │   └── repositories/       # Database repository layer (users, categories, expenses, approvals, audit)
│   ├── mcp/                    # MCP server tools and handlers
│   │   └── index.ts            # MCP router and tool registration
│   ├── middleware/             # Express middleware
│   │   ├── auth.middleware.ts  # JWT validation & user extraction
│   │   ├── rbac.middleware.ts  # Role-based access control
│   │   ├── error.middleware.ts # Global error & 404 handlers
│   │   ├── audit.middleware.ts # Audit logging middleware
│   │   └── index.ts            # Middleware exports
│   ├── services/               # Business logic layer
│   │   ├── expense.service.ts  # Expense business logic
│   │   ├── report.service.ts   # Report generation logic
│   │   └── index.ts            # Service exports
│   ├── types/                  # TypeScript type definitions
│   │   ├── api.types.ts        # API request/response types
│   │   ├── auth.types.ts       # Auth & user types
│   │   ├── expense.types.ts    # Expense domain types
│   │   └── user.types.ts       # User domain types
│   ├── utils/                  # Utility functions
│   └── index.ts                # Main Express server entry point
├── data/                       # SQLite database storage
└── package.json
```

**Scripts**:

- `bun run dev` - Development mode with tsx watch
- `bun run build` - TypeScript compilation
- `bun run start` - Run production build
- `bun run db:seed` - Seed database with initial data
- `bun run db:reset` - Reset and re-seed database
- `bun run lint` - ESLint check
- `bun run typecheck` - TypeScript type checking

### Packages Workspace (`packages/*`)

#### `packages/typescript-config`

- **Package Name**: `@expense/typescript-config`
- **Purpose**: Shared TypeScript configurations
- **Exports**:
  - `base.json` - Base config for all projects
  - `react-library.json` - React-specific config
  - `nextjs.json` - Next.js-specific config

#### `packages/eslint-config`

- **Package Name**: `@expense/eslint-config`
- **Purpose**: Shared ESLint configurations
- **Exports**:
  - `base.js` - Base rules (TypeScript, Turbo, Prettier)
  - `react-internal.js` - React library rules
  - `next.js` - Next.js-specific rules

#### `packages/ui`

- **Package Name**: `@expense/ui`
- **Purpose**: Shared React component library
- **Components**: Button, Card, Code
- **Framework**: React 19.2.0
- **Export Pattern**: Direct TSX file exports

---

## Build System (Turborepo)

### Configuration (`turbo.json`)

```json
{
  "$schema": "https://turborepo.dev/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["$TURBO_DEFAULT$", ".env*"],
      "outputs": [".next/**", "!.next/cache/**"]
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "check-types": {
      "dependsOn": ["^check-types"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

### Task Dependencies

- `^` prefix means "run this task in dependencies first"
- Example: `build` depends on `^build` (all deps must build first)
- `dev` runs in persistent mode (doesn't cache)

### Root Scripts

```bash
# Run all builds across workspaces
bun run build

# Run all dev servers in parallel
bun run dev

# Run all linters
bun run lint

# Run all type checks
bun run check-types

# Format all code
bun run format
```

---

## 🚨 CRITICAL RULES FOR AI AGENTS

### Rule 1: Package Installation (PRIMARY RULE)

**DO NOT** hallucinate version numbers or manually specify versions for new npm packages.

**ALWAYS** use Bun's automatic latest version installation:

```bash
# ✅ CORRECT - Install latest version automatically
cd apps/expenses-server
bun add package-name

# ✅ CORRECT - Install as dev dependency
bun add -d package-name

# ❌ WRONG - Do not specify versions unless required
bun add package-name@1.2.3

# ⚠️ ONLY specify version when compatibility requires it
bun add react@18.0.0  # Only if React 18 specifically needed
```

**Examples**:

```bash
# Adding a new utility library to expenses-server
cd apps/expenses-server
bun add lodash

# Adding a new dev dependency
cd apps/expenses-server
bun add -d @types/lodash

# Adding to shared UI package
cd packages/ui
bun add clsx
```

### Rule 2: Workspace References

When referencing internal packages, use the `workspace:*` protocol:

```json
{
  "dependencies": {
    "@expense/ui": "workspace:*",
    "@expense/typescript-config": "workspace:*"
  }
}
```

### Rule 3: Module System

This project uses **ES Modules** exclusively:

```typescript
// ✅ CORRECT - Use ES module syntax
import express from "express";
export const app = express();

// ❌ WRONG - Do not use CommonJS
const express = require("express");
module.exports = app;
```

All `package.json` files have `"type": "module"`.

### Rule 4: TypeScript Configuration

Always extend from shared configs:

```json
// apps/expenses-server/tsconfig.json
{
  "extends": "@expense/typescript-config/base.json",
  "compilerOptions": {
    "outDir": "dist"
  }
}
```

### Rule 5: File Organization

Follow the established patterns:

```
src/
├── api/          # REST API routes and controllers
├── config/       # Configuration files (constants, env)
├── db/           # Database setup, migrations, seeds
├── mcp/          # MCP tools and handlers
├── middleware/   # Express middleware functions
├── types/        # TypeScript type definitions
├── utils/        # Utility functions
└── index.ts      # Entry point
```

### Rule 6: Authentication Patterns

Always use Descope for authentication:

```typescript
import { descopeClient, descopeMcpProvider } from "../config/descope";
import { authMiddleware } from "../middleware";

// For REST API routes
app.get("/api/expenses", authMiddleware, handler);

// For MCP endpoints
// The createMcpRouter() automatically uses descopeMcpProvider
import { createMcpRouter } from "../mcp";
app.use(createMcpRouter());
```

**Key Modules**:

- [config/descope.ts](apps/expenses-server/src/config/descope.ts) - Descope client and MCP provider initialization
- [middleware/auth.middleware.ts](apps/expenses-server/src/middleware/auth.middleware.ts) - JWT validation middleware
- [middleware/rbac.middleware.ts](apps/expenses-server/src/middleware/rbac.middleware.ts) - Role-based access control

### Rule 7: Error Handling

Use structured error handling with the global error middleware:

```typescript
// The error middleware (middleware/error.middleware.ts) handles all errors
// Throw standard errors or create custom error classes in utils/errors.ts

// Standard error throwing
throw new Error("Something went wrong");

// Or use custom error classes when available:
// import { UnauthorizedError, ForbiddenError, NotFoundError } from '../utils/errors';
// throw new UnauthorizedError('Invalid token');
// throw new ForbiddenError('Insufficient permissions');
// throw new NotFoundError('Expense not found');

// The errorHandler middleware will format the response consistently
```

**Error Middleware Features**:

- Catches all errors in the application
- Formats errors consistently
- Logs errors in non-production environments
- Returns appropriate HTTP status codes
- Includes error details in development mode

### Rule 8: Type Safety

Maintain strict type safety:

```typescript
// ✅ CORRECT - Explicit types
export async function getExpense(id: string): Promise<Expense> {
  // ...
}

// ❌ WRONG - Implicit any
export async function getExpense(id) {
  // ...
}
```

---

## Development Guidelines

### Adding a New Package

**To Apps:**

```bash
cd apps/expenses-server
bun add new-package-name
```

**To Shared Packages:**

```bash
cd packages/ui
bun add new-package-name
```

**Root-level dev dependencies:**

```bash
# From project root
bun add -d new-dev-tool
```

### Creating a New Workspace Package

1. Create directory: `packages/new-package/`
2. Initialize: `bun init`
3. Set package name: `@expense/new-package`
4. Mark as private: `"private": true`
5. Add to workspaces (already configured in root)

### Running Commands in Workspaces

```bash
# Run in specific workspace
cd apps/expenses-server
bun run dev

# Run across all workspaces (from root)
bun run dev  # Runs all dev scripts via Turbo
```

### Database Management

```bash
cd apps/expenses-server

# Seed database with initial data
bun run db:seed

# Reset database (delete + re-seed)
bun run db:reset
```

**Database Location**: `apps/expenses-server/data/expense.db`

### Environment Variables

Create `.env` file in `apps/expenses-server/`:

```env
NODE_ENV=development
PORT=3000
SERVER_URL=http://localhost:3000
DATABASE_PATH=./data/expense.db
DESCOPE_PROJECT_ID=your_project_id
DESCOPE_MANAGEMENT_KEY=your_management_key
CORS_ORIGIN=*
```

---

## Code Patterns & Best Practices

### Middleware Patterns

The application uses several middleware layers for security and functionality:

```typescript
// src/index.ts - Middleware order is important!
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { errorHandler, notFoundHandler } from "./middleware";

const app = express();

// 1. Security first
app.use(helmet({ contentSecurityPolicy: config.NODE_ENV === "production" }));

// 2. CORS configuration
app.use(
  cors({
    origin: config.CORS_ORIGIN === "*" ? "*" : config.CORS_ORIGIN.split(","),
    credentials: true,
  }),
);

// 3. Request parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// 4. Logging (skip in tests)
if (config.NODE_ENV !== "test") {
  app.use(morgan(config.NODE_ENV === "production" ? "combined" : "dev"));
}

// 5. Routes (public first, then protected)
app.get("/health", healthHandler);
app.use(createMcpRouter()); // MCP with its own auth
app.use("/api", apiRouter); // REST API routes

// 6. Error handling (MUST be last)
app.use(notFoundHandler); // 404 handler
app.use(errorHandler); // Global error handler
```

**Available Middleware**:

- `authMiddleware` - Validates JWT and extracts user info (required)
- `optionalAuthMiddleware` - Validates JWT if present (optional auth)
- `requireRoles(...roles)` - Checks if user has one of the specified roles
- `requireScopes(...scopes)` - Checks if user has all specified scopes
- `requireAnyScope(...scopes)` - Checks if user has any of the specified scopes
- `auditMiddleware` - Logs user actions for audit trail
- `errorHandler` - Global error handler (catches all errors)
- `notFoundHandler` - 404 handler for unknown routes

### REST API Endpoints

```typescript
import { Router } from "express";
import type { Request, Response } from "express";
import { authMiddleware, requireRoles } from "../middleware";
import { UserRoles } from "../config/constants";

const router = Router();

// Public endpoint
router.get("/health", (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: { status: "healthy", timestamp: new Date().toISOString() },
  });
});

// Authenticated endpoint
router.get("/expenses", authMiddleware, async (req: Request, res: Response) => {
  // req.user contains authenticated user info
  const userId = req.user?.userId;
  // ... fetch expenses
});

// Role-protected endpoint
router.post(
  "/expenses/approve/:id",
  authMiddleware,
  requireRoles(UserRoles.MANAGER, UserRoles.FINANCE_ADMIN),
  async (req: Request, res: Response) => {
    // Only managers and finance admins can access
    const { id } = req.params;
    // ... approve expense
  },
);
```

**Response Format**:
All API responses follow a consistent format:

```typescript
// Success response
{
  success: true,
  data: { /* ... */ }
}

// Error response (from error middleware)
{
  success: false,
  error: {
    message: "Error message",
    code: "ERROR_CODE",
    details?: { /* ... */ }
  }
}
```

### MCP Server Setup

The MCP server is configured using Descope MCP Express wrapper:

```typescript
// src/mcp/index.ts
import { descopeMcpAuthRouter } from "@descope/mcp-express";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { descopeMcpProvider } from "../config/descope";

function registerTools(server: McpServer): void {
  // Tools will be registered here in Phase 6
  // Example:
  // server.tool('submit_expense', { ... });
}

export function createMcpRouter() {
  return descopeMcpAuthRouter(registerTools, descopeMcpProvider);
}
```

**MCP Endpoints**:

- `POST /mcp` - Main MCP protocol endpoint (requires Bearer token)
- `GET /.well-known/oauth-protected-resource` - OAuth resource metadata
- `GET /.well-known/oauth-authorization-server` - OAuth server metadata

MCP tools implementation is planned for Phase 6.

### Database Queries

Use the repository layer (Phase 3) instead of raw queries for application code:

```typescript
import { expenseRepository, userRepository } from "../db/repositories";
import { ExpenseStatus } from "../config/constants";

// Fetch a user and their expenses
const user = userRepository.findById("user_alice_employee");
const expenses = expenseRepository.listByUser(user!.userId, {
  status: [ExpenseStatus.PENDING, ExpenseStatus.APPROVED],
});

// Create a new expense
const created = expenseRepository.create(user!.userId, {
  amount: 120,
  currency: "USD",
  description: "Client lunch",
  expenseDate: "2026-02-05",
  categoryId: 1,
});

// Approve it
expenseRepository.updateStatus(created.expenseId, ExpenseStatus.APPROVED);
```

---

## Testing Strategy

### Current Status

Tests not yet implemented (planned for later phases).

### Planned Testing Approach

- **Unit Tests**: Vitest
- **Integration Tests**: Supertest for API
- **E2E Tests**: Playwright (for UI)

---

## Common Tasks

### Adding a New Middleware

1. Create file: `src/middleware/my-middleware.ts`
2. Export middleware function
3. Export from `src/middleware/index.ts`
4. Apply in `src/index.ts`

**Example**:

```typescript
// src/middleware/my-middleware.ts
import type { Request, Response, NextFunction } from "express";

export function myMiddleware(req: Request, res: Response, next: NextFunction) {
  // Middleware logic
  next();
}

// src/middleware/index.ts
export { myMiddleware } from "./my-middleware";

// src/index.ts
import { myMiddleware } from "./middleware";
app.use(myMiddleware);
```

### Adding a New API Route

1. Create file: `src/api/my-route.ts`
2. Create router with handlers
3. Import and mount in `src/api/index.ts`

### Adding a New Type Definition

1. Create file: `src/types/my-types.ts`
2. Export interfaces/types
3. Import where needed

### Updating Shared Config

```bash
# Update TypeScript config
cd packages/typescript-config
# Edit base.json, react-library.json, etc.

# Update ESLint config
cd packages/eslint-config
# Edit base.js, react-internal.js, etc.
```

---

## Troubleshooting

### Bun Lock Issues

```bash
rm bun.lockb
bun install
```

### Type Errors

```bash
# Check types across entire monorepo
bun run check-types

# Check specific workspace
cd apps/expenses-server
bun run typecheck
```

### Turbo Cache Issues

```bash
# Clear Turbo cache
rm -rf .turbo
bun run build
```

### Database Issues

```bash
cd apps/expenses-server

# Reset database
bun run db:reset

# Manual reset
rm -f data/expense.db
bun run db:seed
```

---

## Project Phases

### Phase 0: ✅ Completed

- Project initialization
- Directory structure
- Shared configurations
- Monorepo setup

### Phase 1: ✅ Completed

- Express server setup with Helmet, CORS, Morgan
- MCP wrapper integration with Descope authentication
- Middleware implementation (auth, RBAC, error handling, audit)
- Complete type definitions for API, auth, expenses, and users
- Basic API structure with health endpoints
- Server entry point with graceful shutdown

### Phase 2: ✅ Completed

- Database design
- SQLite setup
- Seed data

### Phase 3: ✅ Completed

- Database repository layer (Base, User, Category, Expense, Approval, Audit)
- Pagination, filtering, and summaries for expenses
- Audit logging helpers and approval history utilities

### Phase 4: ✅ Completed

- REST API implementation
- Controllers, Services, Validators
- Expenses, Reports, and Categories endpoints
- RBAC and Audit integration

### Phase 5+: 📋 Planned

- MCP tools implementation
- Testing
- Documentation

---

## Important URLs & Endpoints

### Development Server

- **Base URL**: `http://localhost:3000`
- **Health Check**: `GET /health` (public, server-level)
- **API Health**: `GET /api/health` (API-level health check)
- **API Info**: `GET /api` (API metadata and endpoint listing)
- **MCP Endpoint**: `POST /mcp` (requires Bearer token)
- **REST API**: `/api/*` (base path for all REST endpoints)
- **OAuth Resource Metadata**: `GET /.well-known/oauth-protected-resource`
- **OAuth Server Metadata**: `GET /.well-known/oauth-authorization-server`

### Documentation

- **AI Agent Guide**: `AGENTS.md` (this file - comprehensive AI agent guidance)
- **Agent Update Instructions**: `.agents/update-agents-doc.md` (how to update this file)
- **Phase 1 Guide**: `PHASE-1.md` (Phase 1 implementation documentation)
- **Phase 2 Guide**: `PHASE-2.md` (Phase 2 implementation documentation)
- **Phase 3 Guide**: `PHASE-3.md` (Phase 3 planning/implementation)

---

## External Resources

### Documentation Links

- [Turborepo Docs](https://turbo.build/repo/docs)
- [Bun Documentation](https://bun.sh/docs)
- [Descope MCP Express](https://github.com/descope/descope-mcp-express)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Express.js Guide](https://expressjs.com/)
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)

### Package Registries

- **NPM**: https://www.npmjs.com/
- **Bun**: https://bun.sh/packages

---

## AI Agent Quick Reference

### Before Adding Any Package

1. Navigate to correct workspace: `cd apps/expenses-server` or `cd packages/ui`
2. Run: `bun add package-name` (NO version number)
3. Let Bun automatically install the latest compatible version
4. Only specify version if there's a specific compatibility requirement

### Before Making Changes

1. Read existing code in the area you're modifying
2. Follow established patterns
3. Maintain type safety
4. Use shared configs from packages workspace
5. Test changes with `bun run dev`

### Common Commands Cheatsheet

```bash
# Install dependencies (root)
bun install

# Run dev servers
bun run dev

# Build everything
bun run build

# Type check everything
bun run check-types

# Lint everything
bun run lint

# Format code
bun run format

# Reset database
cd apps/expenses-server && bun run db:reset
```

---

**Last Updated**: 2026-02-05
**Current Phase**: Phase 3 Complete - Phase 4 Next (REST API, MCP tools, testing)
