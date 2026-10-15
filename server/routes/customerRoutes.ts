import { Router, Request, Response } from 'express';
import { dbQuery, dbQueryOne, dbExecute } from '../db.ts';
import { authenticate, requireAdmin } from '../auth.ts';

export const customerRouter = Router();

// Get all customers with summary
customerRouter.get('/', authenticate, (_req: Request, res: Response) => {
  const customers = dbQuery(`
    SELECT c.*,
           COUNT(s.id) AS total_invoices,
           COALESCE(SUM(s.total_amount), 0) AS total_spent
    FROM customers c
    LEFT JOIN sales s ON s.customer_id = c.id
    GROUP BY c.id
    ORDER BY c.name ASC
  `);
  res.json({ customers });
});

// Get customer by ID with sales history
customerRouter.get('/:id', authenticate, (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const customer = dbQueryOne('SELECT * FROM customers WHERE id = ?', [id]);

  if (!customer) {
    res.status(404).json({ error: 'Customer not found.' });
    return;
  }

  const invoices = dbQuery(
    'SELECT * FROM sales WHERE customer_id = ? ORDER BY date DESC, id DESC',
    [id]
  );

  res.json({ customer, invoices });
});

// Add customer
customerRouter.post('/', authenticate, (req: Request, res: Response) => {
  const { name, email, phone, address, customer_type = 'retail', outstanding_balance } = req.body;

  if (!name || !phone) {
    res.status(400).json({ error: 'Customer name and phone number are required.' });
    return;
  }

  const result = dbExecute(
    `INSERT INTO customers (name, email, phone, address, customer_type, outstanding_balance)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      name.trim(),
      email?.trim() || null,
      phone.trim(),
      address?.trim() || null,
      customer_type || 'retail',
      Number(outstanding_balance) || 0
    ]
  );

  res.status(201).json({
    message: 'Customer added successfully',
    customerId: result.lastInsertRowid
  });
});

// Update customer
customerRouter.put('/:id', authenticate, (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const { name, email, phone, address, customer_type, outstanding_balance } = req.body;

  if (!name || !phone) {
    res.status(400).json({ error: 'Customer name and phone number are required.' });
    return;
  }

  dbExecute(
    `UPDATE customers SET
      name = ?,
      email = ?,
      phone = ?,
      address = ?,
      customer_type = COALESCE(?, customer_type),
      outstanding_balance = ?
    WHERE id = ?`,
    [
      name.trim(),
      email?.trim() || null,
      phone.trim(),
      address?.trim() || null,
      customer_type || null,
      Number(outstanding_balance) || 0,
      id
    ]
  );

  res.json({ message: 'Customer details updated successfully.' });
});

// Delete customer
customerRouter.delete('/:id', authenticate, requireAdmin, (req: Request, res: Response) => {
  const id = parseInt(req.params.id);

  const salesCheck = dbQueryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM sales WHERE customer_id = ?',
    [id]
  );

  if (salesCheck && salesCheck.count > 0) {
    res.status(400).json({
      error: `Cannot delete customer: Linked to ${salesCheck.count} invoice(s). You can mark the customer or keep records for auditing.`
    });
    return;
  }

  dbExecute('DELETE FROM customers WHERE id = ?', [id]);
  res.json({ message: 'Customer deleted successfully.' });
});
