import { useState, useEffect, useRef, useCallback } from 'react'
import {
  getPocketBillings, addPocketBilling, updatePocketBilling, deletePocketBilling, fmt,
} from '../lib/api.js'

// ── Billing Form (inline add / edit) ─────────────────────────────────────
function BillingForm({ initial, onSave, onCancel }) {
  const today = new Date().toISOString().slice(0, 10)
  const [name,        setName]        = useState(initial?.name        ?? '')
  const [amount,      setAmount]      = useState(initial?.amount      ?? '')
  const [date,        setDate]        = useState(initial?.date        ?? today)
  const [description, setDescription] = useState(initial?.description ?? '')
  const [saving,      setSaving]      = useState(false)
  const nameRef = useRef(null)

  useEffect(() => { nameRef.current?.focus() }, [])

  const valid = name.trim() && parseFloat(amount) > 0

  const submit = async (e) => {
    e.preventDefault()
    if (!valid) return
    setSaving(true)
    try {
      await onSave({ name: name.trim(), amount: parseFloat(amount), date, description: description.trim() })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="billing-form" onSubmit={submit}>
      <div className="billing-form-row">
        {/* Name */}
        <div className="billing-form-field">
          <label className="billing-form-label">Description</label>
          <input
            ref={nameRef}
            className="form-input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Grocery run, Doctor visit"
            required
          />
        </div>

        {/* Amount */}
        <div className="billing-form-field billing-form-field--sm">
          <label className="billing-form-label">Amount (RM)</label>
          <input
            className="form-input"
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            step="0.01"
            min="0.01"
            required
          />
        </div>

        {/* Date */}
        <div className="billing-form-field billing-form-field--sm">
          <label className="billing-form-label">Date</label>
          <input
            className="form-input"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            required
          />
        </div>
      </div>

      {/* Notes */}
      <div className="billing-form-field">
        <label className="billing-form-label">Notes <span className="opt">(optional)</span></label>
        <input
          className="form-input"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Optional notes"
        />
      </div>

      <div className="billing-form-actions">
        <button type="button" className="btn-cancel" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={!valid || saving}>
          {saving ? 'Saving…' : initial ? 'Save Changes' : 'Add Billing'}
        </button>
      </div>
    </form>
  )
}

// ── Main Modal ────────────────────────────────────────────────────────────
export default function PocketBillingModal({ pocket, onClose, onBillingChange }) {
  const [billings,  setBillings]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [editBill,  setEditBill]  = useState(null)   // billing being edited

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setBillings(await getPocketBillings(pocket.id))
    } catch (e) { alert('Failed to load billings: ' + e.message) }
    finally { setLoading(false) }
  }, [pocket.id])

  useEffect(() => { load() }, [load])

  // Close on Escape
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const handleAdd = async (data) => {
    try {
      const created = await addPocketBilling(pocket.id, data)
      setBillings(bs => [created, ...bs])
      setShowForm(false)
      onBillingChange()
    } catch (e) { alert('Failed to add billing: ' + e.message) }
  }

  const handleEdit = async (data) => {
    try {
      const updated = await updatePocketBilling(editBill.id, data)
      setBillings(bs => bs.map(b => b.id === editBill.id ? updated : b))
      setEditBill(null)
      onBillingChange()
    } catch (e) { alert('Failed to update billing: ' + e.message) }
  }

  const handleDelete = async (bill) => {
    if (!confirm(`Delete billing "${bill.name}" (${fmt(bill.amount)})?`)) return
    try {
      await deletePocketBilling(bill.id)
      setBillings(bs => bs.filter(b => b.id !== bill.id))
      onBillingChange()
    } catch (e) { alert('Failed to delete: ' + e.message) }
  }

  const totalSpent = billings.reduce((s, b) => s + Number(b.amount), 0)
  const remaining  = Number(pocket.credit_amount) - totalSpent
  const over       = remaining < 0

  return (
    <div className="modal-overlay billing-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-billing">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="modal-header billing-modal-header" style={{ borderBottomColor: pocket.color }}>
          <div className="billing-modal-title">
            <span className="billing-modal-icon">{pocket.icon}</span>
            <div>
              <h2 style={{ color: pocket.color }}>{pocket.name}</h2>
              <p className="billing-modal-subtitle">Billings tracker</p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* ── Pocket balance strip ────────────────────────────────────── */}
        <div className="billing-balance-strip">
          <div className="billing-balance-stat">
            <span className="billing-balance-label">Credit</span>
            <span className="billing-balance-val">{fmt(pocket.credit_amount)}</span>
          </div>
          <div className="billing-balance-stat">
            <span className="billing-balance-label">Spent</span>
            <span className="billing-balance-val val-neg">{fmt(totalSpent)}</span>
          </div>
          <div className="billing-balance-stat">
            <span className="billing-balance-label">{over ? '⚠️ Over' : 'Left'}</span>
            <span className={`billing-balance-val ${over ? 'val-neg' : 'val-pos'}`}>
              {over ? '−' : ''}{fmt(Math.abs(remaining))}
            </span>
          </div>
        </div>

        {/* ── Add billing form ────────────────────────────────────────── */}
        <div className="billing-body">
          {showForm && !editBill ? (
            <div className="billing-form-wrap">
              <h4 className="billing-form-heading">➕ New Billing</h4>
              <BillingForm onSave={handleAdd} onCancel={() => setShowForm(false)} />
            </div>
          ) : (
            <button
              className="billing-add-btn"
              onClick={() => { setShowForm(true); setEditBill(null) }}
            >
              + Add Billing
            </button>
          )}

          {/* ── Billings list ──────────────────────────────────────────── */}
          {loading ? (
            <div className="loading" style={{ padding: '1.5rem' }}>Loading…</div>
          ) : billings.length === 0 ? (
            <div className="billing-empty">No billings yet for this pocket.</div>
          ) : (
            <div className="billing-list">
              {billings.map(bill => (
                <div key={bill.id} className="billing-item">
                  {editBill?.id === bill.id ? (
                    <div className="billing-form-wrap">
                      <h4 className="billing-form-heading">✏️ Edit Billing</h4>
                      <BillingForm
                        initial={editBill}
                        onSave={handleEdit}
                        onCancel={() => setEditBill(null)}
                      />
                    </div>
                  ) : (
                    <>
                      <div className="billing-item-main">
                        <div className="billing-item-info">
                          <span className="billing-item-name">{bill.name}</span>
                          {bill.description && (
                            <span className="billing-item-notes">{bill.description}</span>
                          )}
                          <span className="billing-item-date">📅 {bill.date}</span>
                        </div>
                        <span className="billing-item-amount">{fmt(bill.amount)}</span>
                      </div>
                      <div className="billing-item-actions">
                        <button className="action-btn edit-btn"
                          onClick={() => { setEditBill(bill); setShowForm(false) }}
                          title="Edit">✏️</button>
                        <button className="action-btn del-btn"
                          onClick={() => handleDelete(bill)}
                          title="Delete">🗑️</button>
                      </div>
                    </>
                  )}
                </div>
              ))}

              {/* Total row */}
              <div className="billing-total-row">
                <span>Total spent</span>
                <span className="val-neg">{fmt(totalSpent)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
