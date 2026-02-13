// User roles
export const UserRoles = {
  EMPLOYEE: "employee",
  MANAGER: "manager",
  FINANCE_ADMIN: "finance_admin",
} as const;

export type UserRole = (typeof UserRoles)[keyof typeof UserRoles];

// Expense statuses
export const ExpenseStatus = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  PAID: "paid",
} as const;

export type ExpenseStatusType =
  (typeof ExpenseStatus)[keyof typeof ExpenseStatus];

// Approval actions
export const ApprovalAction = {
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;

export type ApprovalActionType =
  (typeof ApprovalAction)[keyof typeof ApprovalAction];

// OAuth Scopes for MCP
export const McpScopes = {
  EXPENSE_SUBMIT: "expense:submit",
  EXPENSE_VIEW_OWN: "expense:view:own",
  EXPENSE_VIEW_TEAM: "expense:view:team",
  EXPENSE_VIEW_ALL: "expense:view:all",
  EXPENSE_APPROVE: "expense:approve",
  EXPENSE_REPORT_GENERATE: "expense:report:generate",
} as const;

export const LR_MCP_SCOPE = "mcp:tools";

export type McpScope = (typeof McpScopes)[keyof typeof McpScopes];

// Report types
export const ReportTypes = {
  SUMMARY: "summary",
  DETAILED: "detailed",
  BY_CATEGORY: "by_category",
} as const;

export type ReportType = (typeof ReportTypes)[keyof typeof ReportTypes];

// Default pagination
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// Expense categories (these will be seeded in DB)
export const DEFAULT_CATEGORIES = [
  {
    name: "Meals",
    description: "Business meals and client entertainment",
    requiresReceipt: true,
    maxAmount: 100,
  },
  {
    name: "Travel",
    description: "Transportation and accommodation",
    requiresReceipt: true,
    maxAmount: 5000,
  },
  {
    name: "Office Supplies",
    description: "Stationery, equipment, etc.",
    requiresReceipt: false,
    maxAmount: 500,
  },
  {
    name: "Software",
    description: "Software subscriptions and licenses",
    requiresReceipt: false,
    maxAmount: 1000,
  },
  {
    name: "Training",
    description: "Courses, conferences, certifications",
    requiresReceipt: true,
    maxAmount: 3000,
  },
] as const;
