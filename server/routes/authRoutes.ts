import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { dbQuery, dbQueryOne, dbExecute } from '../db.ts';
import { generateToken, authenticate, requireAdmin } from '../auth.ts';

export const authRouter = Router();

// Login
authRouter.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const user = dbQueryOne<{ id: number; name: string; email: string; password: string; role: 'admin' | 'staff'; status: string; phone: string }>(
    'SELECT * FROM users WHERE LOWER(email) = LOWER(?)',
    [email.trim()]
  );

  if (!user) {
    res.status(401).json({ error: 'Invalid email address or user not found.' });
    return;
  }

  if (user.status !== 'active') {
    res.status(403).json({ error: 'Account is deactivated. Contact an administrator.' });
    return;
  }

  const isPasswordValid = bcrypt.compareSync(password, user.password);
  if (!isPasswordValid) {
    res.status(401).json({ error: 'Incorrect password. Please try again.' });
    return;
  }

  const token = generateToken({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  });

  res.json({
    message: 'Login successful',
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone
    }
  });
});

// Current user profile
authRouter.get('/me', authenticate, (req: Request, res: Response) => {
  const user = dbQueryOne<{ id: number; name: string; email: string; role: 'admin' | 'staff'; phone: string; created_at: string }>(
    'SELECT id, name, email, role, phone, created_at FROM users WHERE id = ?',
    [req.user!.id]
  );

  if (!user) {
    res.status(404).json({ error: 'User profile not found.' });
    return;
  }

  res.json({ user });
});

// Update profile / change password
authRouter.put('/profile', authenticate, (req: Request, res: Response) => {
  const { name, phone, currentPassword, newPassword } = req.body;
  const userId = req.user!.id;

  const user = dbQueryOne<{ id: number; password: string }>('SELECT id, password FROM users WHERE id = ?', [userId]);
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  if (newPassword) {
    if (!currentPassword) {
      res.status(400).json({ error: 'Current password is required to set a new password.' });
      return;
    }
    const isCurrentValid = bcrypt.compareSync(currentPassword, user.password);
    if (!isCurrentValid) {
      res.status(400).json({ error: 'Current password is incorrect.' });
      return;
    }
    const hashedNew = bcrypt.hashSync(newPassword, 10);
    dbExecute('UPDATE users SET password = ? WHERE id = ?', [hashedNew, userId]);
  }

  if (name || phone !== undefined) {
    dbExecute('UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone) WHERE id = ?', [
      name ? name.trim() : null,
      phone !== undefined ? phone.trim() : null,
      userId
    ]);
  }

  res.json({ message: 'Profile updated successfully.' });
});

// User management (Admin only)
authRouter.get('/users', authenticate, requireAdmin, (req: Request, res: Response) => {
  const users = dbQuery('SELECT id, name, email, role, phone, status, created_at FROM users ORDER BY id ASC');
  res.json({ users });
});

authRouter.post('/users', authenticate, requireAdmin, (req: Request, res: Response) => {
  const { name, email, password, role, phone } = req.body;

  if (!name || !email || !password || !role) {
    res.status(400).json({ error: 'Name, email, password, and role are required.' });
    return;
  }

  const existing = dbQueryOne('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [email.trim()]);
  if (existing) {
    res.status(400).json({ error: 'User with this email already exists.' });
    return;
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  const result = dbExecute(
    'INSERT INTO users (name, email, password, role, phone, status) VALUES (?, ?, ?, ?, ?, ?)',
    [name.trim(), email.trim(), hashedPassword, role, phone ? phone.trim() : null, 'active']
  );

  res.status(201).json({
    message: 'User created successfully',
    userId: result.lastInsertRowid
  });
});

authRouter.delete('/users/:id', authenticate, requireAdmin, (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  if (id === req.user!.id) {
    res.status(400).json({ error: 'You cannot delete your own active account.' });
    return;
  }

  dbExecute('DELETE FROM users WHERE id = ?', [id]);
  res.json({ message: 'User deleted successfully.' });
});
