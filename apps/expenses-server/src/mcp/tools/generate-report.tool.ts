import { defineTool } from "../define-tool.js";
import { z } from "zod";
import { createTextResponse, createErrorResponse } from "../types.js";
import { ReportTypes, ExpenseStatus, McpScopes } from "../../config/constants.js";
import { exchangeToken, TokenExchangeError } from "../../utils/tokenExchange.js";
import { callRest, RestError } from "../../utils/restClient.js";

const generateReportInput = {
  report_type: z
    .enum([ReportTypes.SUMMARY, ReportTypes.DETAILED, ReportTypes.BY_CATEGORY])
    .default(ReportTypes.SUMMARY)
    .describe("Type of report to generate (summary, detailed, by_category)"),

  from_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe("Start date for report (YYYY-MM-DD)"),

  to_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe("End date for report (YYYY-MM-DD)"),

  department: z.string().optional().describe("Optional department filter"),

  status: z
    .enum([
      ExpenseStatus.PENDING,
      ExpenseStatus.APPROVED,
      ExpenseStatus.REJECTED,
      ExpenseStatus.PAID,
    ])
    .optional()
    .describe("Optional status filter"),
};

export const generateReportTool = defineTool({
  name: "generate_report",

  description: `Generate expense reports. Only available to finance admins.

Report Types:
- summary: High-level overview of expenses (totals, counts)
- detailed: List of individual expenses with details
- by_category: Aggregated totals by category

You must specify a date range (from_date, to_date).`,

  input: generateReportInput as any,

  scopes: [],

  handler: async (args, extra) => {
    try {
      const restToken = await exchangeToken(
        extra.authInfo.token,
        McpScopes.EXPENSE_REPORT_GENERATE,
      );
      const data = await callRest(
        restToken,
        "POST",
        "/api/expenses/reports/generate",
        {
          reportType: args.report_type,
          fromDate: args.from_date,
          toDate: args.to_date,
          department: args.department,
          status: args.status,
          format: "json",
        },
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
