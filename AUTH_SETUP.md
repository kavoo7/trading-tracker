# Adding Password Protection

This adds a single shared password gate in front of your trading journal.
Anyone without the password sees a lock screen; the data API itself
rejects requests without a valid login token, so this isn't just a
frontend illusion — someone can't bypass it by guessing the API URL.

## What's new

```
api/
├── _auth.js     NEW — verifies login tokens, shared by all protected routes
├── login.js     NEW — checks password, issues a token
├── trades.js           now requires a valid token
├── trades/[id].js      now requires a valid token
├── stats.js            now requires a valid token
└── health.js           unchanged — stays open, just a basic ping
```

`public/index.html` now shows a password screen before the dashboard, and
attaches the login token to every API request afterward.

## Setup — two new environment variables

Go to **Vercel Dashboard → your project → Settings → Environment Variables**
and add:

### 1. `JOURNAL_PASSWORD`
The actual password you'll type to log in. Pick anything you'll remember —
this is for keeping casual visitors out, not defending against a
determined attacker, so a memorable phrase is fine.

### 2. `JWT_SECRET`
A random string used to cryptographically sign login tokens — NOT the
password itself, and not something you ever type in. Generate one with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Example output (don't reuse this one — generate your own):
```
9a3b0aa314b9636fc098f90866806bfc4542fd760395fda9d1f5959d476d0dd1
```
Paste whatever you generate as the value.

After adding both, **redeploy** (same as when you added `DATABASE_URL` —
new env vars don't apply to already-running deployments).

## How it works

1. You open the site → see a password screen, not the dashboard.
2. You type the password → frontend sends it to `/api/login`.
3. `login.js` checks it against `JOURNAL_PASSWORD`. If correct, it signs a
   token (a JWT) using `JWT_SECRET` and sends it back.
4. The frontend stores that token in `sessionStorage` and includes it as
   an `Authorization: Bearer <token>` header on every future request.
5. Every data route (`trades.js`, `trades/[id].js`, `stats.js`) checks that
   header via `_auth.js` before doing anything. No valid token → `401
   Unauthorized`, no data returned.
6. Tokens expire after 7 days, so even a leaked token doesn't grant
   permanent access — you'll just need to log in again.

Closing the browser tab clears the session (by design — `sessionStorage`,
not `localStorage`), so you'll log in again next time you open the site
fresh. Refreshing the page within the same browser session keeps you
logged in.

## Testing it

After redeploying:
1. Visit your site — you should see the lock screen, not the dashboard.
2. Try the wrong password — should show "Incorrect password."
3. Try the right password — should unlock into the dashboard normally.
4. Visit `/api/trades` directly in the browser (no token attached) — you
   should get `{"success":false,"message":"Unauthorized — please log in"}`
   instead of your trade data. This confirms the protection is real, not
   just cosmetic.

## Limitations worth knowing

This is a single shared password for one user (you) — there's no concept
of multiple accounts, password reset flows, or rate-limiting login
attempts. That's appropriate for a personal journal, but if you ever want
to share read-only access with someone else, or worry about someone
brute-forcing the password, that would need a more involved auth system
(e.g. NextAuth, Clerk, or a proper user table) — let me know if you get
there and want help.
