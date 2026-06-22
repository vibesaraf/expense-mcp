import {
  expenseRepository,
  userRepository,
} from "../db/repositories/index.js";
import type { AuthenticatedUser } from "../types/auth.types.js";
import type { ReportResponse, ExpenseListResponse } from "../types/api.types.js";
import type { GenerateReportInput } from "../api/validators/report.validator.js";
import { ForbiddenError } from "../utils/errors.js";
import { isFinanceAdmin } from "../middleware/rbac.middleware.js";
import { generateUUID } from "../utils/uuid.js";
import type { ExpenseStatusType, ReportType } from "../config/constants.js";

export class ReportService {
  /**
   * Generate an expense report
   */
  async generateReport(
    user: AuthenticatedUser,
    input: GenerateReportInput,
  ): Promise<ReportResponse> {
    // Only finance admins can generate reports
    if (!isFinanceAdmin(user)) {
      throw new ForbiddenError("Only finance admins can generate reports");
    }

    const reportId = `report_${new Date()
      .toISOString()
      .replace(/[-:T.Z]/g, "")
      .substring(0, 14)}`;

    // Get expense data based on filters
    const filters = {
      fromDate: input.fromDate,
      toDate: input.toDate,
      status: input.status ? [input.status] : undefined,
      department: input.department ? [input.department] : undefined,
      limit: 1000, // Get all for report
    };

    const expenseData = expenseRepository.list(filters);

    // Get summaries
    const byCategory = expenseRepository.getSummaryByCategory(
      input.fromDate,
      input.toDate,
      input.department,
    );

    const byStatus = expenseRepository.getSummaryByStatus(
      input.fromDate,
      input.toDate,
      input.department,
    );

    const byDepartment = input.department
      ? undefined
      : expenseRepository.getSummaryByDepartment(input.fromDate, input.toDate);

    // Build response
    const report: ReportResponse = {
      reportId,
      reportType: input.reportType as ReportType,
      period: {
        fromDate: input.fromDate,
        toDate: input.toDate,
      },
      filters: {
        department: input.department,
        status: input.status as ExpenseStatusType | undefined,
      },
      summary: {
        totalExpenses: expenseData.pagination.totalItems,
        totalAmount: expenseData.summary.totalAmount,
        currency: "USD",
        byCategory: byCategory.reduce(
          (acc, cat) => {
            acc[cat.category_name] = cat.total_amount;
            return acc;
          },
          {} as Record<string, number>,
        ),
        byStatus: byStatus.reduce(
          (acc, status) => {
            acc[status.status] = status.total_amount;
            return acc;
          },
          {} as Record<string, number>,
        ),
        ...(byDepartment && {
          byDepartment: byDepartment.reduce(
            (acc, dept) => {
              acc[dept.department] = dept.total_amount;
              return acc;
            },
            {} as Record<string, number>,
          ),
        }),
      },
      generatedAt: new Date().toISOString(),
      generatedBy: {
        userId: user.userId,
        fullName: user.fullName || user.email,
      },
    };

    // Include detailed expenses if report type is detailed
    if (input.reportType === "detailed") {
      report.expenses = expenseData.expenses.map((exp) => ({
        expenseId: exp.expenseId,
        submitter: exp.submitter.fullName,
        category: exp.categoryName,
        amount: exp.amount,
        status: exp.status,
        expenseDate: exp.expenseDate,
      }));
    }

    return report;
  }
}

// Export singleton instance
export const reportService = new ReportService();
