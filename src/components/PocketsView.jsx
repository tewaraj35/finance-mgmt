import { useState, useEffect, useCallback } from 'react'
import {
  getPockets, addPocket, updatePocket, deletePocket, fmt,
} from '../lib/api.js'
import PocketBillingModal from './PocketBillingModal.jsx'
import PocketFormModal    from './PocketFormModal.jsx'

// ── Pocket Card ───────────────────────────────────────────────────────────
function PocketCard({ pocket, onEdit, onDelete, onViewBillings }) {
  const { credit_amount, spent, remaining, billing_count } = pocket
  const pct  = credit_amount > 0 ? Math.min(Math.round((spent / credit_amount) * 100), 100) : 0
  const over = spent > credit_amount

  return (
    <div className="pocket-card" style={{ '--pocket-color': pocket.color }}>
      {/* Header */}
      <div className="pocket-card-header">
        <span className="pocket-icon">{pocket.icon}</span>
        <div className="pocket-name-wrap">
          <span className="pocket-name">{pocket.name}</span>
          {pocket.description && (
            <span className="pocket-desc">{pocket.description}</span>
          )}
        </div>
        <div className="pocket-card-actions">
          <button className="action-btn edit-btn" onClick={() => onEdit(pocket)} title="Edit pocket">✏️</button>
          <button className="action-btn del-btn"  onClick={() => onDelete(pocket)} title="Delete pocket">🗑️</button>
        </div>
      </div>

      {/* Credit amount */}
      <div className="pocket-credit">
        <span className="pocket-credit-label">Credit</span>
        <span className="pocket-credit-amount">{fmt(credit_amount)}</span>
      </div>

      {/* Progress bar */}
      <div className="pocket-progress-wrap">
        <div className="pocket-progress-track">
          <div
            className={`pocket-progress-fill ${over ? 'over-budget' : ''}`}
            style={{ width: `${pct}%`, background: over ? undefined : pocket.color }}
          />
        </div>
        <span className="pocket-progress-pct">{pct}%</span>
      </div>

      {/* Stats row */}
      <div className="pocket-stats">
        <div className="pocket-stat">
          <span className="pocket-stat-label">Spent</span>
          <span className="pocket-stat-value val-neg">{fmt(spent)}</span>
        </div>
        <div className="pocket-stat">
          <span className="pocket-stat-label">{over ? '⚠️ Over' : 'Remaining'}</span>
          <span className={`pocket-stat-value ${over ? 'val-neg' : 'val-pos'}`}>
            {over ? '-' : ''}{fmt(Math.abs(remaining))}
          </span>
        </div>
        <div className="pocket-stat">
          <span className="pocket-stat-label">Bills</span>
          <span className="pocket-stat-value">{billing_count}</span>
        </div>
      </div>

      {/* View billings button */}
      <button className="pocket-bills-btn" onClick={() => onViewBillings(pocket)}>
        📋 View Billings {billing_count > 0 && <span className="pocket-bills-badge">{billing_count}</span>}
      </button>
    </div>
  )
}

// ── Summary strip ─────────────────────────────────────────────────────────
function PocketSummary({ pockets }) {
  const totalCredit    = pockets.reduce((s, p) => s + Number(p.credit_amount), 0)
  const totalSpent     = pockets.reduce((s, p) => s + Number(p.spent), 0)
  const totalRemaining = totalCredit - totalSpent

  return (
    <div className="pocket-summary">
      <div className="pocket-summary-stat">
        <span className="pocket-summary-label">💰 Total Credit</span>
        <span className="pocket-summary-value">{fmt(totalCredit)}</span>
      </div>
      <div className="pocket-summary-stat">
        <span className="pocket-summary-label">💸 Total Spent</span>
        <span className="pocket-summary-value val-neg">{fmt(totalSpent)}</span>
      </div>
      <div className="pocket-summary-stat">
        <span className="pocket-summary-label">✅ Remaining</span>
        <span className={`pocket-summary-value ${totalRemaining >= 0 ? 'val-pos' : 'val-neg'}`}>
          {fmt(totalRemaining)}
        </span>
      </div>
      <div className="pocket-summary-stat">
        <span className="pocket-summary-label">👝 Pockets</span>
        <span className="pocket-summary-value">{pockets.length}</span>
      </div>
    </div>
  )
}

// ── Main View ─────────────────────────────────────────────────────────────
export default function PocketsView() {
  const [pockets, setPockets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  // modal state: null | { mode: 'add' | 'edit', pocket?: obj }
  const [formModal,    setFormModal]    = useState(null)
  // billing drawer: null | pocket
  const [billingPocket, setBillingPocket] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setPockets(await getPockets())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Handlers ─────────────────────────────────────────────────────────
  const handleAddSave = async (data) => {
    try {
      const created = await addPocket(data)
      setPockets(ps => [...ps, created])
      setFormModal(null)
    } catch (e) { alert('Failed to create pocket: ' + e.message) }
  }

  const handleEditSave = async (data) => {
    const id = formModal.pocket.id
    try {
      const updated = await updatePocket(id, data)
      setPockets(ps => ps.map(p => p.id === id ? updated : p))
      // refresh billing modal if open
      if (billingPocket?.id === id) setBillingPocket(updated)
      setFormModal(null)
    } catch (e) { alert('Failed to update pocket: ' + e.message) }
  }

  const handleDelete = async (pocket) => {
    if (!confirm(`Delete pocket "${pocket.name}"? All its billings will be removed too.`)) return
    try {
      await deletePocket(pocket.id)
      setPockets(ps => ps.filter(p => p.id !== pocket.id))
      if (billingPocket?.id === pocket.id) setBillingPocket(null)
    } catch (e) { alert('Failed to delete pocket: ' + e.message) }
  }

  // After a billing is added/deleted, refresh the pockets list to update counts/amounts
  const handleBillingChange = async () => {
    try {
      const fresh = await getPockets()
      setPockets(fresh)
      // Update the open billing modal's pocket header too
      if (billingPocket) {
        const updated = fresh.find(p => p.id === billingPocket.id)
        if (updated) setBillingPocket(updated)
      }
    } catch (_) {}
  }

  if (loading) return <div className="loading">Loading pockets…</div>

  if (error) return (
    <div className="error-card">
      <h3>⚠️ Cannot reach API server</h3>
      <p>{error}</p>
      <button className="btn-primary" onClick={load}>Retry</button>
    </div>
  )

  return (
    <div className="pockets-view">
      {/* ── Summary ──────────────────────────────────────────────────── */}
      {pockets.length > 0 && <PocketSummary pockets={pockets} />}

      {/* ── Grid ─────────────────────────────────────────────────────── */}
      {pockets.length === 0 ? (
        <div className="empty-state">
          <p>🪣 No pockets yet.</p>
          <p>Create a pocket to store a credit amount and track what you spend from it.</p>
        </div>
      ) : (
        <div className="pocket-grid">
          {pockets.map(p => (
            <PocketCard
              key={p.id}
              pocket={p}
              onEdit={pocket => setFormModal({ mode: 'edit', pocket })}
              onDelete={handleDelete}
              onViewBillings={pocket => setBillingPocket(pocket)}
            />
          ))}
        </div>
      )}

      {/* ── Add button ───────────────────────────────────────────────── */}
      <div className="add-row">
        <button className="btn-add" onClick={() => setFormModal({ mode: 'add' })}>
          + Create Pocket
        </button>
      </div>

      {/* ── Pocket form modal ─────────────────────────────────────────── */}
      {formModal && (
        <PocketFormModal
          mode={formModal.mode}
          initial={formModal.pocket}
          onSave={formModal.mode === 'add' ? handleAddSave : handleEditSave}
          onClose={() => setFormModal(null)}
        />
      )}

      {/* ── Billing drawer/modal ──────────────────────────────────────── */}
      {billingPocket && (
        <PocketBillingModal
          pocket={billingPocket}
          onClose={() => setBillingPocket(null)}
          onBillingChange={handleBillingChange}
        />
      )}
    </div>
  )
}
