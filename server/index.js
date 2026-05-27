/**
 * PayDay Manager — Local API Server
 * Stores all data in data/finance.json (plain JSON, human-readable)
 */
import express from 'express'
import cors from 'cors'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

// ── Data file setup ──────────────────────────────────────────────────────
const DATA_DIR  = path.join(__dirname, '..', 'data')
const DATA_FILE = path.join(DATA_DIR, 'finance.json')

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })

const SEED = {
  salary: [
    { id: 1, month: 5, year: 2026, gross_salary: 0, net_salary: 7305.70, updated_at: new Date().toISOString() }
  ],
  pockets: [],
  pocket_billings: [],
  commitments: [
    // Credit Card Loans
    { id:  1, category: 'Credit Card Loans', name: 'HSBC',    amount: 257.02, status: 'PAID', description: 'Credit Card Installment',                              month: 5, year: 2026, sort_order: 1 },
    { id:  2, category: 'Credit Card Loans', name: 'HSBC',    amount:  99.91, status: 'PAID', description: 'Apple Watch Installment',                              month: 5, year: 2026, sort_order: 2 },
    { id:  3, category: 'Credit Card Loans', name: 'MAYBANK', amount: 180.00, status: 'PAID', description: 'Grolier',                                              month: 5, year: 2026, sort_order: 3 },
    // Bank Loans
    { id:  4, category: 'Bank Loans', name: 'Car',           amount:  599.00, status: 'PAID', description: 'Ambank',                                               month: 5, year: 2026, sort_order: 1 },
    { id:  5, category: 'Bank Loans', name: 'Kajang House',  amount: 1151.00, status: 'PAID', description: 'RHB Bank',                                             month: 5, year: 2026, sort_order: 2 },
    { id:  6, category: 'Bank Loans', name: 'PTPTN',         amount:  251.83, status: 'PAID', description: '-',                                                    month: 5, year: 2026, sort_order: 3 },
    // Bills
    { id:  7, category: 'Bills', name: 'Electricity', amount: 100.00, status: 'PAID', description: 'Paid for May bill — next bill due with June salary',           month: 5, year: 2026, sort_order: 1 },
    { id:  8, category: 'Bills', name: 'Water',       amount:  50.00, status: 'PAID', description: 'Paid for May bill — next bill due with June salary',           month: 5, year: 2026, sort_order: 2 },
    { id:  9, category: 'Bills', name: 'Wifi',        amount:  94.35, status: 'PAID', description: 'Paid for May bill — next bill due with June salary',           month: 5, year: 2026, sort_order: 3 },
    { id: 10, category: 'Bills', name: 'UMobile',     amount:  72.10, status: 'PAID', description: '-',                                                            month: 5, year: 2026, sort_order: 4 },
    { id: 11, category: 'Bills', name: 'Netflix',     amount:  29.90, status: 'PAID', description: '-',                                                            month: 5, year: 2026, sort_order: 5 },
    { id: 12, category: 'Bills', name: 'Maintenance', amount: 217.25, status: 'PAID', description: 'Paid for May bill — next bill due with June salary',           month: 5, year: 2026, sort_order: 6 },
    // Insurances
    { id: 13, category: 'Insurances', name: 'MCIS Life Protection', amount: 650.00, status: 'PAID', description: '', month: 5, year: 2026, sort_order: 1 },
    { id: 14, category: 'Insurances', name: 'MCIS Insurance',       amount: 186.63, status: 'PAID', description: '', month: 5, year: 2026, sort_order: 2 },
    // Shyaamrudh
    { id: 15, category: 'Shyaamrudh', name: 'Diaper',     amount: 100.00, status: 'PAID', description: '', month: 5, year: 2026, sort_order: 1 },
    { id: 16, category: 'Shyaamrudh', name: 'Medication', amount: 100.00, status: 'PAID', description: '', month: 5, year: 2026, sort_order: 2 },
    { id: 17, category: 'Shyaamrudh', name: 'Milk',       amount: 494.70, status: 'PAID', description: '', month: 5, year: 2026, sort_order: 3 },
    // Additional
    { id: 18, category: 'Additional', name: 'Fuel',               amount: 200.00, status: 'PAID', description: '', month: 5, year: 2026, sort_order: 1 },
    { id: 19, category: 'Additional', name: 'Toll & Parking',      amount:  50.00, status: 'PAID', description: '', month: 5, year: 2026, sort_order: 2 },
    { id: 20, category: 'Additional', name: 'Eat Out',             amount: 250.00, status: 'PAID', description: '', month: 5, year: 2026, sort_order: 3 },
    { id: 21, category: 'Additional', name: 'Emergency Fund',      amount: 200.00, status: 'PAID', description: '', month: 5, year: 2026, sort_order: 4 },
    { id: 22, category: 'Additional', name: 'Sinking Fund',        amount: 150.00, status: 'PAID', description: '', month: 5, year: 2026, sort_order: 5 },
    { id: 23, category: 'Additional', name: 'Medication',          amount: 200.00, status: 'PAID', description: '', month: 5, year: 2026, sort_order: 6 },
    { id: 24, category: 'Additional', name: 'Grocery',             amount: 600.00, status: 'PAID', description: '', month: 5, year: 2026, sort_order: 7 },
    { id: 25, category: 'Additional', name: 'Aussie',              amount: 200.00, status: 'PAID', description: '', month: 5, year: 2026, sort_order: 8 },
    { id: 26, category: 'Additional', name: 'Shyaamrudh Saving',   amount: 100.00, status: 'PAID', description: '', month: 5, year: 2026, sort_order: 9 },
  ],
  _nextId: { salary: 2, commitments: 27, pockets: 1, pocket_billings: 1 },
}

// ── Read / Write helpers ─────────────────────────────────────────────────
function readDB() {
  if (!existsSync(DATA_FILE)) {
    writeFileSync(DATA_FILE, JSON.stringify(SEED, null, 2), 'utf-8')
    return structuredClone(SEED)
  }
  return JSON.parse(readFileSync(DATA_FILE, 'utf-8'))
}

function writeDB(data) {
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

function nextId(db, table) {
  const id = db._nextId[table]
  db._nextId[table]++
  return id
}

// ── Express app ──────────────────────────────────────────────────────────
const app = express()
app.use(cors())
app.use(express.json())

// ── Salary routes ────────────────────────────────────────────────────────
app.get('/api/salary/:year/:month', (req, res) => {
  const { year, month } = req.params
  const db  = readDB()
  const row = db.salary.find(s => s.month === +month && s.year === +year)
  res.json(row ?? { month: +month, year: +year, gross_salary: 0, net_salary: 0 })
})

app.put('/api/salary/:year/:month', (req, res) => {
  const { year, month } = req.params
  const { gross_salary, net_salary } = req.body
  const db  = readDB()
  const idx = db.salary.findIndex(s => s.month === +month && s.year === +year)
  const now = new Date().toISOString()

  if (idx >= 0) {
    db.salary[idx] = { ...db.salary[idx], gross_salary, net_salary, updated_at: now }
  } else {
    db.salary.push({ id: nextId(db, 'salary'), month: +month, year: +year, gross_salary, net_salary, updated_at: now })
  }
  writeDB(db)
  res.json(db.salary.find(s => s.month === +month && s.year === +year))
})

// ── Commitment routes ────────────────────────────────────────────────────
app.get('/api/commitments/:year/:month', (req, res) => {
  const { year, month } = req.params
  const db = readDB()
  const rows = db.commitments
    .filter(c => c.month === +month && c.year === +year)
    .sort((a, b) => {
      if (a.category < b.category) return -1
      if (a.category > b.category) return  1
      return (a.sort_order - b.sort_order) || (a.id - b.id)
    })
  res.json(rows)
})

app.post('/api/commitments', (req, res) => {
  const { category, name, amount, status, description, month, year } = req.body
  const db = readDB()
  const maxOrder = db.commitments
    .filter(c => c.category === category && c.month === +month && c.year === +year)
    .reduce((m, c) => Math.max(m, c.sort_order), 0)

  const row = {
    id: nextId(db, 'commitments'),
    category, name,
    amount:      parseFloat(amount),
    status:      status ?? 'UNPAID',
    description: description ?? '',
    month:       +month,
    year:        +year,
    sort_order:  maxOrder + 1,
    created_at:  new Date().toISOString(),
    updated_at:  new Date().toISOString(),
  }
  db.commitments.push(row)
  writeDB(db)
  res.status(201).json(row)
})

app.put('/api/commitments/:id', (req, res) => {
  const id  = +req.params.id
  const db  = readDB()
  const idx = db.commitments.findIndex(c => c.id === id)
  if (idx < 0) return res.status(404).json({ error: 'Not found' })

  const { name, amount, status, description, category } = req.body
  db.commitments[idx] = {
    ...db.commitments[idx],
    name, amount: parseFloat(amount), status, description, category,
    updated_at: new Date().toISOString(),
  }
  writeDB(db)
  res.json(db.commitments[idx])
})

app.patch('/api/commitments/:id/toggle', (req, res) => {
  const id  = +req.params.id
  const db  = readDB()
  const idx = db.commitments.findIndex(c => c.id === id)
  if (idx < 0) return res.status(404).json({ error: 'Not found' })

  db.commitments[idx].status     = db.commitments[idx].status === 'PAID' ? 'UNPAID' : 'PAID'
  db.commitments[idx].updated_at = new Date().toISOString()
  writeDB(db)
  res.json(db.commitments[idx])
})

app.delete('/api/commitments/:id', (req, res) => {
  const id = +req.params.id
  const db = readDB()
  db.commitments = db.commitments.filter(c => c.id !== id)
  writeDB(db)
  res.json({ success: true })
})

app.post('/api/commitments/copy-next-month', (req, res) => {
  const { fromMonth, fromYear } = req.body
  let toMonth = +fromMonth + 1
  let toYear  = +fromYear
  if (toMonth > 12) { toMonth = 1; toYear++ }

  const db       = readDB()
  const existing = db.commitments.some(c => c.month === toMonth && c.year === toYear)
  if (existing) return res.status(400).json({ error: `${MONTH_NAMES[toMonth - 1]} ${toYear} already has commitments.` })

  const source = db.commitments.filter(c => c.month === +fromMonth && c.year === +fromYear)
  const now    = new Date().toISOString()
  for (const s of source) {
    db.commitments.push({
      ...s,
      id:          nextId(db, 'commitments'),
      month:       toMonth,
      year:        toYear,
      status:      'UNPAID',
      created_at:  now,
      updated_at:  now,
    })
  }
  writeDB(db)
  res.json({ success: true, toMonth, toYear })
})

app.get('/api/months', (req, res) => {
  const db   = readDB()
  const seen = new Map()
  for (const r of [...db.commitments, ...db.salary]) {
    const k = `${r.year}-${r.month}`
    if (!seen.has(k)) seen.set(k, { month: r.month, year: r.year })
  }
  const months = [...seen.values()].sort((a, b) => b.year - a.year || b.month - a.month)
  res.json(months)
})

// ── Dashboard: aggregate totals per month ────────────────────────────────
app.get('/api/dashboard', (req, res) => {
  const db   = readDB()
  const seen = new Map()
  for (const r of [...db.commitments, ...db.salary]) {
    const k = `${r.year}-${String(r.month).padStart(2, '0')}`
    if (!seen.has(k)) seen.set(k, { month: r.month, year: r.year })
  }

  const months = [...seen.values()].sort((a, b) => a.year - b.year || a.month - b.month)

  const result = months.map(({ month, year }) => {
    const sal   = db.salary.find(s => s.month === month && s.year === year)
    const comms = db.commitments.filter(c => c.month === month && c.year === year)

    const total_committed = comms.reduce((s, c) => s + Number(c.amount), 0)
    const total_paid      = comms.filter(c => c.status === 'PAID').reduce((s, c) => s + Number(c.amount), 0)
    const net_salary      = Number(sal?.net_salary ?? 0)

    // Per-category subtotals
    const by_category = {}
    for (const c of comms) {
      by_category[c.category] = (by_category[c.category] ?? 0) + Number(c.amount)
    }

    return {
      month,
      year,
      gross_salary:     Number(sal?.gross_salary ?? 0),
      net_salary,
      total_committed,
      total_paid,
      total_unpaid:     total_committed - total_paid,
      balance:          net_salary - total_committed,
      paid_pct:         total_committed > 0 ? Math.round((total_paid / total_committed) * 100) : 0,
      commitment_count: comms.length,
      by_category,
    }
  })

  res.json(result)
})

// ── Pocket routes ────────────────────────────────────────────────────────

// Ensure old data files grow the new collections gracefully
function ensurePockets(db) {
  if (!db.pockets)         db.pockets = []
  if (!db.pocket_billings) db.pocket_billings = []
  if (!db._nextId.pockets)         db._nextId.pockets = db.pockets.length + 1
  if (!db._nextId.pocket_billings) db._nextId.pocket_billings = db.pocket_billings.length + 1
}

// GET all pockets with computed spend / remaining
app.get('/api/pockets', (req, res) => {
  const db = readDB()
  ensurePockets(db)
  const result = db.pockets.map(p => {
    const billings = db.pocket_billings.filter(b => b.pocket_id === p.id)
    const spent    = billings.reduce((s, b) => s + Number(b.amount), 0)
    return { ...p, spent, remaining: Number(p.credit_amount) - spent, billing_count: billings.length }
  })
  res.json(result)
})

// POST create pocket
app.post('/api/pockets', (req, res) => {
  const { name, icon, color, credit_amount, description } = req.body
  const db = readDB()
  ensurePockets(db)
  const pocket = {
    id:            nextId(db, 'pockets'),
    name,
    icon:          icon          ?? '💰',
    color:         color         ?? '#3b82f6',
    credit_amount: parseFloat(credit_amount) || 0,
    description:   description   ?? '',
    created_at:    new Date().toISOString(),
    updated_at:    new Date().toISOString(),
  }
  db.pockets.push(pocket)
  writeDB(db)
  const spent = 0
  res.status(201).json({ ...pocket, spent, remaining: pocket.credit_amount, billing_count: 0 })
})

// PUT update pocket
app.put('/api/pockets/:id', (req, res) => {
  const id  = +req.params.id
  const db  = readDB()
  ensurePockets(db)
  const idx = db.pockets.findIndex(p => p.id === id)
  if (idx < 0) return res.status(404).json({ error: 'Pocket not found' })

  const { name, icon, color, credit_amount, description } = req.body
  db.pockets[idx] = {
    ...db.pockets[idx],
    name, icon, color,
    credit_amount: parseFloat(credit_amount) || 0,
    description,
    updated_at: new Date().toISOString(),
  }
  writeDB(db)

  const billings = db.pocket_billings.filter(b => b.pocket_id === id)
  const spent    = billings.reduce((s, b) => s + Number(b.amount), 0)
  res.json({ ...db.pockets[idx], spent, remaining: Number(db.pockets[idx].credit_amount) - spent, billing_count: billings.length })
})

// DELETE pocket (also removes all its billings)
app.delete('/api/pockets/:id', (req, res) => {
  const id = +req.params.id
  const db = readDB()
  ensurePockets(db)
  db.pockets         = db.pockets.filter(p => p.id !== id)
  db.pocket_billings = db.pocket_billings.filter(b => b.pocket_id !== id)
  writeDB(db)
  res.json({ success: true })
})

// ── Pocket billing routes ────────────────────────────────────────────────

// GET billings for a pocket
app.get('/api/pockets/:id/billings', (req, res) => {
  const id = +req.params.id
  const db = readDB()
  ensurePockets(db)
  const billings = db.pocket_billings
    .filter(b => b.pocket_id === id)
    .sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id)
  res.json(billings)
})

// POST add billing to a pocket
app.post('/api/pockets/:id/billings', (req, res) => {
  const pocket_id = +req.params.id
  const db = readDB()
  ensurePockets(db)
  if (!db.pockets.find(p => p.id === pocket_id))
    return res.status(404).json({ error: 'Pocket not found' })

  const { name, amount, date, description } = req.body
  const billing = {
    id:          nextId(db, 'pocket_billings'),
    pocket_id,
    name,
    amount:      parseFloat(amount) || 0,
    date:        date ?? new Date().toISOString().slice(0, 10),
    description: description ?? '',
    created_at:  new Date().toISOString(),
    updated_at:  new Date().toISOString(),
  }
  db.pocket_billings.push(billing)
  writeDB(db)
  res.status(201).json(billing)
})

// PUT update a billing
app.put('/api/pocket-billings/:id', (req, res) => {
  const id  = +req.params.id
  const db  = readDB()
  ensurePockets(db)
  const idx = db.pocket_billings.findIndex(b => b.id === id)
  if (idx < 0) return res.status(404).json({ error: 'Billing not found' })

  const { name, amount, date, description } = req.body
  db.pocket_billings[idx] = {
    ...db.pocket_billings[idx],
    name, amount: parseFloat(amount) || 0, date, description,
    updated_at: new Date().toISOString(),
  }
  writeDB(db)
  res.json(db.pocket_billings[idx])
})

// DELETE a billing
app.delete('/api/pocket-billings/:id', (req, res) => {
  const id = +req.params.id
  const db = readDB()
  ensurePockets(db)
  db.pocket_billings = db.pocket_billings.filter(b => b.id !== id)
  writeDB(db)
  res.json({ success: true })
})

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

const PORT = 3001
app.listen(PORT, () => {
  console.log(`\n  💰 PayDay Manager API  →  http://localhost:${PORT}`)
  console.log(`  📁 Data file           →  ${DATA_FILE}\n`)
})
