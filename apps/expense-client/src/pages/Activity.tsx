import { useState, useEffect } from 'react'
import { apiFetch, ApiError } from '../lib/api'
import type { ActivityResponse, AuditLog } from '../types'

const AGENT_NAMES: Record<string, string> = {}

function agentLabel(clientId: string | null): string {
  if (!clientId) return 'Agent'
  return AGENT_NAMES[clientId] ?? clientId
}

function performedVia(log: AuditLog): string {
  return log.actorType === 'user' ? 'Web App' : agentLabel(log.actorClientId)
}

function resourceLabel(log: AuditLog): string {
  return log.resourceId ? `${log.resourceType} / ${log.resourceId}` : log.resourceType
}

interface Filters {
  actorType: 'user' | 'agent' | ''
  action: string
  fromDate: string
  toDate: string
  page: number
}

const INIT: Filters = { actorType: '', action: '', fromDate: '', toDate: '', page: 1 }

export function Activity() {
  const [filters, setFilters] = useState<Filters>(INIT)
  const [applied, setApplied] = useState<Filters>(INIT)
  const [result, setResult] = useState<ActivityResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    const qs = new URLSearchParams()
    if (applied.actorType) qs.set('actorType', applied.actorType)
    if (applied.action) qs.set('action', applied.action)
    if (applied.fromDate) qs.set('fromDate', applied.fromDate)
    if (applied.toDate) qs.set('toDate', applied.toDate)
    qs.set('page', String(applied.page))
    qs.set('limit', '20')
    apiFetch<ActivityResponse>(`/activity?${qs.toString()}`)
      .then(setResult)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : 'Failed to load activity')
      })
      .finally(() => setLoading(false))
  }, [applied])

  const handleApply = () => setApplied({ ...filters, page: 1 })
  const handleReset = () => { setFilters(INIT); setApplied(INIT) }
  const setPage = (p: number) => setApplied(prev => ({ ...prev, page: p }))

  const { pagination } = result ?? {}

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Activity</h2>
      </div>

      <div className="filters-bar">
        <label>
          Performed via
          <select
            value={filters.actorType}
            onChange={e => setFilters(p => ({ ...p, actorType: e.target.value as Filters['actorType'] }))}
          >
            <option value="">All</option>
            <option value="user">Web App only</option>
            <option value="agent">Agent only</option>
          </select>
        </label>
        <label>
          Action
          <input
            type="text"
            value={filters.action}
            placeholder="e.g. approve_expense"
            onChange={e => setFilters(p => ({ ...p, action: e.target.value }))}
            style={{ width: 180 }}
          />
        </label>
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
                  <th>User</th>
                  <th>Action</th>
                  <th>Resource</th>
                  <th>Performed via</th>
                </tr>
              </thead>
              <tbody>
                {result.logs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="empty-cell">No activity found.</td>
                  </tr>
                ) : (
                  result.logs.map(log => (
                    <tr key={log.id}>
                      <td className="cell-truncate" style={{ maxWidth: 140 }}>
                        {log.userId}
                      </td>
                      <td className="cell-mono">{log.action}</td>
                      <td className="cell-truncate" style={{ maxWidth: 180 }}>
                        {resourceLabel(log)}
                      </td>
                      <td className="cell-nowrap">
                        {log.actorType === 'user' ? (
                          <span className="via-user">Web App</span>
                        ) : (
                          <span className="via-agent">🤖 {performedVia(log)}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="pagination">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={pagination.currentPage === 1}
                onClick={() => setPage(pagination.currentPage - 1)}
              >
                Prev
              </button>
              <span>Page {pagination.currentPage} of {pagination.totalPages}</span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={pagination.currentPage === pagination.totalPages}
                onClick={() => setPage(pagination.currentPage + 1)}
              >
                Next
              </button>
            </div>
          )}

          <p style={{ marginTop: 8, fontSize: 11, color: 'var(--gray-400)' }}>
            {pagination?.totalItems ?? 0} total rows
          </p>
        </>
      )}
    </div>
  )
}
