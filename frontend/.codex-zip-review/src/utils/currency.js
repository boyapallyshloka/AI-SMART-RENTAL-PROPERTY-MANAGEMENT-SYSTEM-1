/**
 * Currency formatting utility for Indian Rupee (INR / ₹)
 * Consistently formats monetary values using Indian numbering system
 */

export const formatCurrency = (amount, options = {}) => {
  if (amount == null || amount === '') return '—'
  const num = Number(amount)
  if (!Number.isFinite(num)) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: options.maximumFractionDigits ?? 0,
    minimumFractionDigits: options.minimumFractionDigits ?? 0,
    ...options,
  }).format(num)
}

export const formatINR = (amount) => {
  if (amount == null || amount === '') return '—'
  const num = Number(amount)
  if (!Number.isFinite(num)) return '—'
  return `₹${num.toLocaleString('en-IN')}`
}

export default formatCurrency
