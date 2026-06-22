import { defineTool } from "../define-tool.js";
import { z } from "zod";
import { createTextResponse, createErrorResponse } from "../types.js";
import { ExpenseStatus, McpScopes } from "../../config/constants.js";
import { exchangeToken, TokenExchangeError } from "../../utils/tokenExchange.js";
import { callRest, RestError } from "../../utils/restClient.js";

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

export const listMyExpensesTool = defineTool({
  name: "list_my_expenses",

  description: `View your own submitted expenses with optional filters for status and date range.

Returns a paginated list of expenses with:
- Expense details (category, amount, description, date)
- Current status (pending, approved, rejected, paid)
- Summary totals (total amount, pending amount, approved amount)

Use this tool to check the status of your submitted expenses or review your expense history.`,

  input: listMyExpensesInput as any,

  scopes: [],

  handler: async (args, extra) => {
    try {
      const qs = new URLSearchParams();
      if (args.status?.length) qs.set("status", args.status.join(","));
      if (args.from_date) qs.set("fromDate", args.from_date);
      if (args.to_date) qs.set("toDate", args.to_date);
      qs.set("page", String(args.page ?? 1));
      qs.set("limit", String(args.limit ?? 20));

      const restToken = await exchangeToken(
        extra.authInfo.token,
        McpScopes.EXPENSE_VIEW_OWN,
      );
      const data = await callRest(
        restToken,
        "GET",
        `/api/expenses/me?${qs.toString()}`,
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
