# Phase 4: API Business Logic Implementation

## Overview
This phase implements the REST API endpoints with controllers, services, validators, and proper route configuration. It wires up authentication and RBAC middleware.

## Prerequisites
- Phases 0-3 completed
- Database seeded with test data
- Repositories implemented

---

## Step 1: Create Request Validators

### Create `apps/expense-server/src/api/validators/expense.validator.ts`:

```typescript
import { z } from 'zod';
import { ExpenseStatus, ReportTypes } from '../../config/constants';

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
  page: z.string().transform(Number).pipe(z.number().int().positive()).default('1'),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).default('20'),
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
```

### Create `apps/expense-server/src/api/validators/report.validator.ts`:

```typescript
import { z } from 'zod';
import { ReportTypes, ExpenseStatus } from '../../config/constants';

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
```

### Create `apps/expense-server/src/api/validators/index.ts`:

```typescript
export * from './expense.validator';
export * from './report.validator';
```

---

## Step 2: Create Service Layer

### Create `apps/expense-server/src/services/expense.service.ts`:

```typescript
import { 
  expenseRepository, 
  categoryRepository, 
  userRepository,
  approvalRepository,
  auditRepository,
  type ExpenseFilters 
} from '../db/repositories';
import type { 
  Expense, 
  ExpenseWithSubmitter, 
  ExpenseWithApprovalHistory,
  CreateExpenseInput 
} from '../types/expense.types';
import type { AuthenticatedUser } from '../types/auth.types';
import { 
  NotFoundError, 
  ValidationError, 
  ForbiddenError, 
  ConflictError 
} from '../utils/errors';
import { ExpenseStatus, UserRoles } from '../config/constants';
import { isFinanceAdmin, isManagerOrHigher } from '../middleware/rbac.middleware';

export class ExpenseService {
  /**
   * Submit a new expense
   */
  async submitExpense(
    user: AuthenticatedUser,
    input: CreateExpenseInput
  ): Promise<ExpenseWithSubmitter> {
    // Validate category exists
    const category = categoryRepository.findById(input.categoryId);
    if (!category) {
      throw new NotFoundError('Category', input.categoryId.toString());
    }

    // Check amount limit
    if (!categoryRepository.isAmountWithinLimit(input.categoryId, input.amount)) {
      throw new ValidationError(
        `Amount exceeds category limit of ${category.maxAmount}`,
        { maxAmount: category.maxAmount, providedAmount: input.amount }
      );
    }

    // Check if receipt is required
    if (categoryRepository.requiresReceipt(input.categoryId) && !input.receiptUrl) {
      throw new ValidationError(
        `Receipt is required for category '${category.categoryName}'`,
        { categoryName: category.categoryName }
      );
    }

    // Ensure user exists in local DB (sync from Descope if needed)
    let dbUser = userRepository.findById(user.userId);
    if (!dbUser) {
      // Create user in local DB
      dbUser = userRepository.create({
        userId: user.userId,
        email: user.email,
        fullName: user.name || user.email,
        role: user.roles[0] || UserRoles.EMPLOYEE,
        department: user.department,
      });
    }

    // Create the expense
    const expense = expenseRepository.create(user.userId, input);

    // Log audit
    auditRepository.create({
      userId: user.userId,
      action: 'expense:submit',
      resourceType: 'expense',
      resourceId: expense.expenseId,
      details: { amount: input.amount, categoryId: input.categoryId },
    });

    return expenseRepository.findByIdWithSubmitter(expense.expenseId)!;
  }

  /**
   * Get user's own expenses
   */
  async getMyExpenses(
    user: AuthenticatedUser,
    filters: Omit<ExpenseFilters, 'submitterId'>
  ) {
    return expenseRepository.listByUser(user.userId, filters);
  }

  /**
   * Get team expenses (for managers)
   */
  async getTeamExpenses(
    user: AuthenticatedUser,
    teamId: string | undefined,
    filters: Omit<ExpenseFilters, 'submitterId'>
  ) {
    // If no teamId provided, use user as manager
    const managerId = teamId || user.userId;

    // If user is not finance admin and trying to view another team, verify they are the manager
    if (!isFinanceAdmin(user) && managerId !== user.userId) {
      throw new ForbiddenError('You can only view your own team expenses');
    }

    return expenseRepository.listByTeam(managerId, filters);
  }

  /**
   * Get all expenses (for finance admin)
   */
  async getAllExpenses(
    user: AuthenticatedUser,
    filters: ExpenseFilters
  ) {
    // Finance admins can see all
    if (!isFinanceAdmin(user)) {
      throw new ForbiddenError('Only finance admins can view all expenses');
    }

    return expenseRepository.list(filters);
  }

  /**
   * Get expense details with approval history
   */
  async getExpenseDetails(
    user: AuthenticatedUser,
    expenseId: string
  ): Promise<ExpenseWithApprovalHistory> {
    const expense = expenseRepository.findByIdWithSubmitter(expenseId);
    if (!expense) {
      throw new NotFoundError('Expense', expenseId);
    }

    // Check access
    const canView = await this.canViewExpense(user, expense);
    if (!canView) {
      throw new ForbiddenError('You do not have permission to view this expense');
    }

    // Get approval history
    const approvalHistory = approvalRepository.getApprovalHistory(expenseId);

    return {
      ...expense,
      approvalHistory,
    };
  }

  /**
   * Approve an expense
   */
  async approveExpense(
    user: AuthenticatedUser,
    expenseId: string,
    notes?: string
  ): Promise<ExpenseWithApprovalHistory> {
    const expense = expenseRepository.findByIdWithSubmitter(expenseId);
    if (!expense) {
      throw new NotFoundError('Expense', expenseId);
    }

    // Check if already processed
    if (expense.status !== ExpenseStatus.PENDING) {
      throw new ConflictError(
        `Cannot approve expense with status '${expense.status}'`,
        { currentStatus: expense.status }
      );
    }

    // Check authorization
    const canApprove = await this.canApproveExpense(user, expense);
    if (!canApprove) {
      throw new ForbiddenError('You do not have permission to approve this expense');
    }

    // Prevent self-approval
    if (expense.submitterId === user.userId) {
      throw new ForbiddenError('You cannot approve your own expense');
    }

    // Update status
    expenseRepository.updateStatus(expenseId, ExpenseStatus.APPROVED);

    // Create approval record
    approvalRepository.create(expenseId, user.userId, 'approved', notes);

    // Log audit
    auditRepository.create({
      userId: user.userId,
      action: 'expense:approve',
      resourceType: 'expense',
      resourceId: expenseId,
      details: { notes },
    });

    // Return updated expense with history
    return this.getExpenseDetails(user, expenseId);
  }

  /**
   * Reject an expense
   */
  async rejectExpense(
    user: AuthenticatedUser,
    expenseId: string,
    reason: string
  ): Promise<ExpenseWithApprovalHistory> {
    const expense = expenseRepository.findByIdWithSubmitter(expenseId);
    if (!expense) {
      throw new NotFoundError('Expense', expenseId);
    }

    // Check if already processed
    if (expense.status !== ExpenseStatus.PENDING) {
      throw new ConflictError(
        `Cannot reject expense with status '${expense.status}'`,
        { currentStatus: expense.status }
      );
    }

    // Check authorization
    const canApprove = await this.canApproveExpense(user, expense);
    if (!canApprove) {
      throw new ForbiddenError('You do not have permission to reject this expense');
    }

    // Update status
    expenseRepository.updateStatus(expenseId, ExpenseStatus.REJECTED);

    // Create rejection record
    approvalRepository.create(expenseId, user.userId, 'rejected', reason);

    // Log audit
    auditRepository.create({
      userId: user.userId,
      action: 'expense:reject',
      resourceType: 'expense',
      resourceId: expenseId,
      details: { reason },
    });

    // Return updated expense with history
    return this.getExpenseDetails(user, expenseId);
  }

  /**
   * Check if user can view an expense
   */
  private async canViewExpense(
    user: AuthenticatedUser,
    expense: ExpenseWithSubmitter
  ): Promise<boolean> {
    // Finance admin can view all
    if (isFinanceAdmin(user)) return true;

    // User can view their own
    if (expense.submitterId === user.userId) return true;

    // Manager can view team expenses
    if (isManagerOrHigher(user)) {
      return userRepository.isTeamMember(expense.submitterId, user.userId);
    }

    return false;
  }

  /**
   * Check if user can approve/reject an expense
   */
  private async canApproveExpense(
    user: AuthenticatedUser,
    expense: ExpenseWithSubmitter
  ): Promise<boolean> {
    // Finance admin can approve all
    if (isFinanceAdmin(user)) return true;

    // Manager can approve team expenses
    if (isManagerOrHigher(user)) {
      return userRepository.isTeamMember(expense.submitterId, user.userId);
    }

    return false;
  }
}

// Export singleton instance
export const expenseService = new ExpenseService();
```

### Create `apps/expense-server/src/services/report.service.ts`:

```typescript
import { 
  expenseRepository, 
  userRepository,
  auditRepository 
} from '../db/repositories';
import type { AuthenticatedUser } from '../types/auth.types';
import type { ReportResponse, ExpenseListResponse } from '../types/api.types';
import type { GenerateReportInput } from '../api/validators/report.validator';
import { ForbiddenError } from '../utils/errors';
import { isFinanceAdmin } from '../middleware/rbac.middleware';
import { generateUUID } from '../utils/uuid';
import type { ExpenseStatusType, ReportType } from '../config/constants';

export class ReportService {
  /**
   * Generate an expense report
   */
  async generateReport(
    user: AuthenticatedUser,
    input: GenerateReportInput
  ): Promise<ReportResponse> {
    // Only finance admins can generate reports
    if (!isFinanceAdmin(user)) {
      throw new ForbiddenError('Only finance admins can generate reports');
    }

    const reportId = `report_${new Date().toISOString().replace(/[-:T.Z]/g, '').substring(0, 14)}`;

    // Get expense data based on filters
    const filters = {
      fromDate: input.fromDate,
      toDate: input.toDate,
      status: input.status ? [input.status] : undefined,
      department: input.department ? [input.department] : undefined,
      limit: 1000, // Get all for report
    };

    const expenseData = expenseRepository.list(filters);

    // Get summaries
    const byCategory = expenseRepository.getSummaryByCategory(
      input.fromDate,
      input.toDate,
      input.department
    );

    const byStatus = expenseRepository.getSummaryByStatus(
      input.fromDate,
      input.toDate,
      input.department
    );

    const byDepartment = input.department 
      ? undefined 
      : expenseRepository.getSummaryByDepartment(input.fromDate, input.toDate);

    // Build response
    const report: ReportResponse = {
      reportId,
      reportType: input.reportType as ReportType,
      period: {
        fromDate: input.fromDate,
        toDate: input.toDate,
      },
      filters: {
        department: input.department,
        status: input.status as ExpenseStatusType | undefined,
      },
      summary: {
        totalExpenses: expenseData.pagination.totalItems,
        totalAmount: expenseData.summary.totalAmount,
        currency: 'USD',
        byCategory: byCategory.reduce((acc, cat) => {
          acc[cat.category_name] = cat.total_amount;
          return acc;
        }, {} as Record<string, number>),
        byStatus: byStatus.reduce((acc, status) => {
          acc[status.status] = status.total_amount;
          return acc;
        }, {} as Record<string, number>),
        ...(byDepartment && {
          byDepartment: byDepartment.reduce((acc, dept) => {
            acc[dept.department] = dept.total_amount;
            return acc;
          }, {} as Record<string, number>),
        }),
      },
      generatedAt: new Date().toISOString(),
      generatedBy: {
        userId: user.userId,
        fullName: user.name || user.email,
      },
    };

    // Include detailed expenses if report type is detailed
    if (input.reportType === 'detailed') {
      report.expenses = expenseData.expenses.map(exp => ({
        expenseId: exp.expenseId,
        submitter: exp.submitter.fullName,
        category: exp.categoryName,
        amount: exp.amount,
        status: exp.status,
        expenseDate: exp.expenseDate,
      }));
    }

    // Log audit
    auditRepository.create({
      userId: user.userId,
      action: 'report:generate',
      resourceType: 'report',
      resourceId: reportId,
      details: {
        reportType: input.reportType,
        period: { from: input.fromDate, to: input.toDate },
        filters: { department: input.department, status: input.status },
      },
    });

    return report;
  }
}

// Export singleton instance
export const reportService = new ReportService();
```

### Create `apps/expense-server/src/services/index.ts`:

```typescript
export { expenseService, ExpenseService } from './expense.service';
export { reportService, ReportService } from './report.service';
```

---

## Step 3: Create Controllers

### Create `apps/expense-server/src/api/controllers/expense.controller.ts`:

```typescript
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
        throw new ValidationError('Invalid expense data', { errors: parsed.error.errors });
      }

      const expense = await expenseService.submitExpense(req.auth!, parsed.data);
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
        throw new ValidationError('Invalid query parameters', { errors: parsed.error.errors });
      }

      const result = await expenseService.getMyExpenses(req.auth!, parsed.data);
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
        throw new ValidationError('Invalid query parameters', { errors: parsed.error.errors });
      }

      const teamId = req.params.teamId;
      const result = await expenseService.getTeamExpenses(req.auth!, teamId, parsed.data);
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
        throw new ValidationError('Invalid query parameters', { errors: parsed.error.errors });
      }

      const result = await expenseService.getAllExpenses(req.auth!, parsed.data);
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
      const expense = await expenseService.getExpenseDetails(req.auth!, expenseId);
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
        throw new ValidationError('Invalid approval data', { errors: parsed.error.errors });
      }

      const { expenseId } = req.params;
      const expense = await expenseService.approveExpense(req.auth!, expenseId, parsed.data.notes);
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
        throw new ValidationError('Invalid rejection data', { errors: parsed.error.errors });
      }

      const { expenseId } = req.params;
      const expense = await expenseService.rejectExpense(req.auth!, expenseId, parsed.data.reason);
      sendSuccess(res, expense);
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export const expenseController = new ExpenseController();
```

### Create `apps/expense-server/src/api/controllers/report.controller.ts`:

```typescript
import type { Request, Response, NextFunction } from 'express';
import { reportService } from '../../services';
import { sendSuccess } from '../../utils/response';
import { generateReportSchema } from '../validators';
import { ValidationError } from '../../utils/errors';

export class ReportController {
  /**
   * POST /api/expenses/reports/generate - Generate expense report
   */
  async generateReport(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = generateReportSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Invalid report parameters', { errors: parsed.error.errors });
      }

      const report = await reportService.generateReport(req.auth!, parsed.data);
      sendSuccess(res, report);
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export const reportController = new ReportController();
```

### Create `apps/expense-server/src/api/controllers/category.controller.ts`:

```typescript
import type { Request, Response, NextFunction } from 'express';
import { categoryRepository } from '../../db/repositories';
import { sendSuccess } from '../../utils/response';

export class CategoryController {
  /**
   * GET /api/categories - List all expense categories
   */
  async listCategories(_req: Request, res: Response, next: NextFunction) {
    try {
      const categories = categoryRepository.findAll();
      sendSuccess(res, { categories });
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export const categoryController = new CategoryController();
```

### Create `apps/expense-server/src/api/controllers/index.ts`:

```typescript
export { expenseController } from './expense.controller';
export { reportController } from './report.controller';
export { categoryController } from './category.controller';
```

---

## Step 4: Create API Routes

### Create `apps/expense-server/src/api/routes/expense.routes.ts`:

```typescript
import { Router } from 'express';
import { expenseController } from '../controllers';
import { 
  authMiddleware, 
  requireScopes, 
  requireAnyScope,
  requireManager,
  requireFinanceAdmin,
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
  auditMiddleware('expense:list:own', 'expense'),
  expenseController.listMyExpenses.bind(expenseController)
);

/**
 * GET /expenses/team/:teamId? - List team expenses
 * Required scope: expense:view:team
 * Required role: manager or finance_admin
 */
router.get(
  '/team/:teamId?',
  requireScopes(McpScopes.EXPENSE_VIEW_TEAM),
  requireManager(),
  auditMiddleware('expense:list:team', 'expense'),
  expenseController.listTeamExpenses.bind(expenseController)
);

/**
 * GET /expenses/all - List all expenses (company-wide)
 * Required scope: expense:view:all
 * Required role: finance_admin
 */
router.get(
  '/all',
  requireScopes(McpScopes.EXPENSE_VIEW_ALL),
  requireFinanceAdmin(),
  auditMiddleware('expense:list:all', 'expense'),
  expenseController.listAllExpenses.bind(expenseController)
);

/**
 * GET /expenses/:expenseId - Get expense details
 * Required scope: any view scope (access checked in service)
 */
router.get(
  '/:expenseId',
  requireAnyScope(McpScopes.EXPENSE_VIEW_OWN, McpScopes.EXPENSE_VIEW_TEAM, McpScopes.EXPENSE_VIEW_ALL),
  auditMiddleware('expense:view', 'expense'),
  expenseController.getExpenseDetails.bind(expenseController)
);

/**
 * POST /expenses/:expenseId/approve - Approve an expense
 * Required scope: expense:approve
 * Required role: manager or finance_admin
 */
router.post(
  '/:expenseId/approve',
  requireScopes(McpScopes.EXPENSE_APPROVE),
  requireManager(),
  auditMiddleware('expense:approve', 'expense'),
  expenseController.approveExpense.bind(expenseController)
);

/**
 * POST /expenses/:expenseId/reject - Reject an expense
 * Required scope: expense:approve
 * Required role: manager or finance_admin
 */
router.post(
  '/:expenseId/reject',
  requireScopes(McpScopes.EXPENSE_APPROVE),
  requireManager(),
  auditMiddleware('expense:reject', 'expense'),
  expenseController.rejectExpense.bind(expenseController)
);

export { router as expenseRoutes };
```

### Create `apps/expense-server/src/api/routes/report.routes.ts`:

```typescript
import { Router } from 'express';
import { reportController } from '../controllers';
import { 
  authMiddleware, 
  requireScopes, 
  requireFinanceAdmin,
  auditMiddleware 
} from '../../middleware';
import { McpScopes } from '../../config/constants';

const router = Router();

// All report routes require authentication
router.use(authMiddleware);

/**
 * POST /reports/generate - Generate expense report
 * Required scope: expense:report:generate
 * Required role: finance_admin
 */
router.post(
  '/generate',
  requireScopes(McpScopes.EXPENSE_REPORT_GENERATE),
  requireFinanceAdmin(),
  auditMiddleware('report:generate', 'report'),
  reportController.generateReport.bind(reportController)
);

export { router as reportRoutes };
```

### Create `apps/expense-server/src/api/routes/category.routes.ts`:

```typescript
import { Router } from 'express';
import { categoryController } from '../controllers';
import { authMiddleware } from '../../middleware';

const router = Router();

/**
 * GET /categories - List all expense categories
 * Requires authentication but no specific scope
 */
router.get(
  '/',
  authMiddleware,
  categoryController.listCategories.bind(categoryController)
);

export { router as categoryRoutes };
```

### Create `apps/expense-server/src/api/routes/index.ts`:

```typescript
export { expenseRoutes } from './expense.routes';
export { reportRoutes } from './report.routes';
export { categoryRoutes } from './category.routes';
```

---

## Step 5: Update API Router

Update `apps/expense-server/src/api/index.ts`:

```typescript
import { Router } from 'express';
import type { Request, Response } from 'express';
import { expenseRoutes } from './routes/expense.routes';
import { reportRoutes } from './routes/report.routes';
import { categoryRoutes } from './routes/category.routes';

const apiRouter = Router();

/**
 * API Health check endpoint (no auth required)
 */
apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
  });
});

/**
 * API Info endpoint (no auth required)
 */
apiRouter.get('/', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      name: 'Expense Management API',
      version: '1.0.0',
      endpoints: {
        categories: 'GET /api/categories',
        submitExpense: 'POST /api/expenses',
        myExpenses: 'GET /api/expenses/me',
        teamExpenses: 'GET /api/expenses/team/:teamId?',
        allExpenses: 'GET /api/expenses/all',
        expenseDetails: 'GET /api/expenses/:expenseId',
        approveExpense: 'POST /api/expenses/:expenseId/approve',
        rejectExpense: 'POST /api/expenses/:expenseId/reject',
        generateReport: 'POST /api/expenses/reports/generate',
      },
      authentication: 'Bearer token required (Descope JWT)',
      documentation: 'See README.md for detailed API documentation',
    },
  });
});

// Mount routes
apiRouter.use('/expenses', expenseRoutes);
apiRouter.use('/expenses/reports', reportRoutes);
apiRouter.use('/categories', categoryRoutes);

export { apiRouter };
```

---

## Step 6: Verification

After completing Phase 4:

1. Start the server:
   ```bash
   cd apps/expense-server
   bun run dev
   ```

2. Test API info endpoint:
   ```bash
   curl http://localhost:3000/api
   ```

3. Test category listing (requires auth):
   ```bash
   # This should return 401 without token
   curl http://localhost:3000/api/categories
   ```

4. To test with authentication, you'll need a valid Descope JWT token.

---

## Files Created/Modified in This Phase

1. `apps/expense-server/src/api/validators/expense.validator.ts`
2. `apps/expense-server/src/api/validators/report.validator.ts`
3. `apps/expense-server/src/api/validators/index.ts`
4. `apps/expense-server/src/services/expense.service.ts`
5. `apps/expense-server/src/services/report.service.ts`
6. `apps/expense-server/src/services/index.ts`
7. `apps/expense-server/src/api/controllers/expense.controller.ts`
8. `apps/expense-server/src/api/controllers/report.controller.ts`
9. `apps/expense-server/src/api/controllers/category.controller.ts`
10. `apps/expense-server/src/api/controllers/index.ts`
11. `apps/expense-server/src/api/routes/expense.routes.ts`
12. `apps/expense-server/src/api/routes/report.routes.ts`
13. `apps/expense-server/src/api/routes/category.routes.ts`
14. `apps/expense-server/src/api/routes/index.ts`
15. `apps/expense-server/src/api/index.ts` (updated)

---

## API Endpoints Summary

| Method | Endpoint | Description | Scope | Role |
|--------|----------|-------------|-------|------|
| GET | /api/categories | List categories | (auth only) | Any |
| POST | /api/expenses | Submit expense | expense:submit | Any |
| GET | /api/expenses/me | List own expenses | expense:view:own | Any |
| GET | /api/expenses/team/:teamId? | List team expenses | expense:view:team | Manager+ |
| GET | /api/expenses/all | List all expenses | expense:view:all | Finance Admin |
| GET | /api/expenses/:id | Get expense details | expense:view:* | (access checked) |
| POST | /api/expenses/:id/approve | Approve expense | expense:approve | Manager+ |
| POST | /api/expenses/:id/reject | Reject expense | expense:approve | Manager+ |
| POST | /api/expenses/reports/generate | Generate report | expense:report:generate | Finance Admin |