import { useState, useEffect } from 'react'
import { apiFetch, ApiError } from '../lib/api'
import type { ExpenseListResponse } from '../types'
import { StatusBadge } from '../components/StatusBadge'
import { useAuth } from '../contexts/AuthContext'

const STATUSES = ['pending', 'approved', 'rejected', 'paid'] as const

interface Filters {
  status: string[]
  fromDate: string
  toDate: string
  page: number
}

interface ActionState {
  expenseId: string
  type: 'approve' | 'reject'
  value: string
  error: string
}

const INIT: Filters = { status: [], fromDate: '', toDate: '', page: 1 }

export function TeamExpenses() {
  const { user } = useAuth()
  const [filters, setFilters] = useState<Filters>(INIT)
  const [applied, setApplied] = useState<Filters>(INIT)
  const [tick, setTick] = useState(0)
  const [result, setResult] = useState<ExpenseListResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [action, setAction] = useState<ActionState | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    setError(null)
    const qs = new URLSearchParams()
    if (applied.status.length) qs.set('status', applied.status.join(','))
    if (applied.fromDate) qs.set('fromDate', applied.fromDate)
    if (applied.toDate) qs.set('toDate', applied.toDate)
    qs.set('page', String(applied.page))
    qs.set('limit', '20')
    apiFetch<ExpenseListResponse>(`/expenses/team/${user.userId}?${qs.toString()}`)
      .then(setResult)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : 'Failed to load expenses')
      })
      .finally(() => setLoading(false))
  }, [applied, tick, user])

  const toggleStatus = (s: string) =>
    setFilters(prev => ({
      ...prev,
      status: prev.status.includes(s) ? prev.status.filter(x => x !== s) : [...prev.status, s],
    }))

  const handleApply = () => setApplied({ ...filters, page: 1 })
  const handleReset = () => { setFilters(INIT); setApplied(INIT) }
  const setPage = (p: number) => setApplied(prev => ({ ...prev, page: p }))

  const handleConfirm = async () => {
    if (!action) return
    if (action.type === 'reject' && !action.value.trim()) {
      setAction(prev => prev ? { ...prev, error: 'Reason is required' } : null)
      return
    }
    setSubmitting(true)
    try {
      const body =
        action.type === 'approve'
          ? { notes: action.value || undefined }
          : { reason: action.value }
      await apiFetch(`/expenses/${action.expenseId}/${action.type}`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      setAction(null)
      setTick(t => t + 1)
    } catch (err) {
      setAction(prev =>
        prev ? { ...prev, error: err instanceof ApiError ? err.message : 'Action failed' } : null,
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (!user) return null

  const { pagination, summary } = result ?? {}

  return (
    <div style={{ padding: 24 }}>
      <h2>Team Expenses</h2>

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
                {['Submitter', 'Date', 'Category', 'Amount', 'Description', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '2px solid #e5e7eb' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.expenses.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 16, color: '#6b7280' }}>No expenses found.</td></tr>
              ) : result.expenses.map(e => (
                <>
                  <tr key={e.expenseId} style={{ borderBottom: action?.expenseId === e.expenseId ? 'none' : '1px solid #f3f4f6' }}>
                    <td style={{ padding: '6px 8px' }}>{e.submitter.fullName}</td>
                    <td style={{ padding: '6px 8px' }}>{e.expenseDate}</td>
                    <td style={{ padding: '6px 8px' }}>{e.categoryName}</td>
                    <td style={{ padding: '6px 8px' }}>{e.currency} {e.amount.toFixed(2)}</td>
                    <td style={{ padding: '6px 8px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description}</td>
                    <td style={{ padding: '6px 8px' }}><StatusBadge status={e.status} /></td>
                    <td style={{ padding: '6px 8px' }}>
                      {e.status === 'pending' && action?.expenseId !== e.expenseId && (
                        <span style={{ display: 'flex', gap: 4 }}>
                          <button type="button" onClick={() => setAction({ expenseId: e.expenseId, type: 'approve', value: '', error: '' })}>Approve</button>
                          <button type="button" onClick={() => setAction({ expenseId: e.expenseId, type: 'reject', value: '', error: '' })}>Reject</button>
                        </span>
                      )}
                    </td>
                  </tr>
                  {action?.expenseId === e.expenseId && (
                    <tr key={`${e.expenseId}-action`} style={{ borderBottom: '1px solid #f3f4f6', background: '#f9fafb' }}>
                      <td colSpan={7} style={{ padding: '8px 8px 12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 400 }}>
                          <strong>{action.type === 'approve' ? 'Add notes (optional)' : 'Reason for rejection *'}</strong>
                          <textarea
                            rows={2}
                            value={action.value}
                            onChange={e2 => setAction(prev => prev ? { ...prev, value: e2.target.value, error: '' } : null)}
                            placeholder={action.type === 'approve' ? 'Optional notes…' : 'Required reason…'}
                            style={{ padding: 6 }}
                          />
                          {action.error && <small style={{ color: 'red' }}>{action.error}</small>}
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button type="button" onClick={handleConfirm} disabled={submitting}>
                              {submitting ? 'Submitting…' : `Confirm ${action.type}`}
                            </button>
                            <button type="button" onClick={() => setAction(null)}>Cancel</button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
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
