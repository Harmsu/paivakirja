import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

authRouter.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body ?? {};
  const okUser = username === process.env.APP_USERNAME;
  // Verrataan aina hashiin, jotta vastausaika ei paljasta onko käyttäjätunnus oikein
  const okPass = await bcrypt.compare(String(password ?? ''), process.env.APP_PASSWORD_HASH || '');
  if (!okUser || !okPass) return res.status(401).json({ error: 'Väärä tunnus tai salasana' });
  const token = jwt.sign({ sub: username }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });
  res.json({ token });
});

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Ei kirjautunut' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Istunto vanhentunut' });
  }
}
