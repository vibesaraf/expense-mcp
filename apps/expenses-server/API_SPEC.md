# Expense Management API Specification

Version: 1.0.0

## Overview

The Expense Management Server provides a dual-interface architecture combining REST API endpoints and MCP (Model Context Protocol) tools for AI agent integration. It features Scalekit-based authentication with JWT validation and role-based access control (RBAC).

**Base URLs:**
- REST API: `http://localhost:3001/api`
- MCP Server: `http://localhost:3001/mcp`

**Database:** SQLite (file-based, zero configuration)

---

## Authentication

All endpoints (except `/.well-known/oauth-protected-resource`) require authentication via LoginRadius JWT tokens (validated via OIDC/JWKS).

**Headers Required:**
```
Authorization: Bearer <jwt_token>
```

**Token Claims:**
- `sub`: LoginRadius user ID (used to look up the local user record)
- `email`: Used as fallback lookup if `sub` doesn't match
- `scp` or `scope`: Space-separated or array of permission scopes

---

## User Roles & Permissions

| Role | Permissions |
|------|-------------|
| `employee` | Submit expenses, view own expenses |
| `manager` | All employee permissions + view/approve/reject team expenses |
| `finance_admin` | Full access to all expenses, reports, and administrative functions |

---

## Expense Categories

| Category | Description | Max Amount | Receipt Required |
|----------|-------------|------------|------------------|
| Meals | Business meals and client entertainment | $100 | Yes |
| Travel | Transportation and accommodation | $5,000 | Yes |
| Office Supplies | Stationery, equipment, etc. | $500 | No |
| Software | Software subscriptions and licenses | $1,000 | No |
| Training | Courses, conferences, certifications | $3,000 | Yes |

---

## Expense Status Flow

```
pending → approved → paid
    ↓
rejected
```

**Statuses:**
- `pending`: Awaiting approval
- `approved`: Approved by manager
- `rejected`: Rejected by manager
- `paid`: Processed by finance

---

## REST API Endpoints

### Health & Info

#### GET /api/health
Get server health status. No authentication required.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2026-02-15T10:30:00.000Z",
    "version": "1.0.0"
  }
}
```

#### GET /api
Get API information and available endpoints. No authentication required.

**Response:**
```json
{
  "success": true,
  "data": {
    "name": "Expense Management API",
    "version": "1.0.0",
    "endpoints": {
      "expenses": "/api/expenses",
      "categories": "/api/categories",
      "reports": "/api/expenses/reports",
      "users": "/api/users"
    },
    "documentation": "/api/docs"
  }
}
```

#### GET /.well-known/oauth-protected-resource
Returns OAuth 2.0 Protected Resource Metadata. No authentication required.

**Response:** JSON object from `PROTECTED_RESOURCE_METADATA` environment variable.

---

### Expenses

#### POST /api/expenses
Submit a new expense for approval. Returns HTTP 201 on success.

**Scope Required:** `expense:submit`

**Business Rules:**
- Amount must not exceed category max limit
- Receipt URL required for Meals, Travel, and Training categories
- User must exist in the database

**Request Body:**
```json
{
  "categoryId": 1,
  "amount": 45.50,
  "currency": "USD",
  "description": "Team lunch at downtown restaurant",
  "expenseDate": "2026-02-15",
  "receiptUrl": "https://example.com/receipts/receipt-123.pdf"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `categoryId` | integer | Yes | Positive integer, must exist in DB |
| `amount` | number | Yes | Greater than 0, must not exceed category limit |
| `currency` | string | No | 3-letter ISO 4217 code, default: `USD` |
| `description` | string | Yes | Min 10 characters |
| `expenseDate` | string | Yes | YYYY-MM-DD format |
| `receiptUrl` | string | No | Valid URL; required for Meals, Travel, Training |

**Response (201):**
```json
{
  "success": true,
  "data": {
    "expenseId": "550e8400-e29b-41d4-a716-446655440000",
    "submitterId": "user-123",
    "categoryId": 1,
    "categoryName": "Meals",
    "amount": 45.50,
    "currency": "USD",
    "description": "Team lunch at downtown restaurant",
    "expenseDate": "2026-02-15",
    "receiptUrl": "https://example.com/receipts/receipt-123.pdf",
    "status": "pending",
    "submittedAt": "2026-02-15T10:30:00.000Z",
    "updatedAt": "2026-02-15T10:30:00.000Z",
    "submitter": {
      "userId": "user-123",
      "fullName": "Alice Johnson",
      "email": "alice@example.com",
      "department": "Engineering"
    }
  }
}
```

---

#### GET /api/expenses/me
List your own expenses.

**Scope Required:** `expense:view:own`

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Comma-separated statuses: `pending,approved,rejected,paid` |
| `fromDate` | string | Start date (YYYY-MM-DD) |
| `toDate` | string | End date (YYYY-MM-DD) |
| `categoryId` | string | Comma-separated category IDs (e.g., `1,2`) |
| `page` | integer | Page number, default: 1 |
| `limit` | integer | Items per page, default: 20, max: 100 |

**Response:**
```json
{
  "success": true,
  "data": {
    "expenses": [
      {
        "expenseId": "550e8400-e29b-41d4-a716-446655440000",
        "submitterId": "user-123",
        "categoryId": 1,
        "categoryName": "Meals",
        "amount": 45.50,
        "currency": "USD",
        "description": "Team lunch at downtown restaurant",
        "expenseDate": "2026-02-15",
        "receiptUrl": "https://example.com/receipts/receipt-123.pdf",
        "status": "pending",
        "submittedAt": "2026-02-15T10:30:00.000Z",
        "updatedAt": "2026-02-15T10:30:00.000Z",
        "submitter": {
          "userId": "user-123",
          "fullName": "Alice Johnson",
          "email": "alice@example.com",
          "department": "Engineering"
        }
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalItems": 45,
      "itemsPerPage": 20
    },
    "summary": {
      "totalAmount": 2340.75,
      "pendingAmount": 450.00,
      "approvedAmount": 1890.75,
      "rejectedAmount": 0.00,
      "paidAmount": 0.00
    }
  }
}
```

---

#### GET /api/expenses/team/:teamId
List team expenses. `teamId` is the manager's user ID whose direct reports' expenses are returned.

**Scope Required:** `expense:view:team`
**Role Required:** `manager` or `finance_admin`

**Notes:**
- Non-finance-admin users can only view their own team (`teamId` must match their own user ID)
- Finance admins can query any manager's team

**Query Parameters:** Same as `/api/expenses/me`

**Response:** Same structure as `/api/expenses/me` (expenses include `submitter` details).

---

#### GET /api/expenses/all
List all expenses across the organization.

**Scope Required:** `expense:view:all`
**Role Required:** `finance_admin`

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Comma-separated statuses |
| `fromDate` | string | Start date (YYYY-MM-DD) |
| `toDate` | string | End date (YYYY-MM-DD) |
| `categoryId` | string | Comma-separated category IDs |
| `department` | string | Comma-separated department names |
| `submitterId` | string | Filter by submitter user ID |
| `page` | integer | Page number, default: 1 |
| `limit` | integer | Items per page, default: 20, max: 100 |

**Response:** Same structure as `/api/expenses/me`.

---

#### GET /api/expenses/:expenseId
Get detailed information about a specific expense, including full approval history.

**Scope Required:** any of `expense:view:own`, `expense:view:team`, `expense:view:all`

**Access Rules:**
- User can view their own expenses
- Manager can view direct reports' expenses
- Finance admin can view all expenses

**Response:**
```json
{
  "success": true,
  "data": {
    "expenseId": "550e8400-e29b-41d4-a716-446655440000",
    "submitterId": "user-123",
    "categoryId": 1,
    "categoryName": "Meals",
    "amount": 45.50,
    "currency": "USD",
    "description": "Team lunch at downtown restaurant",
    "expenseDate": "2026-02-15",
    "receiptUrl": "https://example.com/receipts/receipt-123.pdf",
    "status": "approved",
    "submittedAt": "2026-02-15T10:30:00.000Z",
    "updatedAt": "2026-02-15T14:20:00.000Z",
    "submitter": {
      "userId": "user-123",
      "fullName": "Alice Johnson",
      "email": "alice@example.com",
      "department": "Engineering"
    },
    "approvalHistory": [
      {
        "approver": {
          "userId": "manager-456",
          "fullName": "Bob Smith",
          "email": "bob@example.com"
        },
        "action": "approved",
        "notes": "Approved for team event",
        "approvedAt": "2026-02-15T14:20:00.000Z"
      }
    ]
  }
}
```

---

#### POST /api/expenses/:expenseId/approve
Approve a pending expense.

**Scope Required:** `expense:approve`

**Business Rules:**
- Expense must be in `pending` status
- Manager can only approve direct reports' expenses
- Finance admin can approve any expense
- Self-approval is not permitted

**Request Body:**
```json
{
  "notes": "Approved for quarterly team building"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `notes` | string | No | Max 500 characters |

**Response:** Full `ExpenseWithApprovalHistory` object (same shape as `GET /api/expenses/:expenseId`).

---

#### POST /api/expenses/:expenseId/reject
Reject a pending expense.

**Scope Required:** `expense:approve`

**Business Rules:**
- Expense must be in `pending` status
- Manager can only reject direct reports' expenses
- Finance admin can reject any expense

**Request Body:**
```json
{
  "reason": "Receipt not clear, please resubmit with better quality"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `reason` | string | Yes | Min 10 characters |

**Response:** Full `ExpenseWithApprovalHistory` object (same shape as `GET /api/expenses/:expenseId`).

---

### Categories

#### GET /api/categories
List all expense categories.

**Authentication Required:** Yes (any authenticated user, no specific scope)

**Response:**
```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "categoryId": 1,
        "categoryName": "Meals",
        "description": "Business meals and client entertainment",
        "requiresReceipt": true,
        "maxAmount": 100,
        "createdAt": "2026-01-01T00:00:00.000Z"
      },
      {
        "categoryId": 2,
        "categoryName": "Travel",
        "description": "Transportation and accommodation",
        "requiresReceipt": true,
        "maxAmount": 5000,
        "createdAt": "2026-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

---

### Reports

#### POST /api/expenses/reports/generate
Generate expense reports.

**Scope Required:** `expense:report:generate`
**Role Required:** `finance_admin`

**Request Body:**
```json
{
  "reportType": "summary",
  "fromDate": "2026-01-01",
  "toDate": "2026-01-31",
  "department": "Engineering",
  "status": "approved",
  "format": "json"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `reportType` | string | No | `summary` \| `detailed` \| `by_category`, default: `summary` |
| `fromDate` | string | Yes | YYYY-MM-DD; must be ≤ `toDate` |
| `toDate` | string | Yes | YYYY-MM-DD |
| `department` | string | No | Single department name |
| `status` | string | No | `pending` \| `approved` \| `rejected` \| `paid` |
| `format` | string | No | `json` \| `csv` \| `pdf`, default: `json` |

**Report Types:**
- `summary`: Aggregated statistics only
- `detailed`: Statistics + full list of individual expenses
- `by_category`: Statistics (breakdown by category always included)

**Response:**
```json
{
  "success": true,
  "data": {
    "reportId": "report_20260215150000",
    "reportType": "summary",
    "period": {
      "fromDate": "2026-01-01",
      "toDate": "2026-01-31"
    },
    "filters": {
      "department": "Engineering",
      "status": "approved"
    },
    "summary": {
      "totalExpenses": 127,
      "totalAmount": 45678.90,
      "currency": "USD",
      "byCategory": {
        "Meals": 3450.00,
        "Travel": 28000.00,
        "Software": 12000.00
      },
      "byStatus": {
        "approved": 45678.90
      },
      "byDepartment": {
        "Engineering": 45678.90
      }
    },
    "generatedAt": "2026-02-15T15:00:00.000Z",
    "generatedBy": {
      "userId": "admin-999",
      "fullName": "Carol Finance"
    }
  }
}
```

**Notes:**
- `byDepartment` is omitted when a `department` filter is specified
- When `reportType` is `detailed`, a top-level `expenses` array is added:
  ```json
  "expenses": [
    {
      "expenseId": "550e8400-e29b-41d4-a716-446655440000",
      "submitter": "Alice Johnson",
      "category": "Meals",
      "amount": 45.50,
      "status": "approved",
      "expenseDate": "2026-02-15"
    }
  ]
  ```

---

### Users

#### POST /api/users/register
Register a new user in the system. Typically called after a user authenticates via LoginRadius for the first time.

**Role Required:** `finance_admin` (no scope check)

**Request Body:**
```json
{
  "email": "newuser@example.com",
  "fullName": "Jane Doe",
  "department": "Engineering",
  "managerId": "manager-uuid-here",
  "lrUserId": "lr-user-id-from-loginradius"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `email` | string | Yes | Valid email address |
| `fullName` | string | Yes | Non-empty |
| `department` | string | No | Non-empty if provided |
| `managerId` | string | No | Must be a valid existing user ID |
| `lrUserId` | string | Yes | LoginRadius user ID; must be unique |

**Response (201):**
```json
{
  "success": true,
  "data": {
    "userId": "generated-uuid",
    "email": "newuser@example.com",
    "fullName": "Jane Doe",
    "department": "Engineering",
    "managerId": "manager-uuid-here",
    "lrUserId": "lr-user-id-from-loginradius",
    "createdAt": "2026-02-15T10:30:00.000Z",
    "updatedAt": "2026-02-15T10:30:00.000Z"
  }
}
```

---

## MCP Tools

MCP tools provide AI agent integration for expense management workflows.

### who_am_i
Returns the authenticated user's profile information. No scope required.

**Input Schema:** None (no parameters)

**Response:**
```json
{
  "name": "Alice Johnson",
  "email": "alice@example.com",
  "department": "Engineering",
  "manager": "Bob Smith"
}
```

`manager` is `null` if the user has no manager.

---

### submit_expense
Submit a new expense for approval.

**Scope Required:** `expense:submit`

**Input Schema:**
```typescript
{
  category: "Meals" | "Travel" | "Office Supplies" | "Software" | "Training"
  amount: number              // Positive number
  currency?: string           // ISO 4217 code, default: "USD"
  description: string         // 10-500 characters
  expense_date: string        // YYYY-MM-DD format
  receipt_url?: string        // Valid URL (required for Meals, Travel, Training)
}
```

**Response:**
```json
{
  "success": true,
  "message": "Expense submitted successfully",
  "data": {
    "expense_id": "550e8400-e29b-41d4-a716-446655440000",
    "category": "Meals",
    "amount": 45.50,
    "currency": "USD",
    "description": "Team lunch at downtown restaurant",
    "expense_date": "2026-02-15",
    "receipt_url": "https://example.com/receipts/receipt-123.pdf",
    "status": "pending",
    "submitted_at": "2026-02-15T10:30:00.000Z"
  }
}
```

---

### list_my_expenses
List the authenticated user's own expenses.

**Scope Required:** `expense:view:own`

**Input Schema:**
```typescript
{
  status?: Array<"pending" | "approved" | "rejected" | "paid">
  from_date?: string          // YYYY-MM-DD
  to_date?: string            // YYYY-MM-DD
  page?: number               // Default: 1
  limit?: number              // Default: 20, max: 100
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "expenses": [
      {
        "expense_id": "...",
        "category": "Meals",
        "amount": 45.50,
        "currency": "USD",
        "description": "...",
        "expense_date": "2026-02-15",
        "receipt_url": "...",
        "status": "pending",
        "submitted_at": "2026-02-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "current_page": 1,
      "total_pages": 3,
      "total_items": 45,
      "items_per_page": 20
    },
    "summary": {
      "total_amount": 2340.75,
      "pending_amount": 450.00,
      "approved_amount": 1890.75,
      "rejected_amount": 0.00
    }
  }
}
```

---

### list_team_expenses
List team expenses (managers and finance admins only).

**Scope Required:** `expense:view:team`
**Role Required:** `manager` or `finance_admin`

**Input Schema:**
```typescript
{
  team_id?: string            // Manager's user ID (defaults to the authenticated user)
  status?: Array<"pending" | "approved" | "rejected" | "paid">
  from_date?: string          // YYYY-MM-DD
  to_date?: string            // YYYY-MM-DD
  submitter_id?: string       // Filter by specific team member
  page?: number               // Default: 1
  limit?: number              // Default: 20, max: 100
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "team_name": "manager-user-id",
    "expenses": [
      {
        "expense_id": "...",
        "submitter": {
          "user_id": "user-123",
          "full_name": "Alice Johnson",
          "email": "alice@example.com"
        },
        "category": "Meals",
        "amount": 45.50,
        "currency": "USD",
        "description": "...",
        "expense_date": "2026-02-15",
        "receipt_url": "...",
        "status": "pending",
        "submitted_at": "2026-02-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "current_page": 1,
      "total_pages": 2,
      "total_items": 30,
      "items_per_page": 20
    },
    "summary": {
      "total_amount": 1500.00,
      "pending_amount": 300.00,
      "approved_amount": 1200.00
    }
  }
}
```

`team_name` is `"All Teams"` when no `team_id` is provided.

---

### approve_expense
Approve a pending expense.

**Scope Required:** `expense:approve`
**Role Required:** `manager` or `finance_admin`

**Input Schema:**
```typescript
{
  expense_id: string          // UUID of the expense
  notes?: string              // Max 500 characters
}
```

**Response:**
```json
{
  "success": true,
  "message": "Expense approved successfully",
  "data": {
    "expense_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "approved",
    "approved_at": "2026-02-15T14:20:00.000Z",
    "approver_id": "manager-456",
    "notes": "Approved for team event"
  }
}
```

---

### reject_expense
Reject a pending expense.

**Scope Required:** `expense:approve`
**Role Required:** `manager` or `finance_admin`

**Input Schema:**
```typescript
{
  expense_id: string          // UUID of the expense
  reason: string              // Required, 10-500 characters
}
```

**Response:**
```json
{
  "success": true,
  "message": "Expense rejected successfully",
  "data": {
    "expense_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "rejected",
    "rejected_at": "2026-02-15T14:20:00.000Z",
    "rejector_id": "manager-456",
    "reason": "Receipt not legible"
  }
}
```

---

### generate_report
Generate comprehensive expense reports. (Note: MCP tool name is `generate_report`, not `generate_expense_report`.)

**Scope Required:** `expense:report` (MCP scope mapping for `expense:report:generate`)
**Role Required:** `finance_admin`

**Input Schema:**
```typescript
{
  report_type?: "summary" | "detailed" | "by_category"  // Default: "summary"
  from_date: string           // YYYY-MM-DD
  to_date: string             // YYYY-MM-DD
  department?: string         // Optional department filter
  status?: "pending" | "approved" | "rejected" | "paid"
}
```

**Response:** Full `ReportResponse` object (same as REST API `POST /api/expenses/reports/generate`).

---

## Error Responses

All endpoints return errors in a consistent format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  }
}
```

**Common Error Codes:**
- `UNAUTHORIZED`: Missing or invalid authentication token
- `FORBIDDEN`: Insufficient permissions for the requested operation
- `NOT_FOUND`: Resource not found
- `VALIDATION_ERROR`: Invalid input parameters
- `CONFLICT`: State conflict (e.g., approving an already-approved expense)
- `INTERNAL_ERROR`: Server-side error

**HTTP Status Codes:**
- `200`: Success
- `201`: Created
- `400`: Bad Request (validation error)
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `409`: Conflict
- `500`: Internal Server Error

---

## Security Features

### Authentication
- JWT-based authentication via LoginRadius (OIDC; public keys fetched from `LR_ISSUER/.well-known/openid-configuration`)
- Token validated against LoginRadius JWKS on every request
- User matched by `sub` claim (LoginRadius user ID) or email fallback
- User must be pre-registered via `POST /api/users/register`

### Authorization
- Scope-based permissions (OAuth 2.1)
- Role-based access control (RBAC)
- Resource-level access checks (e.g., manager can only approve direct reports)
- Self-approval prevention

### Audit Logging
All mutations are logged to the `audit_log` table:
- Expense submission (`expense:submit`)
- Approval/rejection actions (`expense:approve` / `expense:reject`)
- Report generation (`report:generate`)

### Data Validation
- Input validation using Zod schemas
- SQL injection protection via prepared statements
- Amount limit enforcement per category
- Receipt requirement enforcement per category

---

## Database Schema

### Tables
- `users`: User accounts (`userId`, `email`, `fullName`, `department`, `managerId`, `lrUserId`)
- `expenses`: Expense records
- `expense_categories`: Predefined expense categories
- `expense_approvals`: Approval/rejection history
- `audit_logs`: Audit trail for all mutations

### Relationships
- Expenses belong to users (submitter)
- Expenses belong to categories
- Approvals belong to expenses and approvers (users)
- Users may have a manager (self-referential FK on `manager_id`)
- Audit logs track user actions on resources

---

## Development

### Prerequisites
- Node.js with pnpm
- Scalekit account with credentials

### Quick Start
```bash
# Install dependencies
pnpm install

# Setup environment
cp .env.example .env
# Edit .env with your Scalekit credentials

# Seed database
pnpm run db:seed

# Start development server
pnpm run dev
```

### Available Commands
```bash
pnpm run dev         # Start development server (tsx watch, port 3000)
pnpm run build       # Compile TS to dist/
pnpm run db:seed     # Seed database with test data
pnpm run db:reset    # Drop tables and reseed
pnpm run typecheck   # tsc --noEmit
pnpm run lint        # ESLint
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `LR_ISSUER` | Yes | LoginRadius issuer URL (OIDC base URL) |
| `LR_INTROSPECT_URL` | Yes | LoginRadius token introspection endpoint |
| `LR_JWKS_URI` | Yes | LoginRadius JWKS endpoint |
| `LR_CLIENT_ID` | Yes | LoginRadius client ID |
| `LR_CLIENT_SECRET` | Yes | LoginRadius client secret |
| `LR_TOKEN_ENDPOINT_AUTH_METHOD` | No | `client_secret_post` (default) or `client_secret_basic` |
| `MCP_RESOURCE_URL` | Yes | Public URL of this MCP server (e.g. `http://localhost:3001/mcp`) |
| `PROTECTED_RESOURCE_METADATA` | Yes | JSON string for OAuth protected resource metadata |
| `SERVER_URL` | No | Server base URL, default: `http://localhost:3001` |
| `PORT` | No | Server port, default: 3001 |
| `DATABASE_PATH` | No | SQLite file path, default: `./data/expense.db` |
| `CORS_ORIGIN` | No | CORS allowed origin, default: `*` |
| `NODE_ENV` | No | `development` \| `production` \| `test` |

---

## Test Data (after db:seed)

**Users:**
- Carol (finance_admin)
- Bob (engineering manager)
- Alice, Dave (engineering employees, report to Bob)
- Eve (sales manager)
- Frank (sales employee, reports to Eve)

**Categories:** Meals ($100), Travel ($5000), Office Supplies ($500), Software ($1000), Training ($3000)

---

## Changelog

### Version 1.0.0 (2026-02-15)
- Initial release
- REST API with full CRUD operations
- MCP server for AI agent integration (7 tools)
- LoginRadius authentication (OIDC/JWKS JWT validation)
- LoginRadius user registration integration (`lrUserId` field)
- SQLite database with WAL mode
- Audit logging for all mutations
- Multi-role RBAC support
