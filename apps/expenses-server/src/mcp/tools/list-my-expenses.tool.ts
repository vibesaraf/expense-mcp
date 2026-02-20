// =============================================================================
// MCP Tool: List My Expenses
// =============================================================================
// Allows users to view their own submitted expenses
// Required Scope: expense:view:own
// =============================================================================

import { defineTool } from "../define-tool";
import { z } from "zod";
import { expenseService } from "../../services/expense.service";
import { MCP_SCOPES } from "../provider";
import { createTextResponse, createErrorResponse } from "../types";
import { ExpenseStatus } from "../../config/constants";
import { userRepository } from "../../db/repositories";
import { deriveRolesFromScopes } from "../../middleware/rbac.middleware";

/**
 * Input schema for list_my_expenses tool
 */
const listMyExpensesInput = {
  status: z
    .array(
      z.enum([
        ExpenseStatus.PENDING,
        ExpenseStatus.APPROVED,
        ExpenseStatus.REJECTED,
        ExpenseStatus.PAID,
      ]),
    )
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

  // Note: Service expects category IDs, but tool input should probably be names or IDs.
  // Let's support IDs for now as that's what the service filter expects, or we can map names.
  // The service filter `categories` takes IDs (number[]).
  // But the tool input description in the original plan said names.
  // Let's stick to simple implementation: accept IDs or handle mapping if we want to be fancy.
  // For simplicity and alignment with service, let's just not expose category filter in this iteration
  // or expose it as IDs. The original plan had `category: z.array(z.string())`.
  // Let's support mapped names if possible, or just omit for now to avoid complexity in this step.
  // I'll omit category filter from the tool input for now to keep it robust.

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

  input: listMyExpensesInput as any,

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
        status: args.status,
        fromDate: args.from_date,
        toDate: args.to_date,
        // categories: args.category, // Skipped for now
        page: args.page || 1,
        limit: args.limit || 20,
      };

      const user = userRepository.findById(userId);
      if (!user) {
        return createErrorResponse("User not found", {
          code: "NOT_FOUND",
        });
      }

      const roles =
        extra.authInfo.roles ?? deriveRolesFromScopes(extra.authInfo.scopes);

      const authUser = {
        userId: user.userId,
        email: user.email,
        fullName: user.fullName,
        roles,
        scopes: extra.authInfo.scopes,
        department: user.department || "General",
        managerId: user.managerId,
      };

      // Call service layer
      const result = await expenseService.getMyExpenses(
        authUser as any,
        filters,
      );

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
            // expense_count is available as total_items in pagination
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
