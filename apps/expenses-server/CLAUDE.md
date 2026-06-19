# Expense Management Server

A combined MCP + REST API server for expense management with LoginRadius authentication.

## Features

- **MCP Server** at `/mcp` - For AI agent integration
- **REST API** at `/api` - For traditional clients
- **SQLite Database** - Zero configuration, file-based
- **LoginRadius Auth** - JWT validation (OIDC/JWKS) and RBAC

## Quick Start

1. Copy `.env.example` to `.env`:

   ```bash
   cp .env.example .env
   ```

2. Fill in your LoginRadius credentials in `.env`

3. Install dependencies:

   ```bash
   pnpm install
   ```

4. Seed the database:

   ```bash
   pnpm run db:seed
   ```

5. Start the development server:
   ```bash
   pnpm run dev
   ```

## API Endpoints

### REST API (`/api`)

| Method | Endpoint                       | Description         | Required Scope            |
| ------ | ------------------------------ | ------------------- | ------------------------- |
| POST   | /api/expenses                  | Submit expense      | expense:submit            |
| GET    | /api/expenses/me               | List own expenses   | expense:view:own          |
| GET    | /api/expenses/team/:teamId     | List team expenses  | expense:view:team         |
| GET    | /api/expenses/all              | List all expenses   | expense:view:all          |
| GET    | /api/expenses/:id              | Get expense details | expense:view:own/team/all |
| POST   | /api/expenses/:id/approve      | Approve expense     | expense:approve           |
| POST   | /api/expenses/:id/reject       | Reject expense      | expense:approve           |
| POST   | /api/expenses/reports/generate | Generate report     | expense:report:generate   |

### MCP Tools (`/mcp`)

- `who_am_i` - Get current user's profile
- `submit_expense` - Submit a new expense
- `list_my_expenses` - List user's own expenses
- `list_team_expenses` - List team expenses (managers)
- `approve_expense` - Approve an expense
- `reject_expense` - Reject an expense
- `generate_report` - Generate expense report (finance)

## User Roles

| Role          | Permissions                                |
| ------------- | ------------------------------------------ |
| employee      | Submit, view own expenses                  |
| manager       | Submit, view own/team, approve/reject team |
| finance_admin | Full access to all expenses and reports    |

## Development

```bash
# Run in development mode
pnpm run dev

# Reset and reseed database
pnpm run db:reset

# Type check
pnpm run typecheck

# Lint
pnpm run lint
```

## Environment Variables

See `.env.example` for all configuration options.
