// =============================================================================
// MCP Tool: Approve Expense
// =============================================================================
// Allows managers/finance admins to approve pending expenses
// Required Scope: expense:approve
// =============================================================================

import { defineTool } from "../define-tool.js";
import { z } from "zod";
import { expenseService } from "../../services/expense.service.js";
import { userRepository } from "../../db/repositories/index.js";
import { MCP_SCOPES } from "../provider.js";
import { createTextResponse, createErrorResponse } from "../types.js";
import { deriveRolesFromScopes } from "../../middleware/rbac.middleware.js";

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
 */
export const approveExpenseTool = defineTool({
  name: "approve_expense",

  description: `Approve a pending expense request.
Only managers and finance admins can approve expenses.
Managers can only approve expenses from their team members.
You can optionally add notes to the approval.`,

  input: approveExpenseInput as any,

  scopes: [MCP_SCOPES.EXPENSE_APPROVE],

  handler: async (args, extra) => {
    try {
      const userId = extra.authInfo.clientId;

      if (!userId) {
        return createErrorResponse("Authentication required", {
          code: "UNAUTHORIZED",
        });
      }

      // Get user from DB
      const user = userRepository.findById(userId);
      if (!user) {
        return createErrorResponse("User not found");
      }

      const roles =
        extra.authInfo.roles ?? deriveRolesFromScopes(extra.authInfo.scopes);

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
      const result = await expenseService.approveExpense(
        authUser as any,
        args.expense_id,
        args.notes,
      );

      return createTextResponse({
        success: true,
        message: "Expense approved successfully",
        data: {
          expense_id: result.expenseId,
          status: result.status,
          approved_at: new Date().toISOString(),
          approver_id: userId,
          notes: args.notes,
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("not found")) {
          return createErrorResponse("Expense not found", {
            code: "NOT_FOUND",
            message: error.message,
          });
        }

        if (
          error.message.includes("permission") ||
          error.message.includes("can only")
        ) {
          return createErrorResponse("Access denied", {
            code: "FORBIDDEN",
            message: error.message,
          });
        }

        if (error.message.includes("status")) {
          return createErrorResponse("Invalid status transition", {
            code: "CONFLICT",
            message: error.message,
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
