/**
 * api.js — All data operations via Firebase Firestore.
 * Function signatures are identical to the old Express version so no
 * component changes are needed.
 *
 * Collections:
 *   salary          — keyed by "year-month"  e.g. "2026-5"
 *   commitments     — auto-ID, field monthYear = "year-month"
 *   pockets         — auto-ID
 *   pocket_billings — auto-ID, field pocket_id = pocket doc-ID
 */

import { db } from './firebase.js'
import {
  doc, getDoc, setDoc, deleteDoc,
  collection, query, where, getDocs, addDoc,
  writeBatch,
} from 'firebase/firestore'

// ── Internal helpers ──────────────────────────────────────────────────────

const isoNow = () => new Date().toISOString()
const monthKey = (month, year) => `${year}-${month}`

// ── Salary ────────────────────────────────────────────────────────────────

export async function getSalary(month, year) {
  const snap = await getDoc(doc(db, 'salary', monthKey(month, year)))
  if (snap.exists()) return { id: snap.id, ...snap.data() }
  return { month, year, gross_salary: 0, net_salary: 0 }
}

export async function upsertSalary(month, year, gross_salary, net_salary) {
  const id   = monthKey(month, year)
  const data = { month, year, gross_salary, net_salary, updated_at: isoNow() }
  await setDoc(doc(db, 'salary', id), data)
  return { id, ...data }
}

// ── Commitments ───────────────────────────────────────────────────────────

export async function getCommitments(month, year) {
  const snap = await getDocs(
    query(collection(db, 'commitments'), where('monthYear', '==', monthKey(month, year)))
  )
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function addCommitment({ category, name, amount, status, description, month, year }) {
  const key  = monthKey(month, year)
  // Fetch existing to compute next sort_order (client-side filter avoids composite index)
  const snap = await getDocs(
    query(collection(db, 'commitments'), where('monthYear', '==', key))
  )
  const maxOrder = snap.docs
    .filter(d => d.data().category === category)
    .reduce((m, d) => Math.max(m, d.data().sort_order ?? 0), 0)

  const now  = isoNow()
  const data = {
    category,
    name,
    amount:      parseFloat(amount),
    status:      status ?? 'UNPAID',
    description: description ?? '',
    month,
    year,
    monthYear:   key,
    sort_order:  maxOrder + 1,
    created_at:  now,
    updated_at:  now,
  }
  const ref = await addDoc(collection(db, 'commitments'), data)
  return { id: ref.id, ...data }
}

export async function updateCommitment(id, updates) {
  const ref  = doc(db, 'commitments', id)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Commitment not found')
  const updated = {
    ...snap.data(),
    name:        updates.name,
    amount:      parseFloat(updates.amount),
    status:      updates.status,
    description: updates.description,
    category:    updates.category,
    updated_at:  isoNow(),
  }
  await setDoc(ref, updated)
  return { id, ...updated }
}

export async function toggleCommitment(id) {
  const ref  = doc(db, 'commitments', id)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Commitment not found')
  const updated = {
    ...snap.data(),
    status:     snap.data().status === 'PAID' ? 'UNPAID' : 'PAID',
    updated_at: isoNow(),
  }
  await setDoc(ref, updated)
  return { id, ...updated }
}

export async function deleteCommitment(id) {
  await deleteDoc(doc(db, 'commitments', id))
  return { success: true }
}

export async function copyToNextMonth(fromMonth, fromYear) {
  let toMonth = fromMonth + 1
  let toYear  = fromYear
  if (toMonth > 12) { toMonth = 1; toYear++ }

  const fromKey = monthKey(fromMonth, fromYear)
  const toKey   = monthKey(toMonth,   toYear)

  // Check destination is empty
  const existing = await getDocs(
    query(collection(db, 'commitments'), where('monthYear', '==', toKey))
  )
  if (!existing.empty) {
    throw new Error(`${MONTHS[toMonth - 1]} ${toYear} already has commitments.`)
  }

  // Copy with a batch write (max 500 ops — commitments are always << 500)
  const source = await getDocs(
    query(collection(db, 'commitments'), where('monthYear', '==', fromKey))
  )
  const now   = isoNow()
  const batch = writeBatch(db)
  for (const d of source.docs) {
    const newRef = doc(collection(db, 'commitments'))
    batch.set(newRef, {
      ...d.data(),
      month:      toMonth,
      year:       toYear,
      monthYear:  toKey,
      status:     'UNPAID',
      created_at: now,
      updated_at: now,
    })
  }
  await batch.commit()
  return { toMonth, toYear }
}

export async function getAvailableMonths() {
  const [cSnap, sSnap] = await Promise.all([
    getDocs(collection(db, 'commitments')),
    getDocs(collection(db, 'salary')),
  ])
  const seen = new Map()
  for (const d of [...cSnap.docs, ...sSnap.docs]) {
    const { month, year } = d.data()
    const k = monthKey(month, year)
    if (!seen.has(k)) seen.set(k, { month, year })
  }
  return [...seen.values()].sort((a, b) => b.year - a.year || b.month - a.month)
}

// ── Dashboard ─────────────────────────────────────────────────────────────

export async function getDashboard() {
  const [cSnap, sSnap] = await Promise.all([
    getDocs(collection(db, 'commitments')),
    getDocs(collection(db, 'salary')),
  ])

  // Build ordered unique month list
  const seen = new Map()
  for (const d of [...cSnap.docs, ...sSnap.docs]) {
    const { month, year } = d.data()
    const k = `${year}-${String(month).padStart(2, '0')}`
    if (!seen.has(k)) seen.set(k, { month, year })
  }
  const months = [...seen.values()].sort((a, b) => a.year - b.year || a.month - b.month)

  // Salary lookup map
  const salMap = {}
  for (const d of sSnap.docs) {
    const { month, year } = d.data()
    salMap[monthKey(month, year)] = d.data()
  }

  return months.map(({ month, year }) => {
    const sal   = salMap[monthKey(month, year)]
    const comms = cSnap.docs
      .filter(d => d.data().month === month && d.data().year === year)
      .map(d => d.data())

    const total_committed = comms.reduce((s, c) => s + Number(c.amount), 0)
    const total_paid      = comms.filter(c => c.status === 'PAID').reduce((s, c) => s + Number(c.amount), 0)
    const net_salary      = Number(sal?.net_salary ?? 0)

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
}

// ── Pockets ───────────────────────────────────────────────────────────────

export async function getPockets() {
  const [pSnap, bSnap] = await Promise.all([
    getDocs(collection(db, 'pockets')),
    getDocs(collection(db, 'pocket_billings')),
  ])
  return pSnap.docs.map(d => {
    const pocket   = { id: d.id, ...d.data() }
    const billings = bSnap.docs.filter(b => b.data().pocket_id === d.id).map(b => b.data())
    const spent    = billings.reduce((s, b) => s + Number(b.amount), 0)
    return { ...pocket, spent, remaining: Number(pocket.credit_amount) - spent, billing_count: billings.length }
  })
}

export async function addPocket(data) {
  const now    = isoNow()
  const pocket = {
    name:          data.name,
    icon:          data.icon          ?? '💰',
    color:         data.color         ?? '#3b82f6',
    credit_amount: parseFloat(data.credit_amount) || 0,
    description:   data.description   ?? '',
    created_at:    now,
    updated_at:    now,
  }
  const ref = await addDoc(collection(db, 'pockets'), pocket)
  return { id: ref.id, ...pocket, spent: 0, remaining: pocket.credit_amount, billing_count: 0 }
}

export async function updatePocket(id, data) {
  const ref  = doc(db, 'pockets', id)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Pocket not found')
  const updated = {
    ...snap.data(),
    name:          data.name,
    icon:          data.icon,
    color:         data.color,
    credit_amount: parseFloat(data.credit_amount) || 0,
    description:   data.description,
    updated_at:    isoNow(),
  }
  await setDoc(ref, updated)

  const bSnap    = await getDocs(query(collection(db, 'pocket_billings'), where('pocket_id', '==', id)))
  const spent    = bSnap.docs.reduce((s, d) => s + Number(d.data().amount), 0)
  return { id, ...updated, spent, remaining: Number(updated.credit_amount) - spent, billing_count: bSnap.size }
}

export async function deletePocket(id) {
  const batch = writeBatch(db)
  batch.delete(doc(db, 'pockets', id))
  const bSnap = await getDocs(query(collection(db, 'pocket_billings'), where('pocket_id', '==', id)))
  bSnap.docs.forEach(d => batch.delete(d.ref))
  await batch.commit()
  return { success: true }
}

// ── Pocket billings ───────────────────────────────────────────────────────

export async function getPocketBillings(pocketId) {
  const snap = await getDocs(
    query(collection(db, 'pocket_billings'), where('pocket_id', '==', pocketId))
  )
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => new Date(b.date) - new Date(a.date) || a.id.localeCompare(b.id))
}

export async function addPocketBilling(pocketId, data) {
  const now     = isoNow()
  const billing = {
    pocket_id:   pocketId,
    name:        data.name,
    amount:      parseFloat(data.amount) || 0,
    date:        data.date ?? now.slice(0, 10),
    description: data.description ?? '',
    created_at:  now,
    updated_at:  now,
  }
  const ref = await addDoc(collection(db, 'pocket_billings'), billing)
  return { id: ref.id, ...billing }
}

export async function updatePocketBilling(id, data) {
  const ref  = doc(db, 'pocket_billings', id)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Billing not found')
  const updated = {
    ...snap.data(),
    name:        data.name,
    amount:      parseFloat(data.amount) || 0,
    date:        data.date,
    description: data.description,
    updated_at:  isoNow(),
  }
  await setDoc(ref, updated)
  return { id, ...updated }
}

export async function deletePocketBilling(id) {
  await deleteDoc(doc(db, 'pocket_billings', id))
  return { success: true }
}

// ── Shared constants / utils ──────────────────────────────────────────────

export const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

export const fmt = (n) =>
  'RM ' + Number(n ?? 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
