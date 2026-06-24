// api/_db.js
// Shared database helper used by every serverless function.
// Each function invocation gets its own short-lived connection — this is
// the correct pattern for serverless (no long-lived pool sitting in memory
// between invocations the way you would on a traditional always-on server).

const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  // Fails loudly and immediately rather than crashing later with a cryptic
  // "fetch failed" once a query runs. Set DATABASE_URL in Vercel's
  // Environment Variables (it's injected automatically once you add the
  // Neon integration from the Marketplace).
  throw new Error('DATABASE_URL is not set. Add the Neon Postgres integration in Vercel → Storage.');
}

const sql = neon(process.env.DATABASE_URL);

// Creates the trades table if it doesn't exist yet. Safe to call on every
// cold start — CREATE TABLE IF NOT EXISTS is a no-op once the table exists.
async function ensureSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS trades (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      date DATE NOT NULL,
      pair TEXT NOT NULL,
      dir TEXT NOT NULL,
      session TEXT NOT NULL,
      strategy TEXT NOT NULL,
      tf TEXT NOT NULL,
      entry NUMERIC,
      sl NUMERIC,
      tp NUMERIC,
      outcome TEXT NOT NULL,
      pnl NUMERIC NOT NULL DEFAULT 0,
      conf TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // Migration: the table above already existed in production before the
  // "mistakes" feature was added. CREATE TABLE IF NOT EXISTS only handles
  // brand-new tables — it does nothing to a table that already exists with
  // a different set of columns. ALTER TABLE ... ADD COLUMN IF NOT EXISTS
  // is the safe way to evolve an existing table without losing data: it's
  // a no-op if the column is already there, and adds it (defaulting every
  // existing row to an empty array) if it's missing.
  await sql`
    ALTER TABLE trades ADD COLUMN IF NOT EXISTS mistakes TEXT[] NOT NULL DEFAULT '{}'
  `;
}

// Shared CORS handling so the frontend (served from the same Vercel
// project, but useful if you ever split it out) can call these endpoints.
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = { sql, ensureSchema, setCors };
