import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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

export function SubmitExpense() {
  const navigate = useNavigate()
  const [categories, setCategories] = useState<Category[]>([])
  const [form, setForm] = useState<FormState>({
    categoryId: '',
    amount: '',
    currency: 'USD',
    description: '',
    expenseDate: '',
    receiptUrl: '',
  })
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
      navigate('/expenses/me')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to submit expense')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ maxWidth: 480, padding: 24 }}>
      <h2>Submit Expense</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label htmlFor="categoryId">
            <strong>Category</strong>
          </label>
          <br />
          <select
            id="categoryId"
            name="categoryId"
            value={form.categoryId}
            onChange={handleChange}
            required
            style={{ width: '100%', padding: 6 }}
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
            <small style={{ color: '#92400e' }}>Receipt URL required for this category</small>
          )}
        </div>

        <div>
          <label htmlFor="amount">
            <strong>Amount</strong>
          </label>
          <br />
          <input
            id="amount"
            type="number"
            name="amount"
            value={form.amount}
            onChange={handleChange}
            min="0.01"
            step="0.01"
            required
            style={{ width: '100%', padding: 6 }}
          />
        </div>

        <div>
          <label htmlFor="currency">
            <strong>Currency</strong>
          </label>
          <br />
          <input
            id="currency"
            type="text"
            name="currency"
            value={form.currency}
            onChange={handleChange}
            maxLength={3}
            required
            style={{ width: '80px', padding: 6 }}
          />
        </div>

        <div>
          <label htmlFor="expenseDate">
            <strong>Date</strong>
          </label>
          <br />
          <input
            id="expenseDate"
            type="date"
            name="expenseDate"
            value={form.expenseDate}
            onChange={handleChange}
            required
            style={{ padding: 6 }}
          />
        </div>

        <div>
          <label htmlFor="description">
            <strong>Description</strong>
          </label>
          <br />
          <textarea
            id="description"
            name="description"
            value={form.description}
            onChange={handleChange}
            minLength={10}
            maxLength={500}
            rows={3}
            required
            style={{ width: '100%', padding: 6 }}
          />
        </div>

        {(selectedCategory?.requiresReceipt ?? false) || form.receiptUrl ? (
          <div>
            <label htmlFor="receiptUrl">
              <strong>Receipt URL{selectedCategory?.requiresReceipt ? ' *' : ''}</strong>
            </label>
            <br />
            <input
              id="receiptUrl"
              type="url"
              name="receiptUrl"
              value={form.receiptUrl}
              onChange={handleChange}
              required={selectedCategory?.requiresReceipt ?? false}
              style={{ width: '100%', padding: 6 }}
            />
          </div>
        ) : null}

        {error && <p style={{ color: 'red', margin: 0 }}>{error}</p>}

        <button type="submit" disabled={submitting} style={{ padding: '8px 16px', alignSelf: 'flex-start' }}>
          {submitting ? 'Submitting…' : 'Submit Expense'}
        </button>
      </form>
    </div>
  )
}
