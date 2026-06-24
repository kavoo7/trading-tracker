// api/trades.js
// Vercel maps this file to the route /api/trades automatically based on
// its filename — there's no app.get()/app.post() routing table the way
// there is in Express. Instead, this single function receives every
// HTTP method sent to /api/trades and branches on req.method.

const { sql, ensureSchema, setCors } = require('./_db');
const { requireAuth } = require('./_auth');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!requireAuth(req, res)) return; // requireAuth already sent the 401 response

  try {
    await ensureSchema();

    if (req.method === 'GET') {
      const { outcome, strategy, pair, session, from, to } = req.query;

      // Build a parameterized WHERE clause piece by piece. We avoid string
      // concatenation of user input directly into SQL (that's how you get
      // SQL injection) — the neon `sql` template tag parameterizes each
      // ${value} automatically, so this stays safe even though we're
      // composing the query dynamically.
      let rows = await sql`SELECT * FROM trades ORDER BY date DESC`;

      if (outcome)  rows = rows.filter(t => t.outcome === outcome);
      if (strategy) rows = rows.filter(t => t.strategy === strategy);
      if (pair)     rows = rows.filter(t => t.pair === pair);
      if (session)  rows = rows.filter(t => t.session === session);
      if (from)     rows = rows.filter(t => t.date >= from);
      if (to)       rows = rows.filter(t => t.date <= to);

      return res.status(200).json({ success: true, count: rows.length, trades: rows });
    }

    if (req.method === 'POST') {
      const { date, pair, dir, session, strategy, tf, entry, sl, tp, outcome, pnl, conf, notes, mistakes } = req.body;

      if (!date || !pair || !outcome) {
        return res.status(400).json({ success: false, message: 'date, pair, and outcome are required' });
      }

      // mistakes arrives as a JS array (e.g. ["Revenge trade", "Moved SL"])
      // from the frontend's checkbox group. Default to an empty array for
      // clean trades — a trade having zero mistakes is the expected,
      // good outcome, not a missing-data case.
      const mistakeList = Array.isArray(mistakes) ? mistakes : [];

      const [trade] = await sql`
        INSERT INTO trades (date, pair, dir, session, strategy, tf, entry, sl, tp, outcome, pnl, conf, notes, mistakes)
        VALUES (
          ${date}, ${pair}, ${dir || 'Long'}, ${session || 'London'},
          ${strategy || 'Other'}, ${tf || '15M'},
          ${entry || null}, ${sl || null}, ${tp || null},
          ${outcome}, ${pnl || 0}, ${conf || ''}, ${notes || ''}, ${mistakeList}
        )
        RETURNING *
      `;

      return res.status(201).json({ success: true, trade });
    }

    if (req.method === 'DELETE') {
      // Reset endpoint — deletes every trade. Used only if you explicitly
      // wipe the journal; the single-trade delete lives in /api/trades/[id].js
      await sql`DELETE FROM trades`;
      return res.status(200).json({ success: true, message: 'All trades deleted' });
    }

    res.setHeader('Allow', 'GET, POST, DELETE, OPTIONS');
    return res.status(405).json({ success: false, message: `Method ${req.method} not allowed` });

  } catch (err) {
    // This is the catch block that prevents FUNCTION_INVOCATION_FAILED.
    // Without it, a DB error or bad input would throw, Node would see an
    // unhandled exception, and the whole function invocation would crash
    // with the exact error from before. Catching it and returning a normal
    // JSON 500 response keeps the function alive and gives a real error
    // message back to the frontend (and to Vercel's function logs).
    console.error('Error in /api/trades:', err);
    return res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
};
