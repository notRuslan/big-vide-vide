import jwt from 'jsonwebtoken';

function getSecret() {
  return process.env.JWT_SECRET || 'fallback-secret';
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, getSecret());
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function generateToken(userId) {
  return jwt.sign({ userId }, getSecret(), { expiresIn: '30d' });
}

export { authMiddleware, generateToken };
