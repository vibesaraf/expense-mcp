import { defineTool } from "../define-tool.js";
import { z } from "zod";
import { createTextResponse, createErrorResponse } from "../types.js";
import { ExpenseStatus, McpScopes } from "../../config/constants.js";
import { exchangeToken, TokenExchangeError } from "../../utils/tokenExchange.js";
import { callRest, RestError } from "../../utils/restClient.js";

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

  scopes: [],

  handler: async (args, extra) => {
    try {
      const teamId = args.team_id ?? extra.authInfo.clientId;

      const qs = new URLSearchParams();
      if (args.status?.length) qs.set("status", args.status.join(","));
      if (args.from_date) qs.set("fromDate", args.from_date);
      if (args.to_date) qs.set("toDate", args.to_date);
      if (args.submitter_id) qs.set("submitterId", args.submitter_id);
      qs.set("page", String(args.page ?? 1));
      qs.set("limit", String(args.limit ?? 20));

      const restToken = await exchangeToken(
        extra.authInfo.token,
        McpScopes.EXPENSE_VIEW_TEAM,
      );
      const data = await callRest(
        restToken,
        "GET",
        `/api/expenses/team/${teamId}?${qs.toString()}`,
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
