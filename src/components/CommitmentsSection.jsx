import { useState } from 'react'
import { fmt } from '../lib/api.js'

const CAT_META = {
  'Credit Card Loans': { icon: '💳', color: '#6d28d9', bg: '#ede9fe' },
  'Bank Loans':        { icon: '🏦', color: '#1d4ed8', bg: '#dbeafe' },
  'Bills':             { icon: '📋', color: '#0e7490', bg: '#cffafe' },
  'Insurances':        { icon: '🛡️', color: '#047857', bg: '#d1fae5' },
  'Shyaamrudh':        { icon: '👶', color: '#b45309', bg: '#fef3c7' },
  'Additional':        { icon: '📌', color: '#b91c1c', bg: '#fee2e2' },
}
const DEFAULT_META = { icon: '📝', color: '#475569', bg: '#f1f5f9' }
const CAT_ORDER    = ['Credit Card Loans','Bank Loans','Bills','Insurances','Shyaamrudh','Additional']

function meta(cat) { return CAT_META[cat] ?? DEFAULT_META }

export default function CommitmentsSection({ commitments, onToggle, onEdit, onDelete }) {
  const [filter, setFilter] = useState('ALL')

  if (commitments.length === 0) {
    return (
      <div className="empty-state">
        <p>No commitments for this month yet.</p>
        <p>Use <strong>+ Add Commitment</strong> below to get started.</p>
      </div>
    )
  }

  // Sort: by category order, then sort_order, then id
  const sorted = [...commitments].sort((a, b) => {
    const ai = CAT_ORDER.indexOf(a.category)
    const bi = CAT_ORDER.indexOf(b.category)
    const catCmp = (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi) || a.category.localeCompare(b.category)
    if (catCmp !== 0) return catCmp
    return (a.sort_order - b.sort_order) || (a.id - b.id)
  })

  const filtered    = sorted.filter(c => filter === 'ALL' || c.status === filter)
  const paidCount   = commitments.filter(c => c.status === 'PAID').length
  const unpaidCount = commitments.length - paidCount
  const filteredTotal = filtered.reduce((s, c) => s + Number(c.amount), 0)

  return (
    <div className="commitments-table-wrap">
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="table-toolbar">
        <div className="filter-tabs">
          {[
            { key: 'ALL',    label: `All`,    count: commitments.length },
            { key: 'PAID',   label: '✅ Paid',   count: paidCount },
            { key: 'UNPAID', label: '🔴 Unpaid', count: unpaidCount },
          ].map(({ key, label, count }) => (
            <button
              key={key}
              className={`filter-btn ${filter === key ? 'filter-active' : ''}`}
              onClick={() => setFilter(key)}
            >
              {label} <span className="filter-count">{count}</span>
            </button>
          ))}
        </div>
        <span className="table-hint">Click status badge to toggle payment</span>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className="table-scroll">
        <table className="main-table">
          <thead>
            <tr>
              <th className="th-type">Type</th>
              <th>Name</th>
              <th className="th-amount">Amount</th>
              <th className="th-status">Status</th>
              <th>Description</th>
              <th className="th-actions"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => {
              const isGroupStart = i === 0 || filtered[i - 1].category !== c.category
              const m = meta(c.category)
              return (
                <tr
                  key={c.id}
                  className={[
                    'tr-base',
                    c.status === 'PAID' ? 'tr-paid' : 'tr-unpaid',
                    isGroupStart ? 'tr-group-start' : '',
                  ].join(' ')}
                >
                  {/* Type column — show pill only on first row of each group */}
                  <td className="td-type">
                    {isGroupStart ? (
                      <span className="cat-pill" style={{ background: m.bg, color: m.color }}>
                        {m.icon} {c.category}
                      </span>
                    ) : (
                      <span className="cat-continuation">—</span>
                    )}
                  </td>

                  <td className="td-name">{c.name}</td>

                  <td className="td-amount">{fmt(c.amount)}</td>

                  <td className="td-status">
                    <button
                      className={`status-badge ${c.status === 'PAID' ? 'badge-paid' : 'badge-unpaid'}`}
                      onClick={() => onToggle(c.id, c.status)}
                      title="Click to toggle"
                    >
                      {c.status === 'PAID' ? '✅ PAID' : '🔴 UNPAID'}
                    </button>
                  </td>

                  <td className="td-desc">{c.description || '—'}</td>

                  <td className="td-actions">
                    <button className="action-btn edit-btn" onClick={() => onEdit(c)} title="Edit">✏️</button>
                    <button className="action-btn del-btn"  onClick={() => onDelete(c.id, c.name)} title="Delete">🗑️</button>
                  </td>
                </tr>
              )
            })}

            {/* ── Totals footer ──────────────────────────────────────── */}
            <tr className="tr-total">
              <td colSpan={2}><strong>Total{filter !== 'ALL' ? ` (${filter.toLowerCase()})` : ''}</strong></td>
              <td className="td-amount"><strong>{fmt(filteredTotal)}</strong></td>
              <td colSpan={3}></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
