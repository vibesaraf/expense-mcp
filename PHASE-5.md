# Phase 5: MCP Tool Implementations

## Overview
This phase implements the 6 MCP tools using the `@descope/mcp-express` SDK. Each tool wraps the corresponding service layer functions, handles scope validation, and integrates with the Descope authentication system.

## Prerequisites
- Phase 0-4 completed
- `@descope/mcp-express` installed
- Descope project configured with MCP Server and scopes
- Service layer functions working

---

## Understanding @descope/mcp-express

### Key Concepts

The `@descope/mcp-express` SDK provides:
1. **`DescopeMcpProvider`** - Configuration for MCP + Descope integration
2. **`descopeMcpAuthRouter`** - Express router that handles OAuth metadata endpoints and `/mcp` endpoint
3. **`defineTool`** - Helper to create authenticated MCP tools with scope requirements
4. **`registerAuthenticatedTool`** - Alternative API for tool registration

### How It Works

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Express Server                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  descopeMcpAuthRouter                                        │   │
│  │                                                              │   │
│  │  Endpoints:                                                  │   │
│  │  - GET /.well-known/oauth-protected-resource (RFC 8705)     │   │
│  │  - GET /.well-known/oauth-authorization-server (RFC 8414)   │   │
│  │  - POST /mcp (MCP protocol endpoint)                        │   │
│  │                                                              │   │
│  │  On /mcp request:                                           │   │
│  │  1. Extract Bearer token                                     │   │
│  │  2. Validate token with Descope                             │   │
│  │  3. Check required scopes for tool                          │   │
│  │  4. Execute tool handler with authInfo                      │   │
│  │  5. Return CallToolResult                                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Step 1: Configure MCP Provider

### File: `src/mcp/provider.ts`

```typescript
// =============================================================================
// MCP Provider Configuration
// =============================================================================
// This file configures the DescopeMcpProvider which handles:
// - OAuth 2.1 metadata endpoints
// - Bearer token validation
// - Scope enforcement
// =============================================================================

import { DescopeMcpProvider } from "@descope/mcp-express";
import { config } from "../config";

/**
 * MCP Provider Configuration
 * 
 * The provider runs in "Resource Server" mode by default (recommended).
 * This means:
 * - It exposes OAuth metadata endpoints
 * - It validates Bearer tokens on /mcp requests
 * - Authorization Server features are handled by Descope
 * 
 * Scopes are defined in the Descope Console under "Inbound Apps" → "MCP Server"
 */
export const mcpProvider = new DescopeMcpProvider({
  // Required: Your Descope Project ID
  projectId: config.descope.projectId,
  
  // Required: The public URL of your MCP server
  // Used in OAuth metadata endpoints
  serverUrl: config.server.url,
  
  // Optional: Custom Descope base URL (for self-hosted or regional deployments)
  // baseUrl: config.descope.baseUrl,
  
  // Optional: Token verification options
  verifyTokenOptions: {
    // Scopes that are required for ALL tools by default
    // Individual tools can override this with their own scope requirements
    // requiredScopes: ["openid"],
    
    // Optional: Resource indicator for RFC 8707 compliance
    // resourceIndicator: config.server.url,
    
    // Optional: Expected audience claim in the token
    // audience: config.descope.projectId,
  },
});

/**
 * Scope Constants
 * 
 * These must match the scopes configured in Descope Console:
 * 1. Go to Descope Console → Inbound Apps
 * 2. Create an MCP Server
 * 3. Define these scopes with descriptions
 */
export const MCP_SCOPES = {
  // Basic scopes
  OPENID: "openid",
  
  // Expense submission
  EXPENSE_SUBMIT: "expense:submit",
  
  // Expense viewing
  EXPENSE_VIEW_OWN: "expense:view:own",
  EXPENSE_VIEW_TEAM: "expense:view:team",
  EXPENSE_VIEW_ALL: "expense:view:all",
  
  // Expense approval
  EXPENSE_APPROVE: "expense:approve",
  
  // Report generation
  EXPENSE_REPORT: "expense:report:generate",
} as const;

export type McpScope = (typeof MCP_SCOPES)[keyof typeof MCP_SCOPES];
```

---

## Step 2: Create Tool Type Definitions

### File: `src/mcp/types.ts`

```typescript
// =============================================================================
// MCP Tool Type Definitions
// =============================================================================

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * Authentication info provided by Descope MCP Express
 * Available in tool handlers via `extra.authInfo`
 */
export interface McpAuthInfo {
  /** The client ID (user ID from Descope) */
  clientId: string;
  
  /** Scopes granted to this token */
  scopes: string[];
  
  /** Token expiration timestamp */
  expiresAt?: number;
  
  /** Raw token claims (varies based on Descope configuration) */
  claims?: Record<string, unknown>;
}

/**
 * Extra context passed to tool handlers
 */
export interface McpToolExtra {
  /** Authentication information from the validated token */
  authInfo: McpAuthInfo;
  
  /** 
   * Get an outbound token for calling external APIs
   * Only available if Descope Outbound Apps is configured
   */
  getOutboundToken?: (appId: string, scopes?: string[]) => Promise<string>;
}

/**
 * Tool handler function signature (with input)
 */
export type ToolHandlerWithInput<TArgs> = (
  args: TArgs,
  extra: McpToolExtra
) => Promise<CallToolResult>;

/**
 * Tool handler function signature (without input)
 */
export type ToolHandlerNoInput = (
  extra: McpToolExtra
) => Promise<CallToolResult>;

/**
 * Helper to create a successful text response
 */
export function createTextResponse(data: unknown): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

/**
 * Helper to create an error response
 */
export function createErrorResponse(
  error: string,
  details?: unknown
): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            error,
            details,
          },
          null,
          2
        ),
      },
    ],
    isError: true,
  };
}
```

---

## Step 3: Implement MCP Tools

### Tool 1: Submit Expense

### File: `src/mcp/tools/submit-expense.tool.ts`

```typescript
// =============================================================================
// MCP Tool: Submit Expense
// =============================================================================
// Allows employees to submit new expenses for approval
// Required Scope: expense:submit
// =============================================================================

import { defineTool } from "@descope/mcp-express";
import { z } from "zod";
import { expenseService } from "../../services/expense.service";
import { MCP_SCOPES } from "../provider";
import { createTextResponse, createErrorResponse } from "../types";
import { DEFAULT_CATEGORIES } from "../../config/constants";

/**
 * Input schema for submit_expense tool
 * Validated at runtime by Zod
 */
const submitExpenseInput = {
  category: z
    .enum(DEFAULT_CATEGORIES as [string, ...string[]])
    .describe("Expense category (Meals, Travel, Office Supplies, Software, Training)"),
  
  amount: z
    .number()
    .positive()
    .describe("Expense amount in USD (must be greater than 0)"),
  
  currency: z
    .string()
    .length(3)
    .default("USD")
    .describe("Currency code (ISO 4217, e.g., USD, EUR)"),
  
  description: z
    .string()
    .min(10)
    .max(500)
    .describe("Detailed description of the expense (10-500 characters)"),
  
  expense_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe("Date when expense occurred (YYYY-MM-DD format)"),
  
  receipt_url: z
    .string()
    .url()
    .optional()
    .describe("URL to receipt image or PDF (optional for small amounts)"),
};

/**
 * Submit Expense Tool
 * 
 * @scope expense:submit
 * @rbac Any authenticated user can submit expenses
 */
export const submitExpenseTool = defineTool({
  name: "submit_expense",
  
  description: `Submit a new expense for approval. Employees can submit expenses for reimbursement.
  
Categories available:
- Meals: Business meals and client entertainment (max $100, receipt required)
- Travel: Transportation and accommodation (max $5000, receipt required)
- Office Supplies: Stationery, equipment, etc. (max $500)
- Software: Software subscriptions and licenses (max $1000)
- Training: Courses, conferences, certifications (max $3000, receipt required)

The expense will be created with 'pending' status and routed to the appropriate manager for approval.`,
  
  input: submitExpenseInput,
  
  scopes: [MCP_SCOPES.EXPENSE_SUBMIT],
  
  handler: async (args, extra) => {
    try {
      // Get user ID from auth info
      const userId = extra.authInfo.clientId;
      
      if (!userId) {
        return createErrorResponse("Authentication required", {
          code: "UNAUTHORIZED",
        });
      }
      
      // Call service layer to create expense
      const result = await expenseService.submitExpense(
        {
          categoryName: args.category,
          amount: args.amount,
          currency: args.currency || "USD",
          description: args.description,
          expenseDate: args.expense_date,
          receiptUrl: args.receipt_url,
        },
        userId
      );
      
      return createTextResponse({
        success: true,
        message: "Expense submitted successfully",
        data: {
          expense_id: result.expenseId,
          category: args.category,
          amount: args.amount,
          currency: args.currency || "USD",
          description: args.description,
          expense_date: args.expense_date,
          receipt_url: args.receipt_url,
          status: "pending",
          submitted_at: result.submittedAt,
        },
      });
    } catch (error) {
      // Handle known error types
      if (error instanceof Error) {
        if (error.message.includes("Category not found")) {
          return createErrorResponse("Invalid category", {
            code: "VALIDATION_ERROR",
            message: error.message,
            valid_categories: DEFAULT_CATEGORIES,
          });
        }
        
        if (error.message.includes("exceeds maximum")) {
          return createErrorResponse("Amount exceeds limit", {
            code: "VALIDATION_ERROR",
            message: error.message,
          });
        }
        
        if (error.message.includes("receipt required")) {
          return createErrorResponse("Receipt required", {
            code: "VALIDATION_ERROR",
            message: error.message,
          });
        }
        
        return createErrorResponse("Failed to submit expense", {
          code: "INTERNAL_ERROR",
          message: error.message,
        });
      }
      
      return createErrorResponse("An unexpected error occurred", {
        code: "INTERNAL_ERROR",
      });
    }
  },
});
```

---

### Tool 2: List My Expenses

### File: `src/mcp/tools/list-my-expenses.tool.ts`

```typescript
// =============================================================================
// MCP Tool: List My Expenses
// =============================================================================
// Allows users to view their own submitted expenses
// Required Scope: expense:view:own
// =============================================================================

import { defineTool } from "@descope/mcp-express";
import { z } from "zod";
import { expenseService } from "../../services/expense.service";
import { MCP_SCOPES } from "../provider";
import { createTextResponse, createErrorResponse } from "../types";
import { ExpenseStatus } from "../../config/constants";

/**
 * Input schema for list_my_expenses tool
 */
const listMyExpensesInput = {
  status: z
    .array(z.enum(["pending", "approved", "rejected", "paid"]))
    .optional()
    .describe("Filter by expense status (optional, can specify multiple)"),
  
  from_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Start date for filtering (YYYY-MM-DD)"),
  
  to_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("End date for filtering (YYYY-MM-DD)"),
  
  category: z
    .array(z.string())
    .optional()
    .describe("Filter by category names"),
  
  page: z
    .number()
    .int()
    .positive()
    .default(1)
    .describe("Page number for pagination (default: 1)"),
  
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Number of results per page (1-100, default: 20)"),
};

/**
 * List My Expenses Tool
 * 
 * @scope expense:view:own
 * @rbac Any authenticated user can view their own expenses
 */
export const listMyExpensesTool = defineTool({
  name: "list_my_expenses",
  
  description: `View your own submitted expenses with optional filters for status and date range.

Returns a paginated list of expenses with:
- Expense details (category, amount, description, date)
- Current status (pending, approved, rejected, paid)
- Summary totals (total amount, pending amount, approved amount)

Use this tool to check the status of your submitted expenses or review your expense history.`,
  
  input: listMyExpensesInput,
  
  scopes: [MCP_SCOPES.EXPENSE_VIEW_OWN],
  
  handler: async (args, extra) => {
    try {
      const userId = extra.authInfo.clientId;
      
      if (!userId) {
        return createErrorResponse("Authentication required", {
          code: "UNAUTHORIZED",
        });
      }
      
      // Build filter options
      const filters = {
        status: args.status as ExpenseStatus[] | undefined,
        fromDate: args.from_date,
        toDate: args.to_date,
        categories: args.category,
        page: args.page || 1,
        limit: args.limit || 20,
      };
      
      // Call service layer
      const result = await expenseService.getMyExpenses(userId, filters);
      
      return createTextResponse({
        success: true,
        data: {
          expenses: result.expenses.map((expense) => ({
            expense_id: expense.expenseId,
            category: expense.categoryName,
            amount: expense.amount,
            currency: expense.currency,
            description: expense.description,
            expense_date: expense.expenseDate,
            receipt_url: expense.receiptUrl,
            status: expense.status,
            submitted_at: expense.submittedAt,
          })),
          pagination: {
            current_page: result.pagination.currentPage,
            total_pages: result.pagination.totalPages,
            total_items: result.pagination.totalItems,
            items_per_page: result.pagination.itemsPerPage,
          },
          summary: {
            total_amount: result.summary.totalAmount,
            pending_amount: result.summary.pendingAmount,
            approved_amount: result.summary.approvedAmount,
            rejected_amount: result.summary.rejectedAmount,
            expense_count: result.summary.expenseCount,
          },
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        return createErrorResponse("Failed to fetch expenses", {
          code: "INTERNAL_ERROR",
          message: error.message,
        });
      }
      
      return createErrorResponse("An unexpected error occurred", {
        code: "INTERNAL_ERROR",
      });
    }
  },
});
```

---

### Tool 3: List Team Expenses

### File: `src/mcp/tools/list-team-expenses.tool.ts`

```typescript
// =============================================================================
// MCP Tool: List Team Expenses
// =============================================================================
// Allows managers to view expenses submitted by their team members
// Required Scope: expense:view:team
// =============================================================================

import { defineTool } from "@descope/mcp-express";
import { z } from "zod";
import { expenseService } from "../../services/expense.service";
import { userRepository } from "../../db/repositories";
import { MCP_SCOPES } from "../provider";
import { createTextResponse, createErrorResponse } from "../types";
import { ExpenseStatus, UserRole } from "../../config/constants";

/**
 * Input schema for list_team_expenses tool
 */
const listTeamExpensesInput = {
  team_id: z
    .string()
    .optional()
    .describe("Team/department ID (optional, defaults to your managed team)"),
  
  status: z
    .array(z.enum(["pending", "approved", "rejected", "paid"]))
    .optional()
    .describe("Filter by expense status"),
  
  from_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Start date for filtering (YYYY-MM-DD)"),
  
  to_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("End date for filtering (YYYY-MM-DD)"),
  
  submitter_id: z
    .string()
    .optional()
    .describe("Filter by specific team member"),
  
  page: z
    .number()
    .int()
    .positive()
    .default(1)
    .describe("Page number for pagination"),
  
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Number of results per page (1-100)"),
};

/**
 * List Team Expenses Tool
 * 
 * @scope expense:view:team
 * @rbac Only managers and finance_admins can use this tool
 */
export const listTeamExpensesTool = defineTool({
  name: "list_team_expenses",
  
  description: `View expenses submitted by your team members. Only available to managers and finance admins.

As a manager, you can:
- View all expenses from your direct reports
- Filter by status to see pending approvals
- Review expense details before approving/rejecting

Finance admins can view expenses across all teams.

Note: You can only view expenses from users who report to you directly (your team).`,
  
  input: listTeamExpensesInput,
  
  scopes: [MCP_SCOPES.EXPENSE_VIEW_TEAM],
  
  handler: async (args, extra) => {
    try {
      const userId = extra.authInfo.clientId;
      
      if (!userId) {
        return createErrorResponse("Authentication required", {
          code: "UNAUTHORIZED",
        });
      }
      
      // Get user to check role
      const user = await userRepository.findById(userId);
      
      if (!user) {
        return createErrorResponse("User not found", {
          code: "NOT_FOUND",
        });
      }
      
      // Check RBAC: Only managers and finance_admins can view team expenses
      if (user.role !== UserRole.MANAGER && user.role !== UserRole.FINANCE_ADMIN) {
        return createErrorResponse("Access denied", {
          code: "FORBIDDEN",
          message: "Only managers and finance admins can view team expenses",
          required_role: ["manager", "finance_admin"],
          current_role: user.role,
        });
      }
      
      // Determine team/department to query
      let department = args.team_id;
      
      // If no team_id provided, use the manager's department
      if (!department && user.role === UserRole.MANAGER) {
        department = user.department || undefined;
      }
      
      // Finance admin must specify a team_id or gets all
      // (handled in service layer)
      
      const filters = {
        status: args.status as ExpenseStatus[] | undefined,
        fromDate: args.from_date,
        toDate: args.to_date,
        submitterId: args.submitter_id,
        page: args.page || 1,
        limit: args.limit || 20,
      };
      
      // Call service layer
      const result = await expenseService.getTeamExpenses(
        userId,
        user.role,
        department,
        filters
      );
      
      return createTextResponse({
        success: true,
        data: {
          team_name: department || "All Teams",
          expenses: result.expenses.map((expense) => ({
            expense_id: expense.expenseId,
            submitter: {
              user_id: expense.submitterId,
              full_name: expense.submitterName,
              email: expense.submitterEmail,
            },
            category: expense.categoryName,
            amount: expense.amount,
            currency: expense.currency,
            description: expense.description,
            expense_date: expense.expenseDate,
            receipt_url: expense.receiptUrl,
            status: expense.status,
            submitted_at: expense.submittedAt,
          })),
          pagination: {
            current_page: result.pagination.currentPage,
            total_pages: result.pagination.totalPages,
            total_items: result.pagination.totalItems,
            items_per_page: result.pagination.itemsPerPage,
          },
          summary: {
            total_amount: result.summary.totalAmount,
            pending_amount: result.summary.pendingAmount,
            approved_amount: result.summary.approvedAmount,
            expense_count: result.summary.expenseCount,
          },
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("not authorized")) {
          return createErrorResponse("Access denied", {
            code: "FORBIDDEN",
            message: error.message,
          });
        }
        
        return createErrorResponse("Failed to fetch team expenses", {
          code: "INTERNAL_ERROR",
          message: error.message,
        });
      }
      
      return createErrorResponse("An unexpected error occurred", {
        code: "INTERNAL_ERROR",
      });
    }
  },
});
```

---

### Tool 4: Approve Expense

### File: `src/mcp/tools/approve-expense.tool.ts`

```typescript
// =============================================================================
// MCP Tool: Approve Expense
// =============================================================================
// Allows managers/finance admins to approve pending expenses
// Required Scope: expense:approve
// =============================================================================

import { defineTool } from "@descope/mcp-express";
import { z } from "zod";
import { expenseService } from "../../services/expense.service";
import { userRepository } from "../../db/repositories";
import { MCP_SCOPES } from "../provider";
import { createTextResponse, createErrorResponse } from "../types";
import { UserRole } from "../../config/constants";

/**
 * Input schema for approve_expense tool
 */
const approveExpenseInput = {
  expense_id: z
    .string()
    .uuid()
    .describe("Unique identifier (UUID) of the expense to approve"),
  
  notes: z
    .string()
    .max(500)
    .optional()
    .describe("Optional notes about the approval (max 500 characters)"),
};

/**
 * Approve Expense Tool
 * 
 * @scope expense:approve
 * @rbac Only managers and finance_admins can approve expenses
 * @rules
 * - Managers can only approve expenses from their direct reports
 * - Finance admins can approve any expense
 * - Cannot approve your own expenses
 * - Can only approve expenses in 'pending' status
 */
export const approveExpenseTool = defineTool({
  name: "approve_expense",
  
  description: `Approve a pending expense. Only managers and finance admins can approve expenses.

Rules:
- Managers can only approve expenses from their direct reports
- Finance admins can approve any expense in the organization
- You cannot approve your own expenses
- Only expenses in 'pending' status can be approved

Once approved, the expense will be queued for payment processing.`,
  
  input: approveExpenseInput,
  
  scopes: [MCP_SCOPES.EXPENSE_APPROVE],
  
  handler: async (args, extra) => {
    try {
      const userId = extra.authInfo.clientId;
      
      if (!userId) {
        return createErrorResponse("Authentication required", {
          code: "UNAUTHORIZED",
        });
      }
      
      // Get user to check role
      const user = await userRepository.findById(userId);
      
      if (!user) {
        return createErrorResponse("User not found", {
          code: "NOT_FOUND",
        });
      }
      
      // Check RBAC
      if (user.role !== UserRole.MANAGER && user.role !== UserRole.FINANCE_ADMIN) {
        return createErrorResponse("Access denied", {
          code: "FORBIDDEN",
          message: "Only managers and finance admins can approve expenses",
          required_role: ["manager", "finance_admin"],
          current_role: user.role,
        });
      }
      
      // Call service layer to approve
      const result = await expenseService.approveExpense(
        args.expense_id,
        userId,
        user.role,
        args.notes
      );
      
      return createTextResponse({
        success: true,
        message: "Expense approved successfully",
        data: {
          expense_id: args.expense_id,
          status: "approved",
          approver: {
            user_id: userId,
            full_name: user.fullName,
          },
          notes: args.notes || null,
          approved_at: result.approvedAt,
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        // Handle specific error cases
        if (error.message.includes("not found")) {
          return createErrorResponse("Expense not found", {
            code: "NOT_FOUND",
            expense_id: args.expense_id,
          });
        }
        
        if (error.message.includes("already approved")) {
          return createErrorResponse("Expense already approved", {
            code: "CONFLICT",
            message: "This expense has already been approved",
          });
        }
        
        if (error.message.includes("own expense")) {
          return createErrorResponse("Cannot approve own expense", {
            code: "FORBIDDEN",
            message: "You cannot approve your own expenses",
          });
        }
        
        if (error.message.includes("not your team member")) {
          return createErrorResponse("Access denied", {
            code: "FORBIDDEN",
            message: "You can only approve expenses from your direct reports",
          });
        }
        
        if (error.message.includes("not pending")) {
          return createErrorResponse("Invalid expense status", {
            code: "CONFLICT",
            message: "Only pending expenses can be approved",
          });
        }
        
        return createErrorResponse("Failed to approve expense", {
          code: "INTERNAL_ERROR",
          message: error.message,
        });
      }
      
      return createErrorResponse("An unexpected error occurred", {
        code: "INTERNAL_ERROR",
      });
    }
  },
});
```

---

### Tool 5: Reject Expense

### File: `src/mcp/tools/reject-expense.tool.ts`

```typescript
// =============================================================================
// MCP Tool: Reject Expense
// =============================================================================
// Allows managers/finance admins to reject pending expenses
// Required Scope: expense:approve
// =============================================================================

import { defineTool } from "@descope/mcp-express";
import { z } from "zod";
import { expenseService } from "../../services/expense.service";
import { userRepository } from "../../db/repositories";
import { MCP_SCOPES } from "../provider";
import { createTextResponse, createErrorResponse } from "../types";
import { UserRole } from "../../config/constants";

/**
 * Input schema for reject_expense tool
 */
const rejectExpenseInput = {
  expense_id: z
    .string()
    .uuid()
    .describe("Unique identifier (UUID) of the expense to reject"),
  
  reason: z
    .string()
    .min(10)
    .max(500)
    .describe("Reason for rejection (required, 10-500 characters)"),
};

/**
 * Reject Expense Tool
 * 
 * @scope expense:approve
 * @rbac Only managers and finance_admins can reject expenses
 * @rules Same as approve_expense
 */
export const rejectExpenseTool = defineTool({
  name: "reject_expense",
  
  description: `Reject a pending expense with a reason. Only managers and finance admins can reject expenses.

A rejection reason is required to help the submitter understand why the expense was not approved.

Common rejection reasons:
- Missing receipt/documentation
- Amount exceeds policy limits
- Not a valid business expense
- Duplicate submission
- Insufficient description

The submitter will be notified of the rejection along with your reason.`,
  
  input: rejectExpenseInput,
  
  scopes: [MCP_SCOPES.EXPENSE_APPROVE],
  
  handler: async (args, extra) => {
    try {
      const userId = extra.authInfo.clientId;
      
      if (!userId) {
        return createErrorResponse("Authentication required", {
          code: "UNAUTHORIZED",
        });
      }
      
      // Get user to check role
      const user = await userRepository.findById(userId);
      
      if (!user) {
        return createErrorResponse("User not found", {
          code: "NOT_FOUND",
        });
      }
      
      // Check RBAC
      if (user.role !== UserRole.MANAGER && user.role !== UserRole.FINANCE_ADMIN) {
        return createErrorResponse("Access denied", {
          code: "FORBIDDEN",
          message: "Only managers and finance admins can reject expenses",
          required_role: ["manager", "finance_admin"],
          current_role: user.role,
        });
      }
      
      // Call service layer to reject
      const result = await expenseService.rejectExpense(
        args.expense_id,
        userId,
        user.role,
        args.reason
      );
      
      return createTextResponse({
        success: true,
        message: "Expense rejected",
        data: {
          expense_id: args.expense_id,
          status: "rejected",
          approver: {
            user_id: userId,
            full_name: user.fullName,
          },
          reason: args.reason,
          rejected_at: result.rejectedAt,
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        // Handle specific error cases (same as approve)
        if (error.message.includes("not found")) {
          return createErrorResponse("Expense not found", {
            code: "NOT_FOUND",
            expense_id: args.expense_id,
          });
        }
        
        if (error.message.includes("already")) {
          return createErrorResponse("Expense already processed", {
            code: "CONFLICT",
            message: error.message,
          });
        }
        
        if (error.message.includes("own expense")) {
          return createErrorResponse("Cannot reject own expense", {
            code: "FORBIDDEN",
            message: "You cannot reject your own expenses",
          });
        }
        
        if (error.message.includes("not your team member")) {
          return createErrorResponse("Access denied", {
            code: "FORBIDDEN",
            message: "You can only reject expenses from your direct reports",
          });
        }
        
        if (error.message.includes("not pending")) {
          return createErrorResponse("Invalid expense status", {
            code: "CONFLICT",
            message: "Only pending expenses can be rejected",
          });
        }
        
        return createErrorResponse("Failed to reject expense", {
          code: "INTERNAL_ERROR",
          message: error.message,
        });
      }
      
      return createErrorResponse("An unexpected error occurred", {
        code: "INTERNAL_ERROR",
      });
    }
  },
});
```

---

### Tool 6: Generate Expense Report

### File: `src/mcp/tools/generate-report.tool.ts`

```typescript
// =============================================================================
// MCP Tool: Generate Expense Report
// =============================================================================
// Allows finance admins to generate comprehensive expense reports
// Required Scope: expense:report:generate
// =============================================================================

import { defineTool } from "@descope/mcp-express";
import { z } from "zod";
import { reportService } from "../../services/report.service";
import { userRepository } from "../../db/repositories";
import { MCP_SCOPES } from "../provider";
import { createTextResponse, createErrorResponse } from "../types";
import { UserRole } from "../../config/constants";

/**
 * Input schema for generate_expense_report tool
 */
const generateReportInput = {
  report_type: z
    .enum(["summary", "detailed", "by_category"])
    .default("summary")
    .describe("Type of report: summary (aggregates), detailed (all expenses), by_category (grouped)"),
  
  from_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe("Report start date (YYYY-MM-DD, required)"),
  
  to_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe("Report end date (YYYY-MM-DD, required)"),
  
  department: z
    .string()
    .optional()
    .describe("Filter by specific department (optional, omit for company-wide)"),
  
  status: z
    .enum(["pending", "approved", "rejected", "paid"])
    .optional()
    .describe("Filter by expense status (optional)"),
};

/**
 * Generate Expense Report Tool
 * 
 * @scope expense:report:generate
 * @rbac Only finance_admins can generate reports
 */
export const generateReportTool = defineTool({
  name: "generate_expense_report",
  
  description: `Generate comprehensive expense reports with summaries and analytics. Only available to finance admins.

Report types:
- summary: High-level totals by category, status, and department
- detailed: Full list of individual expenses with all details
- by_category: Expenses grouped by category with subtotals

Reports include:
- Total amounts and counts
- Breakdown by category
- Breakdown by department
- Breakdown by status
- Period comparison data

Use this for monthly expense reviews, budget tracking, and financial analysis.`,
  
  input: generateReportInput,
  
  scopes: [MCP_SCOPES.EXPENSE_REPORT],
  
  handler: async (args, extra) => {
    try {
      const userId = extra.authInfo.clientId;
      
      if (!userId) {
        return createErrorResponse("Authentication required", {
          code: "UNAUTHORIZED",
        });
      }
      
      // Get user to check role
      const user = await userRepository.findById(userId);
      
      if (!user) {
        return createErrorResponse("User not found", {
          code: "NOT_FOUND",
        });
      }
      
      // Check RBAC: Only finance_admins can generate reports
      if (user.role !== UserRole.FINANCE_ADMIN) {
        return createErrorResponse("Access denied", {
          code: "FORBIDDEN",
          message: "Only finance admins can generate expense reports",
          required_role: "finance_admin",
          current_role: user.role,
        });
      }
      
      // Validate date range
      const fromDate = new Date(args.from_date);
      const toDate = new Date(args.to_date);
      
      if (fromDate > toDate) {
        return createErrorResponse("Invalid date range", {
          code: "VALIDATION_ERROR",
          message: "from_date must be before or equal to to_date",
        });
      }
      
      // Generate report
      const report = await reportService.generateReport({
        reportType: args.report_type,
        fromDate: args.from_date,
        toDate: args.to_date,
        department: args.department,
        status: args.status,
        generatedBy: userId,
      });
      
      return createTextResponse({
        success: true,
        data: {
          report_id: report.reportId,
          report_type: args.report_type,
          period: {
            from_date: args.from_date,
            to_date: args.to_date,
          },
          filters: {
            department: args.department || "all",
            status: args.status || "all",
          },
          summary: report.summary,
          // Include expenses for detailed/by_category reports
          ...(args.report_type !== "summary" && {
            expenses: report.expenses,
          }),
          // Include category breakdown for by_category reports
          ...(args.report_type === "by_category" && {
            by_category: report.byCategory,
          }),
          generated_at: report.generatedAt,
          generated_by: {
            user_id: userId,
            full_name: user.fullName,
          },
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        return createErrorResponse("Failed to generate report", {
          code: "INTERNAL_ERROR",
          message: error.message,
        });
      }
      
      return createErrorResponse("An unexpected error occurred", {
        code: "INTERNAL_ERROR",
      });
    }
  },
});
```

---

## Step 4: Create Tool Index and Registration

### File: `src/mcp/tools/index.ts`

```typescript
// =============================================================================
// MCP Tools Index
// =============================================================================
// Exports all tools and provides a registration function
// =============================================================================

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Import all tools
import { submitExpenseTool } from "./submit-expense.tool";
import { listMyExpensesTool } from "./list-my-expenses.tool";
import { listTeamExpensesTool } from "./list-team-expenses.tool";
import { approveExpenseTool } from "./approve-expense.tool";
import { rejectExpenseTool } from "./reject-expense.tool";
import { generateReportTool } from "./generate-report.tool";

/**
 * All available MCP tools
 */
export const tools = {
  submitExpense: submitExpenseTool,
  listMyExpenses: listMyExpensesTool,
  listTeamExpenses: listTeamExpensesTool,
  approveExpense: approveExpenseTool,
  rejectExpense: rejectExpenseTool,
  generateReport: generateReportTool,
};

/**
 * Register all tools with the MCP server
 * 
 * This function is passed to descopeMcpAuthRouter and called
 * when the router sets up the /mcp endpoint.
 * 
 * @param server - The MCP server instance
 */
export function registerAllTools(server: McpServer): void {
  // Register each tool
  submitExpenseTool(server);
  listMyExpensesTool(server);
  listTeamExpensesTool(server);
  approveExpenseTool(server);
  rejectExpenseTool(server);
  generateReportTool(server);
  
  console.log("[MCP] Registered 6 tools:");
  console.log("  - submit_expense (scope: expense:submit)");
  console.log("  - list_my_expenses (scope: expense:view:own)");
  console.log("  - list_team_expenses (scope: expense:view:team)");
  console.log("  - approve_expense (scope: expense:approve)");
  console.log("  - reject_expense (scope: expense:approve)");
  console.log("  - generate_expense_report (scope: expense:report:generate)");
}

// Re-export individual tools
export { submitExpenseTool } from "./submit-expense.tool";
export { listMyExpensesTool } from "./list-my-expenses.tool";
export { listTeamExpensesTool } from "./list-team-expenses.tool";
export { approveExpenseTool } from "./approve-expense.tool";
export { rejectExpenseTool } from "./reject-expense.tool";
export { generateReportTool } from "./generate-report.tool";
```

---

## Step 5: Create Main MCP Module

### File: `src/mcp/index.ts`

```typescript
// =============================================================================
// MCP Module Entry Point
// =============================================================================
// Sets up the MCP router with Descope authentication
// =============================================================================

import { descopeMcpAuthRouter } from "@descope/mcp-express";
import { mcpProvider, MCP_SCOPES } from "./provider";
import { registerAllTools } from "./tools";

/**
 * Create the MCP router with authentication
 * 
 * This router handles:
 * 1. OAuth metadata endpoints (/.well-known/*)
 * 2. MCP protocol endpoint (POST /mcp)
 * 3. Bearer token validation
 * 4. Scope enforcement per tool
 * 
 * Usage in main server:
 * ```
 * import { createMcpRouter } from "./mcp";
 * app.use(createMcpRouter());
 * ```
 */
export function createMcpRouter() {
  return descopeMcpAuthRouter(registerAllTools, mcpProvider);
}

// Re-export provider and scopes for use in other modules
export { mcpProvider, MCP_SCOPES } from "./provider";
export { registerAllTools } from "./tools";
export * from "./types";
```

---

## Step 6: Integrate with Main Server

### Update: `src/index.ts`

```typescript
// =============================================================================
// Main Server Entry Point
// =============================================================================

import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import { config } from "./config";
import { initializeDatabase } from "./db";
import { createMcpRouter } from "./mcp";
import { apiRouter } from "./api";
import { errorMiddleware } from "./middleware";

const app = express();

// =============================================================================
// Security Middleware
// =============================================================================
app.use(helmet());
app.use(cors({
  origin: config.server.corsOrigins,
  credentials: true,
}));

// =============================================================================
// Request Parsing
// =============================================================================
// IMPORTANT: express.json() MUST be before the MCP router
// so that /mcp can read JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =============================================================================
// Logging
// =============================================================================
app.use(morgan(config.server.logFormat));

// =============================================================================
// Health Check
// =============================================================================
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
  });
});

// =============================================================================
// MCP Router
// =============================================================================
// This adds:
// - GET  /.well-known/oauth-protected-resource
// - GET  /.well-known/oauth-authorization-server
// - POST /mcp (authenticated MCP protocol endpoint)
app.use(createMcpRouter());

// =============================================================================
// REST API Router
// =============================================================================
// All REST endpoints are under /api
app.use("/api", apiRouter);

// =============================================================================
// Error Handling
// =============================================================================
app.use(errorMiddleware);

// =============================================================================
// Server Startup
// =============================================================================
async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();
    console.log("[DB] Database initialized");
    
    // Start server
    const port = config.server.port;
    app.listen(port, () => {
      console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  Expense Management Server Started                             ║
╠═══════════════════════════════════════════════════════════════╣
║                                                                 ║
║  REST API:  http://localhost:${port}/api                          ║
║  MCP:       http://localhost:${port}/mcp                          ║
║  Health:    http://localhost:${port}/health                       ║
║                                                                 ║
║  OAuth Metadata:                                               ║
║  - Protected Resource: /.well-known/oauth-protected-resource   ║
║  - Auth Server:        /.well-known/oauth-authorization-server ║
║                                                                 ║
╚═══════════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error("[Server] Failed to start:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("[Server] SIGTERM received, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("[Server] SIGINT received, shutting down gracefully...");
  process.exit(0);
});

// Start the server
startServer();
```

---

## Descope Console Configuration

### Required Scopes to Configure

In the Descope Console, create an MCP Server (Inbound App) with these scopes:

| Scope Name | Description | Required |
|------------|-------------|----------|
| `openid` | Basic identity | Yes |
| `expense:submit` | Submit expense reports for reimbursement | No |
| `expense:view:own` | View your own submitted expenses | No |
| `expense:view:team` | View expenses submitted by your team members | No |
| `expense:view:all` | View all company expenses across departments | No |
| `expense:approve` | Approve or reject expense reports | No |
| `expense:report:generate` | Generate detailed expense reports and analytics | No |

### User Roles to Configure

Create these roles in Descope Console → Authorization → Roles:

| Role Name | Permissions | Description |
|-----------|-------------|-------------|
| `employee` | Submit, View Own | Basic employee |
| `manager` | Submit, View Own, View Team, Approve | Department manager |
| `finance_admin` | All permissions | Finance administrator |

### Consent Flow Configuration

Create a consent flow that requests these scopes. The user will be prompted to approve access when an MCP client connects.

---

## Testing MCP Tools

### Using MCP Inspector

1. **Install MCP Inspector**
   ```bash
   npx @anthropic-ai/mcp-inspector
   ```

2. **Configure Connection**
   - URL: `http://localhost:3000/mcp`
   - Transport: Streamable HTTP
   - Auth: Enable OAuth

3. **Test Flow**
   - Inspector will discover OAuth metadata
   - Register as a client (DCR)
   - Redirect to Descope for authentication
   - Receive access token
   - Call tools with authenticated requests

### Manual cURL Testing

```bash
# 1. Get an access token from Descope (use test user)
# This requires going through the OAuth flow manually

# 2. Test health endpoint
curl http://localhost:3000/health

# 3. Test OAuth metadata
curl http://localhost:3000/.well-known/oauth-protected-resource

# 4. Test MCP endpoint (requires valid token)
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {}
  }'

# 5. Call a tool
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "list_my_expenses",
      "arguments": {
        "limit": 10
      }
    }
  }'
```

---

## Summary

### Files Created in This Phase

```
src/mcp/
├── index.ts              # Main MCP module entry
├── provider.ts           # DescopeMcpProvider configuration
├── types.ts              # MCP-specific type definitions
└── tools/
    ├── index.ts          # Tool registry and exports
    ├── submit-expense.tool.ts
    ├── list-my-expenses.tool.ts
    ├── list-team-expenses.tool.ts
    ├── approve-expense.tool.ts
    ├── reject-expense.tool.ts
    └── generate-report.tool.ts
```

### Tool-Scope Mapping

| Tool | Required Scope | RBAC |
|------|----------------|------|
| `submit_expense` | `expense:submit` | Any user |
| `list_my_expenses` | `expense:view:own` | Any user |
| `list_team_expenses` | `expense:view:team` | Manager, Finance Admin |
| `approve_expense` | `expense:approve` | Manager, Finance Admin |
| `reject_expense` | `expense:approve` | Manager, Finance Admin |
| `generate_expense_report` | `expense:report:generate` | Finance Admin only |

### Key Integration Points

1. **Authentication**: Handled by `@descope/mcp-express` via `descopeMcpAuthRouter`
2. **Scope Validation**: Declared per-tool in `scopes` array
3. **RBAC**: Enforced in tool handlers by checking `userRepository.findById()`
4. **Service Layer**: Tools call existing service functions for business logic
5. **Error Handling**: Consistent error responses with codes and details

---

## Next Phase

**Phase 6: Testing and Documentation** will cover:
- Unit tests for MCP tools
- Integration tests with mock tokens
- API documentation (OpenAPI/Swagger)
- README with setup instructions
- Troubleshooting guide