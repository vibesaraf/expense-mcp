// =============================================================================
// MCP Tool: Reject Expense
// =============================================================================
// Allows managers/finance admins to reject pending expenses
// Required Scope: expense:approve (same as approval)
// =============================================================================

import { defineTool } from "../define-tool";
import { z } from "zod";
import { expenseService } from "../../services/expense.service";
import { userRepository } from "../../db/repositories";
import { MCP_SCOPES } from "../provider";
import { createTextResponse, createErrorResponse } from "../types";

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
 */
export const rejectExpenseTool = defineTool({
  name: "reject_expense",

  description: `Reject a pending expense request.
Only managers and finance admins can reject expenses.
Managers can only reject expenses from their team members.
A reason for rejection is required.`,

  input: rejectExpenseInput as any,

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

      // Construct AuthenticatedUser
      const authUser = {
        userId: user.userId,
        email: user.email,
        fullName: user.fullName,
        roles: [user.role],
        department: user.department || "General",
      };

      // Call service layer
      const result = await expenseService.rejectExpense(
        authUser as any,
        args.expense_id,
        args.reason,
      );

      return createTextResponse({
        success: true,
        message: "Expense rejected successfully",
        data: {
          expense_id: result.expenseId,
          status: result.status,
          rejected_at: new Date().toISOString(),
          rejector_id: userId,
          reason: args.reason,
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
