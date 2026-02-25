import { Router } from 'express';
import { expenseController } from '../controllers';
import {
    authMiddleware,
    requireScopes,
    requireAnyScope,
    auditMiddleware
} from '../../middleware';
import { McpScopes } from '../../config/constants';

const router = Router();

// All expense routes require authentication
router.use(authMiddleware);

/**
 * POST /expenses - Submit a new expense
 * Required scope: expense:submit
 */
router.post(
    '/',
    requireScopes(McpScopes.EXPENSE_SUBMIT),
    auditMiddleware('expense:submit', 'expense'),
    expenseController.submitExpense.bind(expenseController)
);

/**
 * GET /expenses/me - List user's own expenses
 * Required scope: expense:view:own
 */
router.get(
    '/me',
    requireScopes(McpScopes.EXPENSE_VIEW_OWN),
    expenseController.listMyExpenses.bind(expenseController)
);

/**
 * GET /expenses/team/:teamId? - List team expenses
 * Required scope: expense:view:team
 */
router.get(
    '/team/:teamId',
    requireScopes(McpScopes.EXPENSE_VIEW_TEAM),
    expenseController.listTeamExpenses.bind(expenseController)
);

/**
 * GET /expenses/all - List all expenses (finance admin only)
 * Required scope: expense:view:all
 */
router.get(
    '/all',
    requireScopes(McpScopes.EXPENSE_VIEW_ALL),
    expenseController.listAllExpenses.bind(expenseController)
);

/**
 * GET /expenses/:expenseId - Get expense details
 * Required scope: expense:view
 */
router.get(
    '/:expenseId',
    requireAnyScope(McpScopes.EXPENSE_VIEW_OWN, McpScopes.EXPENSE_VIEW_TEAM, McpScopes.EXPENSE_VIEW_ALL),
    expenseController.getExpenseDetails.bind(expenseController)
);

/**
 * POST /expenses/:expenseId/approve - Approve an expense
 * Required scope: expense:approve
 */
router.post(
    '/:expenseId/approve',
    requireScopes(McpScopes.EXPENSE_APPROVE),
    auditMiddleware('expense:approve', 'expense'),
    expenseController.approveExpense.bind(expenseController)
);

/**
 * POST /expenses/:expenseId/reject - Reject an expense
 * Required scope: expense:approve (uses same scope as approve)
 */
router.post(
    '/:expenseId/reject',
    requireScopes(McpScopes.EXPENSE_APPROVE),
    auditMiddleware('expense:reject', 'expense'),
    expenseController.rejectExpense.bind(expenseController)
);

export const expenseRouter: Router = router;
