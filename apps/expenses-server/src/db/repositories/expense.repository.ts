import { BaseRepository } from './base.js';
import type {
  Expense,
  ExpenseWithCategory,
  ExpenseWithSubmitter,
  CreateExpenseInput
} from '../../types/expense.types.js';
import type {
  ExpenseRow,
  ExpenseWithCategoryRow,
  ExpenseWithSubmitterRow,
  ExpenseSummaryRow,
  CategorySummaryRow,
  DepartmentSummaryRow,
  StatusSummaryRow
} from '../types.js';
import type { ExpenseStatusType } from '../../config/constants.js';
import { generateUUID } from '../../utils/uuid.js';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../config/constants.js';

export interface ExpenseFilters {
  submitterId?: string;
  status?: ExpenseStatusType[];
  categoryId?: number[];
  fromDate?: string;
  toDate?: string;
  department?: string[];
  page?: number;
  limit?: number;
}

export interface ExpenseListResult {
  expenses: ExpenseWithSubmitter[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
  summary: {
    totalAmount: number;
    pendingAmount: number;
    approvedAmount: number;
    rejectedAmount: number;
    paidAmount: number;
  };
}

export class ExpenseRepository extends BaseRepository {
  /**
   * Convert database row to Expense object
   */
  private rowToExpense(row: ExpenseRow): Expense {
    return {
      expenseId: row.expense_id,
      submitterId: row.submitter_id,
      categoryId: row.category_id,
      amount: row.amount,
      currency: row.currency,
      description: row.description,
      expenseDate: row.expense_date,
      receiptUrl: row.receipt_url || undefined,
      status: row.status as ExpenseStatusType,
      submittedAt: this.toDate(row.submitted_at),
      updatedAt: this.toDate(row.updated_at),
    };
  }

  /**
   * Convert database row with category to ExpenseWithCategory object
   */
  private rowToExpenseWithCategory(row: ExpenseWithCategoryRow): ExpenseWithCategory {
    return {
      ...this.rowToExpense(row),
      categoryName: row.category_name,
    };
  }

  /**
   * Convert database row with submitter to ExpenseWithSubmitter object
   */
  private rowToExpenseWithSubmitter(row: ExpenseWithSubmitterRow): ExpenseWithSubmitter {
    return {
      ...this.rowToExpenseWithCategory(row),
      submitter: {
        userId: row.submitter_id,
        fullName: row.submitter_full_name,
        email: row.submitter_email,
        department: row.submitter_department || undefined,
      },
    };
  }

  /**
   * Find expense by ID
   */
  findById(expenseId: string): Expense | null {
    const row = this.db.prepare(`
      SELECT * FROM expenses WHERE expense_id = ?
    `).get(expenseId) as ExpenseRow | undefined;

    return row ? this.rowToExpense(row) : null;
  }

  /**
   * Find expense by ID with category name
   */
  findByIdWithCategory(expenseId: string): ExpenseWithCategory | null {
    const row = this.db.prepare(`
      SELECT e.*, c.category_name
      FROM expenses e
      JOIN expense_categories c ON e.category_id = c.category_id
      WHERE e.expense_id = ?
    `).get(expenseId) as ExpenseWithCategoryRow | undefined;

    return row ? this.rowToExpenseWithCategory(row) : null;
  }

  /**
   * Find expense by ID with submitter details
   */
  findByIdWithSubmitter(expenseId: string): ExpenseWithSubmitter | null {
    const row = this.db.prepare(`
      SELECT 
        e.*,
        c.category_name,
        u.full_name as submitter_full_name,
        u.email as submitter_email,
        u.department as submitter_department
      FROM expenses e
      JOIN expense_categories c ON e.category_id = c.category_id
      JOIN users u ON e.submitter_id = u.user_id
      WHERE e.expense_id = ?
    `).get(expenseId) as ExpenseWithSubmitterRow | undefined;

    return row ? this.rowToExpenseWithSubmitter(row) : null;
  }

  /**
   * Build filter conditions for SQL WHERE clause
   */
  private buildFilterConditions(filters: ExpenseFilters): { conditions: string[]; values: unknown[] } {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (filters.submitterId) {
      conditions.push('e.submitter_id = ?');
      values.push(filters.submitterId);
    }

    if (filters.status && filters.status.length > 0) {
      const placeholders = filters.status.map(() => '?').join(', ');
      conditions.push(`e.status IN (${placeholders})`);
      values.push(...filters.status);
    }

    if (filters.categoryId && filters.categoryId.length > 0) {
      const placeholders = filters.categoryId.map(() => '?').join(', ');
      conditions.push(`e.category_id IN (${placeholders})`);
      values.push(...filters.categoryId);
    }

    if (filters.fromDate) {
      conditions.push('e.expense_date >= ?');
      values.push(filters.fromDate);
    }

    if (filters.toDate) {
      conditions.push('e.expense_date <= ?');
      values.push(filters.toDate);
    }

    if (filters.department && filters.department.length > 0) {
      const placeholders = filters.department.map(() => '?').join(', ');
      conditions.push(`u.department IN (${placeholders})`);
      values.push(...filters.department);
    }

    return { conditions, values };
  }

  /**
   * List expenses with filters and pagination
   */
  list(filters: ExpenseFilters = {}): ExpenseListResult {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, filters.limit || DEFAULT_PAGE_SIZE));

    const { conditions, values } = this.buildFilterConditions(filters);
    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    // Get total count
    const countRow = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM expenses e
      JOIN users u ON e.submitter_id = u.user_id
      ${whereClause}
    `).get(...values) as { count: number };

    // Get summary
    const summaryRow = this.db.prepare(`
      SELECT 
        COALESCE(SUM(e.amount), 0) as total_amount,
        COALESCE(SUM(CASE WHEN e.status = 'pending' THEN e.amount ELSE 0 END), 0) as pending_amount,
        COALESCE(SUM(CASE WHEN e.status = 'approved' THEN e.amount ELSE 0 END), 0) as approved_amount,
        COALESCE(SUM(CASE WHEN e.status = 'rejected' THEN e.amount ELSE 0 END), 0) as rejected_amount,
        COALESCE(SUM(CASE WHEN e.status = 'paid' THEN e.amount ELSE 0 END), 0) as paid_amount
      FROM expenses e
      JOIN users u ON e.submitter_id = u.user_id
      ${whereClause}
    `).get(...values) as {
      total_amount: number;
      pending_amount: number;
      approved_amount: number;
      rejected_amount: number;
      paid_amount: number;
    };

    // Get paginated expenses
    const offset = (page - 1) * limit;
    const rows = this.db.prepare(`
      SELECT 
        e.*,
        c.category_name,
        u.full_name as submitter_full_name,
        u.email as submitter_email,
        u.department as submitter_department
      FROM expenses e
      JOIN expense_categories c ON e.category_id = c.category_id
      JOIN users u ON e.submitter_id = u.user_id
      ${whereClause}
      ORDER BY e.submitted_at DESC
      LIMIT ? OFFSET ?
    `).all(...values, limit, offset) as ExpenseWithSubmitterRow[];

    return {
      expenses: rows.map(row => this.rowToExpenseWithSubmitter(row)),
      pagination: this.calculatePagination(countRow.count, page, limit),
      summary: {
        totalAmount: summaryRow.total_amount,
        pendingAmount: summaryRow.pending_amount,
        approvedAmount: summaryRow.approved_amount,
        rejectedAmount: summaryRow.rejected_amount,
        paidAmount: summaryRow.paid_amount,
      },
    };
  }

  /**
   * List expenses for a specific user
   */
  listByUser(userId: string, filters: Omit<ExpenseFilters, 'submitterId'> = {}): ExpenseListResult {
    return this.list({ ...filters, submitterId: userId });
  }

  /**
   * List expenses for a manager's team
   */
  listByTeam(managerId: string, filters: Omit<ExpenseFilters, 'submitterId'> = {}): ExpenseListResult {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, filters.limit || DEFAULT_PAGE_SIZE));

    // Build additional filter conditions
    const { conditions: filterConditions, values: filterValues } = this.buildFilterConditions(filters);

    // Add team filter
    const teamCondition = 'u.manager_id = ?';
    const allConditions = [teamCondition, ...filterConditions];
    const allValues = [managerId, ...filterValues];
    const whereClause = 'WHERE ' + allConditions.join(' AND ');

    // Get total count
    const countRow = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM expenses e
      JOIN users u ON e.submitter_id = u.user_id
      ${whereClause}
    `).get(...allValues) as { count: number };

    // Get summary
    const summaryRow = this.db.prepare(`
      SELECT 
        COALESCE(SUM(e.amount), 0) as total_amount,
        COALESCE(SUM(CASE WHEN e.status = 'pending' THEN e.amount ELSE 0 END), 0) as pending_amount,
        COALESCE(SUM(CASE WHEN e.status = 'approved' THEN e.amount ELSE 0 END), 0) as approved_amount,
        COALESCE(SUM(CASE WHEN e.status = 'rejected' THEN e.amount ELSE 0 END), 0) as rejected_amount,
        COALESCE(SUM(CASE WHEN e.status = 'paid' THEN e.amount ELSE 0 END), 0) as paid_amount
      FROM expenses e
      JOIN users u ON e.submitter_id = u.user_id
      ${whereClause}
    `).get(...allValues) as {
      total_amount: number;
      pending_amount: number;
      approved_amount: number;
      rejected_amount: number;
      paid_amount: number;
    };

    // Get paginated expenses
    const offset = (page - 1) * limit;
    const rows = this.db.prepare(`
      SELECT 
        e.*,
        c.category_name,
        u.full_name as submitter_full_name,
        u.email as submitter_email,
        u.department as submitter_department
      FROM expenses e
      JOIN expense_categories c ON e.category_id = c.category_id
      JOIN users u ON e.submitter_id = u.user_id
      ${whereClause}
      ORDER BY e.submitted_at DESC
      LIMIT ? OFFSET ?
    `).all(...allValues, limit, offset) as ExpenseWithSubmitterRow[];

    return {
      expenses: rows.map(row => this.rowToExpenseWithSubmitter(row)),
      pagination: this.calculatePagination(countRow.count, page, limit),
      summary: {
        totalAmount: summaryRow.total_amount,
        pendingAmount: summaryRow.pending_amount,
        approvedAmount: summaryRow.approved_amount,
        rejectedAmount: summaryRow.rejected_amount,
        paidAmount: summaryRow.paid_amount,
      },
    };
  }

  /**
   * Create a new expense
   */
  create(submitterId: string, input: CreateExpenseInput): Expense {
    const expenseId = generateUUID();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO expenses 
      (expense_id, submitter_id, category_id, amount, currency, description, expense_date, receipt_url, status, submitted_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(
      expenseId,
      submitterId,
      input.categoryId,
      input.amount,
      input.currency || 'USD',
      input.description,
      input.expenseDate,
      input.receiptUrl || null,
      now,
      now
    );

    return this.findById(expenseId)!;
  }

  /**
   * Update expense status
   */
  updateStatus(expenseId: string, status: ExpenseStatusType): Expense | null {
    const expense = this.findById(expenseId);
    if (!expense) return null;

    this.db.prepare(`
      UPDATE expenses 
      SET status = ?, updated_at = datetime('now')
      WHERE expense_id = ?
    `).run(status, expenseId);

    return this.findById(expenseId);
  }

  /**
   * Delete an expense
   */
  delete(expenseId: string): boolean {
    const result = this.db.prepare(`
      DELETE FROM expenses WHERE expense_id = ?
    `).run(expenseId);

    return result.changes > 0;
  }

  /**
   * Get summary by category for a date range
   */
  getSummaryByCategory(fromDate: string, toDate: string, department?: string): CategorySummaryRow[] {
    let query = `
      SELECT 
        c.category_name,
        COALESCE(SUM(e.amount), 0) as total_amount,
        COUNT(*) as expense_count
      FROM expenses e
      JOIN expense_categories c ON e.category_id = c.category_id
      JOIN users u ON e.submitter_id = u.user_id
      WHERE e.expense_date >= ? AND e.expense_date <= ?
    `;

    const params: unknown[] = [fromDate, toDate];

    if (department) {
      query += ' AND u.department = ?';
      params.push(department);
    }

    query += ' GROUP BY c.category_name ORDER BY total_amount DESC';

    return this.db.prepare(query).all(...params) as CategorySummaryRow[];
  }

  /**
   * Get summary by department for a date range
   */
  getSummaryByDepartment(fromDate: string, toDate: string): DepartmentSummaryRow[] {
    return this.db.prepare(`
      SELECT 
        u.department,
        COALESCE(SUM(e.amount), 0) as total_amount,
        COUNT(*) as expense_count
      FROM expenses e
      JOIN users u ON e.submitter_id = u.user_id
      WHERE e.expense_date >= ? AND e.expense_date <= ?
        AND u.department IS NOT NULL
      GROUP BY u.department
      ORDER BY total_amount DESC
    `).all(fromDate, toDate) as DepartmentSummaryRow[];
  }

  /**
   * Get summary by status for a date range
   */
  getSummaryByStatus(fromDate: string, toDate: string, department?: string): StatusSummaryRow[] {
    let query = `
      SELECT 
        e.status,
        COALESCE(SUM(e.amount), 0) as total_amount,
        COUNT(*) as expense_count
      FROM expenses e
      JOIN users u ON e.submitter_id = u.user_id
      WHERE e.expense_date >= ? AND e.expense_date <= ?
    `;

    const params: unknown[] = [fromDate, toDate];

    if (department) {
      query += ' AND u.department = ?';
      params.push(department);
    }

    query += ' GROUP BY e.status ORDER BY total_amount DESC';

    return this.db.prepare(query).all(...params) as StatusSummaryRow[];
  }
}

// Export singleton instance
export const expenseRepository = new ExpenseRepository();
