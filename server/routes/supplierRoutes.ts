import { Router, Request, Response } from 'express';
import { dbQuery, dbQueryOne, dbExecute } from '../db.ts';
import { authenticate, requireAdmin } from '../auth.ts';

export const supplierRouter = Router();

// Get all suppliers with total purchase summary
supplierRouter.get('/', authenticate, (_req: Request, res: Response) => {
  const suppliers = dbQuery(`
    SELECT s.*,
           COUNT(p.id) AS total_orders,
           COALESCE(SUM(p.total_amount), 0) AS total_purchased
    FROM suppliers s
    LEFT JOIN purchases p ON p.supplier_id = s.id
    GROUP BY s.id
    ORDER BY s.name ASC
  `);
  res.json({ suppliers });
});

// Get single supplier with purchase history
supplierRouter.get('/:id', authenticate, (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const supplier = dbQueryOne('SELECT * FROM suppliers WHERE id = ?', [id]);

  if (!supplier) {
    res.status(404).json({ error: 'Supplier not found.' });
    return;
  }

  const purchases = dbQuery(
    'SELECT * FROM purchases WHERE supplier_id = ? ORDER BY date DESC, id DESC',
    [id]
  );

  res.json({ supplier, purchases });
});

// Add supplier
supplierRouter.post('/', authenticate, (req: Request, res: Response) => {
  const { name, contact_person, email, phone, address, tax_id, outstanding_balance } = req.body;

  if (!name || !phone) {
    res.status(400).json({ error: 'Supplier company name and phone number are required.' });
    return;
  }

  const result = dbExecute(
    `INSERT INTO suppliers (name, contact_person, email, phone, address, tax_id, outstanding_balance)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      name.trim(),
      contact_person?.trim() || null,
      email?.trim() || null,
      phone.trim(),
      address?.trim() || null,
      tax_id?.trim() || null,
      Number(outstanding_balance) || 0
    ]
  );

  res.status(201).json({
    message: 'Supplier added successfully',
    supplierId: result.lastInsertRowid
  });
});

// Update supplier
supplierRouter.put('/:id', authenticate, (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const { name, contact_person, email, phone, address, tax_id, outstanding_balance, status } = req.body;

  if (!name || !phone) {
    res.status(400).json({ error: 'Supplier company name and phone number are required.' });
    return;
  }

  dbExecute(
    `UPDATE suppliers SET
      name = ?,
      contact_person = ?,
      email = ?,
      phone = ?,
      address = ?,
      tax_id = ?,
      outstanding_balance = ?,
      status = COALESCE(?, status)
    WHERE id = ?`,
    [
      name.trim(),
      contact_person?.trim() || null,
      email?.trim() || null,
      phone.trim(),
      address?.trim() || null,
      tax_id?.trim() || null,
      Number(outstanding_balance) || 0,
      status || null,
      id
    ]
  );

  res.json({ message: 'Supplier details updated successfully.' });
});

// Delete supplier
supplierRouter.delete('/:id', authenticate, requireAdmin, (req: Request, res: Response) => {
  const id = parseInt(req.params.id);

  const purchaseCheck = dbQueryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM purchases WHERE supplier_id = ?',
    [id]
  );

  if (purchaseCheck && purchaseCheck.count > 0) {
    res.status(400).json({
      error: `Cannot delete supplier: Linked to ${purchaseCheck.count} purchase order(s).`
    });
    return;
  }

  dbExecute('DELETE FROM suppliers WHERE id = ?', [id]);
  res.json({ message: 'Supplier deleted successfully.' });
});
