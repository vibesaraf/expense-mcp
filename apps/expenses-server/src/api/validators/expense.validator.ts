import { z } from 'zod';
import { ExpenseStatus, ReportTypes } from '../../config/constants.js';

/**
 * Schema for creating a new expense
 */
export const createExpenseSchema = z.object({
    categoryId: z.number().int().positive('Category ID must be a positive integer'),
    amount: z.number().positive('Amount must be greater than 0'),
    currency: z.string().length(3, 'Currency must be a 3-letter code').default('USD'),
    description: z.string().min(10, 'Description must be at least 10 characters'),
    expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    receiptUrl: z.string().url('Receipt URL must be a valid URL').optional(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

/**
 * Schema for listing expenses (query parameters)
 */
export const listExpensesQuerySchema = z.object({
    status: z.string()
        .transform(val => val.split(','))
        .pipe(z.array(z.enum(['pending', 'approved', 'rejected', 'paid'])))
        .optional(),
    fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    categoryId: z.string()
        .transform(val => val.split(',').map(Number))
        .pipe(z.array(z.number().int().positive()))
        .optional(),
    page: z.string().transform(Number).pipe(z.number().int().positive()).default(1),
    limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).default(20),
});

export type ListExpensesQuery = z.infer<typeof listExpensesQuerySchema>;

/**
 * Schema for listing all expenses (includes department filter)
 */
export const listAllExpensesQuerySchema = listExpensesQuerySchema.extend({
    department: z.string()
        .transform(val => val.split(','))
        .optional(),
    submitterId: z.string().optional(),
});

export type ListAllExpensesQuery = z.infer<typeof listAllExpensesQuerySchema>;

/**
 * Schema for approving an expense
 */
export const approveExpenseSchema = z.object({
    notes: z.string().max(500, 'Notes cannot exceed 500 characters').optional(),
});

export type ApproveExpenseInput = z.infer<typeof approveExpenseSchema>;

/**
 * Schema for rejecting an expense
 */
export const rejectExpenseSchema = z.object({
    reason: z.string().min(10, 'Rejection reason must be at least 10 characters'),
});

export type RejectExpenseInput = z.infer<typeof rejectExpenseSchema>;
