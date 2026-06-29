import { useState, useEffect } from 'react'
import { apiFetch, ApiError } from '../lib/api'
import type { Category, Expense } from '../types'

interface FormState {
  categoryId: string
  amount: string
  currency: string
  description: string
  expenseDate: string
  receiptUrl: string
}

const EMPTY: FormState = {
  categoryId: '',
  amount: '',
  currency: 'USD',
  description: '',
  expenseDate: '',
  receiptUrl: '',
}

interface Props {
  onClose: () => void
  onSuccess: () => void
}

export function ExpenseModal({ onClose, onSuccess }: Props) {
  const [categories, setCategories] = useState<Category[]>([])
  const [form, setForm] = useState<FormState>(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiFetch<{ categories: Category[] }>('/categories')
      .then(data => setCategories(data.categories))
      .catch(() => setError('Failed to load categories'))
  }, [])

  const selectedCategory = categories.find(c => c.categoryId === Number(form.categoryId))

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await apiFetch<Expense>('/expenses', {
        method: 'POST',
        body: JSON.stringify({
          categoryId: Number(form.categoryId),
          amount: Number(form.amount),
          currency: form.currency || 'USD',
          description: form.description,
          expenseDate: form.expenseDate,
          receiptUrl: form.receiptUrl || undefined,
        }),
      })
      onSuccess()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to submit expense')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-header">
          <h3 id="modal-title">New Expense</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label htmlFor="categoryId" className="form-label">Category</label>
              <select
                id="categoryId"
                name="categoryId"
                value={form.categoryId}
                onChange={handleChange}
                required
                className="form-select"
              >
                <option value="">Select a category</option>
                {categories.map(c => (
                  <option key={c.categoryId} value={c.categoryId}>
                    {c.categoryName}
                    {c.maxAmount != null ? ` (max $${c.maxAmount})` : ''}
                  </option>
                ))}
              </select>
              {selectedCategory?.requiresReceipt && (
                <span className="form-hint" style={{ color: '#92400e' }}>
                  Receipt URL required for this category
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label htmlFor="amount" className="form-label">Amount</label>
                <input
                  id="amount"
                  type="number"
                  name="amount"
                  value={form.amount}
                  onChange={handleChange}
                  min="0.01"
                  step="0.01"
                  required
                  className="form-input"
                />
              </div>
              <div className="form-group" style={{ width: 80 }}>
                <label htmlFor="currency" className="form-label">Currency</label>
                <input
                  id="currency"
                  type="text"
                  name="currency"
                  value={form.currency}
                  onChange={handleChange}
                  maxLength={3}
                  required
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="expenseDate" className="form-label">Date</label>
              <input
                id="expenseDate"
                type="date"
                name="expenseDate"
                value={form.expenseDate}
                onChange={handleChange}
                required
                className="form-input"
                style={{ width: 'auto' }}
              />
            </div>

            <div className="form-group">
              <label htmlFor="description" className="form-label">Description</label>
              <textarea
                id="description"
                name="description"
                value={form.description}
                onChange={handleChange}
                minLength={10}
                maxLength={500}
                rows={3}
                required
                className="form-textarea"
              />
              <span className="form-hint">{form.description.length}/500</span>
            </div>

            {((selectedCategory?.requiresReceipt ?? false) || form.receiptUrl) && (
              <div className="form-group">
                <label htmlFor="receiptUrl" className="form-label">
                  Receipt URL{selectedCategory?.requiresReceipt ? ' *' : ''}
                </label>
                <input
                  id="receiptUrl"
                  type="url"
                  name="receiptUrl"
                  value={form.receiptUrl}
                  onChange={handleChange}
                  required={selectedCategory?.requiresReceipt ?? false}
                  className="form-input"
                />
              </div>
            )}

            {error && <div className="alert-error">{error}</div>}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
