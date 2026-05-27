import { useState } from 'react'
import { fmt } from '../lib/api.js'

export default function SalaryPanel({ salary, balance, monthLabel, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [gross, setGross] = useState('')
  const [net,   setNet]   = useState('')

  const startEdit = () => {
    setGross(salary.gross_salary ?? 0)
    setNet(salary.net_salary ?? 0)
    setEditing(true)
  }

  const save = async () => {
    const g = parseFloat(gross) || 0
    const n = parseFloat(net)   || 0
    await onUpdate(g, n)
    setEditing(false)
  }

  const cancel = () => setEditing(false)

  const balanceClass = balance >= 0 ? 'balance-positive' : 'balance-negative'

  return (
    <div className="salary-panel">
      {/* Gross Salary */}
      <div className="salary-card gross">
        <div className="salary-card-header">
          <span className="salary-icon">💼</span>
          <span className="salary-title">Gross Salary</span>
        </div>
        {editing ? (
          <input
            type="number"
            className="salary-input"
            value={gross}
            onChange={e => setGross(e.target.value)}
            placeholder="0.00"
            step="0.01"
            autoFocus
          />
        ) : (
          <div className="salary-amount">{fmt(salary.gross_salary)}</div>
        )}
        <div className="salary-sub">Before deductions</div>
      </div>

      {/* Net / Take-home */}
      <div className="salary-card net">
        <div className="salary-card-header">
          <span className="salary-icon">💵</span>
          <span className="salary-title">Net Salary</span>
        </div>
        {editing ? (
          <input
            type="number"
            className="salary-input"
            value={net}
            onChange={e => setNet(e.target.value)}
            placeholder="0.00"
            step="0.01"
          />
        ) : (
          <div className="salary-amount">{fmt(salary.net_salary)}</div>
        )}
        <div className="salary-sub">Take-home pay</div>
      </div>

      {/* Balance */}
      <div className={`salary-card balance ${balanceClass}`}>
        <div className="salary-card-header">
          <span className="salary-icon">📊</span>
          <span className="salary-title">Balance</span>
        </div>
        <div className="salary-amount">
          {balance < 0 ? '−' : ''}{fmt(Math.abs(balance))}
        </div>
        <div className="salary-sub">After all commitments</div>
      </div>

      {/* Edit / Save controls */}
      <div className="salary-actions">
        {editing ? (
          <>
            <button className="btn-save" onClick={save}>✓ Save</button>
            <button className="btn-cancel" onClick={cancel}>✕ Cancel</button>
          </>
        ) : (
          <button className="btn-edit-salary" onClick={startEdit}>
            ✏️ Edit Salary — {monthLabel}
          </button>
        )}
      </div>
    </div>
  )
}
