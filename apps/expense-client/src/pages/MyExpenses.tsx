import { useState, useEffect } from 'react'
import { apiFetch, ApiError } from '../lib/api'
import type { ExpenseListResponse } from '../types'
import { StatusBadge } from '../components/StatusBadge'

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
  const [result, setResult] = useState<ExpenseListResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
  }, [applied])

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
    <div style={{ padding: 24 }}>
      <h2>My Expenses</h2>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
        <fieldset style={{ margin: 0 }}>
          <legend>Status</legend>
          {STATUSES.map(s => (
            <label key={s} style={{ marginRight: 8 }}>
              <input
                type="checkbox"
                checked={filters.status.includes(s)}
                onChange={() => toggleStatus(s)}
              />
              {' '}{s}
            </label>
          ))}
        </fieldset>
        <label>
          From{' '}
          <input
            type="date"
            value={filters.fromDate}
            onChange={e => setFilters(p => ({ ...p, fromDate: e.target.value }))}
          />
        </label>
        <label>
          To{' '}
          <input
            type="date"
            value={filters.toDate}
            onChange={e => setFilters(p => ({ ...p, toDate: e.target.value }))}
          />
        </label>
        <button type="button" onClick={handleApply}>Apply</button>
        <button type="button" onClick={handleReset}>Reset</button>
      </div>

      {loading && <p>Loading…</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {result && (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Date', 'Category', 'Amount', 'Description', 'Status', 'Submitted'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '2px solid #e5e7eb' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.expenses.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 16, color: '#6b7280' }}>No expenses found.</td></tr>
              ) : result.expenses.map(e => (
                <tr key={e.expenseId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '6px 8px' }}>{e.expenseDate}</td>
                  <td style={{ padding: '6px 8px' }}>{e.categoryName}</td>
                  <td style={{ padding: '6px 8px' }}>{e.currency} {e.amount.toFixed(2)}</td>
                  <td style={{ padding: '6px 8px', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description}</td>
                  <td style={{ padding: '6px 8px' }}><StatusBadge status={e.status} /></td>
                  <td style={{ padding: '6px 8px' }}>{new Date(e.submittedAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {summary && (
            <div style={{ marginTop: 12, color: '#374151', fontSize: 14 }}>
              Total: <strong>${summary.totalAmount.toFixed(2)}</strong>
              {' · '}Pending: <strong>${summary.pendingAmount.toFixed(2)}</strong>
              {' · '}Approved: <strong>${summary.approvedAmount.toFixed(2)}</strong>
            </div>
          )}

          {pagination && pagination.totalPages > 1 && (
            <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
              <button type="button" disabled={pagination.currentPage === 1} onClick={() => setPage(pagination.currentPage - 1)}>Prev</button>
              <span>Page {pagination.currentPage} of {pagination.totalPages}</span>
              <button type="button" disabled={pagination.currentPage === pagination.totalPages} onClick={() => setPage(pagination.currentPage + 1)}>Next</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
