// =============================================================================
// MCP Tool: List Team Expenses
// =============================================================================
// Allows managers to view expenses submitted by their team members
// Required Scope: expense:view:team
// =============================================================================

import { defineTool } from "../define-tool";
import { z } from "zod";
import { expenseService } from "../../services/expense.service";
import { userRepository } from "../../db/repositories";
import { MCP_SCOPES } from "../provider";
import { createTextResponse, createErrorResponse } from "../types";
import { ExpenseStatus, UserRoles } from "../../config/constants";
import {
  deriveRolesFromScopes,
  isManagerOrHigher,
} from "../../middleware/rbac.middleware";

/**
 * Input schema for list_team_expenses tool
 */
const listTeamExpensesInput = {
  team_id: z
    .string()
    .optional()
    .describe("Team/department ID (optional, defaults to your managed team)"),

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

  input: listTeamExpensesInput as any,

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
      const user = userRepository.findById(userId);

      if (!user) {
        return createErrorResponse("User not found", {
          code: "NOT_FOUND",
        });
      }

      const roles =
        extra.authInfo.roles ?? deriveRolesFromScopes(extra.authInfo.scopes);

      // Check RBAC: Only managers and finance_admins can view team expenses
      if (!isManagerOrHigher({ roles })) {
        return createErrorResponse("Access denied", {
          code: "FORBIDDEN",
          message: "Only managers and finance admins can view team expenses",
          required_role: ["manager", "finance_admin"],
          current_role: roles[0],
        });
      }

      // Determine team/department to query
      let department = args.team_id;

      // If no team_id provided, use the manager's department
      if (!department && roles[0] === UserRoles.MANAGER) {
        department = user.department || undefined;
      }

      const filters = {
        status: args.status,
        fromDate: args.from_date,
        toDate: args.to_date,
        submitterId: args.submitter_id,
        page: args.page || 1,
        limit: args.limit || 20,
      };

      // Construct AuthenticatedUser
      const authUser = {
        userId: user.userId,
        email: user.email,
        fullName: user.fullName,
        roles,
        scopes: extra.authInfo.scopes,
        department: user.department || "General",
      };

      // Call service layer
      const result = await expenseService.getTeamExpenses(
        authUser as any,
        department,
        filters,
      );

      return createTextResponse({
        success: true,
        data: {
          team_name: department || "All Teams",
          expenses: result.expenses.map((expense) => ({
            expense_id: expense.expenseId,
            submitter: {
              user_id: expense.submitter.userId,
              full_name: expense.submitter.fullName,
              email: expense.submitter.email,
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
            // expense_count is available as total_items in pagination
          },
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        if (
          error.message.includes("not authorized") ||
          error.message.includes("permission")
        ) {
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
