import { useState, useEffect, useRef } from 'react'

const PRESET_CATEGORIES = [
  'Credit Card Loans','Bank Loans','Bills','Insurances','Shyaamrudh','Additional',
]

export default function AddEditModal({ mode, initial, categories, onSave, onClose }) {
  const isEdit = mode === 'edit'
  const allCats = [...new Set([...PRESET_CATEGORIES, ...categories])]

  const [name,     setName]     = useState(initial?.name        ?? '')
  const [category, setCategory] = useState(initial?.category    ?? allCats[0] ?? '')
  const [newCat,   setNewCat]   = useState('')
  const [amount,   setAmount]   = useState(initial?.amount      ?? '')
  const [status,   setStatus]   = useState(initial?.status      ?? 'UNPAID')
  const [desc,     setDesc]     = useState(initial?.description  ?? '')
  const [useNew,   setUseNew]   = useState(false)
  const [saving,   setSaving]   = useState(false)

  const nameRef = useRef(null)
  useEffect(() => { nameRef.current?.focus() }, [])

  const finalCategory = useNew ? newCat.trim() : category

  const valid = name.trim() && finalCategory && parseFloat(amount) > 0

  const submit = async (e) => {
    e.preventDefault()
    if (!valid) return
    setSaving(true)
    try {
      await onSave({
        name:        name.trim(),
        category:    finalCategory,
        amount:      parseFloat(amount),
        status,
        description: desc.trim(),
      })
    } finally {
      setSaving(false)
    }
  }

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>{isEdit ? '✏️ Edit Commitment' : '➕ Add Commitment'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form className="modal-form" onSubmit={submit}>
          {/* Category */}
          <label className="form-label">Category</label>
          {!useNew ? (
            <div className="field-row">
              <select
                className="form-select"
                value={category}
                onChange={e => setCategory(e.target.value)}
              >
                {allCats.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button type="button" className="btn-new-cat" onClick={() => setUseNew(true)}>
                + New
              </button>
            </div>
          ) : (
            <div className="field-row">
              <input
                className="form-input"
                value={newCat}
                onChange={e => setNewCat(e.target.value)}
                placeholder="New category name"
                autoFocus
              />
              <button type="button" className="btn-new-cat" onClick={() => setUseNew(false)}>
                ← Back
              </button>
            </div>
          )}

          {/* Name */}
          <label className="form-label">Name</label>
          <input
            ref={nameRef}
            className="form-input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. HSBC, Netflix, Groceries"
            required
          />

          {/* Amount */}
          <label className="form-label">Amount (RM)</label>
          <input
            className="form-input"
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            step="0.01"
            min="0"
            required
          />

          {/* Status */}
          <label className="form-label">Status</label>
          <div className="status-toggle">
            <button
              type="button"
              className={`toggle-btn ${status === 'UNPAID' ? 'active-unpaid' : ''}`}
              onClick={() => setStatus('UNPAID')}
            >
              🔴 UNPAID
            </button>
            <button
              type="button"
              className={`toggle-btn ${status === 'PAID' ? 'active-paid' : ''}`}
              onClick={() => setStatus('PAID')}
            >
              ✅ PAID
            </button>
          </div>

          {/* Description */}
          <label className="form-label">Description <span className="opt">(optional)</span></label>
          <input
            className="form-input"
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder="e.g. Ambank car loan, paid for May"
          />

          {/* Actions */}
          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={!valid || saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Commitment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
