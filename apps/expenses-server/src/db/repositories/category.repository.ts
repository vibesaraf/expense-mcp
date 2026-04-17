import { BaseRepository } from './base.js';
import type { ExpenseCategory } from '../../types/expense.types.js';
import type { ExpenseCategoryRow } from '../types.js';

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
