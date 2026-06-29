import { useState, useEffect } from 'react'
import { apiFetch, ApiError } from '../lib/api'
import type { ExpenseListResponse } from '../types'
import { StatusBadge } from '../components/StatusBadge'
import { ExpenseModal } from '../components/ExpenseModal'

const STATUSES = ['pending', 'approved', 'rejected', 'paid'] as const

interface Filters {
  status: string[]
  fromDate: string
  toDate: string
  page: number
}

const INIT: Filters = { status: [], fromDate: '', toDate: '', page: 1 }

export function MyExpenses() {
  const [filters, setFilters] = useState<Filters>(INIT)
  const [applied, setApplied] = useState<Filters>(INIT)
  const [tick, setTick] = useState(0)
  const [result, setResult] = useState<ExpenseListResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(null)
    const qs = new URLSearchParams()
    if (applied.status.length) qs.set('status', applied.status.join(','))
    if (applied.fromDate) qs.set('fromDate', applied.fromDate)
    if (applied.toDate) qs.set('toDate', applied.toDate)
    qs.set('page', String(applied.page))
    qs.set('limit', '20')
    apiFetch<ExpenseListResponse>(`/expenses/me?${qs.toString()}`)
      .then(setResult)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : 'Failed to load expenses')
      })
      .finally(() => setLoading(false))
  }, [applied, tick])

  const toggleStatus = (s: string) =>
    setFilters(prev => ({
      ...prev,
      status: prev.status.includes(s) ? prev.status.filter(x => x !== s) : [...prev.status, s],
    }))

  const handleApply = () => setApplied({ ...filters, page: 1 })
  const handleReset = () => { setFilters(INIT); setApplied(INIT) }
  const setPage = (p: number) => setApplied(prev => ({ ...prev, page: p }))

  const { pagination, summary } = result ?? {}

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">My Expenses</h2>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
          + New Expense
        </button>
      </div>

      <div className="filters-bar">
        <fieldset>
          <legend>Status</legend>
          <div className="checkbox-group">
            {STATUSES.map(s => (
              <label key={s}>
                <input
                  type="checkbox"
                  checked={filters.status.includes(s)}
                  onChange={() => toggleStatus(s)}
                />
                {s}
              </label>
            ))}
          </div>
        </fieldset>
        <label>
          From
          <input
            type="date"
            value={filters.fromDate}
            onChange={e => setFilters(p => ({ ...p, fromDate: e.target.value }))}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={filters.toDate}
            onChange={e => setFilters(p => ({ ...p, toDate: e.target.value }))}
          />
        </label>
        <div className="filter-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={handleApply}>Apply</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={handleReset}>Reset</button>
        </div>
      </div>

      {error && <div className="alert-error">{error}</div>}
      {loading && <p className="loading-text">Loading…</p>}

      {result && (
        <>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {result.expenses.length === 0 ? (
                  <tr><td colSpan={6} className="empty-cell">No expenses found.</td></tr>
                ) : result.expenses.map(e => (
                  <tr key={e.expenseId}>
                    <td className="cell-nowrap">{e.expenseDate}</td>
                    <td>{e.categoryName}</td>
                    <td className="cell-nowrap">{e.currency} {e.amount.toFixed(2)}</td>
                    <td className="cell-truncate">{e.description}</td>
                    <td><StatusBadge status={e.status} /></td>
                    <td className="cell-nowrap">{new Date(e.submittedAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {summary && (
            <div className="summary-strip">
              <span>Total <strong>${summary.totalAmount.toFixed(2)}</strong></span>
              <span>Pending <strong>${summary.pendingAmount.toFixed(2)}</strong></span>
              <span>Approved <strong>${summary.approvedAmount.toFixed(2)}</strong></span>
            </div>
          )}

          {pagination && pagination.totalPages > 1 && (
            <div className="pagination">
              <button type="button" className="btn btn-ghost btn-sm" disabled={pagination.currentPage === 1} onClick={() => setPage(pagination.currentPage - 1)}>Prev</button>
              <span>Page {pagination.currentPage} of {pagination.totalPages}</span>
              <button type="button" className="btn btn-ghost btn-sm" disabled={pagination.currentPage === pagination.totalPages} onClick={() => setPage(pagination.currentPage + 1)}>Next</button>
            </div>
          )}
        </>
      )}

      {showModal && (
        <ExpenseModal
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); setTick(t => t + 1) }}
        />
      )}
    </div>
  )
}
