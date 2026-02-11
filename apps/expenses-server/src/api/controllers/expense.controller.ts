import type { Request, Response, NextFunction } from 'express';
import { expenseService } from '../../services';
import { sendSuccess, sendCreated } from '../../utils/response';
import {
    createExpenseSchema,
    listExpensesQuerySchema,
    listAllExpensesQuerySchema,
    approveExpenseSchema,
    rejectExpenseSchema,
} from '../validators';
import { ValidationError } from '../../utils/errors';

export class ExpenseController {
    /**
     * POST /api/expenses - Submit a new expense
     */
    async submitExpense(req: Request, res: Response, next: NextFunction) {
        try {
            const parsed = createExpenseSchema.safeParse(req.body);
            if (!parsed.success) {
                throw new ValidationError('Invalid expense data', { errors: parsed.error.issues });
            }

            const expense = await expenseService.submitExpense(req.user!, parsed.data);
            sendCreated(res, expense);
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/expenses/me - List user's own expenses
     */
    async listMyExpenses(req: Request, res: Response, next: NextFunction) {
        try {
            const parsed = listExpensesQuerySchema.safeParse(req.query);
            if (!parsed.success) {
                throw new ValidationError('Invalid query parameters', { errors: parsed.error.issues });
            }

            const result = await expenseService.getMyExpenses(req.user!, parsed.data);
            sendSuccess(res, result);
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/expenses/team/:teamId? - List team expenses
     */
    async listTeamExpenses(req: Request, res: Response, next: NextFunction) {
        try {
            const parsed = listExpensesQuerySchema.safeParse(req.query);
            if (!parsed.success) {
                throw new ValidationError('Invalid query parameters', { errors: parsed.error.issues });
            }

            const teamId = req.params.teamId as string | undefined;
            const result = await expenseService.getTeamExpenses(req.user!, teamId, parsed.data);
            sendSuccess(res, result);
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/expenses/all - List all expenses (finance admin only)
     */
    async listAllExpenses(req: Request, res: Response, next: NextFunction) {
        try {
            const parsed = listAllExpensesQuerySchema.safeParse(req.query);
            if (!parsed.success) {
                throw new ValidationError('Invalid query parameters', { errors: parsed.error.issues });
            }

            const result = await expenseService.getAllExpenses(req.user!, parsed.data);
            sendSuccess(res, result);
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/expenses/:expenseId - Get expense details
     */
    async getExpenseDetails(req: Request, res: Response, next: NextFunction) {
        try {
            const { expenseId } = req.params;
            const expense = await expenseService.getExpenseDetails(req.user!, expenseId as string);
            sendSuccess(res, expense);
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/expenses/:expenseId/approve - Approve an expense
     */
    async approveExpense(req: Request, res: Response, next: NextFunction) {
        try {
            const parsed = approveExpenseSchema.safeParse(req.body);
            if (!parsed.success) {
                throw new ValidationError('Invalid approval data', { errors: parsed.error.issues });
            }

            const { expenseId } = req.params;
            const expense = await expenseService.approveExpense(req.user!, expenseId as string, parsed.data.notes);
            sendSuccess(res, expense);
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/expenses/:expenseId/reject - Reject an expense
     */
    async rejectExpense(req: Request, res: Response, next: NextFunction) {
        try {
            const parsed = rejectExpenseSchema.safeParse(req.body);
            if (!parsed.success) {
                throw new ValidationError('Invalid rejection data', { errors: parsed.error.issues });
            }

            const { expenseId } = req.params;
            const expense = await expenseService.rejectExpense(req.user!, expenseId as string, parsed.data.reason);
            sendSuccess(res, expense);
        } catch (error) {
            next(error);
        }
    }
}

// Export singleton instance
export const expenseController = new ExpenseController();
