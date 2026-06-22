import { defineTool } from "../define-tool.js";
import { z } from "zod";
import { createTextResponse, createErrorResponse } from "../types.js";
import { McpScopes } from "../../config/constants.js";
import { exchangeToken, TokenExchangeError } from "../../utils/tokenExchange.js";
import { callRest, RestError } from "../../utils/restClient.js";

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

export const approveExpenseTool = defineTool({
  name: "approve_expense",

  description: `Approve a pending expense request.
Only managers and finance admins can approve expenses.
Managers can only approve expenses from their team members.
You can optionally add notes to the approval.`,

  input: approveExpenseInput as any,

  scopes: [],

  handler: async (args, extra) => {
    try {
      const restToken = await exchangeToken(
        extra.authInfo.token,
        McpScopes.EXPENSE_APPROVE,
      );
      const data = await callRest(
        restToken,
        "POST",
        `/api/expenses/${args.expense_id}/approve`,
        { notes: args.notes },
      );
      return createTextResponse({ success: true, data });
    } catch (error) {
      if (error instanceof RestError) {
        return createErrorResponse(error.message, { status: error.status });
      }
      if (error instanceof TokenExchangeError) {
        return createErrorResponse(error.message);
      }
      return createErrorResponse("An unexpected error occurred");
    }
  },
});
