import type { ExpenseStatusType } from '../config/constants.js';

export interface Expense {
    expenseId: string;
    submitterId: string;
    categoryId: number;
    amount: number;
    currency: string;
    description: string;
    expenseDate: string;  // YYYY-MM-DD format
    receiptUrl?: string;
    status: ExpenseStatusType;
    submittedAt: Date;
    updatedAt: Date;
}

export interface ExpenseWithCategory extends Expense {
    categoryName: string;
}

export interface ExpenseWithSubmitter extends ExpenseWithCategory {
    submitter: {
        userId: string;
        fullName: string;
        email: string;
        department?: string;
    };
}

export interface ExpenseWithApprovalHistory extends ExpenseWithSubmitter {
    approvalHistory: ApprovalHistoryItem[];
}

export interface ApprovalHistoryItem {
    approver: {
        userId: string;
        fullName: string;
        email: string;
    };
    action: 'approved' | 'rejected';
    notes?: string;
    approvedAt: Date;
}

export interface CreateExpenseInput {
    categoryId: number;
    amount: number;
    currency?: string;
    description: string;
    expenseDate: string;
    receiptUrl?: string;
}

export interface ExpenseCategory {
    categoryId: number;
    categoryName: string;
    description?: string;
    requiresReceipt: boolean;
    maxAmount?: number;
    createdAt: Date;
}

export interface ExpenseApproval {
    approvalId: number;
    expenseId: string;
    approverId: string;
    action: 'approved' | 'rejected';
    notes?: string;
    approvedAt: Date;
}

export interface AuditLog {
    logId: number;
    userId: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
    timestamp: Date;
}
