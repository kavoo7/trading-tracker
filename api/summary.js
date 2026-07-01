// api/summary.js
// Returns a digest for a given period (this week / this month / last
// week / last month) rather than the all-time stats /api/stats provides.
// Kept as its own endpoint instead of bolting period filters onto
// /api/stats, since the response shape here is genuinely different — a
// handful of highlights, not the full breakdown-by-everything payload.

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

    // period: 'week' | 'month'. offset: 0 = current period, 1 = previous
    // period, etc. Defaults give "this week" if nothing is specified.
    const period = req.query.period === 'month' ? 'month' : 'week';
    const offset = parseInt(req.query.offset, 10) || 0;

    const { start, end, label } = getPeriodRange(period, offset);

    const trades = await sql`
      SELECT * FROM trades WHERE date >= ${start} AND date <= ${end} ORDER BY date ASC
    `;

    const summary = buildSummary(trades, label, start, end);
    return res.status(200).json({ success: true, summary });

  } catch (err) {
    console.error('Error in /api/summary:', err);
    return res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
};

// Computes the start/end date strings (YYYY-MM-DD) for the requested
// period, shifted back by `offset` periods. Weeks run Monday–Sunday.
function getPeriodRange(period, offset) {
  const now = new Date();
  let start, end, label;

  if (period === 'week') {
    // getDay(): 0=Sun..6=Sat. Shift so Monday is the start of the week.
    const dow = now.getDay();
    const diffToMonday = (dow === 0 ? -6 : 1) - dow;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday - (offset * 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    start = monday.toISOString().slice(0, 10);
    end = sunday.toISOString().slice(0, 10);
    label = `Week of ${start}`;
  } else {
    const target = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const firstDay = new Date(target.getFullYear(), target.getMonth(), 1);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0);
    start = firstDay.toISOString().slice(0, 10);
    end = lastDay.toISOString().slice(0, 10);
    label = target.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  }

  return { start, end, label };
}

function buildSummary(trades, label, start, end) {
  const num = v => parseFloat(v) || 0;

  if (!trades.length) {
    return {
      label, start, end, totalTrades: 0, hasData: false,
      takeaway: 'No trades logged in this period.'
    };
  }

  const wins = trades.filter(t => t.outcome === 'Win');
  const losses = trades.filter(t => t.outcome === 'Loss');
  const totalR = trades.reduce((s, t) => s + num(t.pnl), 0);
  const winRate = (wins.length / trades.length) * 100;

  const best = trades.reduce((a, b) => (num(b.pnl) > num(a.pnl) ? b : a));
  const worst = trades.reduce((a, b) => (num(b.pnl) < num(a.pnl) ? b : a));

  // Most-used strategy this period
  const stratCounts = {};
  trades.forEach(t => { stratCounts[t.strategy] = (stratCounts[t.strategy] || 0) + 1; });
  const mostUsedStrategy = Object.entries(stratCounts).sort((a, b) => b[1] - a[1])[0];

  // Most costly mistake this period (same "can overlap" logic as /api/stats)
  const mistakeCost = {};
  trades.forEach(t => {
    const tags = Array.isArray(t.mistakes) ? t.mistakes : [];
    tags.forEach(tag => {
      if (!mistakeCost[tag]) mistakeCost[tag] = { count: 0, totalR: 0 };
      mistakeCost[tag].count++;
      mistakeCost[tag].totalR += num(t.pnl);
    });
  });
  const worstMistakeEntry = Object.entries(mistakeCost).sort((a, b) => a[1].totalR - b[1].totalR)[0];

  const cleanCount = trades.filter(t => !Array.isArray(t.mistakes) || t.mistakes.length === 0).length;

  // Best session this period
  const sessionR = {};
  trades.forEach(t => { sessionR[t.session] = (sessionR[t.session] || 0) + num(t.pnl); });
  const bestSession = Object.entries(sessionR).sort((a, b) => b[1] - a[1])[0];

  const takeaway = buildTakeaway({ totalR, winRate, worstMistakeEntry, mostUsedStrategy, trades, cleanCount });

  return {
    label, start, end,
    totalTrades: trades.length,
    hasData: true,
    wins: wins.length,
    losses: losses.length,
    winRate: parseFloat(winRate.toFixed(1)),
    totalR: parseFloat(totalR.toFixed(2)),
    bestTrade: { pair: best.pair, strategy: best.strategy, pnl: parseFloat(num(best.pnl).toFixed(2)), date: best.date },
    worstTrade: { pair: worst.pair, strategy: worst.strategy, pnl: parseFloat(num(worst.pnl).toFixed(2)), date: worst.date },
    mostUsedStrategy: mostUsedStrategy ? { name: mostUsedStrategy[0], count: mostUsedStrategy[1] } : null,
    worstMistake: worstMistakeEntry
      ? { tag: worstMistakeEntry[0], totalR: parseFloat(worstMistakeEntry[1].totalR.toFixed(2)), count: worstMistakeEntry[1].count }
      : null,
    bestSession: bestSession ? { name: bestSession[0], totalR: parseFloat(bestSession[1].toFixed(2)) } : null,
    cleanTrades: cleanCount,
    takeaway
  };
}

// A short, plain-language nudge — deliberately conservative in tone since
// this is shown automatically without the person asking a question. No
// diagnosing "why" something happened, just naming the pattern in the
// numbers themselves.
function buildTakeaway({ totalR, winRate, worstMistakeEntry, mostUsedStrategy, trades, cleanCount }) {
  const lines = [];

  if (worstMistakeEntry && worstMistakeEntry[1].totalR < 0) {
    lines.push(`"${worstMistakeEntry[0]}" was tagged on ${worstMistakeEntry[1].count} trade${worstMistakeEntry[1].count === 1 ? '' : 's'} and cost ${worstMistakeEntry[1].totalR.toFixed(1)}R.`);
  }
  if (cleanCount === trades.length && trades.length > 0) {
    lines.push('Every trade this period was logged with no mistakes tagged.');
  }
  if (mostUsedStrategy) {
    lines.push(`Most-used setup: ${mostUsedStrategy[0]} (${mostUsedStrategy[1]} trade${mostUsedStrategy[1] === 1 ? '' : 's'}).`);
  }
  lines.push(`Net result: ${totalR >= 0 ? '+' : ''}${totalR.toFixed(1)}R across ${trades.length} trade${trades.length === 1 ? '' : 's'}, ${winRate.toFixed(0)}% win rate.`);

  return lines.join(' ');
}
