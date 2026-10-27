import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Edit2,
  FileText,
  IndianRupee,
  Loader2,
  PlusCircle,
  Receipt,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import {
  createExpense,
  deleteExpense,
  EXPENSE_CATEGORIES,
  getExpensesByProperty,
  updateExpense,
} from '../../api/expenseApi'
import { getMyProperties } from '../../api/propertyApi'
import { Button, EmptyState, Input, Loader, Select, Textarea } from '../ui'

/* ─── helpers ─────────────────────────────────────────────── */
const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const formatMoney = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—'
}

const categoryLabel = (cat) =>
  EXPENSE_CATEGORIES.find((c) => c.value === cat)?.label ?? cat ?? '—'

// Factory so every new form instance gets today's actual date, not the module-load date.
const makeEmptyForm = () => ({
  category: '',
  amount: '',
  expenseDate: todayIso(),
  description: '',
  image: null,
})

/* ─── sub-components ──────────────────────────────────────── */

function FieldRow({ label, required, children }) {
  return (
    <div className="w-full">
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#5B6875]">
        {label}
        {required && (
          <span className="ml-1 text-[#B94A48]" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
    </div>
  )
}

function ErrorBanner({ message, onDismiss }) {
  if (!message) return null
  return (
    <div
      role="alert"
      className="flex items-start justify-between gap-3 rounded-md border border-[#F4B4B4] bg-[#FDF2F2] p-3 text-sm text-[#8A2E2C]"
    >
      <span className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        {message}
      </span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss error"
          className="shrink-0 text-[#8A2E2C] hover:text-[#6B1E1C]"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

/* ─── expense form ─────────────────────────────────────────── */

function ExpenseForm({ propertyId, editingExpense, onSuccess, onCancel }) {
  const buildFormFromExpense = (exp) => ({
    category: exp.category ?? '',
    amount: exp.amount != null ? String(exp.amount) : '',
    expenseDate: exp.expenseDate ?? todayIso(),
    description: exp.description ?? '',
    image: null,
  })

  const [form, setForm] = useState(
    editingExpense ? buildFormFromExpense(editingExpense) : makeEmptyForm()
  )
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState('')
  const fileInputRef = useRef(null)

  // Reset form whenever the expense being edited changes (e.g. user clicks
  // Edit on a different row without closing the form first).
  useEffect(() => {
    if (editingExpense) {
      setForm(buildFormFromExpense(editingExpense))
    } else {
      setForm(makeEmptyForm())
    }
    setErrors({})
    setServerError('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingExpense])

  const set = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const validate = () => {
    const errs = {}
    if (!form.category) errs.category = 'Select a category.'
    const amt = Number(form.amount)
    if (!form.amount || !Number.isFinite(amt) || amt <= 0)
      errs.amount = 'Enter a valid positive amount.'
    if (!form.expenseDate) errs.expenseDate = 'Choose a date.'
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }
    setErrors({})
    setServerError('')
    setSaving(true)
    try {
      if (editingExpense) {
        await updateExpense(editingExpense.expenseId, {
          category: form.category,
          amount: form.amount,
          expenseDate: form.expenseDate,
          description: form.description,
        })
      } else {
        await createExpense({
          propertyId,
          category: form.category,
          amount: form.amount,
          expenseDate: form.expenseDate,
          description: form.description,
          image: form.image,
        })
      }
      onSuccess()
    } catch (err) {
      setServerError(err?.message || 'Failed to save expense. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-[#D9E0E6] bg-[#F7F8FA] p-4"
      noValidate
    >
      <p className="text-sm font-semibold text-[#243447]">
        {editingExpense ? 'Edit expense' : 'Add new expense'}
      </p>

      <ErrorBanner message={serverError} onDismiss={() => setServerError('')} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Category */}
        <Select
          label="Category"
          required
          placeholder="Select category"
          value={form.category}
          onChange={set('category')}
          error={errors.category}
          options={EXPENSE_CATEGORIES}
          disabled={saving}
        />

        {/* Amount */}
        <Input
          label="Amount (₹)"
          required
          type="number"
          min="0.01"
          step="0.01"
          placeholder="e.g. 5000"
          value={form.amount}
          onChange={set('amount')}
          error={errors.amount}
          leftIcon={<IndianRupee className="h-3.5 w-3.5" />}
          disabled={saving}
        />

        {/* Date */}
        <Input
          label="Expense Date"
          required
          type="date"
          value={form.expenseDate}
          onChange={set('expenseDate')}
          error={errors.expenseDate}
          disabled={saving}
        />

        {/* Image upload (create-only) */}
        {!editingExpense && (
          <FieldRow label="Receipt / Image (optional)">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-md border border-[#D9E0E6] bg-white px-3 py-2 text-xs font-medium text-[#315A7D] shadow-2xs hover:bg-[#EAF2F7] disabled:opacity-60"
              >
                <Upload className="h-3.5 w-3.5" />
                {form.image ? 'Change file' : 'Attach file'}
              </button>
              {form.image && (
                <span className="max-w-[140px] truncate text-xs text-[#5B6875]">
                  {form.image.name}
                </span>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="sr-only"
              onChange={(e) =>
                setForm((prev) => ({ ...prev, image: e.target.files?.[0] ?? null }))
              }
            />
          </FieldRow>
        )}
      </div>

      {/* Description */}
      <Textarea
        label="Description (optional)"
        placeholder="Enter any additional notes..."
        rows={2}
        value={form.description}
        onChange={set('description')}
        disabled={saving}
      />

      <div className="flex items-center justify-end gap-2 pt-1">
        {onCancel && (
          <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        )}
        <Button type="submit" size="sm" isLoading={saving} disabled={saving}>
          {editingExpense ? 'Save changes' : 'Add expense'}
        </Button>
      </div>
    </form>
  )
}

/* ─── expense list row ─────────────────────────────────────── */

function ExpenseRow({ expense, onEdit, onDelete }) {
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!window.confirm(`Delete this ${categoryLabel(expense.category)} expense of ${formatMoney(expense.amount)}? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await onDelete(expense.expenseId)
    } catch {
      setDeleting(false)
    }
  }

  return (
    <tr className="group border-t border-[#D9E0E6] hover:bg-[#F7F8FA]">
      <td className="px-3 py-3 text-sm font-medium text-[#243447]">
        {categoryLabel(expense.category)}
      </td>
      <td className="px-3 py-3 text-sm text-[#243447]">{formatMoney(expense.amount)}</td>
      <td className="px-3 py-3 text-sm text-[#5B6875]">{expense.expenseDate ?? '—'}</td>
      <td className="px-3 py-3 text-sm text-[#5B6875]">
        <span className="line-clamp-1 max-w-[180px]">{expense.description || '—'}</span>
      </td>
      <td className="px-3 py-3 text-sm text-[#5B6875]">
        {expense.imagePath ? (
          <span className="flex items-center gap-1 text-xs text-[#315A7D]">
            <FileText className="h-3.5 w-3.5" />
            Attached
          </span>
        ) : (
          <span className="text-xs text-[#98A2B3]">None</span>
        )}
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={() => onEdit(expense)}
            title="Edit"
            className="rounded p-1 text-[#315A7D] hover:bg-[#EAF2F7]"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            title="Delete"
            className="rounded p-1 text-[#B94A48] hover:bg-[#FDF2F2] disabled:opacity-50"
          >
            {deleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </td>
    </tr>
  )
}

/* ─── main panel ───────────────────────────────────────────── */

/**
 * OwnerExpensePanel
 *
 * Renders property-scoped expense management exclusively for PROPERTY_OWNER.
 * Loads the owner's properties from GET /api/owner/properties, then loads
 * and manages expenses via /api/expenses/*.
 *
 * @param {{ onExpenseSaved?: () => void }} props
 *   onExpenseSaved — called after a successful create/update/delete so the
 *   parent can refresh the overall report analytics.
 */
export default function OwnerExpensePanel({ onExpenseSaved }) {
  /* ── property list ── */
  const [properties, setProperties] = useState([])
  const [propertiesLoading, setPropertiesLoading] = useState(true)
  const [propertiesError, setPropertiesError] = useState('')

  /* ── selected property + expenses ── */
  const [selectedPropertyId, setSelectedPropertyId] = useState('')
  const [expenses, setExpenses] = useState([])
  const [expensesLoading, setExpensesLoading] = useState(false)
  const [expensesError, setExpensesError] = useState('')
  const [expensesKey, setExpensesKey] = useState(0)

  /* ── form state ── */
  const [showForm, setShowForm] = useState(false)
  const [editingExpense, setEditingExpense] = useState(null)

  /* ── delete error ── */
  const [deleteError, setDeleteError] = useState('')

  /* ── panel collapse ── */
  const [collapsed, setCollapsed] = useState(false)

  /* load owner properties once */
  useEffect(() => {
    setPropertiesLoading(true)
    setPropertiesError('')
    getMyProperties()
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.content ?? []
        setProperties(list)
        if (list.length > 0) {
          const firstId = list[0].propertyId ?? list[0].id
          setSelectedPropertyId(String(firstId))
        }
      })
      .catch((err) => {
        setPropertiesError(err?.message || 'Could not load your properties.')
      })
      .finally(() => setPropertiesLoading(false))
  }, [])

  /* load expenses whenever property or key changes */
  useEffect(() => {
    if (!selectedPropertyId) return
    const controller = new AbortController()
    setExpensesLoading(true)
    setExpensesError('')
    setExpenses([])
    getExpensesByProperty(selectedPropertyId, { signal: controller.signal })
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.content ?? []
        setExpenses(list)
      })
      .catch((err) => {
        if (err?.originalError?.code === 'ERR_CANCELED' || controller.signal.aborted) return
        setExpensesError(err?.message || 'Could not load expenses for this property.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setExpensesLoading(false)
      })
    return () => controller.abort()
  }, [selectedPropertyId, expensesKey])

  const refreshExpenses = useCallback(() => {
    setExpensesKey((k) => k + 1)
    if (onExpenseSaved) onExpenseSaved()
  }, [onExpenseSaved])

  const handleFormSuccess = () => {
    setShowForm(false)
    setEditingExpense(null)
    refreshExpenses()
  }

  const handleEdit = (expense) => {
    setEditingExpense(expense)
    setShowForm(true)
  }

  const handleDelete = async (expenseId) => {
    setDeleteError('')
    try {
      await deleteExpense(expenseId)
      refreshExpenses()
    } catch (err) {
      setDeleteError(err?.message || 'Failed to delete expense. Please try again.')
    }
  }

  const handleCancelForm = () => {
    setShowForm(false)
    setEditingExpense(null)
  }

  /* property options for Select */
  const propertyOptions = properties.map((p) => ({
    value: String(p.propertyId ?? p.id),
    label: p.propertyName ?? p.name ?? `Property ${p.propertyId ?? p.id}`,
  }))

  const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)

  return (
    <section
      className="overflow-hidden rounded-2xl border border-[#C9D9E8] bg-white shadow-[0_12px_32px_rgba(23,50,77,0.08)]"
      aria-labelledby="expense-panel-heading"
    >
      {/* header */}
      <div className="flex items-center justify-between border-b border-[#D5E3EF] bg-gradient-to-r from-[#EAF2F8] via-[#F5F9FC] to-white px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#315A7D] text-white shadow-sm shadow-[#315A7D]/20">
            <Receipt className="h-5 w-5" />
          </span>
          <div>
          <h2
            id="expense-panel-heading"
            className="text-base font-semibold tracking-tight text-[#17324D] sm:text-lg"
          >
            Expense Entry &amp; Management
          </h2>
            <p className="mt-0.5 text-xs text-[#60758A] sm:text-sm">Track property costs and receipts</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-expanded={!collapsed}
          aria-controls="expense-panel-body"
          className="rounded-lg p-2 text-[#315A7D] transition hover:bg-white/80 hover:text-[#17324D]"
        >
          {collapsed ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </button>
      </div>

      {!collapsed && (
        <div id="expense-panel-body" className="space-y-4 bg-gradient-to-b from-[#F8FBFE] to-white p-4 sm:p-5">
          {/* Properties loading/error */}
          {propertiesLoading ? (
            <div className="flex justify-center py-6">
              <Loader text="Loading your properties…" size="sm" center />
            </div>
          ) : propertiesError ? (
            <ErrorBanner message={propertiesError} />
          ) : properties.length === 0 ? (
            <EmptyState
              title="No properties found"
              message="Add a property first before recording expenses."
            />
          ) : (
            <>
              {/* Property selector + action bar */}
              <div className="flex flex-col gap-3 rounded-xl border border-[#D9E6F0] bg-white p-3 shadow-sm sm:flex-row sm:items-end sm:justify-between sm:p-4">
                <div className="max-w-sm flex-1">
                  <Select
                    label="Select property"
                    value={selectedPropertyId}
                    onChange={(e) => {
                      setSelectedPropertyId(e.target.value)
                      setShowForm(false)
                      setEditingExpense(null)
                    }}
                    options={propertyOptions}
                  />
                </div>
                {!showForm && (
                  <Button
                    size="sm"
                    leftIcon={<PlusCircle className="h-4 w-4" />}
                    onClick={() => {
                      setEditingExpense(null)
                      setShowForm(true)
                    }}
                    disabled={!selectedPropertyId}
                  >
                    Add expense
                  </Button>
                )}
              </div>

              {/* Delete error banner */}
              {deleteError && (
                <ErrorBanner
                  message={deleteError}
                  onDismiss={() => setDeleteError('')}
                />
              )}

              {/* Inline form */}
              {showForm && selectedPropertyId && (
                <ExpenseForm
                  propertyId={selectedPropertyId}
                  editingExpense={editingExpense}
                  onSuccess={handleFormSuccess}
                  onCancel={handleCancelForm}
                />
              )}

              {/* Expenses list */}
              {expensesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader text="Loading expenses…" size="sm" center />
                </div>
              ) : expensesError ? (
                <ErrorBanner message={expensesError} onDismiss={() => setExpensesError('')} />
              ) : expenses.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#BFD1E1] bg-[#F5F9FC] p-8 text-center text-sm text-[#5B7185]">
                  <span className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-[#E5EFF7] text-[#315A7D]"><Receipt className="h-5 w-5" /></span>
                  No expenses recorded for this property yet.
                </div>
              ) : (
                <>
                  {/* summary strip */}
                  <div className="flex items-center justify-between rounded-xl border border-[#D3E2EF] bg-gradient-to-r from-[#EAF2F8] to-[#F6FAFD] px-4 py-3 text-xs text-[#536C82]">
                    <span className="font-medium">
                      {expenses.length} expense{expenses.length !== 1 ? 's' : ''}
                    </span>
                    <span className="font-semibold text-[#17324D]">
                      Total <span className="ml-1 text-base">{formatMoney(totalExpenses)}</span>
                    </span>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-[#D8E3EC] bg-white shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left text-sm">
                      <thead className="bg-[#EDF4F9] text-[11px] uppercase tracking-wider text-[#496780]">
                        <tr>
                          <th className="px-3 py-2">Category</th>
                          <th className="px-3 py-2">Amount</th>
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2">Description</th>
                          <th className="px-3 py-2">Receipt</th>
                          <th className="px-3 py-2 sr-only">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#D9E0E6]">
                        {expenses.map((exp) => (
                          <ExpenseRow
                            key={exp.expenseId}
                            expense={exp}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </section>
  )
}
