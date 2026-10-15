import { Router, Request, Response } from 'express';
import { dbQuery, dbQueryOne, dbExecute, dbTransaction } from '../db.ts';
import { authenticate, requireAdmin } from '../auth.ts';

export const productRouter = Router();

// Helper to determine status
function computeStatus(quantity: number, minStock: number): 'in_stock' | 'low_stock' | 'out_of_stock' {
  if (quantity <= 0) return 'out_of_stock';
  if (quantity <= minStock) return 'low_stock';
  return 'in_stock';
}

// Get products with optional search and filters
productRouter.get('/', authenticate, (req: Request, res: Response) => {
  const { search, categoryId, status } = req.query;

  let sql = `
    SELECT p.*, c.name AS category_name, c.color AS category_color
    FROM products p
    JOIN categories c ON p.category_id = c.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (search) {
    sql += ` AND (LOWER(p.name) LIKE ? OR LOWER(p.sku) LIKE ? OR LOWER(p.barcode) LIKE ? OR LOWER(p.brand) LIKE ?)`;
    const term = `%${String(search).trim().toLowerCase()}%`;
    params.push(term, term, term, term);
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

  sql += ` ORDER BY p.id DESC`;

  const products = dbQuery(sql, params).map((p: any) => ({
    ...p,
    status: computeStatus(p.quantity, p.min_stock)
  }));

  res.json({ products });
});

// Get single product
productRouter.get('/:id', authenticate, (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const product = dbQueryOne(`
    SELECT p.*, c.name AS category_name, c.color AS category_color
    FROM products p
    JOIN categories c ON p.category_id = c.id
    WHERE p.id = ?
  `, [id]);

  if (!product) {
    res.status(404).json({ error: 'Product not found.' });
    return;
  }

  product.status = computeStatus(product.quantity, product.min_stock);
  res.json({ product });
});

// Check SKU availability
productRouter.get('/check-sku/:sku', authenticate, (req: Request, res: Response) => {
  const sku = req.params.sku.trim();
  const existing = dbQueryOne('SELECT id FROM products WHERE UPPER(sku) = UPPER(?)', [sku]);
  res.json({ available: !existing });
});

// Create product
productRouter.post('/', authenticate, (req: Request, res: Response) => {
  const {
    name,
    sku,
    barcode,
    brand,
    category_id,
    unit = 'pcs',
    purchase_price,
    selling_price,
    quantity = 0,
    min_stock = 5,
    location,
    description
  } = req.body;

  if (!name || !sku || !category_id || purchase_price === undefined || selling_price === undefined) {
    res.status(400).json({ error: 'Name, SKU, category, purchase price, and selling price are required.' });
    return;
  }

  if (Number(purchase_price) < 0 || Number(selling_price) < 0 || Number(quantity) < 0 || Number(min_stock) < 0) {
    res.status(400).json({ error: 'Prices and quantities must be non-negative values.' });
    return;
  }

  const existingSku = dbQueryOne('SELECT id FROM products WHERE UPPER(sku) = UPPER(?)', [sku.trim()]);
  if (existingSku) {
    res.status(400).json({ error: `Product SKU "${sku}" is already in use. Please use a unique SKU.` });
    return;
  }

  const status = computeStatus(Number(quantity), Number(min_stock));

  try {
    const result = dbTransaction(() => {
      const insertResult = dbExecute(
        `INSERT INTO products (
          name, sku, barcode, brand, category_id, unit, purchase_price, selling_price,
          quantity, min_stock, location, description, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          name.trim(),
          sku.trim().toUpperCase(),
          barcode?.trim() || null,
          brand?.trim() || null,
          Number(category_id),
          unit || 'pcs',
          Number(purchase_price),
          Number(selling_price),
          Number(quantity),
          Number(min_stock),
          location?.trim() || null,
          description?.trim() || null,
          status
        ]
      );

      const productId = insertResult.lastInsertRowid;

      // If initial stock was given, log opening stock movement
      if (Number(quantity) > 0) {
        dbExecute(
          `INSERT INTO stock_logs (
            product_id, type, quantity_change, previous_quantity, new_quantity, reason, reference_id, user_name
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            productId,
            'adjustment_in',
            Number(quantity),
            0,
            Number(quantity),
            'Initial opening stock',
            `INIT-${productId}`,
            req.user?.name || 'System'
          ]
        );
      }

      return productId;
    });

    res.status(201).json({
      message: 'Product created successfully',
      productId: result
    });
  } catch (err: any) {
    console.error('Error creating product:', err);
    res.status(500).json({ error: err.message || 'Failed to create product.' });
  }
});

// Update product
productRouter.put('/:id', authenticate, (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const {
    name,
    sku,
    barcode,
    brand,
    category_id,
    unit,
    purchase_price,
    selling_price,
    min_stock,
    location,
    description
  } = req.body;

  const current = dbQueryOne<{ id: number; quantity: number }>('SELECT id, quantity FROM products WHERE id = ?', [id]);
  if (!current) {
    res.status(404).json({ error: 'Product not found.' });
    return;
  }

  if (sku) {
    const duplicateSku = dbQueryOne('SELECT id FROM products WHERE UPPER(sku) = UPPER(?) AND id != ?', [sku.trim(), id]);
    if (duplicateSku) {
      res.status(400).json({ error: `SKU "${sku}" is already assigned to another product.` });
      return;
    }
  }

  const effectiveMinStock = min_stock !== undefined ? Number(min_stock) : 5;
  const status = computeStatus(current.quantity, effectiveMinStock);

  dbExecute(
    `UPDATE products SET
      name = COALESCE(?, name),
      sku = COALESCE(?, sku),
      barcode = COALESCE(?, barcode),
      brand = COALESCE(?, brand),
      category_id = COALESCE(?, category_id),
      unit = COALESCE(?, unit),
      purchase_price = COALESCE(?, purchase_price),
      selling_price = COALESCE(?, selling_price),
      min_stock = COALESCE(?, min_stock),
      location = COALESCE(?, location),
      description = COALESCE(?, description),
      status = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?`,
    [
      name ? name.trim() : null,
      sku ? sku.trim().toUpperCase() : null,
      barcode !== undefined ? (barcode ? barcode.trim() : null) : null,
      brand !== undefined ? (brand ? brand.trim() : null) : null,
      category_id ? Number(category_id) : null,
      unit || null,
      purchase_price !== undefined ? Number(purchase_price) : null,
      selling_price !== undefined ? Number(selling_price) : null,
      min_stock !== undefined ? Number(min_stock) : null,
      location !== undefined ? (location ? location.trim() : null) : null,
      description !== undefined ? (description ? description.trim() : null) : null,
      status,
      id
    ]
  );

  res.json({ message: 'Product updated successfully.' });
});

// Delete product with confirmation & foreign reference check
productRouter.delete('/:id', authenticate, requireAdmin, (req: Request, res: Response) => {
  const id = parseInt(req.params.id);

  // Check sales history
  const saleItemCheck = dbQueryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM sale_items WHERE product_id = ?',
    [id]
  );
  if (saleItemCheck && saleItemCheck.count > 0) {
    res.status(400).json({
      error: `Cannot delete product: It is linked to ${saleItemCheck.count} sales record(s). Deleting would corrupt historical invoice logs.`
    });
    return;
  }

  // Check purchase history
  const purchaseItemCheck = dbQueryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM purchase_items WHERE product_id = ?',
    [id]
  );
  if (purchaseItemCheck && purchaseItemCheck.count > 0) {
    res.status(400).json({
      error: `Cannot delete product: It is linked to ${purchaseItemCheck.count} purchase record(s).`
    });
    return;
  }

  dbExecute('DELETE FROM products WHERE id = ?', [id]);
  res.json({ message: 'Product deleted successfully.' });
});
