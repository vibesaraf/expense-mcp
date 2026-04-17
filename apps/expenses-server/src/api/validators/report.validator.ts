import { z } from 'zod';
import { ReportTypes, ExpenseStatus } from '../../config/constants.js';

/**
 * Schema for generating an expense report
 */
export const generateReportSchema = z.object({
    reportType: z.enum(['summary', 'detailed', 'by_category']).default('summary'),
    fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    department: z.string().optional(),
    status: z.enum(['pending', 'approved', 'rejected', 'paid']).optional(),
    format: z.enum(['json', 'csv', 'pdf']).default('json'),
}).refine(
    data => new Date(data.fromDate) <= new Date(data.toDate),
    { message: 'fromDate must be before or equal to toDate', path: ['fromDate'] }
);

export type GenerateReportInput = z.infer<typeof generateReportSchema>;
