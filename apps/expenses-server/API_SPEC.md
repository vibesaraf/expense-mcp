# Expense Management API Specification

Version: 1.0.0

## Overview

The Expense Management Server provides a dual-interface architecture combining REST API endpoints and MCP (Model Context Protocol) tools for AI agent integration. It features Scalekit-based authentication with JWT validation and role-based access control (RBAC).

**Base URLs:**
- REST API: `http://localhost:3000/api`
- MCP Server: `http://localhost:3000/mcp`

**Database:** SQLite (file-based, zero configuration)

---

## Authentication

All endpoints require authentication via Scalekit JWT tokens.

**Headers Required:**
```
Authorization: Bearer <jwt_token>
```

**Token Claims:**
- `sub` / `clientId`: User ID
- `email`: User email
- `name`: User full name
- `scopes`: Array of permission scopes

---

## User Roles & Permissions

| Role | Permissions |
|------|-------------|
| `employee` | Submit expenses, view own expenses |
| `manager` | All employee permissions + view/approve team expenses |
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
Get server health status.

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
Get API information and available endpoints.

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
      "reports": "/api/expenses/reports"
    },
    "documentation": "/api/docs"
  }
}
```

---

### Expenses

#### POST /api/expenses
Submit a new expense for approval.

**Scope Required:** `expense:submit`

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

**Response:**
```json
{
  "success": true,
  "data": {
    "expenseId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "pending",
    "submittedAt": "2026-02-15T10:30:00.000Z"
  }
}
```

---

#### GET /api/expenses/me
List your own expenses.

**Scope Required:** `expense:view:own`

**Query Parameters:**
- `status`: Filter by status (comma-separated)
- `fromDate`: Start date (YYYY-MM-DD)
- `toDate`: End date (YYYY-MM-DD)
- `categoryId`: Category IDs (comma-separated)
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)

**Response:**
```json
{
  "success": true,
  "data": {
    "expenses": [
      {
        "expenseId": "550e8400-e29b-41d4-a716-446655440000",
        "category": "Meals",
        "amount": 45.50,
        "currency": "USD",
        "description": "Team lunch at downtown restaurant",
        "expenseDate": "2026-02-15",
        "receiptUrl": "https://example.com/receipts/receipt-123.pdf",
        "status": "pending",
        "submittedAt": "2026-02-15T10:30:00.000Z"
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
      "approvedAmount": 1890.75
    }
  }
}
```

---

#### GET /api/expenses/team/:teamId
List team expenses (managers only).

**Scope Required:** `expense:view:team`
**Role Required:** `manager` or `finance_admin`

**Query Parameters:** Same as `/api/expenses/me`

**Response:** Same structure as `/api/expenses/me` with additional submitter info per expense.

---

#### GET /api/expenses/all
List all expenses across the organization (finance admin only).

**Scope Required:** `expense:view:all`
**Role Required:** `finance_admin`

**Query Parameters:**
- All parameters from `/api/expenses/me`
- `department`: Filter by department (comma-separated)
- `submitterId`: Filter by submitter user ID

**Response:** Same structure as `/api/expenses/team/:teamId`

---

#### GET /api/expenses/:expenseId
Get detailed information about a specific expense.

**Scope Required:** `expense:view:own`, `expense:view:team`, or `expense:view:all`

**Response:**
```json
{
  "success": true,
  "data": {
    "expenseId": "550e8400-e29b-41d4-a716-446655440000",
    "category": "Meals",
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
      "fullName": "John Doe",
      "email": "john@example.com",
      "department": "Engineering"
    },
    "approvalHistory": [
      {
        "approver": {
          "userId": "manager-456",
          "fullName": "Jane Smith",
          "email": "jane@example.com"
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
**Role Required:** `manager` or `finance_admin`

**Request Body:**
```json
{
  "notes": "Approved for quarterly team building"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "expenseId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "approved",
    "approvedBy": "manager-456",
    "approvedAt": "2026-02-15T14:20:00.000Z"
  }
}
```

---

#### POST /api/expenses/:expenseId/reject
Reject a pending expense.

**Scope Required:** `expense:approve`
**Role Required:** `manager` or `finance_admin`

**Request Body:**
```json
{
  "reason": "Receipt not clear, please resubmit with better quality"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "expenseId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "rejected",
    "rejectedBy": "manager-456",
    "rejectedAt": "2026-02-15T14:20:00.000Z"
  }
}
```

---

### Categories

#### GET /api/categories
List all expense categories.

**Scope Required:** Authenticated user

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
        "maxAmount": 100
      },
      {
        "categoryId": 2,
        "categoryName": "Travel",
        "description": "Transportation and accommodation",
        "requiresReceipt": true,
        "maxAmount": 5000
      }
    ]
  }
}
```

---

### Reports

#### POST /api/expenses/reports/generate
Generate expense reports (finance admin only).

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

**Report Types:**
- `summary`: Aggregated statistics
- `detailed`: Full expense list with details
- `by_category`: Breakdown by category

**Formats:**
- `json`: JSON response (default)
- `csv`: CSV file download
- `pdf`: PDF file download

**Response:**
```json
{
  "success": true,
  "data": {
    "reportId": "report-789",
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
      "fullName": "Finance Admin"
    }
  }
}
```

---

## MCP Tools

MCP tools provide AI agent integration for expense management workflows.

### submit_expense
Submit a new expense for approval.

**Scope Required:** `expense:submit`

**Input Schema:**
```typescript
{
  category: "Meals" | "Travel" | "Office Supplies" | "Software" | "Training"
  amount: number              // Positive number
  currency?: string           // ISO 4217 code (default: USD)
  description: string         // 10-500 characters
  expense_date: string        // YYYY-MM-DD format
  receipt_url?: string        // URL to receipt (optional)
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
  status?: "pending" | "approved" | "rejected" | "paid"
  from_date?: string          // YYYY-MM-DD
  to_date?: string            // YYYY-MM-DD
  limit?: number              // Default: 20, max: 100
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "expenses": [...],
    "total_count": 45,
    "summary": {
      "total_amount": 2340.75,
      "pending_amount": 450.00,
      "approved_amount": 1890.75
    }
  }
}
```

---

### list_team_expenses
List team expenses (managers only).

**Scope Required:** `expense:view:team`
**Role Required:** `manager` or `finance_admin`

**Input Schema:**
```typescript
{
  team_id: string             // Team/department identifier
  status?: "pending" | "approved" | "rejected" | "paid"
  from_date?: string          // YYYY-MM-DD
  to_date?: string            // YYYY-MM-DD
  limit?: number              // Default: 20, max: 100
}
```

**Response:** Similar to `list_my_expenses` with submitter details.

---

### approve_expense
Approve a pending expense.

**Scope Required:** `expense:approve`
**Role Required:** `manager` or `finance_admin`

**Input Schema:**
```typescript
{
  expense_id: string
  notes?: string              // Optional approval notes
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
    "approved_at": "2026-02-15T14:20:00.000Z"
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
  expense_id: string
  reason: string              // Required rejection reason
}
```

**Response:**
```json
{
  "success": true,
  "message": "Expense rejected",
  "data": {
    "expense_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "rejected",
    "rejected_at": "2026-02-15T14:20:00.000Z"
  }
}
```

---

### generate_expense_report
Generate comprehensive expense reports (finance admin only).

**Scope Required:** `expense:report:generate`
**Role Required:** `finance_admin`

**Input Schema:**
```typescript
{
  report_type: "summary" | "detailed" | "by_category"
  from_date: string           // YYYY-MM-DD
  to_date: string             // YYYY-MM-DD
  department?: string         // Optional department filter
  status?: "pending" | "approved" | "rejected" | "paid"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Report generated successfully",
  "data": {
    "report_id": "report-789",
    "summary": {
      "total_expenses": 127,
      "total_amount": 45678.90,
      "by_category": {...},
      "by_status": {...}
    },
    "generated_at": "2026-02-15T15:00:00.000Z"
  }
}
```

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
- `INTERNAL_ERROR`: Server-side error

**HTTP Status Codes:**
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `500`: Internal Server Error

---

## Security Features

### Authentication
- JWT-based authentication via Scalekit
- Token validation on every request
- Automatic user provisioning from token claims

### Authorization
- Scope-based permissions (OAuth 2.0 style)
- Role-based access control (RBAC)
- Resource-level access checks

### Audit Logging
All critical operations are logged:
- Expense submission
- Approval/rejection actions
- Report generation
- User IP address and user agent tracking

### Data Validation
- Input validation using Zod schemas
- SQL injection protection via prepared statements
- XSS prevention through proper encoding

---

## Database Schema

### Tables
- `users`: User accounts and profiles
- `expenses`: Expense records
- `expense_categories`: Predefined expense categories
- `expense_approvals`: Approval/rejection history
- `audit_logs`: Audit trail for all actions

### Relationships
- Expenses belong to users (submitter)
- Expenses belong to categories
- Approvals belong to expenses and approvers (users)
- Audit logs track user actions on resources

---

## Development

### Prerequisites
- Bun runtime
- Scalekit account with credentials

### Quick Start
```bash
# Install dependencies
bun install

# Setup environment
cp .env.example .env
# Edit .env with your Scalekit credentials

# Seed database
bun run db:seed

# Start development server
bun run dev
```

### Available Commands
```bash
bun run dev         # Start development server
bun run build       # Build for production
bun run start       # Run production server
bun run db:seed     # Seed database with test data
bun run db:reset    # Reset and reseed database
bun run typecheck   # TypeScript type checking
bun run lint        # ESLint code linting
```

---

## Rate Limiting & Quotas

Currently not implemented. Future versions may include:
- Rate limiting per user/API key
- Expense submission quotas
- Report generation limits

---

## Changelog

### Version 1.0.0 (2026-02-15)
- Initial release
- REST API with full CRUD operations
- MCP server for AI agent integration
- Scalekit authentication
- SQLite database
- Audit logging
- Multi-role RBAC support
