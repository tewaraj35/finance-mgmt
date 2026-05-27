#!/usr/bin/env node
/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  migrate.mjs  —  Migrate data/finance.json → Firebase Firestore
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Usage
 *  ─────
 *    node scripts/migrate.mjs                  # migrate (skip non-empty collections)
 *    node scripts/migrate.mjs --force          # wipe & re-migrate from scratch
 *    node scripts/migrate.mjs --dry-run        # preview only, zero writes
 *    node scripts/migrate.mjs --force --dry-run
 *
 *  What it does
 *  ────────────
 *    salary          → Firestore "salary"          (doc ID = "year-month")
 *    commitments     → Firestore "commitments"     (auto-ID, +monthYear field)
 *    pockets         → Firestore "pockets"         (auto-ID)
 *    pocket_billings → Firestore "pocket_billings" (auto-ID, pocket_id remapped
 *                                                   from old numeric int to new
 *                                                   Firestore string doc-ID)
 *
 *  Prerequisites
 *  ─────────────
 *    1. .env exists with VITE_FIREBASE_* values  (copy .env.example)
 *    2. Firestore security rules allow writes     (see README)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { readFileSync, existsSync } from 'fs'
import path      from 'path'
import { fileURLToPath } from 'url'
import { config as loadEnv } from 'dotenv'

import { initializeApp }  from 'firebase/app'
import {
  getFirestore,
  collection, doc,
  addDoc, setDoc, getDocs, deleteDoc,
  writeBatch,
} from 'firebase/firestore'

// ── CLI flags ─────────────────────────────────────────────────────────────
const args   = process.argv.slice(2)
const FORCE  = args.includes('--force')
const DRY    = args.includes('--dry-run')

// ── Paths ─────────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT      = path.join(__dirname, '..')

// ── Console helpers ───────────────────────────────────────────────────────
const c = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  cyan:   '\x1b[36m',
  white:  '\x1b[37m',
}
const log   = (...a) => console.log(...a)
const ok    = (msg)  => log(`   ${c.green}✔${c.reset}  ${msg}`)
const warn  = (msg)  => log(`   ${c.yellow}⚠${c.reset}  ${msg}`)
const err   = (msg)  => log(`   ${c.red}✖${c.reset}  ${msg}`)
const info  = (msg)  => log(`   ${c.cyan}→${c.reset}  ${msg}`)
const skip  = (msg)  => log(`   ${c.dim}–  ${msg}${c.reset}`)
const head  = (msg)  => log(`\n${c.bold}${msg}${c.reset}`)
const rule  = ()     => log(`${'─'.repeat(60)}`)

// ── Load .env ─────────────────────────────────────────────────────────────
loadEnv({ path: path.join(ROOT, '.env') })

// ── Validate Firebase config ──────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            process.env.VITE_FIREBASE_API_KEY,
  authDomain:        process.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL:       process.env.VITE_FIREBASE_DATABASE_URL,
  projectId:         process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.VITE_FIREBASE_APP_ID,
  measurementId:     process.env.VITE_FIREBASE_MEASUREMENT_ID,
}

// Only these fields are required — databaseURL and measurementId are optional
const REQUIRED_KEYS = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId']

const ENV_KEY_NAMES = {
  apiKey:            'VITE_FIREBASE_API_KEY',
  authDomain:        'VITE_FIREBASE_AUTH_DOMAIN',
  projectId:         'VITE_FIREBASE_PROJECT_ID',
  storageBucket:     'VITE_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'VITE_FIREBASE_MESSAGING_SENDER_ID',
  appId:             'VITE_FIREBASE_APP_ID',
}
const missingKeys = REQUIRED_KEYS
  .filter(k => !firebaseConfig[k])
  .map(k  => ENV_KEY_NAMES[k] ?? k)

if (missingKeys.length) {
  log(`\n${c.red}${c.bold}❌  Missing Firebase config values:${c.reset}`)
  missingKeys.forEach(k => err(k))
  log(`\n   Copy ${c.cyan}.env.example${c.reset} → ${c.cyan}.env${c.reset} and fill in all values.\n`)
  process.exit(1)
}

// ── Read source data ──────────────────────────────────────────────────────
const dataFile = path.join(ROOT, 'data', 'finance.json')
if (!existsSync(dataFile)) {
  log(`\n${c.red}${c.bold}❌  data/finance.json not found${c.reset}`)
  log(`   Expected: ${dataFile}\n`)
  process.exit(1)
}

const raw = JSON.parse(readFileSync(dataFile, 'utf-8'))
const {
  salary          = [],
  commitments     = [],
  pockets         = [],
  pocket_billings = [],
} = raw

// ── Connect to Firestore ──────────────────────────────────────────────────
const app = initializeApp(firebaseConfig)
const db  = getFirestore(app)

// ── Utility: batch-write in chunks of 499 (Firestore max = 500) ──────────
async function batchSetAll(colName, rows, buildDoc) {
  if (rows.length === 0) return []
  const CHUNK  = 499
  const docIds = []

  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    const batch = writeBatch(db)
    for (const row of chunk) {
      const ref = doc(collection(db, colName))
      batch.set(ref, buildDoc(row))
      docIds.push({ oldId: row.id, newId: ref.id })
    }
    if (!DRY) await batch.commit()
  }
  return docIds
}

// ── Utility: delete all docs in a collection ─────────────────────────────
async function clearCollection(colName) {
  const snap = await getDocs(collection(db, colName))
  if (snap.empty) return 0

  const CHUNK = 499
  const docs  = snap.docs
  for (let i = 0; i < docs.length; i += CHUNK) {
    const batch = writeBatch(db)
    docs.slice(i, i + CHUNK).forEach(d => batch.delete(d.ref))
    if (!DRY) await batch.commit()
  }
  return docs.length
}

// ── Utility: check if a collection already has data ───────────────────────
async function collectionCount(colName) {
  const snap = await getDocs(collection(db, colName))
  return snap.size
}

const monthKey = (month, year) => `${year}-${month}`
const now      = new Date().toISOString()

// ═══════════════════════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════════════════════
async function main() {
  rule()
  log(`${c.bold}  PayDay Manager — Firebase Migration${c.reset}`)
  rule()
  log(`  Project   ${c.cyan}${firebaseConfig.projectId}${c.reset}`)
  log(`  Source    ${c.cyan}data/finance.json${c.reset}`)
  log(`  Mode      ${c.cyan}${DRY ? 'dry-run (no writes)' : FORCE ? 'force (wipe + re-migrate)' : 'safe (skip non-empty)'}${c.reset}`)
  rule()

  // ── Source summary ────────────────────────────────────────────────────
  head('📂  Source data')
  info(`salary          : ${salary.length} row(s)`)
  info(`commitments     : ${commitments.length} row(s)`)
  info(`pockets         : ${pockets.length} row(s)`)
  info(`pocket_billings : ${pocket_billings.length} row(s)`)

  const stats = { salary: 0, commitments: 0, pockets: 0, pocket_billings: 0, skipped: 0, deleted: 0 }

  // ════════════════════════════════════════════════════════════════════════
  //  FORCE MODE: wipe existing data first
  // ════════════════════════════════════════════════════════════════════════
  if (FORCE) {
    head(`🗑️   Clearing existing Firestore data${DRY ? ' (dry-run)' : ''}…`)
    for (const col of ['salary', 'commitments', 'pockets', 'pocket_billings']) {
      const n = await clearCollection(col)
      if (n > 0) {
        stats.deleted += n
        warn(`Deleted ${n} doc(s) from ${c.cyan}${col}${c.reset}`)
      } else {
        skip(`${col} was already empty`)
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  1.  SALARY
  // ════════════════════════════════════════════════════════════════════════
  head('💵  Migrating salary…')

  const existingSalary = FORCE ? 0 : await collectionCount('salary')
  if (existingSalary > 0) {
    warn(`salary already has ${existingSalary} doc(s) — skipping (use --force to overwrite)`)
    stats.skipped += salary.length
  } else {
    for (const row of salary) {
      const id   = monthKey(row.month, row.year)
      const data = {
        month:        row.month,
        year:         row.year,
        gross_salary: Number(row.gross_salary),
        net_salary:   Number(row.net_salary),
        updated_at:   row.updated_at ?? now,
      }
      if (!DRY) await setDoc(doc(db, 'salary', id), data)
      ok(`salary/${c.dim}${id}${c.reset}  net=${c.green}${data.net_salary}${c.reset}`)
      stats.salary++
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  2.  COMMITMENTS
  // ════════════════════════════════════════════════════════════════════════
  head('📋  Migrating commitments…')

  const existingCommits = FORCE ? 0 : await collectionCount('commitments')
  if (existingCommits > 0) {
    warn(`commitments already has ${existingCommits} doc(s) — skipping (use --force to overwrite)`)
    stats.skipped += commitments.length
  } else {
    const docIds = await batchSetAll('commitments', commitments, c => ({
      category:    c.category,
      name:        c.name,
      amount:      Number(c.amount),
      status:      c.status      ?? 'UNPAID',
      description: c.description ?? '',
      month:       c.month,
      year:        c.year,
      monthYear:   monthKey(c.month, c.year),
      sort_order:  c.sort_order  ?? 0,
      created_at:  c.created_at  ?? now,
      updated_at:  c.updated_at  ?? now,
    }))
    docIds.forEach(({ newId }, i) => {
      const c_ = commitments[i]
      ok(`${c_.category} / ${c_.name}  ${c.dim}→ ${newId}${c.reset}`)
    })
    stats.commitments = commitments.length
    info(`${commitments.length} commitment(s) written`)
  }

  // ════════════════════════════════════════════════════════════════════════
  //  3.  POCKETS  +  4.  POCKET BILLINGS
  //      Billings reference pockets by old numeric ID.
  //      We build an oldId → newFirestoreId map during pocket creation,
  //      then remap pocket_id in every billing record.
  // ════════════════════════════════════════════════════════════════════════
  head('👝  Migrating pockets…')

  // oldNumericId → new Firestore string doc-ID
  const pocketIdMap = new Map()

  const existingPockets = FORCE ? 0 : await collectionCount('pockets')
  if (existingPockets > 0) {
    warn(`pockets already has ${existingPockets} doc(s) — skipping (use --force to overwrite)`)
    stats.skipped += pockets.length + pocket_billings.length

    // If we're in safe-mode and pockets already exist, we still need the
    // ID map to migrate billings correctly.  Fetch existing Firestore pockets
    // and try to match by name.
    if (pocket_billings.length > 0) {
      warn('Cannot safely migrate pocket_billings without pocket ID map.')
      warn('Run with --force to migrate billings, or clear pockets manually first.')
    }
  } else {
    if (pockets.length === 0) {
      skip('No pockets in source data')
    } else {
      for (const p of pockets) {
        const data = {
          name:          p.name,
          icon:          p.icon          ?? '💰',
          color:         p.color         ?? '#3b82f6',
          credit_amount: Number(p.credit_amount),
          description:   p.description   ?? '',
          created_at:    p.created_at    ?? now,
          updated_at:    p.updated_at    ?? now,
        }
        let newId = `dry-run-pocket-${p.id}`
        if (!DRY) {
          const ref = await addDoc(collection(db, 'pockets'), data)
          newId = ref.id
        }
        pocketIdMap.set(p.id, newId)
        ok(`${p.icon ?? '💰'}  ${p.name}  ${c.dim}(old id ${p.id} → ${newId})${c.reset}`)
        stats.pockets++
      }
    }

    // ── Pocket billings ───────────────────────────────────────────────
    head('🧾  Migrating pocket_billings…')

    const existingBillings = FORCE ? 0 : await collectionCount('pocket_billings')
    if (existingBillings > 0) {
      warn(`pocket_billings already has ${existingBillings} doc(s) — skipping`)
      stats.skipped += pocket_billings.length
    } else if (pocket_billings.length === 0) {
      skip('No pocket_billings in source data')
    } else {
      for (const b of pocket_billings) {
        const newPocketId = pocketIdMap.get(b.pocket_id)
        if (!newPocketId) {
          err(`Billing "${b.name}" references pocket_id=${b.pocket_id} which wasn't found — skipped`)
          stats.skipped++
          continue
        }
        const data = {
          pocket_id:   newPocketId,          // ← remapped to Firestore string ID
          name:        b.name,
          amount:      Number(b.amount),
          date:        b.date        ?? now.slice(0, 10),
          description: b.description ?? '',
          created_at:  b.created_at  ?? now,
          updated_at:  b.updated_at  ?? now,
        }
        let newId = `dry-run-billing-${b.id}`
        if (!DRY) {
          const ref = await addDoc(collection(db, 'pocket_billings'), data)
          newId = ref.id
        }
        ok(`${b.name}  RM ${b.amount}  ${c.dim}(pocket ${b.pocket_id} → ${newPocketId})${c.reset}`)
        stats.pocket_billings++
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  SUMMARY
  // ════════════════════════════════════════════════════════════════════════
  head('📊  Summary')
  rule()

  const rows = [
    ['Collection',      'Source', 'Migrated', 'Skipped'],
    ['salary',          salary.length,          stats.salary,          salary.length - stats.salary],
    ['commitments',     commitments.length,     stats.commitments,     commitments.length - stats.commitments],
    ['pockets',         pockets.length,         stats.pockets,         pockets.length - stats.pockets],
    ['pocket_billings', pocket_billings.length, stats.pocket_billings, pocket_billings.length - stats.pocket_billings],
  ]

  const pad = (s, n) => String(s).padEnd(n)
  const rpad = (s, n) => String(s).padStart(n)
  log(`  ${c.bold}${pad('Collection', 20)} ${rpad('Source', 8)} ${rpad('Migrated', 10)} ${rpad('Skipped', 9)}${c.reset}`)
  log(`  ${'─'.repeat(50)}`)
  for (const [col, src, mig, skp] of rows.slice(1)) {
    const migCol = mig > 0 ? c.green : c.dim
    const skpCol = skp > 0 ? c.yellow : c.dim
    log(`  ${pad(col, 20)} ${rpad(src, 8)} ${migCol}${rpad(mig, 10)}${c.reset} ${skpCol}${rpad(skp, 9)}${c.reset}`)
  }

  if (stats.deleted > 0) {
    log(`\n  ${c.yellow}${stats.deleted} existing document(s) deleted (--force mode)${c.reset}`)
  }

  if (DRY) {
    log(`\n  ${c.yellow}${c.bold}Dry-run — no data was written to Firestore.${c.reset}`)
    log(`  Run without --dry-run to apply the migration.\n`)
  } else {
    const total = stats.salary + stats.commitments + stats.pockets + stats.pocket_billings
    if (total > 0) {
      log(`\n  ${c.green}${c.bold}✅  Migration complete! ${total} document(s) written.${c.reset}\n`)
    } else {
      log(`\n  ${c.yellow}No documents were written (all collections had existing data).${c.reset}`)
      log(`  Run with ${c.cyan}--force${c.reset} to wipe and re-migrate.\n`)
    }
  }

  process.exit(0)
}

main().catch(e => {
  log(`\n${c.red}${c.bold}❌  Unexpected error:${c.reset}`)
  log(`   ${e.message}\n`)
  process.exit(1)
})
