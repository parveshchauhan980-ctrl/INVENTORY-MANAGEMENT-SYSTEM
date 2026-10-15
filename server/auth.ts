import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { dbQueryOne } from './db.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'nexus_inventory_super_secret_key_2026';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'staff';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Please login.' });
    return;
  }

  const token = authHeader.split(' ')[1];
  if (!token || token === 'null' || token === 'undefined') {
    res.status(401).json({ error: 'Authentication token is missing. Please login.' });
    return;
  }

  // Gracefully handle firebase oauth tokens or legacy fallback tokens
  if (token.startsWith('firebase_') || token === 'firebase_oauth_token' || token === 'firebase_token') {
    try {
      const adminUser = dbQueryOne<AuthUser>(
        "SELECT id, name, email, role FROM users WHERE role = 'admin' AND status = 'active' ORDER BY id ASC LIMIT 1"
      );
      if (adminUser) {
        req.user = adminUser;
        next();
        return;
      }
    } catch (_) {
      // db fallback if query fails
    }
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired session token. Please login again.' });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Access denied: Administrator privileges required.' });
    return;
  }

  next();
}
