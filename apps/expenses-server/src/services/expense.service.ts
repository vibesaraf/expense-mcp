import {
  expenseRepository,
  categoryRepository,
  userRepository,
  approvalRepository,
  type ExpenseFilters,
} from "../db/repositories/index.js";
import type {
  Expense,
  ExpenseWithSubmitter,
  ExpenseWithApprovalHistory,
  CreateExpenseInput,
} from "../types/expense.types.js";
import type { AuthenticatedUser } from "../types/auth.types.js";
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
  ConflictError,
  UnauthorizedError,
} from "../utils/errors.js";
import { ExpenseStatus } from "../config/constants.js";
import {
  isFinanceAdmin,
  isManagerOrHigher,
} from "../middleware/rbac.middleware.js";

export class ExpenseService {
  /**
   * Submit a new expense
   */
  async submitExpense(
    user: AuthenticatedUser,
    input: CreateExpenseInput,
  ): Promise<ExpenseWithSubmitter> {
    // Validate category exists
    const category = categoryRepository.findById(input.categoryId);
    if (!category) {
      throw new NotFoundError("Category", input.categoryId.toString());
    }

    // Check amount limit
    if (
      !categoryRepository.isAmountWithinLimit(input.categoryId, input.amount)
    ) {
      throw new ValidationError(
        `Amount exceeds category limit of ${category.maxAmount}`,
        { maxAmount: category.maxAmount, providedAmount: input.amount },
      );
    }

    // Check if receipt is required
    if (
      categoryRepository.requiresReceipt(input.categoryId) &&
      !input.receiptUrl
    ) {
      throw new ValidationError(
        `Receipt is required for category '${category.categoryName}'`,
        { categoryName: category.categoryName },
      );
    }

    const dbUser = userRepository.findById(user.userId);
    if (!dbUser) {
      throw new UnauthorizedError("User not registered");
    }

    // Create the expense
    const expense = expenseRepository.create(user.userId, input);

    return expenseRepository.findByIdWithSubmitter(expense.expenseId)!;
  }

  /**
   * Get user's own expenses
   */
  async getMyExpenses(
    user: AuthenticatedUser,
    filters: Omit<ExpenseFilters, "submitterId">,
  ) {
    return expenseRepository.listByUser(user.userId, filters);
  }

  /**
   * Get team expenses (for managers)
   */
  async getTeamExpenses(
    user: AuthenticatedUser,
    teamId: string | undefined,
    filters: Omit<ExpenseFilters, "submitterId">,
  ) {
    // If no teamId provided, use user as manager
    const managerId = teamId || user.userId;

    // If user is not finance admin and trying to view another team, verify they are the manager
    if (!isFinanceAdmin(user) && managerId !== user.userId) {
      throw new ForbiddenError("You can only view your own team expenses");
    }

    return expenseRepository.listByTeam(managerId, filters);
  }

  /**
   * Get all expenses (for finance admin)
   */
  async getAllExpenses(user: AuthenticatedUser, filters: ExpenseFilters) {
    // Finance admins can see all
    if (!isFinanceAdmin(user)) {
      throw new ForbiddenError("Only finance admins can view all expenses");
    }

    return expenseRepository.list(filters);
  }

  /**
   * Get expense details with approval history
   */
  async getExpenseDetails(
    user: AuthenticatedUser,
    expenseId: string,
  ): Promise<ExpenseWithApprovalHistory> {
    const expense = expenseRepository.findByIdWithSubmitter(expenseId);
    if (!expense) {
      throw new NotFoundError("Expense", expenseId);
    }

    // Check access
    const canView = await this.canViewExpense(user, expense);
    if (!canView) {
      throw new ForbiddenError(
        "You do not have permission to view this expense",
      );
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
    notes?: string,
  ): Promise<ExpenseWithApprovalHistory> {
    const expense = expenseRepository.findByIdWithSubmitter(expenseId);
    if (!expense) {
      throw new NotFoundError("Expense", expenseId);
    }

    // Check if already processed
    if (expense.status !== ExpenseStatus.PENDING) {
      throw new ConflictError(
        `Cannot approve expense with status '${expense.status}'`,
        { currentStatus: expense.status },
      );
    }

    // Check authorization
    const canApprove = await this.canApproveExpense(user, expense);
    if (!canApprove) {
      throw new ForbiddenError(
        "You do not have permission to approve this expense",
      );
    }

    // Prevent self-approval
    if (expense.submitterId === user.userId) {
      throw new ForbiddenError("You cannot approve your own expense");
    }

    // Update status
    expenseRepository.updateStatus(expenseId, ExpenseStatus.APPROVED);

    // Create approval record
    approvalRepository.create(expenseId, user.userId, "approved", notes);

    return this.getExpenseDetails(user, expenseId);
  }

  /**
   * Reject an expense
   */
  async rejectExpense(
    user: AuthenticatedUser,
    expenseId: string,
    reason: string,
  ): Promise<ExpenseWithApprovalHistory> {
    const expense = expenseRepository.findByIdWithSubmitter(expenseId);
    if (!expense) {
      throw new NotFoundError("Expense", expenseId);
    }

    // Check if already processed
    if (expense.status !== ExpenseStatus.PENDING) {
      throw new ConflictError(
        `Cannot reject expense with status '${expense.status}'`,
        { currentStatus: expense.status },
      );
    }

    // Check authorization
    const canApprove = await this.canApproveExpense(user, expense);
    if (!canApprove) {
      throw new ForbiddenError(
        "You do not have permission to reject this expense",
      );
    }

    // Update status
    expenseRepository.updateStatus(expenseId, ExpenseStatus.REJECTED);

    // Create rejection record
    approvalRepository.create(expenseId, user.userId, "rejected", reason);

    return this.getExpenseDetails(user, expenseId);
  }

  /**
   * Check if user can view an expense
   */
  private async canViewExpense(
    user: AuthenticatedUser,
    expense: ExpenseWithSubmitter,
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
    expense: ExpenseWithSubmitter,
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
