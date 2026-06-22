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
    <div style={{ padding: 24 }}>
      <h2>Reports</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 480 }}>
        <div>
          <label htmlFor="reportType"><strong>Report Type</strong></label>
          <br />
          <select
            id="reportType"
            value={reportType}
            onChange={e => setReportType(e.target.value as ReportType)}
            style={{ padding: 6 }}
          >
            <option value="summary">Summary</option>
            <option value="detailed">Detailed</option>
            <option value="by_category">By Category</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <label>
            <strong>From</strong>
            <br />
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} required style={{ padding: 6 }} />
          </label>
          <label>
            <strong>To</strong>
            <br />
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} required style={{ padding: 6 }} />
          </label>
        </div>

        <div>
          <label htmlFor="department"><strong>Department</strong> <small>(optional)</small></label>
          <br />
          <input id="department" type="text" value={department} onChange={e => setDepartment(e.target.value)} style={{ padding: 6 }} />
        </div>

        <div>
          <label htmlFor="statusFilter"><strong>Status</strong> <small>(optional)</small></label>
          <br />
          <select id="statusFilter" value={status} onChange={e => setStatus(e.target.value)} style={{ padding: 6 }}>
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="paid">Paid</option>
          </select>
        </div>

        {error && <p style={{ color: 'red', margin: 0 }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ padding: '8px 16px', alignSelf: 'flex-start' }}>
          {loading ? 'Generating…' : 'Generate Report'}
        </button>
      </form>

      {result && (
        <div style={{ marginTop: 32 }}>
          <h3>
            {result.reportType} report — {result.period.fromDate} to {result.period.toDate}
          </h3>
          <p style={{ color: '#6b7280', fontSize: 13 }}>
            Generated {new Date(result.generatedAt).toLocaleString()} by {result.generatedBy.fullName}
          </p>

          <div style={{ display: 'flex', gap: 24, marginBottom: 24, flexWrap: 'wrap' }}>
            <div>
              <strong>Total Expenses</strong>
              <div style={{ fontSize: 24 }}>{result.summary.totalExpenses}</div>
            </div>
            <div>
              <strong>Total Amount</strong>
              <div style={{ fontSize: 24 }}>{result.summary.currency} {result.summary.totalAmount.toFixed(2)}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
            <div>
              <strong>By Status</strong>
              <table style={{ marginTop: 8, borderCollapse: 'collapse' }}>
                <tbody>
                  {Object.entries(result.summary.byStatus).map(([k, v]) => (
                    <tr key={k}>
                      <td style={{ padding: '3px 12px 3px 0' }}>{k}</td>
                      <td style={{ padding: '3px 0' }}>${(v as number).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <strong>By Category</strong>
              <table style={{ marginTop: 8, borderCollapse: 'collapse' }}>
                <tbody>
                  {Object.entries(result.summary.byCategory).map(([k, v]) => (
                    <tr key={k}>
                      <td style={{ padding: '3px 12px 3px 0' }}>{k}</td>
                      <td style={{ padding: '3px 0' }}>${(v as number).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {result.expenses && result.expenses.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <strong>Expenses</strong>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
                <thead>
                  <tr>
                    {['Submitter', 'Category', 'Amount', 'Status', 'Date'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '2px solid #e5e7eb' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.expenses.map(e => (
                    <tr key={e.expenseId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '6px 8px' }}>{e.submitter}</td>
                      <td style={{ padding: '6px 8px' }}>{e.category}</td>
                      <td style={{ padding: '6px 8px' }}>${e.amount.toFixed(2)}</td>
                      <td style={{ padding: '6px 8px' }}>{e.status}</td>
                      <td style={{ padding: '6px 8px' }}>{e.expenseDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
