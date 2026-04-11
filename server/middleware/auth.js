export function authMiddleware(req, res, next) {
  const token = process.env.AUTH_TOKEN;
  // If no token is configured, skip auth (development mode)
  if (!token) return next();

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  const provided = authHeader.slice(7);
  if (provided !== token) {
    return res.status(403).json({ error: 'Invalid authorization token' });
  }

  next();
}
