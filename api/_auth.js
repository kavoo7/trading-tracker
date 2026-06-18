// api/_auth.js
// Shared helper used by every protected route to verify the request
// carries a valid login token. This keeps the actual password-checking
// logic in one place (api/login.js) and lets every data route just ask
// "is this request authenticated?" without repeating that logic.

const jwt = require('jsonwebtoken');

if (!process.env.JWT_SECRET) {
  // Same pattern as DATABASE_URL — fail loudly at import time rather than
  // silently accepting unsigned/unverifiable tokens later. Set this in
  // Vercel → Settings → Environment Variables.
  throw new Error('JWT_SECRET is not set. Add it in Vercel → Settings → Environment Variables.');
}

const SECRET = process.env.JWT_SECRET;

// Reads the token out of the Authorization header (format: "Bearer <token>")
// and verifies its signature + expiry. Returns true/false rather than
// throwing, so route handlers can do a simple `if (!isAuthed(req))` check.
function isAuthed(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return false;
  try {
    jwt.verify(token, SECRET);
    return true;
  } catch {
    // Covers both "invalid signature" (wrong/tampered token) and
    // "expired" (jwt.verify throws TokenExpiredError after the exp claim
    // passes) — both should just mean "treat this request as logged out."
    return false;
  }
}

// Sends a consistent 401 response when isAuthed() returns false, so every
// route doesn't need to hand-roll its own rejection message.
function requireAuth(req, res) {
  if (!isAuthed(req)) {
    res.status(401).json({ success: false, message: 'Unauthorized — please log in' });
    return false;
  }
  return true;
}

module.exports = { isAuthed, requireAuth, SECRET };
