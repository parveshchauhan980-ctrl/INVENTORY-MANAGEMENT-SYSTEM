import { Router, Request, Response } from 'express';
import { dbQuery, dbQueryOne, dbExecute, dbTransaction } from '../db.ts';
import { authenticate } from '../auth.ts';

export const saleRouter = Router();

// Helper to generate next invoice number
function generateInvoiceNumber(): string {
  const currentYear = new Date().getFullYear();
  const lastRecord = dbQueryOne<{ invoice_number: string }>(
    `SELECT invoice_number FROM sales WHERE invoice_number LIKE 'INV-${currentYear}-%' ORDER BY id DESC LIMIT 1`
  );

  let nextSequence = 1;
  if (lastRecord && lastRecord.invoice_number) {
    const parts = lastRecord.invoice_number.split('-');
    if (parts.length === 3) {
      const parsed = parseInt(parts[2], 10);
      if (!isNaN(parsed)) {
        nextSequence = parsed + 1;
      }
    }
  }

  return `INV-${currentYear}-${String(nextSequence).padStart(4, '0')}`;
}

// Get sales list with filters
saleRouter.get('/', authenticate, (req: Request, res: Response) => {
  const { startDate, endDate, customerId, paymentMethod, status } = req.query;

  let sql = `
    SELECT s.*,
           (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) AS total_items
    FROM sales s
    WHERE 1=1
  `;
  const params: any[] = [];

  if (startDate) {
    sql += ` AND s.date >= ?`;
    params.push(String(startDate));
  }
  if (endDate) {
    sql += ` AND s.date <= ?`;
    params.push(String(endDate));
  }
  if (customerId && customerId !== 'all') {
    sql += ` AND s.customer_id = ?`;
    params.push(parseInt(String(customerId)));
  }
  if (paymentMethod && paymentMethod !== 'all') {
    sql += ` AND s.payment_method = ?`;
    params.push(String(paymentMethod));
  }
  if (status && status !== 'all') {
    sql += ` AND s.status = ?`;
    params.push(String(status));
  }

  sql += ` ORDER BY s.date DESC, s.id DESC`;

  const sales = dbQuery(sql, params);
  res.json({ sales });
});

// Get sale invoice details by ID
saleRouter.get('/:id', authenticate, (req: Request, res: Response) => {
  const id = parseInt(req.params.id);

  const sale = dbQueryOne(`
    SELECT s.*, c.email AS customer_email, c.phone AS customer_phone,
           c.address AS customer_address, c.customer_type
    FROM sales s
    LEFT JOIN customers c ON c.id = s.customer_id
    WHERE s.id = ?
  `, [id]);

  if (!sale) {
    res.status(404).json({ error: 'Invoice not found.' });
    return;
  }

  const items = dbQuery(`
    SELECT si.*, p.unit
    FROM sale_items si
    JOIN products p ON p.id = si.product_id
    WHERE si.sale_id = ?
    ORDER BY si.id ASC
  `, [id]);

  // Fetch company settings for invoice header
  const settingsRows = dbQuery<{ key: string; value: string }>('SELECT key, value FROM settings');
  const settings: Record<string, string> = {};
  for (const row of settingsRows) {
    settings[row.key] = row.value;
  }

  res.json({ sale, items, settings });
});

// Create sales transaction (Validates stock, transactional decrease)
saleRouter.post('/', authenticate, (req: Request, res: Response) => {
  const {
    customer_id,
    customer_name,
    date,
    payment_method = 'cash',
    items,
    tax_rate = 18.0,
    discount_amount = 0,
    notes
  } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'Please add at least one item to the invoice.' });
    return;
  }

  const finalCustomerName = customer_name ? customer_name.trim() : 'Walk-in Retail Customer';
  const effectiveDate = date || new Date().toISOString().split('T')[0];

  // 1. Pre-validate stock for every item before transaction
  for (const item of items) {
    const qty = Number(item.quantity);
    if (!item.product_id || qty <= 0) {
      res.status(400).json({ error: 'Invalid product or quantity specified in invoice items.' });
      return;
    }

    const product = dbQueryOne<{ id: number; name: string; quantity: number }>(
      'SELECT id, name, quantity FROM products WHERE id = ?',
      [item.product_id]
    );

    if (!product) {
      res.status(400).json({ error: `Product ID #${item.product_id} was not found.` });
      return;
    }

    if (product.quantity < qty) {
      res.status(400).json({
        error: `Insufficient stock for "${product.name}". Available: ${product.quantity}, Requested: ${qty}.`
      });
      return;
    }
  }

  try {
    const result = dbTransaction(() => {
      const invoiceNumber = generateInvoiceNumber();

      let subtotal = 0;
      const verifiedItems: Array<{
        product_id: number;
        product_name: string;
        sku: string;
        quantity: number;
        unit_price: number;
        total_price: number;
      }> = [];

      for (const item of items) {
        const prod = dbQueryOne<{ id: number; name: string; sku: string; selling_price: number }>(
          'SELECT id, name, sku, selling_price FROM products WHERE id = ?',
          [item.product_id]
        )!;

        const qty = Number(item.quantity);
        const unitPrice = item.unit_price !== undefined ? Number(item.unit_price) : prod.selling_price;
        const lineTotal = qty * unitPrice;
        subtotal += lineTotal;

        verifiedItems.push({
          product_id: prod.id,
          product_name: prod.name,
          sku: prod.sku,
          quantity: qty,
          unit_price: unitPrice,
          total_price: lineTotal
        });
      }

      const discount = Math.max(0, Number(discount_amount) || 0);
      const taxable = Math.max(0, subtotal - discount);
      const effectiveTaxRate = Number(tax_rate) || 0;
      const taxAmount = (taxable * effectiveTaxRate) / 100;
      const totalAmount = taxable + taxAmount;

      // Insert sale
      const saleInsert = dbExecute(
        `INSERT INTO sales (
          invoice_number, customer_id, customer_name, date, status, payment_status,
          payment_method, subtotal, tax_rate, tax_amount, discount_amount, total_amount, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          invoiceNumber,
          customer_id ? Number(customer_id) : null,
          finalCustomerName,
          effectiveDate,
          'completed',
          'paid',
          payment_method || 'cash',
          subtotal,
          effectiveTaxRate,
          taxAmount,
          discount,
          totalAmount,
          notes?.trim() || null,
          req.user?.name || 'Staff'
        ]
      );

      const saleId = saleInsert.lastInsertRowid;

      // Insert items and decrease stock
      for (const vi of verifiedItems) {
        dbExecute(
          `INSERT INTO sale_items (sale_id, product_id, product_name, sku, quantity, unit_price, total_price)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [saleId, vi.product_id, vi.product_name, vi.sku, vi.quantity, vi.unit_price, vi.total_price]
        );

        // Fetch product again to guarantee latest stock
        const currentProd = dbQueryOne<{ id: number; quantity: number; min_stock: number }>(
          'SELECT id, quantity, min_stock FROM products WHERE id = ?',
          [vi.product_id]
        )!;

        const newQty = currentProd.quantity - vi.quantity;
        const newStatus = newQty <= 0 ? 'out_of_stock' : newQty <= currentProd.min_stock ? 'low_stock' : 'in_stock';

        dbExecute(
          `UPDATE products SET
            quantity = ?,
            status = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
          [newQty, newStatus, vi.product_id]
        );

        // Record stock log
        dbExecute(
          `INSERT INTO stock_logs (
            product_id, type, quantity_change, previous_quantity, new_quantity, reason, reference_id, user_name
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            vi.product_id,
            'sale',
            -vi.quantity,
            currentProd.quantity,
            newQty,
            `Sale to ${finalCustomerName}`,
            invoiceNumber,
            req.user?.name || 'Staff'
          ]
        );
      }

      return {
        saleId,
        invoiceNumber,
        totalAmount
      };
    });

    res.status(201).json({
      message: 'Sale completed and stock successfully deducted.',
      ...result
    });
  } catch (err: any) {
    console.error('Error recording sale:', err);
    res.status(500).json({ error: err.message || 'Failed to process sales invoice.' });
  }
});
