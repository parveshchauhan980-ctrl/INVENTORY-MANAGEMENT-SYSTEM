import { Router, Request, Response } from 'express';
import { dbQuery, dbQueryOne, dbExecute } from '../db.ts';
import { authenticate, requireAdmin } from '../auth.ts';

export const categoryRouter = Router();

// Get all categories with product count
categoryRouter.get('/', authenticate, (_req: Request, res: Response) => {
  const categories = dbQuery(`
    SELECT c.*, COUNT(p.id) AS product_count
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id
    GROUP BY c.id
    ORDER BY c.name ASC
  `);
  res.json({ categories });
});

// Add category
categoryRouter.post('/', authenticate, (req: Request, res: Response) => {
  const { name, code, description, color } = req.body;

  if (!name || !code) {
    res.status(400).json({ error: 'Category name and category code are required.' });
    return;
  }

  const existingName = dbQueryOne('SELECT id FROM categories WHERE LOWER(name) = LOWER(?)', [name.trim()]);
  if (existingName) {
    res.status(400).json({ error: 'A category with this name already exists.' });
    return;
  }

  const existingCode = dbQueryOne('SELECT id FROM categories WHERE UPPER(code) = UPPER(?)', [code.trim()]);
  if (existingCode) {
    res.status(400).json({ error: 'A category with this code already exists.' });
    return;
  }

  const result = dbExecute(
    'INSERT INTO categories (name, code, description, color) VALUES (?, ?, ?, ?)',
    [name.trim(), code.trim().toUpperCase(), description?.trim() || null, color || '#6366f1']
  );

  res.status(201).json({
    message: 'Category created successfully',
    category: {
      id: result.lastInsertRowid,
      name: name.trim(),
      code: code.trim().toUpperCase(),
      description,
      color: color || '#6366f1',
      product_count: 0
    }
  });
});

// Update category
categoryRouter.put('/:id', authenticate, (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const { name, code, description, color } = req.body;

  if (!name || !code) {
    res.status(400).json({ error: 'Category name and category code are required.' });
    return;
  }

  const existingCategory = dbQueryOne('SELECT id FROM categories WHERE id = ?', [id]);
  if (!existingCategory) {
    res.status(404).json({ error: 'Category not found.' });
    return;
  }

  // Check unique constraints
  const duplicateName = dbQueryOne('SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND id != ?', [name.trim(), id]);
  if (duplicateName) {
    res.status(400).json({ error: 'Another category with this name already exists.' });
    return;
  }

  const duplicateCode = dbQueryOne('SELECT id FROM categories WHERE UPPER(code) = UPPER(?) AND id != ?', [code.trim(), id]);
  if (duplicateCode) {
    res.status(400).json({ error: 'Another category with this code already exists.' });
    return;
  }

  dbExecute(
    'UPDATE categories SET name = ?, code = ?, description = ?, color = ? WHERE id = ?',
    [name.trim(), code.trim().toUpperCase(), description?.trim() || null, color || '#6366f1', id]
  );

  res.json({ message: 'Category updated successfully.' });
});

// Delete category with safe check
categoryRouter.delete('/:id', authenticate, requireAdmin, (req: Request, res: Response) => {
  const id = parseInt(req.params.id);

  const productCountResult = dbQueryOne<{ count: number }>(
    'SELECT COUNT(*) AS count FROM products WHERE category_id = ?',
    [id]
  );

  if (productCountResult && productCountResult.count > 0) {
    res.status(400).json({
      error: `Cannot delete category: ${productCountResult.count} product(s) are currently assigned to this category. Please reassign or delete those products first.`
    });
    return;
  }

  dbExecute('DELETE FROM categories WHERE id = ?', [id]);
  res.json({ message: 'Category deleted successfully.' });
});
