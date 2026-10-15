import { Router, Request, Response } from 'express';
import { dbQuery, dbQueryOne, dbExecute, dbTransaction } from '../db.ts';
import { authenticate } from '../auth.ts';

export const purchaseRouter = Router();

// Helper to generate next PO number
function generatePurchaseNumber(): string {
  const currentYear = new Date().getFullYear();
  const lastRecord = dbQueryOne<{ purchase_number: string }>(
    `SELECT purchase_number FROM purchases WHERE purchase_number LIKE 'PO-${currentYear}-%' ORDER BY id DESC LIMIT 1`
  );

  let nextSequence = 1;
  if (lastRecord && lastRecord.purchase_number) {
    const parts = lastRecord.purchase_number.split('-');
    if (parts.length === 3) {
      const parsed = parseInt(parts[2], 10);
      if (!isNaN(parsed)) {
        nextSequence = parsed + 1;
      }
    }
  }

  return `PO-${currentYear}-${String(nextSequence).padStart(4, '0')}`;
}

// Get purchases list with filters
purchaseRouter.get('/', authenticate, (req: Request, res: Response) => {
  const { startDate, endDate, supplierId, status } = req.query;

  let sql = `
    SELECT p.*, s.name AS supplier_name,
           (SELECT COUNT(*) FROM purchase_items pi WHERE pi.purchase_id = p.id) AS total_items
    FROM purchases p
    JOIN suppliers s ON s.id = p.supplier_id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (startDate) {
    sql += ` AND p.date >= ?`;
    params.push(String(startDate));
  }
  if (endDate) {
    sql += ` AND p.date <= ?`;
    params.push(String(endDate));
  }
  if (supplierId && supplierId !== 'all') {
    sql += ` AND p.supplier_id = ?`;
    params.push(parseInt(String(supplierId)));
  }
  if (status && status !== 'all') {
    sql += ` AND p.status = ?`;
    params.push(String(status));
  }

  sql += ` ORDER BY p.date DESC, p.id DESC`;

  const purchases = dbQuery(sql, params);
  res.json({ purchases });
});

// Get purchase details by ID
purchaseRouter.get('/:id', authenticate, (req: Request, res: Response) => {
  const id = parseInt(req.params.id);

  const purchase = dbQueryOne(`
    SELECT p.*, s.name AS supplier_name, s.email AS supplier_email, s.phone AS supplier_phone,
           s.address AS supplier_address, s.tax_id AS supplier_tax_id
    FROM purchases p
    JOIN suppliers s ON s.id = p.supplier_id
    WHERE p.id = ?
  `, [id]);

  if (!purchase) {
    res.status(404).json({ error: 'Purchase order not found.' });
    return;
  }

  const items = dbQuery(`
    SELECT pi.*, p.name AS product_name, p.sku, p.unit
    FROM purchase_items pi
    JOIN products p ON p.id = pi.product_id
    WHERE pi.purchase_id = ?
    ORDER BY pi.id ASC
  `, [id]);

  res.json({ purchase, items });
});

// Record new purchase (Transaction with automatic stock increase)
purchaseRouter.post('/', authenticate, (req: Request, res: Response) => {
  const {
    supplier_id,
    date,
    payment_status = 'paid',
    payment_method = 'bank_transfer',
    items,
    tax_amount = 0,
    discount_amount = 0,
    notes
  } = req.body;

  if (!supplier_id || !date || !items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'Supplier, date, and at least one item are required.' });
    return;
  }

  // Validate items
  for (const item of items) {
    if (!item.product_id || Number(item.quantity) <= 0 || Number(item.unit_price) < 0) {
      res.status(400).json({ error: 'Each item must have a valid product, quantity > 0, and non-negative unit price.' });
      return;
    }
  }

  const supplier = dbQueryOne('SELECT id, name FROM suppliers WHERE id = ?', [supplier_id]);
  if (!supplier) {
    res.status(400).json({ error: 'Selected supplier does not exist.' });
    return;
  }

  try {
    const result = dbTransaction(() => {
      const purchaseNumber = generatePurchaseNumber();

      let subtotal = 0;
      for (const item of items) {
        subtotal += Number(item.quantity) * Number(item.unit_price);
      }

      const totalAmount = Math.max(0, subtotal + Number(tax_amount) - Number(discount_amount));

      // Insert purchase
      const purchaseInsert = dbExecute(
        `INSERT INTO purchases (
          purchase_number, supplier_id, date, status, payment_status, payment_method,
          subtotal, tax_amount, discount_amount, total_amount, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          purchaseNumber,
          Number(supplier_id),
          date,
          'received',
          payment_status,
          payment_method,
          subtotal,
          Number(tax_amount),
          Number(discount_amount),
          totalAmount,
          notes?.trim() || null,
          req.user?.name || 'Staff'
        ]
      );

      const purchaseId = purchaseInsert.lastInsertRowid;

      // Process items and increase stock
      for (const item of items) {
        const qty = Number(item.quantity);
        const unitPrice = Number(item.unit_price);
        const totalPrice = qty * unitPrice;

        dbExecute(
          `INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_price, total_price)
           VALUES (?, ?, ?, ?, ?)`,
          [purchaseId, item.product_id, qty, unitPrice, totalPrice]
        );

        // Fetch current product stock
        const product = dbQueryOne<{ id: number; name: string; quantity: number; min_stock: number }>(
          'SELECT id, name, quantity, min_stock FROM products WHERE id = ?',
          [item.product_id]
        );

        if (product) {
          const oldQty = product.quantity;
          const newQty = oldQty + qty;
          const newStatus = newQty <= 0 ? 'out_of_stock' : newQty <= product.min_stock ? 'low_stock' : 'in_stock';

          // Update product stock and update latest purchase price
          dbExecute(
            `UPDATE products SET
              quantity = ?,
              purchase_price = ?,
              status = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
            [newQty, unitPrice, newStatus, item.product_id]
          );

          // Log stock increment
          dbExecute(
            `INSERT INTO stock_logs (
              product_id, type, quantity_change, previous_quantity, new_quantity, reason, reference_id, user_name
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              item.product_id,
              'purchase',
              qty,
              oldQty,
              newQty,
              `Stock received from ${supplier.name}`,
              purchaseNumber,
              req.user?.name || 'Staff'
            ]
          );
        }
      }

      return { purchaseId, purchaseNumber, totalAmount };
    });

    res.status(201).json({
      message: 'Purchase order recorded and stock successfully updated.',
      ...result
    });
  } catch (err: any) {
    console.error('Error saving purchase:', err);
    res.status(500).json({ error: err.message || 'Failed to record purchase order.' });
  }
});
