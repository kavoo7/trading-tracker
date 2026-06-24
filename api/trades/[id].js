// api/trades/[id].js
// The [id] in the filename is Vercel's dynamic route syntax — equivalent
// to Express's app.get('/api/trades/:id', ...). Vercel parses whatever
// the user requests at that position in the URL into req.query.id.

const { sql, ensureSchema, setCors } = require('../_db');
const { requireAuth } = require('../_auth');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!requireAuth(req, res)) return;

  const { id } = req.query;

  try {
    await ensureSchema();

    if (req.method === 'GET') {
      const [trade] = await sql`SELECT * FROM trades WHERE id = ${id}`;
      if (!trade) return res.status(404).json({ success: false, message: 'Trade not found' });
      return res.status(200).json({ success: true, trade });
    }

    if (req.method === 'PUT') {
      const existing = await sql`SELECT * FROM trades WHERE id = ${id}`;
      if (!existing.length) return res.status(404).json({ success: false, message: 'Trade not found' });

      const merged = { ...existing[0], ...req.body };
      const mistakeList = Array.isArray(merged.mistakes) ? merged.mistakes : [];
      const [trade] = await sql`
        UPDATE trades SET
          date = ${merged.date}, pair = ${merged.pair}, dir = ${merged.dir},
          session = ${merged.session}, strategy = ${merged.strategy}, tf = ${merged.tf},
          entry = ${merged.entry}, sl = ${merged.sl}, tp = ${merged.tp},
          outcome = ${merged.outcome}, pnl = ${merged.pnl},
          conf = ${merged.conf}, notes = ${merged.notes}, mistakes = ${mistakeList}
        WHERE id = ${id}
        RETURNING *
      `;
      return res.status(200).json({ success: true, trade });
    }

    if (req.method === 'DELETE') {
      const result = await sql`DELETE FROM trades WHERE id = ${id} RETURNING id`;
      if (!result.length) return res.status(404).json({ success: false, message: 'Trade not found' });
      return res.status(200).json({ success: true, message: 'Trade deleted' });
    }

    res.setHeader('Allow', 'GET, PUT, DELETE, OPTIONS');
    return res.status(405).json({ success: false, message: `Method ${req.method} not allowed` });

  } catch (err) {
    console.error('Error in /api/trades/[id]:', err);
    return res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
};
