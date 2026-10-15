import { Router, Request, Response } from 'express';
import { dbQuery, dbQueryOne, dbExecute, dbTransaction } from '../db.ts';
import { authenticate } from '../auth.ts';

export const stockRouter = Router();

// Helper to determine status
function computeStatus(quantity: number, minStock: number): 'in_stock' | 'low_stock' | 'out_of_stock' {
  if (quantity <= 0) return 'out_of_stock';
  if (quantity <= minStock) return 'low_stock';
  return 'in_stock';
}

// Get stock status of all products
stockRouter.get('/', authenticate, (req: Request, res: Response) => {
  const { search, categoryId, status } = req.query;

  let sql = `
    SELECT p.id, p.name, p.sku, p.barcode, p.brand, p.unit, p.quantity, p.min_stock,
           p.purchase_price, p.selling_price, p.location, p.updated_at,
           (p.quantity * p.purchase_price) AS stock_value_cost,
           (p.quantity * p.selling_price) AS stock_value_retail,
           c.name AS category_name, c.color AS category_color
    FROM products p
    JOIN categories c ON c.id = p.category_id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (search) {
    sql += ` AND (LOWER(p.name) LIKE ? OR LOWER(p.sku) LIKE ? OR LOWER(p.brand) LIKE ?)`;
    const term = `%${String(search).trim().toLowerCase()}%`;
    params.push(term, term, term);
  }

  if (categoryId && categoryId !== 'all') {
    sql += ` AND p.category_id = ?`;
    params.push(parseInt(String(categoryId)));
  }

  if (status && status !== 'all') {
    if (status === 'out_of_stock') {
      sql += ` AND p.quantity <= 0`;
    } else if (status === 'low_stock') {
      sql += ` AND p.quantity > 0 AND p.quantity <= p.min_stock`;
    } else if (status === 'in_stock') {
      sql += ` AND p.quantity > p.min_stock`;
    }
  }

  sql += ` ORDER BY p.quantity ASC, p.name ASC`;

  const items = dbQuery(sql, params).map((item: any) => ({
    ...item,
    status: computeStatus(item.quantity, item.min_stock)
  }));

  res.json({ items });
});

// Get stock movement history / audit logs
stockRouter.get('/logs', authenticate, (req: Request, res: Response) => {
  const { productId, type, limit = 100 } = req.query;

  let sql = `
    SELECT sl.*, p.name AS product_name, p.sku, p.unit, c.name AS category_name
    FROM stock_logs sl
    JOIN products p ON p.id = sl.product_id
    JOIN categories c ON c.id = p.category_id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (productId && productId !== 'all') {
    sql += ` AND sl.product_id = ?`;
    params.push(parseInt(String(productId)));
  }

  if (type && type !== 'all') {
    sql += ` AND sl.type = ?`;
    params.push(String(type));
  }

  sql += ` ORDER BY sl.id DESC LIMIT ?`;
  params.push(Number(limit) || 100);

  const logs = dbQuery(sql, params);
  res.json({ logs });
});

// Manual stock adjustment
stockRouter.post('/adjust', authenticate, (req: Request, res: Response) => {
  const { product_id, type, quantity, reason } = req.body;

  if (!product_id || !type || quantity === undefined || Number(quantity) <= 0 || !reason) {
    res.status(400).json({ error: 'Product, valid adjustment type, quantity > 0, and reason are required.' });
    return;
  }

  const validTypes = ['adjustment_in', 'adjustment_out', 'damage', 'return'];
  if (!validTypes.includes(type)) {
    res.status(400).json({ error: `Adjustment type must be one of: ${validTypes.join(', ')}` });
    return;
  }

  const product = dbQueryOne<{ id: number; name: string; quantity: number; min_stock: number }>(
    'SELECT id, name, quantity, min_stock FROM products WHERE id = ?',
    [product_id]
  );

  if (!product) {
    res.status(404).json({ error: 'Product not found.' });
    return;
  }

  const qty = Number(quantity);
  const isDeduction = type === 'adjustment_out' || type === 'damage';
  const delta = isDeduction ? -qty : qty;
  const newQuantity = product.quantity + delta;

  if (newQuantity < 0) {
    res.status(400).json({
      error: `Cannot reduce ${qty} units. Product only has ${product.quantity} units in stock. Negative stock is not allowed.`
    });
    return;
  }

  try {
    dbTransaction(() => {
      const newStatus = computeStatus(newQuantity, product.min_stock);

      dbExecute(
        'UPDATE products SET quantity = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newQuantity, newStatus, product_id]
      );

      const refId = `ADJ-${Date.now().toString().slice(-6)}`;

      dbExecute(
        `INSERT INTO stock_logs (
          product_id, type, quantity_change, previous_quantity, new_quantity, reason, reference_id, user_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          product_id,
          type,
          delta,
          product.quantity,
          newQuantity,
          reason.trim(),
          refId,
          req.user?.name || 'Staff'
        ]
      );
    });

    res.json({
      message: 'Stock adjusted successfully',
      previousQuantity: product.quantity,
      newQuantity
    });
  } catch (err: any) {
    console.error('Error adjusting stock:', err);
    res.status(500).json({ error: err.message || 'Failed to adjust stock.' });
  }
});
