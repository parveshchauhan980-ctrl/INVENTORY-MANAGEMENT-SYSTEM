import { Router, Request, Response } from 'express';
import { dbQuery, dbExecute, getDatabase, seedInitialData } from '../db.ts';
import { authenticate, requireAdmin } from '../auth.ts';

export const settingRouter = Router();

// Get settings
settingRouter.get('/', authenticate, (_req: Request, res: Response) => {
  const rows = dbQuery<{ key: string; value: string }>('SELECT key, value FROM settings');
  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  res.json({ settings });
});

// Update settings (Admin only)
settingRouter.put('/', authenticate, requireAdmin, (req: Request, res: Response) => {
  const settings = req.body;

  for (const [key, value] of Object.entries(settings)) {
    dbExecute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, String(value)]);
  }

  res.json({ message: 'Settings updated successfully.' });
});

// Reset demo data (Admin only)
settingRouter.post('/reset-demo', authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const db = await getDatabase();
    
    // Clear existing data
    db.run('DELETE FROM stock_logs;');
    db.run('DELETE FROM sale_items;');
    db.run('DELETE FROM sales;');
    db.run('DELETE FROM purchase_items;');
    db.run('DELETE FROM purchases;');
    db.run('DELETE FROM products;');
    db.run('DELETE FROM customers;');
    db.run('DELETE FROM suppliers;');
    db.run('DELETE FROM categories;');
    db.run('DELETE FROM users;');
    db.run('DELETE FROM settings;');

    // Re-seed
    await seedInitialData(db);

    res.json({ message: 'Demo data reset successfully.' });
  } catch (err: any) {
    console.error('Error resetting demo data:', err);
    res.status(500).json({ error: 'Failed to reset demo data: ' + err.message });
  }
});
