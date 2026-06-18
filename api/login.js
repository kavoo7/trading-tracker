// api/login.js
// The only unprotected route. Accepts a password, checks it against an
// environment variable (never hardcoded, never stored in the database),
// and issues a signed token the frontend stores and sends with every
// subsequent request.

const jwt = require('jsonwebtoken');
const { setCors } = require('./_db');
const { SECRET } = require('./_auth');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  if (!process.env.JOURNAL_PASSWORD) {
    // Distinct from "wrong password" — this means YOU haven't set up the
    // env var yet, not that the user typed something incorrect.
    return res.status(500).json({
      success: false,
      message: 'JOURNAL_PASSWORD is not set on the server. Add it in Vercel → Settings → Environment Variables.'
    });
  }

  const { password } = req.body || {};
  if (!password || password !== process.env.JOURNAL_PASSWORD) {
    // Deliberately vague — doesn't reveal whether the password was close,
    // doesn't distinguish "no password sent" from "wrong password". Helps
    // resist guessing attacks that probe for partial information.
    return res.status(401).json({ success: false, message: 'Incorrect password' });
  }

  // Token expires in 7 days — short enough that a leaked token doesn't
  // grant indefinite access, long enough that you're not re-entering the
  // password constantly during normal personal use.
  const token = jwt.sign({ role: 'owner' }, SECRET, { expiresIn: '7d' });
  return res.status(200).json({ success: true, token });
};
