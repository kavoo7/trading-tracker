# Mistake Tagging + Cost Analytics

This adds discipline tracking on top of your existing journal: every trade
can now be tagged with one or more specific mistakes (independent of
strategy or outcome), and Analytics shows you exactly how much each habit
has cost you in R.

## What changed

- **Database:** `trades` table gets a new `mistakes` column (a list of
  text tags). Existing trades are unaffected — they default to an empty
  list, meaning "no mistakes tagged," not an error state.
- **Add Trade form:** a checkbox grid under Confluences. Check zero, one,
  or several. Leaving all unchecked means a clean trade.
- **Trade Log:** new "Mistakes" column shows the tags on each row as small
  red badges, or a dash for clean trades.
- **Analytics:** new "Cost by Mistake" card, sorted worst-first by total R
  lost, plus a count of how many trades were fully clean.

## Why tags can overlap (and why that's correct)

A single trade can carry several mistake tags — e.g. both "Revenge trade"
and "Moved SL" on the same trade. The "Cost by Mistake" breakdown is
**not** a strict split of your total P&L into separate, non-overlapping
buckets. It answers "how much has this specific habit cost me across all
the trades it showed up in," and one trade can show up under more than one
habit. If you add up every number in that card, it usually won't equal
your overall net P&L — that's expected, not a bug.

## Deploying this

```bash
unzip ~/Downloads/trading-app-mistakes.zip -d /tmp/extracted
cp -r /tmp/extracted/trading-app-mistakes/api .
cp -r /tmp/extracted/trading-app-mistakes/public .
git add -A
git commit -m "Add mistake tagging and cost-by-mistake analytics"
git push
```

No new environment variables are needed — this reuses your existing
`DATABASE_URL`, `JOURNAL_PASSWORD`, and `JWT_SECRET`.

The first time a request hits the updated `api/trades.js` or
`api/stats.js` after deploying, `ensureSchema()` runs the migration
(`ALTER TABLE trades ADD COLUMN IF NOT EXISTS mistakes ...`) automatically
— there's no separate manual migration step to run yourself.

## Testing it

1. Open the site, log in, go to **+ Add Trade**.
2. Check one or two mistake boxes (e.g. "FOMO entry"), fill in the rest,
   save.
3. Go to **Trade Log** — you should see red "FOMO entry" badge(s) on that
   row.
4. Go to **Analytics** — scroll to "Cost by Mistake" — your tagged
   mistake should appear there with its R impact.
5. Add a trade with zero mistakes checked — confirm it shows a dash in
   the log and counts toward "Clean trades" in Analytics.
