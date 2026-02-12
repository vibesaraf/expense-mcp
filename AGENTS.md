# CLAUDE.md

## Project Overview

Expense management system with dual REST API and MCP (Model Context Protocol) interfaces. Built as a Turborepo monorepo using TypeScript, Express 5, SQLite, and Scalekit for authentication.

## Repository Structure

```
apps/expenses-server/src/   # Main backend server
  api/                      # REST routes, controllers, validators
  mcp/                      # MCP tool definitions (6 tools)
  db/                       # SQLite schema, seed, repositories
  services/                 # Business logic layer
  middleware/               # Auth (Scalekit JWT), RBAC, audit, error handling
  config/                   # Env validation (Zod), constants, Scalekit client
  types/                    # TypeScript interfaces
  utils/                    # Error classes, response helpers, UUID
packages/
  eslint-config/            # Shared ESLint configs
  typescript-config/        # Shared tsconfig bases
  ui/                       # React component library (stub)
```

## Commands

```bash
# Root level (turbo)
bun run dev           # Start all packages in dev mode
bun run build         # Build all packages
bun run lint          # Lint all packages
bun run check-types   # Type check all packages
bun run format        # Prettier format

# Server level (apps/expenses-server)
bun run dev           # Dev server with tsx watch (port 3000)
bun run build         # Compile TS to dist/
bun run db:seed       # Seed database with test data
bun run db:reset      # Drop tables and reseed
bun run typecheck     # tsc --noEmit
```

Package manager is **Bun**. Use `bun` instead of `npm`.

## Architecture

Layered architecture: Routes/MCP Tools → Controllers → Services → Repositories → SQLite

- **Auth**: Scalekit JWT validation via middleware; OAuth 2.1 scopes for MCP
- **RBAC**: 3 roles (employee, manager, finance_admin) with scope-based authorization
- **Database**: better-sqlite3 with WAL mode, direct SQL (no ORM), repository pattern
- **Validation**: Zod schemas for all inputs
- **Dual interface**: REST API at `/api/*`, MCP server at `/mcp`

## Key Patterns

- Path alias: `@/*` maps to `./src/*`
- Repositories extend `BaseRepository` with prepared statement caching
- Custom error classes in `src/utils/errors.ts` (UnauthorizedError, ForbiddenError, ValidationError, NotFoundError, ConflictError)
- Expense status flow: `pending → approved → paid` or `pending → rejected`
- All mutations are audit-logged to `audit_log` table
- DB singleton with lazy initialization in `src/db/index.ts`

## Permissions & Authorization

### Roles

Three roles enforced via `requireRoles()` middleware in `src/middleware/rbac.middleware.ts`:

| Role            | Description                               | Capabilities                                                   |
| --------------- | ----------------------------------------- | -------------------------------------------------------------- |
| `employee`      | Default role (assigned if no roles match) | Submit expenses, view own expenses                             |
| `manager`       | Department manager                        | All employee capabilities + view/approve/reject team expenses  |
| `finance_admin` | Finance administrator                     | All manager capabilities + view all expenses, generate reports |

Role hierarchy: `finance_admin` > `manager` > `employee`. Helper middlewares `requireManager()` accepts manager or finance_admin; `requireFinanceAdmin()` accepts only finance_admin.

### OAuth 2.1 Scopes

Six scopes defined in `src/config/constants.ts` (`McpScopes`), enforced via `requireScopes()` / `requireAnyScope()` middlewares on both REST and MCP endpoints:

| Scope                     | Purpose                       | Used by                                                                                                           |
| ------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `expense:submit`          | Submit new expenses           | `POST /api/expenses`, `submit_expense` MCP tool                                                                   |
| `expense:view:own`        | View own submitted expenses   | `GET /api/expenses/me`, `list_my_expenses` MCP tool                                                               |
| `expense:view:team`       | View direct reports' expenses | `GET /api/expenses/team/:teamId`, `list_team_expenses` MCP tool                                                   |
| `expense:view:all`        | View all expenses system-wide | `GET /api/expenses/all` (finance_admin only)                                                                      |
| `expense:approve`         | Approve or reject expenses    | `POST /api/expenses/:id/approve`, `POST /api/expenses/:id/reject`, `approve_expense` / `reject_expense` MCP tools |
| `expense:report:generate` | Generate expense reports      | `POST /api/reports/generate`, `generate_expense_report` MCP tool                                                  |

### Endpoint → Permission Matrix

| Endpoint                         | Role Guard        | Scope Guard                                                        |
| -------------------------------- | ----------------- | ------------------------------------------------------------------ |
| `POST /api/expenses`             | any authenticated | `expense:submit`                                                   |
| `GET /api/expenses/me`           | any authenticated | `expense:view:own`                                                 |
| `GET /api/expenses/team/:teamId` | manager+          | `expense:view:team`                                                |
| `GET /api/expenses/all`          | finance_admin     | `expense:view:all`                                                 |
| `GET /api/expenses/:id`          | any authenticated | any of `expense:view:own`, `expense:view:team`, `expense:view:all` |
| `POST /api/expenses/:id/approve` | any authenticated | `expense:approve`                                                  |
| `POST /api/expenses/:id/reject`  | any authenticated | `expense:approve`                                                  |
| `POST /api/reports/generate`     | finance_admin     | — (role-gated only)                                                |
| `GET /api/categories`            | any authenticated | — (no scope required)                                              |

### Auth Flow

1. Client sends `Authorization: Bearer <JWT>` header
2. `authMiddleware` validates JWT via Scalekit SDK (`scalekitClient.validateAccessToken`)
3. Roles extracted from Scalekit token claims and mapped via `mapScalekitRoles()` (handles variants like `finance-admin`, `financeadmin`)
4. Scopes extracted from the `scope` claim in the token
5. `requireRoles()` / `requireScopes()` middlewares gate individual routes
6. `auditMiddleware` logs all mutations to the `audit_log` table

## Environment Variables

Required: `SCALEKIT_ENV_URL`, `SCALEKIT_CLIENT_ID`, `SCALEKIT_CLIENT_SECRET`, `MCP_SERVER_URL`, `PROTECTED_RESOURCE_METADATA`
Optional: `PORT` (default 3000), `DATABASE_PATH` (default `./data/expense.db`), `CORS_ORIGIN`, `NODE_ENV`

## Test Data (after db:seed)

Users: Carol (finance_admin), Bob (eng manager), Alice/Dave (eng employees), Eve (sales manager), Frank (sales employee). Categories: Meals ($100), Travel ($5000), Office Supplies ($500), Software ($1000), Training ($3000).

## Code Style

- TypeScript strict mode, ES2022 target, ESNext modules
- ESLint 9 flat config with Prettier integration
- No semicolons or trailing commas enforced by Prettier config — follow existing patterns
- Commit messages: lowercase, prefixed with phase or description (e.g., "phase-5: mcp tools")
