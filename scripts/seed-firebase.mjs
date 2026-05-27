/**
 * seed-firebase.mjs
 * Migrates data/finance.json into Firebase Firestore.
 *
 * Usage:
 *   1. Make sure .env exists with your VITE_FIREBASE_* values
 *   2. npm run seed
 *
 * Safe to re-run: existing documents are skipped (upserted by ID for salary,
 * skipped entirely for commitments/pockets if the collection already has data).
 */

import { createRequire } from 'module'
import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { config as loadEnv } from 'dotenv'

// ── Bootstrap ─────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root      = path.join(__dirname, '..')

// Load .env from project root
loadEnv({ path: path.join(root, '.env') })

// ── Firebase (modular SDK works in Node.js too) ───────────────────────────
import { initializeApp }   from 'firebase/app'
import {
  getFirestore, doc, setDoc, addDoc,
  collection, getDocs, writeBatch,
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey:            process.env.VITE_FIREBASE_API_KEY,
  authDomain:        process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.VITE_FIREBASE_APP_ID,
}

if (!firebaseConfig.projectId) {
  console.error('\n❌  No VITE_FIREBASE_PROJECT_ID found.')
  console.error('   Copy .env.example → .env and fill in your Firebase config.\n')
  process.exit(1)
}

const app = initializeApp(firebaseConfig)
const db  = getFirestore(app)

// ── Read source data ──────────────────────────────────────────────────────
const dataFile = path.join(root, 'data', 'finance.json')
if (!existsSync(dataFile)) {
  console.error(`\n❌  data/finance.json not found at ${dataFile}\n`)
  process.exit(1)
}

const { salary, commitments, pockets = [], pocket_billings = [] } =
  JSON.parse(readFileSync(dataFile, 'utf-8'))

// ── Helpers ───────────────────────────────────────────────────────────────
const monthKey = (month, year) => `${year}-${month}`

async function collectionIsEmpty(colName) {
  const snap = await getDocs(collection(db, colName))
  return snap.empty
}

// ── Seed salary ───────────────────────────────────────────────────────────
console.log('\n💾  Seeding salary…')
for (const row of salary) {
  const id   = monthKey(row.month, row.year)
  const data = {
    month:        row.month,
    year:         row.year,
    gross_salary: row.gross_salary,
    net_salary:   row.net_salary,
    updated_at:   row.updated_at ?? new Date().toISOString(),
  }
  await setDoc(doc(db, 'salary', id), data)
  console.log(`   ✅  salary/${id}  (net ${data.net_salary})`)
}

// ── Seed commitments ──────────────────────────────────────────────────────
console.log('\n💾  Seeding commitments…')
const commitEmpty = await collectionIsEmpty('commitments')
if (!commitEmpty) {
  console.log('   ⚠️   commitments collection already has data — skipping.')
  console.log('        Delete the collection in Firebase console to re-seed.')
} else {
  const batch  = writeBatch(db)
  let   count  = 0
  for (const c of commitments) {
    const ref = doc(collection(db, 'commitments'))
    batch.set(ref, {
      category:    c.category,
      name:        c.name,
      amount:      Number(c.amount),
      status:      c.status,
      description: c.description ?? '',
      month:       c.month,
      year:        c.year,
      monthYear:   monthKey(c.month, c.year),
      sort_order:  c.sort_order ?? 0,
      created_at:  new Date().toISOString(),
      updated_at:  new Date().toISOString(),
    })
    count++
  }
  await batch.commit()
  console.log(`   ✅  ${count} commitment(s) written.`)
}

// ── Seed pockets ──────────────────────────────────────────────────────────
if (pockets.length > 0) {
  console.log('\n💾  Seeding pockets…')
  const pocketEmpty = await collectionIsEmpty('pockets')
  if (!pocketEmpty) {
    console.log('   ⚠️   pockets collection already has data — skipping.')
  } else {
    for (const p of pockets) {
      const ref = await addDoc(collection(db, 'pockets'), {
        name:          p.name,
        icon:          p.icon  ?? '💰',
        color:         p.color ?? '#3b82f6',
        credit_amount: Number(p.credit_amount),
        description:   p.description ?? '',
        created_at:    p.created_at  ?? new Date().toISOString(),
        updated_at:    p.updated_at  ?? new Date().toISOString(),
      })
      console.log(`   ✅  pockets/${ref.id}  (${p.name})`)
    }
  }
}

// ── Done ──────────────────────────────────────────────────────────────────
console.log('\n🎉  Seed complete! Open the app and your data should be there.\n')
process.exit(0)
