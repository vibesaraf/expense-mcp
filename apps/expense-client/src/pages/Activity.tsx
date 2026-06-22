import { useState, useEffect } from 'react'
import { apiFetch, ApiError } from '../lib/api'
import type { ActivityResponse, AuditLog } from '../types'

// Fill in actual LoginRadius client IDs → display names for your deployment.
const AGENT_NAMES: Record<string, string> = {}

function agentLabel(clientId: string | null): string {
  if (!clientId) return '🤖 Agent'
  return `🤖 ${AGENT_NAMES[clientId] ?? clientId}`
}

function performedVia(log: AuditLog): string {
  return log.actorType === 'user' ? 'Web App' : agentLabel(log.actorClientId)
}

function statusColor(code: number): string {
  if (code >= 200 && code < 300) return '#065f46'
  if (code >= 400) return '#991b1b'
  return '#374151'
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

const TH_STYLE: React.CSSProperties = {
  textAlign: 'left',
  padding: '6px 8px',
  borderBottom: '2px solid #e5e7eb',
  whiteSpace: 'nowrap',
}

const TD_STYLE: React.CSSProperties = { padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }

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
    <div style={{ padding: 24 }}>
      <h2>Activity</h2>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
        <label>
          Performed via{' '}
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
          Action{' '}
          <input
            type="text"
            value={filters.action}
            placeholder="e.g. approve_expense"
            onChange={e => setFilters(p => ({ ...p, action: e.target.value }))}
            style={{ width: 180 }}
          />
        </label>
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
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={TH_STYLE}>Timestamp</th>
                  <th style={TH_STYLE}>User</th>
                  <th style={TH_STYLE}>Action</th>
                  <th style={TH_STYLE}>Resource</th>
                  <th style={TH_STYLE}>Performed via</th>
                  <th style={TH_STYLE}>Scope used</th>
                  <th style={TH_STYLE}>Result</th>
                </tr>
              </thead>
              <tbody>
                {result.logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ ...TD_STYLE, color: '#6b7280', padding: 16 }}>
                      No activity found.
                    </td>
                  </tr>
                ) : (
                  result.logs.map(log => (
                    <tr key={log.id}>
                      <td style={{ ...TD_STYLE, whiteSpace: 'nowrap' }}>
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td style={{ ...TD_STYLE, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {log.userId}
                      </td>
                      <td style={{ ...TD_STYLE, fontFamily: 'monospace' }}>{log.action}</td>
                      <td style={{ ...TD_STYLE, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {resourceLabel(log)}
                      </td>
                      <td style={{ ...TD_STYLE, whiteSpace: 'nowrap' }}>
                        {log.actorType === 'user' ? (
                          <span style={{ color: '#1e40af' }}>Web App</span>
                        ) : (
                          <span style={{ color: '#6d28d9' }}>{performedVia(log)}</span>
                        )}
                      </td>
                      <td style={{ ...TD_STYLE, fontFamily: 'monospace', fontSize: 11 }}>
                        {log.scopeUsed ?? '—'}
                      </td>
                      <td style={{ ...TD_STYLE, fontWeight: 600, color: statusColor(log.statusCode) }}>
                        {log.statusCode}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                type="button"
                disabled={pagination.currentPage === 1}
                onClick={() => setPage(pagination.currentPage - 1)}
              >
                Prev
              </button>
              <span>Page {pagination.currentPage} of {pagination.totalPages}</span>
              <button
                type="button"
                disabled={pagination.currentPage === pagination.totalPages}
                onClick={() => setPage(pagination.currentPage + 1)}
              >
                Next
              </button>
            </div>
          )}

          <p style={{ marginTop: 8, fontSize: 12, color: '#9ca3af' }}>
            {pagination?.totalItems ?? 0} total rows
          </p>
        </>
      )}
    </div>
  )
}
