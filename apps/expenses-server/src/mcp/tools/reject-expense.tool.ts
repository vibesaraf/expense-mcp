import { defineTool } from "../define-tool.js";
import { z } from "zod";
import { createTextResponse, createErrorResponse } from "../types.js";
import { McpScopes } from "../../config/constants.js";
import { exchangeToken, TokenExchangeError } from "../../utils/tokenExchange.js";
import { callRest, RestError } from "../../utils/restClient.js";

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

export const rejectExpenseTool = defineTool({
  name: "reject_expense",

  description: `Reject a pending expense request.
Only managers and finance admins can reject expenses.
Managers can only reject expenses from their team members.
A reason for rejection is required.`,

  input: rejectExpenseInput as any,

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
        `/api/expenses/${args.expense_id}/reject`,
        { reason: args.reason },
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
