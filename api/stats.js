// api/stats.js
const { sql, ensureSchema, setCors } = require('./_db');
const { requireAuth } = require('./_auth');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!requireAuth(req, res)) return;
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).json({ success: false, message: `Method ${req.method} not allowed` });
  }

  try {
    await ensureSchema();
    const trades = await sql`SELECT * FROM trades`;

    const stats = computeStats(trades);
    return res.status(200).json({ success: true, stats });

  } catch (err) {
    console.error('Error in /api/stats:', err);
    return res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
};

function computeStats(trades) {
  const num = v => parseFloat(v) || 0;

  const wins   = trades.filter(t => t.outcome === 'Win');
  const losses = trades.filter(t => t.outcome === 'Loss');
  const totalR = trades.reduce((s, t) => s + num(t.pnl), 0);
  const winRate = trades.length ? (wins.length / trades.length) * 100 : 0;
  const avgWin  = wins.length   ? wins.reduce((s,t) => s + num(t.pnl), 0) / wins.length   : 0;
  const avgLoss = losses.length ? Math.abs(losses.reduce((s,t) => s + num(t.pnl), 0) / losses.length) : 1;

  const byStrategy = {}, bySession = {}, byPair = {};
  const bump = (obj, key, t) => {
    if (!obj[key]) obj[key] = { wins: 0, losses: 0, be: 0, totalR: 0, count: 0 };
    obj[key].count++;
    obj[key].totalR += num(t.pnl);
    if (t.outcome === 'Win') obj[key].wins++;
    else if (t.outcome === 'Loss') obj[key].losses++;
    else obj[key].be++;
  };
  trades.forEach(t => {
    bump(byStrategy, t.strategy, t);
    bump(bySession, t.session, t);
    bump(byPair, t.pair, t);
  });

  // Cost-by-mistake breakdown. A single trade can carry multiple mistake
  // tags (e.g. both "Revenge trade" and "Moved SL"), so this is NOT a
  // strict partition of total R the way byStrategy is — one trade's R can
  // get counted under several mistake tags at once. That's intentional:
  // the question this answers is "how much has each specific habit cost
  // me," not "how do I split today's R into non-overlapping buckets."
  const byMistake = {};
  trades.forEach(t => {
    const tags = Array.isArray(t.mistakes) ? t.mistakes : [];
    tags.forEach(tag => {
      if (!byMistake[tag]) byMistake[tag] = { count: 0, totalR: 0 };
      byMistake[tag].count++;
      byMistake[tag].totalR += num(t.pnl);
    });
  });
  const cleanTrades = trades.filter(t => !Array.isArray(t.mistakes) || t.mistakes.length === 0).length;

  const sorted = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));
  let cum = 0;
  const equityCurve = sorted.map(t => ({
    date: t.date,
    cumR: parseFloat((cum += num(t.pnl)).toFixed(2)),
    outcome: t.outcome
  }));

  return {
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    breakeven: trades.filter(t => t.outcome === 'BE').length,
    winRate: parseFloat(winRate.toFixed(2)),
    totalR: parseFloat(totalR.toFixed(2)),
    avgWin: parseFloat(avgWin.toFixed(2)),
    avgLoss: parseFloat(avgLoss.toFixed(2)),
    riskRewardRatio: parseFloat((avgLoss ? avgWin / avgLoss : 0).toFixed(2)),
    expectancy: parseFloat(((winRate / 100 * avgWin) - ((1 - winRate / 100) * avgLoss)).toFixed(2)),
    byStrategy, bySession, byPair, byMistake, cleanTrades, equityCurve
  };
}
