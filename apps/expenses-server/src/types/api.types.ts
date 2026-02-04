import type { ExpenseStatusType, ReportType } from '../config/constants';

// Query parameters
export interface ExpenseQueryParams {
    status?: ExpenseStatusType[];
    fromDate?: string;
    toDate?: string;
    categoryId?: number[];
    page?: number;
    limit?: number;
}

export interface AllExpensesQueryParams extends ExpenseQueryParams {
    department?: string[];
    submitterId?: string;
}

// Request bodies
export interface ApproveExpenseBody {
    notes?: string;
}

export interface RejectExpenseBody {
    reason: string;
}

export interface GenerateReportBody {
    reportType: ReportType;
    fromDate: string;
    toDate: string;
    department?: string;
    status?: ExpenseStatusType;
    format?: 'json' | 'csv' | 'pdf';
}

// Response types
export interface PaginationInfo {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
}

export interface ExpenseSummary {
    totalAmount: number;
    pendingAmount: number;
    approvedAmount: number;
    rejectedAmount?: number;
    paidAmount?: number;
}

export interface ExpenseListResponse {
    expenses: Array<{
        expenseId: string;
        category: string;
        amount: number;
        currency: string;
        description: string;
        expenseDate: string;
        receiptUrl?: string;
        status: ExpenseStatusType;
        submittedAt: string;
        submitter?: {
            userId: string;
            fullName: string;
            email: string;
        };
    }>;
    pagination: PaginationInfo;
    summary: ExpenseSummary;
}

export interface ReportResponse {
    reportId: string;
    reportType: ReportType;
    period: {
        fromDate: string;
        toDate: string;
    };
    filters: {
        department?: string;
        status?: ExpenseStatusType;
    };
    summary: {
        totalExpenses: number;
        totalAmount: number;
        currency: string;
        byCategory: Record<string, number>;
        byStatus: Record<string, number>;
        byDepartment?: Record<string, number>;
    };
    expenses?: Array<{
        expenseId: string;
        submitter: string;
        category: string;
        amount: number;
        status: ExpenseStatusType;
        expenseDate: string;
    }>;
    generatedAt: string;
    generatedBy: {
        userId: string;
        fullName: string;
    };
}
