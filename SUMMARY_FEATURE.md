# Weekly / Monthly Summary

A new "Summary" tab that auto-generates a digest of any week or month —
best trade, worst trade, net R, most-used strategy, and most costly
mistake — instead of you having to piece that together from the trade log
or analytics yourself.

## What's new

- **`api/summary.js`** — new endpoint, `GET /api/summary?period=week&offset=0`
  - `period`: `week` or `month`
  - `offset`: `0` = current period, `1` = previous, `2` = two back, etc.
  - Weeks run Monday–Sunday.
- **Summary tab** in the frontend — toggle between Weekly/Monthly, and
  Prev/Next buttons to look at past periods (capped so "Next" can't go
  past the current period).

## Why a separate endpoint instead of extending /api/stats

`/api/stats` answers "how am I doing overall, broken down every way" —
it's a wide, all-time view. This endpoint answers a narrower question —
"what happened in this specific week/month" — and intentionally returns a
much smaller, curated payload (a handful of highlights) rather than every
possible breakdown. Keeping them separate means neither one has to
compromise its shape to serve both purposes.

## The auto-generated takeaway line

This is deliberately conservative — it states what's in the numbers
(e.g. "'Revenge trade' was tagged on 2 trades and cost 3.0R") rather than
trying to interpret *why* something happened. It won't ever guess at your
mental state or motivations; it only ever describes patterns that are
directly computable from what you logged.

## Deploying

```bash
unzip ~/Downloads/trading-app-summary.zip -d /tmp/extracted
cp -r /tmp/extracted/trading-app-summary/api .
cp -r /tmp/extracted/trading-app-summary/public .
git add -A
git commit -m "Add weekly/monthly summary view"
git push
```

No new environment variables, no schema changes — this only reads from
the existing `trades` table.

## Testing it

1. Open the site, log in, click the new **Summary** tab.
2. It should default to "This week" and show a takeaway line plus
   highlight cards (Net Result, Best Trade, Worst Trade, etc.) based on
   whatever you've logged dated within the current Mon–Sun window.
3. Click **Monthly** — should reflect the current calendar month instead.
4. Click **‹ Prev** a couple of times — should step back through earlier
   weeks/months. If a period has zero trades, it'll say so rather than
   showing broken or misleading numbers.
5. **Next ›** should be disabled once you're back at the current period
   (there's nothing to view "in the future").
