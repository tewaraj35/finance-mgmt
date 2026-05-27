import { useState, useEffect, useCallback } from 'react'
import {
  getSalary, upsertSalary,
  getCommitments, addCommitment, updateCommitment, toggleCommitment, deleteCommitment,
  copyToNextMonth, getAvailableMonths,
  MONTHS, fmt,
} from './lib/api.js'
import SalaryPanel        from './components/SalaryPanel.jsx'
import CommitmentsSection from './components/CommitmentsSection.jsx'
import AddEditModal       from './components/AddEditModal.jsx'
import Dashboard          from './components/Dashboard.jsx'
import PocketsView        from './components/PocketsView.jsx'

export default function App() {
  const now = new Date()
  const [view,  setView]  = useState('payday')   // 'payday' | 'dashboard' | 'pockets'
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year,  setYear]  = useState(now.getFullYear())

  const [salary,      setSalary]      = useState({ gross_salary: 0, net_salary: 0 })
  const [commitments, setCommitments] = useState([])
  const [available,   setAvailable]   = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [modal,       setModal]       = useState(null)

  // ── Fetch payday data ────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [sal, comms, months] = await Promise.all([
        getSalary(month, year),
        getCommitments(month, year),
        getAvailableMonths(),
      ])
      setSalary(sal)
      setCommitments(comms)
      setAvailable(months)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [month, year])

  useEffect(() => {
    if (view === 'payday') load()
  }, [load, view])

  // ── Derived totals ───────────────────────────────────────────────────
  const totalCommitted = commitments.reduce((s, c) => s + Number(c.amount), 0)
  const totalPaid      = commitments.filter(c => c.status === 'PAID').reduce((s, c) => s + Number(c.amount), 0)
  const totalUnpaid    = totalCommitted - totalPaid
  const balance        = Number(salary.net_salary) - totalCommitted
  const paidPct        = totalCommitted > 0 ? Math.round((totalPaid / totalCommitted) * 100) : 0

  // ── Month navigation ─────────────────────────────────────────────────
  const navigate = (dir) => {
    if (dir === 'prev') {
      if (month === 1) { setMonth(12); setYear(y => y - 1) }
      else setMonth(m => m - 1)
    } else {
      if (month === 12) { setMonth(1); setYear(y => y + 1) }
      else setMonth(m => m + 1)
    }
  }

  // Called from Dashboard — jump to a month in Payday view
  const navigateToMonth = (m, y) => {
    setMonth(m)
    setYear(y)
    setView('payday')
  }

  // ── Handlers ─────────────────────────────────────────────────────────
  const handleSalaryUpdate = async (gross, net) => {
    try { setSalary(await upsertSalary(month, year, gross, net)) }
    catch (e) { alert('Failed to update salary: ' + e.message) }
  }

  const handleToggle = async (id, status) => {
    try {
      const updated = await toggleCommitment(id, status)
      setCommitments(cs => cs.map(c => c.id === id ? updated : c))
    } catch (e) { alert('Failed to toggle: ' + e.message) }
  }

  const handleUpdate = async (id, data) => {
    try {
      const updated = await updateCommitment(id, data)
      setCommitments(cs => cs.map(c => c.id === id ? updated : c))
    } catch (e) { alert('Failed to update: ' + e.message) }
  }

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete "${name}"?`)) return
    try {
      await deleteCommitment(id)
      setCommitments(cs => cs.filter(c => c.id !== id))
    } catch (e) { alert('Failed to delete: ' + e.message) }
  }

  const handleAdd = async (data) => {
    try {
      const created = await addCommitment({ ...data, month, year })
      setCommitments(cs => [...cs, created])
      setModal(null)
    } catch (e) { alert('Failed to add: ' + e.message) }
  }

  const handleEditSave = async (data) => {
    try {
      const updated = await updateCommitment(modal.data.id, data)
      setCommitments(cs => cs.map(c => c.id === modal.data.id ? updated : c))
      setModal(null)
    } catch (e) { alert('Failed to save: ' + e.message) }
  }

  const handleCopyMonth = async () => {
    const nextM = month === 12 ? 1    : month + 1
    const nextY = month === 12 ? year + 1 : year
    if (!confirm(`Copy all commitments to ${MONTHS[nextM - 1]} ${nextY} and mark them UNPAID?`)) return
    try {
      const { toMonth, toYear } = await copyToNextMonth(month, year)
      setMonth(toMonth); setYear(toYear)
    } catch (e) { alert(e.message) }
  }

  const categories = [...new Set(commitments.map(c => c.category))]

  return (
    <div className="app">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <header className="app-header">
        <div className="header-brand">
          <span className="brand-icon">💰</span>
          <span className="brand-name">PayDay Manager</span>
        </div>

        {/* View tabs */}
        <nav className="view-tabs">
          <button
            className={`view-tab ${view === 'payday' ? 'tab-active' : ''}`}
            onClick={() => setView('payday')}
          >
            💳 Payday
          </button>
          <button
            className={`view-tab ${view === 'dashboard' ? 'tab-active' : ''}`}
            onClick={() => setView('dashboard')}
          >
            📊 Dashboard
          </button>
          <button
            className={`view-tab ${view === 'pockets' ? 'tab-active' : ''}`}
            onClick={() => setView('pockets')}
          >
            👝 Pockets
          </button>
        </nav>

        {/* Month navigation — Payday view only */}
        {view === 'payday' && (
          <div className="header-nav">
            <button className="btn-icon" onClick={() => navigate('prev')} title="Previous month">‹</button>

            <div className="month-display">
              <span className="month-label">{MONTHS[month - 1]} {year}</span>
              {available.length > 0 && (
                <select
                  className="month-jump"
                  value={`${year}-${month}`}
                  onChange={e => {
                    const [y, m] = e.target.value.split('-').map(Number)
                    setMonth(m); setYear(y)
                  }}
                >
                  {available.map(r => (
                    <option key={`${r.year}-${r.month}`} value={`${r.year}-${r.month}`}>
                      {MONTHS[r.month - 1]} {r.year}
                    </option>
                  ))}
                  {!available.find(r => r.month === month && r.year === year) && (
                    <option value={`${year}-${month}`}>{MONTHS[month - 1]} {year}</option>
                  )}
                </select>
              )}
            </div>

            <button className="btn-icon" onClick={() => navigate('next')} title="Next month">›</button>

            <button className="btn-copy" onClick={handleCopyMonth} title="Copy to next month">
              📋 Copy Month
            </button>
          </div>
        )}
      </header>

      {/* ── Main ──────────────────────────────────────────────────────── */}
      <main className="app-main">
        {/* ── DASHBOARD view ──────────────────────────────────────────── */}
        {view === 'dashboard' && (
          <Dashboard onNavigate={navigateToMonth} />
        )}

        {/* ── POCKETS view ────────────────────────────────────────────── */}
        {view === 'pockets' && (
          <PocketsView />
        )}

        {/* ── PAYDAY view ─────────────────────────────────────────────── */}
        {view === 'payday' && (
          error ? (
            <div className="error-card">
              <h3>⚠️ Cannot reach API server</h3>
              <p>{error}</p>
              <p>Make sure <code>npm run dev</code> is running (starts both servers).</p>
              <button className="btn-primary" onClick={load}>Retry</button>
            </div>
          ) : (
            <>
              {/* Salary */}
              <SalaryPanel
                salary={salary}
                balance={balance}
                monthLabel={`${MONTHS[month - 1]} ${year}`}
                onUpdate={handleSalaryUpdate}
              />

              {/* Progress summary */}
              <div className="summary-bar">
                <div className="summary-stats">
                  <div className="stat">
                    <span className="stat-label">Total Committed</span>
                    <span className="stat-value">{fmt(totalCommitted)}</span>
                  </div>
                  <div className="stat paid">
                    <span className="stat-label">✅ Paid</span>
                    <span className="stat-value">{fmt(totalPaid)}</span>
                  </div>
                  <div className="stat unpaid">
                    <span className="stat-label">🔴 Remaining</span>
                    <span className="stat-value">{fmt(totalUnpaid)}</span>
                  </div>
                  <div className="stat items">
                    <span className="stat-label">Items</span>
                    <span className="stat-value">
                      {commitments.filter(c => c.status === 'PAID').length} / {commitments.length}
                    </span>
                  </div>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${paidPct}%` }} />
                </div>
                <span className="progress-label">{paidPct}% paid</span>
              </div>

              {/* Commitments */}
              {loading ? (
                <div className="loading">Loading commitments…</div>
              ) : (
                <CommitmentsSection
                  commitments={commitments}
                  onToggle={handleToggle}
                  onEdit={(data) => setModal({ mode: 'edit', data })}
                  onDelete={handleDelete}
                />
              )}

              {/* Add button */}
              <div className="add-row">
                <button className="btn-add" onClick={() => setModal({ mode: 'add' })}>
                  + Add Commitment
                </button>
              </div>
            </>
          )
        )}
      </main>

      {/* ── Modal ─────────────────────────────────────────────────────── */}
      {modal && (
        <AddEditModal
          mode={modal.mode}
          initial={modal.data}
          categories={categories}
          onSave={modal.mode === 'add' ? handleAdd : handleEditSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
