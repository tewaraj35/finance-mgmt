import { useState, useEffect } from 'react'
import { getDashboard, fmt, MONTHS } from '../lib/api.js'

// ── SVG bar chart ─────────────────────────────────────────────────────────
function MonthlyChart({ data }) {
  const [tooltip, setTooltip] = useState(null)

  if (!data.length) return null

  const maxVal = Math.max(
    ...data.flatMap(d => [d.net_salary ?? 0, d.total_committed ?? 0]),
    1
  )

  const BAR    = 18
  const GAP    = 3
  const GROUP  = 3 * BAR + 2 * GAP
  const SPACE  = 18
  const H      = 160
  const YPAD   = 48

  const totalW = data.length * (GROUP + SPACE) + YPAD + 8
  const svgH   = H + 48

  const yTicks = [0, 0.25, 0.5, 0.75, 1]

  return (
    <div className="chart-wrap">
      {/* Legend */}
      <div className="chart-legend">
        {[
          { color: '#3b82f6', label: 'Net Salary' },
          { color: '#f59e0b', label: 'Committed' },
          { color: '#10b981', label: 'Balance' },
        ].map(({ color, label }) => (
          <span key={label} className="legend-item">
            <span className="legend-dot" style={{ background: color }} />
            {label}
          </span>
        ))}
      </div>

      {/* Scrollable chart */}
      <div className="chart-scroll">
        <svg
          width={Math.max(totalW, 320)}
          height={svgH}
          style={{ overflow: 'visible', display: 'block' }}
        >
          {/* Gridlines + y-axis labels */}
          {yTicks.map(pct => {
            const y = H * (1 - pct)
            const val = maxVal * pct
            return (
              <g key={pct}>
                <line x1={YPAD} y1={y} x2={totalW} y2={y} stroke="#e2e8f0" strokeWidth={1} />
                <text x={YPAD - 5} y={y + 4} textAnchor="end" fontSize={9} fill="#94a3b8">
                  {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val.toFixed(0)}
                </text>
              </g>
            )
          })}

          {/* Bars */}
          {data.map((d, i) => {
            const x   = YPAD + i * (GROUP + SPACE)
            const salH = Math.max(d.net_salary > 0 ? (d.net_salary / maxVal) * H : 0, 0)
            const comH = Math.max(d.total_committed > 0 ? (d.total_committed / maxVal) * H : 0, 0)
            const bal  = d.balance ?? 0
            const balH = Math.max(Math.abs(bal) > 0 ? (Math.abs(bal) / maxVal) * H : 0, 0)
            const balC = bal >= 0 ? '#10b981' : '#ef4444'

            return (
              <g
                key={`${d.year}-${d.month}`}
                onMouseEnter={() => setTooltip({ i, d, x, y: H - Math.max(salH, comH, balH) - 10 })}
                onMouseLeave={() => setTooltip(null)}
                style={{ cursor: 'default' }}
              >
                <rect x={x}                  y={H - salH} width={BAR} height={salH} fill="#3b82f6" rx={2} opacity={0.88} />
                <rect x={x + BAR + GAP}      y={H - comH} width={BAR} height={comH} fill="#f59e0b" rx={2} opacity={0.88} />
                <rect x={x + 2*(BAR + GAP)}  y={H - balH} width={BAR} height={balH} fill={balC}   rx={2} opacity={0.88} />

                <text x={x + GROUP / 2} y={H + 15} textAnchor="middle" fontSize={10} fill="#64748b" fontWeight={500}>
                  {MONTHS[d.month - 1].slice(0, 3)}
                </text>
                <text x={x + GROUP / 2} y={H + 28} textAnchor="middle" fontSize={9} fill="#94a3b8">
                  '{String(d.year).slice(2)}
                </text>
              </g>
            )
          })}

          {/* Hover tooltip */}
          {tooltip && (() => {
            const { d, x } = tooltip
            const tx = x + GROUP / 2
            const ty = -8
            const lines = [
              `${MONTHS[d.month - 1]} ${d.year}`,
              `Salary:    ${fmt(d.net_salary)}`,
              `Committed: ${fmt(d.total_committed)}`,
              `Balance:   ${fmt(d.balance)}`,
              `Paid: ${d.paid_pct}%`,
            ]
            const TW = 164, TH = lines.length * 14 + 10
            return (
              <g style={{ pointerEvents: 'none' }}>
                <rect x={tx - TW / 2 - 6} y={ty - TH} width={TW + 12} height={TH} fill="#1e293b" rx={5} opacity={0.92} />
                {lines.map((l, li) => (
                  <text key={li} x={tx - TW / 2} y={ty - TH + 14 + li * 14}
                    fontSize={10} fill={li === 0 ? '#fff' : '#cbd5e1'} fontWeight={li === 0 ? 600 : 400}
                    fontFamily="monospace"
                  >
                    {l}
                  </text>
                ))}
              </g>
            )
          })()}
        </svg>
      </div>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────
export default function Dashboard({ onNavigate }) {
  const [data,    setData]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading">Loading dashboard…</div>
  if (error)   return <div className="error-card"><h3>⚠️ Error</h3><p>{error}</p></div>
  if (!data.length) return (
    <div className="empty-state">
      <p>No monthly data yet.</p>
      <p>Switch to <strong>Payday</strong> to start adding your commitments.</p>
    </div>
  )

  // ── Averages (months that have a salary set) ──────────────────────────
  const withSal    = data.filter(d => d.net_salary > 0)
  const avgSalary  = withSal.length ? withSal.reduce((s, d) => s + d.net_salary, 0) / withSal.length : 0
  const avgCommit  = data.reduce((s, d) => s + d.total_committed, 0) / data.length
  const avgBalance = withSal.length ? withSal.reduce((s, d) => s + d.balance, 0) / withSal.length : 0

  // ── Category totals across all months ────────────────────────────────
  const catTotals = {}
  for (const d of data) {
    for (const [cat, amt] of Object.entries(d.by_category ?? {})) {
      catTotals[cat] = (catTotals[cat] ?? 0) + amt
    }
  }
  const sortedCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1])
  const maxCat     = Math.max(...sortedCats.map(([, v]) => v), 1)

  return (
    <div className="dashboard">
      {/* ── Summary cards ──────────────────────────────────────────────── */}
      <div className="dash-cards">
        <div className="dash-card">
          <div className="dash-label">Months Tracked</div>
          <div className="dash-value">{data.length}</div>
        </div>
        <div className="dash-card">
          <div className="dash-label">Avg Net Salary</div>
          <div className="dash-value">{fmt(avgSalary)}</div>
        </div>
        <div className="dash-card">
          <div className="dash-label">Avg Committed</div>
          <div className="dash-value">{fmt(avgCommit)}</div>
        </div>
        <div className="dash-card">
          <div className="dash-label">Avg Balance</div>
          <div className={`dash-value ${avgBalance >= 0 ? 'val-pos' : 'val-neg'}`}>
            {fmt(avgBalance)}
          </div>
        </div>
      </div>

      {/* ── Monthly trend chart ────────────────────────────────────────── */}
      <div className="dash-section">
        <h3 className="dash-title">📈 Monthly Trend</h3>
        <MonthlyChart data={data} />
      </div>

      {/* ── Month-by-month table ───────────────────────────────────────── */}
      <div className="dash-section">
        <h3 className="dash-title">📅 Month by Month</h3>
        <p className="dash-hint">Click a row to jump to that month's payday view.</p>
        <div className="table-scroll">
          <table className="main-table">
            <thead>
              <tr>
                <th>Month</th>
                <th className="th-amount">Net Salary</th>
                <th className="th-amount">Committed</th>
                <th className="th-amount">Paid</th>
                <th className="th-amount">Remaining</th>
                <th className="th-amount">Balance</th>
                <th style={{ minWidth: 120 }}>Progress</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map(d => (
                <tr
                  key={`${d.year}-${d.month}`}
                  className="tr-base tr-clickable"
                  onClick={() => onNavigate(d.month, d.year)}
                  title={`Open ${MONTHS[d.month - 1]} ${d.year}`}
                >
                  <td><strong>{MONTHS[d.month - 1]} {d.year}</strong></td>
                  <td className="td-amount">{fmt(d.net_salary)}</td>
                  <td className="td-amount">{fmt(d.total_committed)}</td>
                  <td className="td-amount val-pos">{fmt(d.total_paid)}</td>
                  <td className={`td-amount ${d.total_unpaid > 0 ? 'val-neg' : ''}`}>
                    {fmt(d.total_unpaid)}
                  </td>
                  <td className={`td-amount ${d.balance >= 0 ? 'val-pos' : 'val-neg'}`}>
                    {d.balance < 0 ? '−' : ''}{fmt(Math.abs(d.balance))}
                  </td>
                  <td>
                    <div className="inline-progress">
                      <div className="inline-track">
                        <div className="inline-fill" style={{ width: `${d.paid_pct}%` }} />
                      </div>
                      <span className="inline-pct">{d.paid_pct}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Category spending breakdown ────────────────────────────────── */}
      <div className="dash-section">
        <h3 className="dash-title">📊 Spending by Type — All Months</h3>
        <div className="cat-breakdown">
          {sortedCats.map(([cat, total]) => (
            <div key={cat} className="cat-bar-row">
              <div className="cat-bar-label">{cat}</div>
              <div className="cat-bar-track">
                <div className="cat-bar-fill" style={{ width: `${(total / maxCat) * 100}%` }} />
              </div>
              <div className="cat-bar-value">{fmt(total)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
