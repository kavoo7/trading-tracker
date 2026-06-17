// api/health.js
const { sql, ensureSchema, setCors } = require('./_db');

module.exports = async (req, res) => {
  setCors(res);
  try {
    await ensureSchema();
    const [{ count }] = await sql`SELECT COUNT(*)::int as count FROM trades`;
    return res.status(200).json({ success: true, status: 'ok', tradeCount: count });
  } catch (err) {
    console.error('Error in /api/health:', err);
    return res.status(500).json({ success: false, status: 'error', message: err.message });
  }
};
