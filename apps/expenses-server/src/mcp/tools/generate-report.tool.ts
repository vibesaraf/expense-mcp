// =============================================================================
// MCP Tool: Generate Report
// =============================================================================
// Allows finance admins to generate expense reports
// Required Scope: expense:report:generate
// =============================================================================

import { defineTool } from "../define-tool.js";
import { z } from "zod";
import { reportService } from "../../services/report.service.js";
import { userRepository } from "../../db/repositories/index.js";
import { MCP_SCOPES } from "../provider.js";
import { createTextResponse, createErrorResponse } from "../types.js";
import { ReportTypes, ExpenseStatus } from "../../config/constants.js";
import { deriveRolesFromScopes } from "../../middleware/rbac.middleware.js";

/**
 * Input schema for generate_report tool
 */
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

/**
 * Generate Report Tool
 *
 * @scope expense:report:generate
 * @rbac Only finance_admins can generate reports
 */
export const generateReportTool = defineTool({
  name: "generate_report",

  description: `Generate expense reports. Only available to finance admins.
  
Report Types:
- summary: High-level overview of expenses (totals, counts)
- detailed: List of individual expenses with details
- by_category: Aggregated totals by category

You must specify a date range (from_date, to_date).`,

  input: generateReportInput as any,

  scopes: [MCP_SCOPES.EXPENSE_REPORT],

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
      const report = await reportService.generateReport(authUser as any, {
        reportType: args.report_type,
        fromDate: args.from_date,
        toDate: args.to_date,
        department: args.department,
        status: args.status,
        format: "json", // Default for MCP tool
      });

      return createTextResponse({
        success: true,
        data: report,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("permission")) {
          return createErrorResponse("Access denied", {
            code: "FORBIDDEN",
            message: error.message,
          });
        }

        return createErrorResponse("Failed to generate report", {
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
