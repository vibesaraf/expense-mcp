/**
 * Raw database row types (as returned by SQLite)
 * These match the column names in the database
 */

export interface UserRow {
    user_id: string;
    email: string;
    full_name: string;
    role: string;
    department: string | null;
    manager_id: string | null;
    created_at: string;
    updated_at: string;
}

export interface ExpenseCategoryRow {
    category_id: number;
    category_name: string;
    description: string | null;
    requires_receipt: number; // SQLite boolean (0 or 1)
    max_amount: number | null;
    created_at: string;
}

export interface ExpenseRow {
    expense_id: string;
    submitter_id: string;
    category_id: number;
    amount: number;
    currency: string;
    description: string;
    expense_date: string;
    receipt_url: string | null;
    status: string;
    submitted_at: string;
    updated_at: string;
}

export interface ExpenseWithCategoryRow extends ExpenseRow {
    category_name: string;
}

export interface ExpenseWithSubmitterRow extends ExpenseWithCategoryRow {
    submitter_full_name: string;
    submitter_email: string;
    submitter_department: string | null;
}

export interface ExpenseApprovalRow {
    approval_id: number;
    expense_id: string;
    approver_id: string;
    action: string;
    notes: string | null;
    approved_at: string;
}

export interface ExpenseApprovalWithApproverRow extends ExpenseApprovalRow {
    approver_full_name: string;
    approver_email: string;
}

export interface AuditLogRow {
    log_id: number;
    user_id: string;
    action: string;
    resource_type: string;
    resource_id: string | null;
    details: string | null; // JSON string
    ip_address: string | null;
    user_agent: string | null;
    timestamp: string;
}

/**
 * Query result types for aggregations
 */

export interface ExpenseSummaryRow {
    total_count: number;
    total_amount: number;
    pending_count: number;
    pending_amount: number;
    approved_count: number;
    approved_amount: number;
    rejected_count: number;
    rejected_amount: number;
    paid_count: number;
    paid_amount: number;
}

export interface CategorySummaryRow {
    category_name: string;
    total_amount: number;
    expense_count: number;
}

export interface DepartmentSummaryRow {
    department: string;
    total_amount: number;
    expense_count: number;
}

export interface StatusSummaryRow {
    status: string;
    total_amount: number;
    expense_count: number;
}
