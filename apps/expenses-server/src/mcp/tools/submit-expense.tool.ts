// =============================================================================
// MCP Tool: Submit Expense
// =============================================================================
// Allows employees to submit new expenses for approval
// Required Scope: expense:submit
// =============================================================================

import { defineTool } from "../define-tool";
import { z } from "zod";
import { expenseService } from "../../services/expense.service";
import { MCP_SCOPES } from "../provider";
import { createTextResponse, createErrorResponse } from "../types";
import { DEFAULT_CATEGORIES } from "../../config/constants";
import { userRepository } from "../../db/repositories";
import { deriveRolesFromScopes } from "../../middleware/rbac.middleware";

// Extract category names for validation
const categoryNames = DEFAULT_CATEGORIES.map((c) => c.name) as [
  string,
  ...string[],
];

/**
 * Input schema for submit_expense tool
 * Validated at runtime by Zod
 */
const submitExpenseInput = {
  category: z
    .enum(categoryNames as [string, ...string[]])
    .describe(
      "Expense category (Meals, Travel, Office Supplies, Software, Training)",
    ),

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

  input: submitExpenseInput as any,

  scopes: [MCP_SCOPES.EXPENSE_SUBMIT],

  handler: async (args, extra) => {
    try {
      // Get user info from auth info
      const userId = extra.authInfo.clientId;
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

      // We need to map category name to ID
      const category = DEFAULT_CATEGORIES.find((c) => c.name === args.category);
      if (!category) {
        return createErrorResponse("Invalid category selected");
      }

      // We need category ID. in DB seeding, IDs are 1-based index + 1
      const categoryId = DEFAULT_CATEGORIES.indexOf(category) + 1;

      // Call service layer to create expense
      const result = await expenseService.submitExpense(authUser as any, {
        categoryId: categoryId,
        amount: args.amount,
        currency: args.currency || "USD",
        description: args.description,
        expenseDate: args.expense_date,
        receiptUrl: args.receipt_url,
      });

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
            valid_categories: categoryNames,
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
