import { BaseRepository } from './base.js';
import type { ExpenseApproval, ApprovalHistoryItem } from '../../types/expense.types.js';
import type { ExpenseApprovalRow, ExpenseApprovalWithApproverRow } from '../types.js';
import type { ApprovalActionType } from '../../config/constants.js';

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
