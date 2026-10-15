import { Router, Request, Response } from 'express';
import { dbQuery, dbExecute } from '../db.ts';
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

// Full database export for JSON / CSV backups
settingRouter.get('/export-data', authenticate, (_req: Request, res: Response) => {
  try {
    const products = dbQuery(`
      SELECT p.*, c.name AS category_name, c.code AS category_code
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      ORDER BY p.id ASC
    `);

    const sales = dbQuery(`
      SELECT s.*, c.email AS customer_email, c.phone AS customer_phone
      FROM sales s
      LEFT JOIN customers c ON c.id = s.customer_id
      ORDER BY s.date DESC, s.id DESC
    `);

    const saleItems = dbQuery(`
      SELECT si.*, p.sku AS product_sku
      FROM sale_items si
      LEFT JOIN products p ON p.id = si.product_id
      ORDER BY si.id ASC
    `);

    // Group items by sale_id
    const salesWithItems = sales.map((sale: any) => ({
      ...sale,
      items: saleItems.filter((item: any) => item.sale_id === sale.id)
    }));

    const purchases = dbQuery(`
      SELECT p.*, s.name AS supplier_name, s.phone AS supplier_phone, s.tax_id AS supplier_tax_id
      FROM purchases p
      LEFT JOIN suppliers s ON s.id = p.supplier_id
      ORDER BY p.date DESC, p.id DESC
    `);

    const purchaseItems = dbQuery(`
      SELECT pi.*, p.name AS product_name, p.sku AS product_sku
      FROM purchase_items pi
      LEFT JOIN products p ON p.id = pi.product_id
      ORDER BY pi.id ASC
    `);

    const purchasesWithItems = purchases.map((po: any) => ({
      ...po,
      items: purchaseItems.filter((item: any) => item.purchase_id === po.id)
    }));

    const categories = dbQuery('SELECT * FROM categories ORDER BY name ASC');
    const suppliers = dbQuery('SELECT * FROM suppliers ORDER BY name ASC');
    const customers = dbQuery('SELECT * FROM customers ORDER BY name ASC');
    const stockLogs = dbQuery(`
      SELECT sl.*, p.name AS product_name, p.sku AS product_sku
      FROM stock_logs sl
      LEFT JOIN products p ON p.id = sl.product_id
      ORDER BY sl.id DESC
    `);

    const settingRows = dbQuery<{ key: string; value: string }>('SELECT key, value FROM settings');
    const settings: Record<string, string> = {};
    for (const row of settingRows) {
      settings[row.key] = row.value;
    }

    res.json({
      exportedAt: new Date().toISOString(),
      system: 'Nexus Inventory Management System',
      version: '1.0.0',
      settings,
      summary: {
        totalProducts: products.length,
        totalSales: sales.length,
        totalPurchases: purchases.length,
        totalCategories: categories.length,
        totalSuppliers: suppliers.length,
        totalCustomers: customers.length,
        totalStockLogs: stockLogs.length
      },
      products,
      sales: salesWithItems,
      purchases: purchasesWithItems,
      categories,
      suppliers,
      customers,
      stockLogs
    });
  } catch (err: any) {
    console.error('Error generating export snapshot:', err);
    res.status(500).json({ error: 'Failed to generate export snapshot: ' + err.message });
  }
});
