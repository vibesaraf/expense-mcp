export interface User {
  userId: string
  name: string
  email: string
  roles: string[]
  department?: string
  managerId?: string
  managerName?: string
}

export interface Category {
  categoryId: number
  categoryName: string
  description?: string
  requiresReceipt: boolean
  maxAmount?: number
}

export interface Expense {
  expenseId: string
  submitterId: string
  categoryId: number
  categoryName: string
  amount: number
  currency: string
  description: string
  expenseDate: string
  receiptUrl?: string
  status: 'pending' | 'approved' | 'rejected' | 'paid'
  submittedAt: string
  updatedAt: string
  submitter: { userId: string; fullName: string; email: string; department?: string }
}

export interface ExpenseSummary {
  totalAmount: number
  pendingAmount: number
  approvedAmount: number
  rejectedAmount: number
  paidAmount: number
}

export interface ExpenseListResponse {
  expenses: Expense[]
  pagination: { currentPage: number; totalPages: number; totalItems: number; itemsPerPage: number }
  summary: ExpenseSummary
}

export interface AuditLog {
  id: string
  userId: string
  actorType: 'user' | 'agent'
  actorClientId: string | null
  action: string
  resourceType: string
  resourceId: string | null
  scopeUsed: string | null
  statusCode: number
  createdAt: string
}

export interface ActivityResponse {
  logs: AuditLog[]
  pagination: { currentPage: number; totalPages: number; totalItems: number; itemsPerPage: number }
}
