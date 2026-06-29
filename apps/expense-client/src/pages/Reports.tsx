import { useState } from 'react'
import { apiFetch, ApiError } from '../lib/api'

interface ReportSummary {
  totalExpenses: number
  totalAmount: number
  currency: string
  byCategory: Record<string, number>
  byStatus: Record<string, number>
}

interface DetailedExpense {
  expenseId: string
  submitter: string
  category: string
  amount: number
  status: string
  expenseDate: string
}

interface ReportResult {
  reportId: string
  reportType: 'summary' | 'detailed' | 'by_category'
  period: { fromDate: string; toDate: string }
  summary: ReportSummary
  expenses?: DetailedExpense[]
  generatedAt: string
  generatedBy: { userId: string; fullName: string }
}

type ReportType = 'summary' | 'detailed' | 'by_category'

export function Reports() {
  const [reportType, setReportType] = useState<ReportType>('summary')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [department, setDepartment] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ReportResult | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const data = await apiFetch<ReportResult>('/expenses/reports/generate', {
        method: 'POST',
        body: JSON.stringify({
          reportType,
          fromDate,
          toDate,
          department: department || undefined,
          status: status || undefined,
          format: 'json',
        }),
      })
      setResult(data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to generate report')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Reports</h2>
      </div>

      <div className="card" style={{ maxWidth: 520 }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label htmlFor="reportType" className="form-label">Report Type</label>
            <select
              id="reportType"
              value={reportType}
              onChange={e => setReportType(e.target.value as ReportType)}
              className="form-select"
            >
              <option value="summary">Summary</option>
              <option value="detailed">Detailed</option>
              <option value="by_category">By Category</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="fromDate" className="form-label">From</label>
              <input
                id="fromDate"
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                required
                className="form-input"
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="toDate" className="form-label">To</label>
              <input
                id="toDate"
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                required
                className="form-input"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="department" className="form-label">Department <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--gray-400)' }}>(optional)</span></label>
            <input
              id="department"
              type="text"
              value={department}
              onChange={e => setDepartment(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="statusFilter" className="form-label">Status <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--gray-400)' }}>(optional)</span></label>
            <select
              id="statusFilter"
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="form-select"
            >
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="paid">Paid</option>
            </select>
          </div>

          {error && <div className="alert-error">{error}</div>}

          <div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Generating…' : 'Generate Report'}
            </button>
          </div>
        </form>
      </div>

      {result && (
        <div className="report-result">
          <div>
            <h3 style={{ textTransform: 'capitalize' }}>
              {result.reportType.replace('_', ' ')} report — {result.period.fromDate} to {result.period.toDate}
            </h3>
            <p className="report-meta">
              Generated {new Date(result.generatedAt).toLocaleString()} by {result.generatedBy.fullName}
            </p>
          </div>

          <div className="report-stats">
            <div className="report-stat">
              <span className="report-stat-label">Total Expenses</span>
              <span className="report-stat-value">{result.summary.totalExpenses}</span>
            </div>
            <div className="report-stat">
              <span className="report-stat-label">Total Amount</span>
              <span className="report-stat-value">{result.summary.currency} {result.summary.totalAmount.toFixed(2)}</span>
            </div>
          </div>

          <div className="report-breakdowns">
            <div className="breakdown-section">
              <h4>By Status</h4>
              <table className="breakdown-table">
                <tbody>
                  {Object.entries(result.summary.byStatus).map(([k, v]) => (
                    <tr key={k}>
                      <td style={{ textTransform: 'capitalize' }}>{k}</td>
                      <td>${(v as number).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="breakdown-section">
              <h4>By Category</h4>
              <table className="breakdown-table">
                <tbody>
                  {Object.entries(result.summary.byCategory).map(([k, v]) => (
                    <tr key={k}>
                      <td>{k}</td>
                      <td>${(v as number).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {result.expenses && result.expenses.length > 0 && (
            <div>
              <h4 style={{ marginBottom: 10, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--gray-500)' }}>Expenses</h4>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Submitter</th>
                      <th>Category</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.expenses.map(e => (
                      <tr key={e.expenseId}>
                        <td>{e.submitter}</td>
                        <td>{e.category}</td>
                        <td>${e.amount.toFixed(2)}</td>
                        <td style={{ textTransform: 'capitalize' }}>{e.status}</td>
                        <td className="cell-nowrap">{e.expenseDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
