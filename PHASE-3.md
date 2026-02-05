# Phase 3: Database Repository Functions

## Overview
This phase implements the repository pattern for all database operations, providing a clean abstraction layer between the business logic and the database.

## Prerequisites
- Phase 0, 1, and 2 completed
- Database tables created and seeded

---

## Step 1: Create Base Repository Utilities

Create `apps/expense-server/src/db/repositories/base.ts`:

```typescript
import type Database from 'better-sqlite3';
import { getDb } from '../index';

/**
 * Base repository with common database utilities
 */
export abstract class BaseRepository {
  protected get db(): Database.Database {
    return getDb();
  }

  /**
   * Convert SQLite datetime string to Date object
   */
  protected toDate(sqliteDate: string): Date {
    return new Date(sqliteDate + 'Z'); // Append Z to treat as UTC
  }

  /**
   * Convert Date to SQLite datetime string
   */
  protected toSqliteDate(date: Date): string {
    return date.toISOString().replace('T', ' ').replace('Z', '');
  }

  /**
   * Build WHERE clause from filters
   */
  protected buildWhereClause(
    conditions: string[],
    baseWhere = ''
  ): string {
    const allConditions = baseWhere ? [baseWhere, ...conditions] : conditions;
    if (allConditions.length === 0) return '';
    return 'WHERE ' + allConditions.join(' AND ');
  }

  /**
   * Build pagination clause
   */
  protected buildPaginationClause(page: number, limit: number): string {
    const offset = (page - 1) * limit;
    return `LIMIT ${limit} OFFSET ${offset}`;
  }

  /**
   * Calculate pagination info
   */
  protected calculatePagination(
    totalItems: number,
    page: number,
    limit: number
  ): { currentPage: number; totalPages: number; totalItems: number; itemsPerPage: number } {
    return {
      currentPage: page,
      totalPages: Math.ceil(totalItems / limit),
      totalItems,
      itemsPerPage: limit,
    };
  }
}
```

---

## Step 2: Create User Repository

Create `apps/expense-server/src/db/repositories/user.repository.ts`:

```typescript
import { BaseRepository } from './base';
import type { User, CreateUserInput, UpdateUserInput } from '../../types/user.types';
import type { UserRow } from '../types';
import type { UserRole } from '../../config/constants';

export class UserRepository extends BaseRepository {
  /**
   * Convert database row to User object
   */
  private rowToUser(row: UserRow): User {
    return {
      userId: row.user_id,
      email: row.email,
      fullName: row.full_name,
      role: row.role as UserRole,
      department: row.department || undefined,
      managerId: row.manager_id || undefined,
      createdAt: this.toDate(row.created_at),
      updatedAt: this.toDate(row.updated_at),
    };
  }

  /**
   * Find user by ID
   */
  findById(userId: string): User | null {
    const row = this.db.prepare(`
      SELECT * FROM users WHERE user_id = ?
    `).get(userId) as UserRow | undefined;

    return row ? this.rowToUser(row) : null;
  }

  /**
   * Find user by email
   */
  findByEmail(email: string): User | null {
    const row = this.db.prepare(`
      SELECT * FROM users WHERE email = ?
    `).get(email) as UserRow | undefined;

    return row ? this.rowToUser(row) : null;
  }

  /**
   * Get all users
   */
  findAll(): User[] {
    const rows = this.db.prepare(`
      SELECT * FROM users ORDER BY full_name
    `).all() as UserRow[];

    return rows.map(row => this.rowToUser(row));
  }

  /**
   * Get users by department
   */
  findByDepartment(department: string): User[] {
    const rows = this.db.prepare(`
      SELECT * FROM users WHERE department = ? ORDER BY full_name
    `).all(department) as UserRow[];

    return rows.map(row => this.rowToUser(row));
  }

  /**
   * Get users managed by a specific manager
   */
  findByManager(managerId: string): User[] {
    const rows = this.db.prepare(`
      SELECT * FROM users WHERE manager_id = ? ORDER BY full_name
    `).all(managerId) as UserRow[];

    return rows.map(row => this.rowToUser(row));
  }

  /**
   * Get all team members (direct reports) for a manager
   */
  getTeamMembers(managerId: string): User[] {
    return this.findByManager(managerId);
  }

  /**
   * Check if a user is a team member of a manager
   */
  isTeamMember(userId: string, managerId: string): boolean {
    const result = this.db.prepare(`
      SELECT 1 FROM users WHERE user_id = ? AND manager_id = ?
    `).get(userId, managerId);

    return !!result;
  }

  /**
   * Create a new user
   */
  create(input: CreateUserInput): User {
    const now = new Date().toISOString();
    
    this.db.prepare(`
      INSERT INTO users (user_id, email, full_name, role, department, manager_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.userId,
      input.email,
      input.fullName,
      input.role,
      input.department || null,
      input.managerId || null,
      now,
      now
    );

    return this.findById(input.userId)!;
  }

  /**
   * Update a user
   */
  update(userId: string, input: UpdateUserInput): User | null {
    const user = this.findById(userId);
    if (!user) return null;

    const updates: string[] = [];
    const values: unknown[] = [];

    if (input.email !== undefined) {
      updates.push('email = ?');
      values.push(input.email);
    }
    if (input.fullName !== undefined) {
      updates.push('full_name = ?');
      values.push(input.fullName);
    }
    if (input.role !== undefined) {
      updates.push('role = ?');
      values.push(input.role);
    }
    if (input.department !== undefined) {
      updates.push('department = ?');
      values.push(input.department);
    }
    if (input.managerId !== undefined) {
      updates.push('manager_id = ?');
      values.push(input.managerId);
    }

    if (updates.length === 0) return user;

    updates.push("updated_at = datetime('now')");
    values.push(userId);

    this.db.prepare(`
      UPDATE users SET ${updates.join(', ')} WHERE user_id = ?
    `).run(...values);

    return this.findById(userId);
  }

  /**
   * Upsert user (create or update)
   * Useful for syncing users from Descope
   */
  upsert(input: CreateUserInput): User {
    const existing = this.findById(input.userId);
    
    if (existing) {
      return this.update(input.userId, {
        email: input.email,
        fullName: input.fullName,
        role: input.role,
        department: input.department,
        managerId: input.managerId,
      })!;
    }
    
    return this.create(input);
  }

  /**
   * Delete a user
   */
  delete(userId: string): boolean {
    const result = this.db.prepare(`
      DELETE FROM users WHERE user_id = ?
    `).run(userId);

    return result.changes > 0;
  }

  /**
   * Get user's manager
   */
  getManager(userId: string): User | null {
    const user = this.findById(userId);
    if (!user || !user.managerId) return null;
    return this.findById(user.managerId);
  }

  /**
   * Get all departments
   */
  getDepartments(): string[] {
    const rows = this.db.prepare(`
      SELECT DISTINCT department FROM users 
      WHERE department IS NOT NULL 
      ORDER BY department
    `).all() as Array<{ department: string }>;

    return rows.map(row => row.department);
  }
}

// Export singleton instance
export const userRepository = new UserRepository();
```

---

## Step 3: Create Category Repository

Create `apps/expense-server/src/db/repositories/category.repository.ts`:

```typescript
import { BaseRepository } from './base';
import type { ExpenseCategory } from '../../types/expense.types';
import type { ExpenseCategoryRow } from '../types';

export class CategoryRepository extends BaseRepository {
  /**
   * Convert database row to ExpenseCategory object
   */
  private rowToCategory(row: ExpenseCategoryRow): ExpenseCategory {
    return {
      categoryId: row.category_id,
      categoryName: row.category_name,
      description: row.description || undefined,
      requiresReceipt: row.requires_receipt === 1,
      maxAmount: row.max_amount || undefined,
      createdAt: this.toDate(row.created_at),
    };
  }

  /**
   * Find category by ID
   */
  findById(categoryId: number): ExpenseCategory | null {
    const row = this.db.prepare(`
      SELECT * FROM expense_categories WHERE category_id = ?
    `).get(categoryId) as ExpenseCategoryRow | undefined;

    return row ? this.rowToCategory(row) : null;
  }

  /**
   * Find category by name
   */
  findByName(categoryName: string): ExpenseCategory | null {
    const row = this.db.prepare(`
      SELECT * FROM expense_categories WHERE category_name = ?
    `).get(categoryName) as ExpenseCategoryRow | undefined;

    return row ? this.rowToCategory(row) : null;
  }

  /**
   * Get all categories
   */
  findAll(): ExpenseCategory[] {
    const rows = this.db.prepare(`
      SELECT * FROM expense_categories ORDER BY category_name
    `).all() as ExpenseCategoryRow[];

    return rows.map(row => this.rowToCategory(row));
  }

  /**
   * Check if an amount is within category limit
   */
  isAmountWithinLimit(categoryId: number, amount: number): boolean {
    const category = this.findById(categoryId);
    if (!category || category.maxAmount === undefined) return true;
    return amount <= category.maxAmount;
  }

  /**
   * Check if category requires receipt
   */
  requiresReceipt(categoryId: number): boolean {
    const category = this.findById(categoryId);
    return category?.requiresReceipt ?? false;
  }

  /**
   * Create a new category
   */
  create(input: {
    categoryName: string;
    description?: string;
    requiresReceipt?: boolean;
    maxAmount?: number;
  }): ExpenseCategory {
    const result = this.db.prepare(`
      INSERT INTO expense_categories (category_name, description, requires_receipt, max_amount)
      VALUES (?, ?, ?, ?)
    `).run(
      input.categoryName,
      input.description || null,
      input.requiresReceipt ? 1 : 0,
      input.maxAmount || null
    );

    return this.findById(result.lastInsertRowid as number)!;
  }

  /**
   * Update a category
   */
  update(
    categoryId: number,
    input: {
      categoryName?: string;
      description?: string;
      requiresReceipt?: boolean;
      maxAmount?: number | null;
    }
  ): ExpenseCategory | null {
    const category = this.findById(categoryId);
    if (!category) return null;

    const updates: string[] = [];
    const values: unknown[] = [];

    if (input.categoryName !== undefined) {
      updates.push('category_name = ?');
      values.push(input.categoryName);
    }
    if (input.description !== undefined) {
      updates.push('description = ?');
      values.push(input.description);
    }
    if (input.requiresReceipt !== undefined) {
      updates.push('requires_receipt = ?');
      values.push(input.requiresReceipt ? 1 : 0);
    }
    if (input.maxAmount !== undefined) {
      updates.push('max_amount = ?');
      values.push(input.maxAmount);
    }

    if (updates.length === 0) return category;

    values.push(categoryId);

    this.db.prepare(`
      UPDATE expense_categories SET ${updates.join(', ')} WHERE category_id = ?
    `).run(...values);

    return this.findById(categoryId);
  }

  /**
   * Delete a category
   */
  delete(categoryId: number): boolean {
    const result = this.db.prepare(`
      DELETE FROM expense_categories WHERE category_id = ?
    `).run(categoryId);

    return result.changes > 0;
  }
}

// Export singleton instance
export const categoryRepository = new CategoryRepository();
```

---

## Step 4: Create Expense Repository

Create `apps/expense-server/src/db/repositories/expense.repository.ts`:

```typescript
import { BaseRepository } from './base';
import type { 
  Expense, 
  ExpenseWithCategory, 
  ExpenseWithSubmitter,
  CreateExpenseInput 
} from '../../types/expense.types';
import type { 
  ExpenseRow, 
  ExpenseWithCategoryRow, 
  ExpenseWithSubmitterRow,
  ExpenseSummaryRow,
  CategorySummaryRow,
  DepartmentSummaryRow,
  StatusSummaryRow
} from '../types';
import type { ExpenseStatusType } from '../../config/constants';
import { generateUUID } from '../../utils/uuid';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../config/constants';

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
```

---

## Step 5: Create Approval Repository

Create `apps/expense-server/src/db/repositories/approval.repository.ts`:

```typescript
import { BaseRepository } from './base';
import type { ExpenseApproval, ApprovalHistoryItem } from '../../types/expense.types';
import type { ExpenseApprovalRow, ExpenseApprovalWithApproverRow } from '../types';
import type { ApprovalActionType } from '../../config/constants';

export class ApprovalRepository extends BaseRepository {
  /**
   * Convert database row to ExpenseApproval object
   */
  private rowToApproval(row: ExpenseApprovalRow): ExpenseApproval {
    return {
      approvalId: row.approval_id,
      expenseId: row.expense_id,
      approverId: row.approver_id,
      action: row.action as 'approved' | 'rejected',
      notes: row.notes || undefined,
      approvedAt: this.toDate(row.approved_at),
    };
  }

  /**
   * Convert database row to ApprovalHistoryItem
   */
  private rowToHistoryItem(row: ExpenseApprovalWithApproverRow): ApprovalHistoryItem {
    return {
      approver: {
        userId: row.approver_id,
        fullName: row.approver_full_name,
        email: row.approver_email,
      },
      action: row.action as 'approved' | 'rejected',
      notes: row.notes || undefined,
      approvedAt: this.toDate(row.approved_at),
    };
  }

  /**
   * Find approval by ID
   */
  findById(approvalId: number): ExpenseApproval | null {
    const row = this.db.prepare(`
      SELECT * FROM expense_approvals WHERE approval_id = ?
    `).get(approvalId) as ExpenseApprovalRow | undefined;

    return row ? this.rowToApproval(row) : null;
  }

  /**
   * Get approval history for an expense
   */
  getApprovalHistory(expenseId: string): ApprovalHistoryItem[] {
    const rows = this.db.prepare(`
      SELECT 
        ea.*,
        u.full_name as approver_full_name,
        u.email as approver_email
      FROM expense_approvals ea
      JOIN users u ON ea.approver_id = u.user_id
      WHERE ea.expense_id = ?
      ORDER BY ea.approved_at DESC
    `).all(expenseId) as ExpenseApprovalWithApproverRow[];

    return rows.map(row => this.rowToHistoryItem(row));
  }

  /**
   * Get all approvals by an approver
   */
  findByApprover(approverId: string): ExpenseApproval[] {
    const rows = this.db.prepare(`
      SELECT * FROM expense_approvals 
      WHERE approver_id = ?
      ORDER BY approved_at DESC
    `).all(approverId) as ExpenseApprovalRow[];

    return rows.map(row => this.rowToApproval(row));
  }

  /**
   * Create a new approval record
   */
  create(
    expenseId: string,
    approverId: string,
    action: ApprovalActionType,
    notes?: string
  ): ExpenseApproval {
    const result = this.db.prepare(`
      INSERT INTO expense_approvals (expense_id, approver_id, action, notes)
      VALUES (?, ?, ?, ?)
    `).run(expenseId, approverId, action, notes || null);

    return this.findById(result.lastInsertRowid as number)!;
  }

  /**
   * Check if an expense has been approved/rejected by a specific approver
   */
  hasApprovalBy(expenseId: string, approverId: string): boolean {
    const result = this.db.prepare(`
      SELECT 1 FROM expense_approvals 
      WHERE expense_id = ? AND approver_id = ?
    `).get(expenseId, approverId);

    return !!result;
  }

  /**
   * Delete all approvals for an expense
   */
  deleteByExpense(expenseId: string): number {
    const result = this.db.prepare(`
      DELETE FROM expense_approvals WHERE expense_id = ?
    `).run(expenseId);

    return result.changes;
  }
}

// Export singleton instance
export const approvalRepository = new ApprovalRepository();
```

---

## Step 6: Create Audit Repository

Create `apps/expense-server/src/db/repositories/audit.repository.ts`:

```typescript
import { BaseRepository } from './base';
import type { AuditLog } from '../../types/expense.types';
import type { AuditLogRow } from '../types';

export interface CreateAuditLogInput {
  userId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLogFilters {
  userId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

export class AuditRepository extends BaseRepository {
  /**
   * Convert database row to AuditLog object
   */
  private rowToAuditLog(row: AuditLogRow): AuditLog {
    return {
      logId: row.log_id,
      userId: row.user_id,
      action: row.action,
      resourceType: row.resource_type,
      resourceId: row.resource_id || undefined,
      details: row.details ? JSON.parse(row.details) : undefined,
      ipAddress: row.ip_address || undefined,
      userAgent: row.user_agent || undefined,
      timestamp: this.toDate(row.timestamp),
    };
  }

  /**
   * Create a new audit log entry
   */
  create(input: CreateAuditLogInput): AuditLog {
    const result = this.db.prepare(`
      INSERT INTO audit_log 
      (user_id, action, resource_type, resource_id, details, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.userId,
      input.action,
      input.resourceType,
      input.resourceId || null,
      input.details ? JSON.stringify(input.details) : null,
      input.ipAddress || null,
      input.userAgent || null
    );

    return this.findById(result.lastInsertRowid as number)!;
  }

  /**
   * Find audit log by ID
   */
  findById(logId: number): AuditLog | null {
    const row = this.db.prepare(`
      SELECT * FROM audit_log WHERE log_id = ?
    `).get(logId) as AuditLogRow | undefined;

    return row ? this.rowToAuditLog(row) : null;
  }

  /**
   * Search audit logs with filters
   */
  search(filters: AuditLogFilters = {}): { logs: AuditLog[]; total: number } {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));

    const conditions: string[] = [];
    const values: unknown[] = [];

    if (filters.userId) {
      conditions.push('user_id = ?');
      values.push(filters.userId);
    }
    if (filters.action) {
      conditions.push('action = ?');
      values.push(filters.action);
    }
    if (filters.resourceType) {
      conditions.push('resource_type = ?');
      values.push(filters.resourceType);
    }
    if (filters.resourceId) {
      conditions.push('resource_id = ?');
      values.push(filters.resourceId);
    }
    if (filters.fromDate) {
      conditions.push('timestamp >= ?');
      values.push(filters.fromDate);
    }
    if (filters.toDate) {
      conditions.push('timestamp <= ?');
      values.push(filters.toDate);
    }

    const whereClause = conditions.length > 0 
      ? 'WHERE ' + conditions.join(' AND ') 
      : '';

    // Get total count
    const countRow = this.db.prepare(`
      SELECT COUNT(*) as count FROM audit_log ${whereClause}
    `).get(...values) as { count: number };

    // Get paginated results
    const offset = (page - 1) * limit;
    const rows = this.db.prepare(`
      SELECT * FROM audit_log 
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `).all(...values, limit, offset) as AuditLogRow[];

    return {
      logs: rows.map(row => this.rowToAuditLog(row)),
      total: countRow.count,
    };
  }

  /**
   * Get audit logs for a specific resource
   */
  getByResource(resourceType: string, resourceId: string): AuditLog[] {
    const rows = this.db.prepare(`
      SELECT * FROM audit_log 
      WHERE resource_type = ? AND resource_id = ?
      ORDER BY timestamp DESC
    `).all(resourceType, resourceId) as AuditLogRow[];

    return rows.map(row => this.rowToAuditLog(row));
  }

  /**
   * Get recent audit logs for a user
   */
  getRecentByUser(userId: string, limit = 50): AuditLog[] {
    const rows = this.db.prepare(`
      SELECT * FROM audit_log 
      WHERE user_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(userId, limit) as AuditLogRow[];

    return rows.map(row => this.rowToAuditLog(row));
  }

  /**
   * Delete old audit logs (for maintenance)
   */
  deleteOlderThan(days: number): number {
    const result = this.db.prepare(`
      DELETE FROM audit_log 
      WHERE timestamp < datetime('now', '-' || ? || ' days')
    `).run(days);

    return result.changes;
  }
}

// Export singleton instance
export const auditRepository = new AuditRepository();
```

---

## Step 7: Create Repository Index

Create `apps/expense-server/src/db/repositories/index.ts`:

```typescript
export { userRepository, UserRepository } from './user.repository';
export { categoryRepository, CategoryRepository } from './category.repository';
export { expenseRepository, ExpenseRepository, type ExpenseFilters, type ExpenseListResult } from './expense.repository';
export { approvalRepository, ApprovalRepository } from './approval.repository';
export { auditRepository, AuditRepository, type CreateAuditLogInput, type AuditLogFilters } from './audit.repository';
```

---

## Step 8: Verification

After completing Phase 3:

1. Start the server:
   ```bash
   cd apps/expense-server
   bun run dev
   ```

2. You can test repositories by adding temporary test code to `src/index.ts`:
   ```typescript
   import { userRepository, expenseRepository, categoryRepository } from './db/repositories';
   
   // Test user repository
   const users = userRepository.findAll();
   console.log('Users:', users.length);
   
   // Test category repository
   const categories = categoryRepository.findAll();
   console.log('Categories:', categories.length);
   
   // Test expense repository
   const aliceExpenses = expenseRepository.listByUser('user_alice_employee');
   console.log('Alice expenses:', aliceExpenses.expenses.length);
   console.log('Summary:', aliceExpenses.summary);
   ```

3. Verify all repositories compile without errors:
   ```bash
   bun run typecheck
   ```

---

## Files Created in This Phase

1. `apps/expense-server/src/db/repositories/base.ts`
2. `apps/expense-server/src/db/repositories/user.repository.ts`
3. `apps/expense-server/src/db/repositories/category.repository.ts`
4. `apps/expense-server/src/db/repositories/expense.repository.ts`
5. `apps/expense-server/src/db/repositories/approval.repository.ts`
6. `apps/expense-server/src/db/repositories/audit.repository.ts`
7. `apps/expense-server/src/db/repositories/index.ts`

---

## Repository Summary

| Repository | Key Methods |
|------------|-------------|
| `userRepository` | `findById`, `findByEmail`, `findByManager`, `getTeamMembers`, `isTeamMember`, `upsert` |
| `categoryRepository` | `findById`, `findByName`, `findAll`, `isAmountWithinLimit`, `requiresReceipt` |
| `expenseRepository` | `findById`, `findByIdWithSubmitter`, `list`, `listByUser`, `listByTeam`, `create`, `updateStatus`, `getSummaryByCategory` |
| `approvalRepository` | `findById`, `getApprovalHistory`, `create`, `hasApprovalBy` |
| `auditRepository` | `create`, `search`, `getByResource`, `getRecentByUser` |