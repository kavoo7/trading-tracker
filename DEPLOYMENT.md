# Deploying the SMC Trading Journal to Vercel (with Neon Postgres)

This replaces the local `server.js` + `trades.json` setup with serverless
functions backed by a real Postgres database, suitable for an actual
Vercel deployment.

## What changed and why

The old `server.js` called `app.listen()` and wrote trades to a local
`trades.json` file. That works great on your own machine but crashes on
Vercel with `FUNCTION_INVOCATION_FAILED`, because:

- Vercel functions don't run as a persistent process — there's no
  `app.listen()` to keep alive.
- Vercel's filesystem is read-only (except `/tmp`, which is wiped between
  requests) — `fs.writeFileSync` throws there.

This version fixes both: each route is its own function file under `/api`,
and all data lives in Neon Postgres instead of a local file.

## Project structure

```
trading-app/
├── api/
│   ├── _db.js              shared DB connection + schema setup
│   ├── trades.js           GET (list/filter) + POST /api/trades
│   ├── trades/[id].js      GET/PUT/DELETE /api/trades/:id
│   ├── stats.js            GET /api/stats — analytics
│   └── health.js           GET /api/health
├── public/
│   └── index.html          frontend (served as a static file)
├── package.json
└── vercel.json
```

## Step-by-step deploy

### 1. Add the files to your repo

Copy this whole `trading-app` folder's contents into your GitHub repo
(replacing your old `server.js`-based files), then commit and push:

```bash
git add .
git commit -m "Migrate backend to Vercel serverless functions + Neon Postgres"
git push
```

### 2. Add a Postgres database

In the Vercel dashboard:
1. Open your project → **Storage** tab
2. Click **Create Database** → choose **Neon** (or "Postgres") from the Marketplace
3. Follow the prompts to create a free database and link it to your project

This automatically injects a `DATABASE_URL` environment variable into your
project — you don't need to copy/paste any connection string yourself.

### 3. Redeploy

If your repo is already connected to Vercel, pushing to `main` (step 1)
triggers a new deployment automatically. Otherwise, click **Redeploy** in
the Vercel dashboard, or run:

```bash
vercel --prod
```

### 4. Verify

Visit `https://your-project.vercel.app/api/health` — you should see:
```json
{"success":true,"status":"ok","tradeCount":0}
```

Then open `https://your-project.vercel.app/` — the frontend should show
the green "API online" dot, and adding a trade should persist it (refresh
the page to confirm it's still there, since it's now in a real database
instead of memory).

## Local development

You can test this exact serverless setup locally before pushing, using
the Vercel CLI:

```bash
npm install -g vercel
vercel link        # connects this folder to your Vercel project
vercel env pull    # downloads DATABASE_URL etc. into .env.local
vercel dev         # runs functions + static files locally, matching production
```

`vercel dev` is the correct way to test serverless functions locally —
running `node api/trades.js` directly won't work, since these files export
a handler function rather than starting a server themselves.

## If something still fails

Check **Vercel Dashboard → your project → Logs** (or `vercel logs` from
the CLI). Every function file in this version wraps its logic in
try/catch and returns a proper JSON error with a 500 status instead of
letting the error go unhandled — so you should get a readable error
message in the response body, plus a stack trace in the logs, instead of
the opaque `FUNCTION_INVOCATION_FAILED`.

Common remaining issues:
- **`DATABASE_URL is not set`** → the Neon integration wasn't added, or
  you need to redeploy after adding it for the env var to take effect.
- **CORS errors in browser console** → shouldn't happen since frontend and
  API share a domain now, but if you ever split them onto different
  domains, you'll need to set `Access-Control-Allow-Origin` to your actual
  frontend domain instead of `*` in `api/_db.js`.
