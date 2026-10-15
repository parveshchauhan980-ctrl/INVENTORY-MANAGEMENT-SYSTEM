import { Router, Request, Response } from 'express';
import { dbQuery, dbQueryOne } from '../db.ts';
import { authenticate } from '../auth.ts';

export const reportRouter = Router();

// Sales Report
reportRouter.get('/sales', authenticate, (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;

  let sql = `
    SELECT s.id, s.invoice_number, s.customer_name, s.date, s.payment_method,
           s.subtotal, s.tax_amount, s.discount_amount, s.total_amount, s.created_by,
           (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) AS item_count
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

  sql += ` ORDER BY s.date DESC, s.id DESC`;

  const rows = dbQuery(sql, params);

  const summary = {
    totalSales: rows.length,
    totalRevenue: rows.reduce((acc, r) => acc + (r.total_amount || 0), 0),
    totalSubtotal: rows.reduce((acc, r) => acc + (r.subtotal || 0), 0),
    totalTax: rows.reduce((acc, r) => acc + (r.tax_amount || 0), 0),
    totalDiscount: rows.reduce((acc, r) => acc + (r.discount_amount || 0), 0)
  };

  res.json({ rows, summary });
});

// Purchases Report
reportRouter.get('/purchases', authenticate, (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;

  let sql = `
    SELECT p.id, p.purchase_number, s.name AS supplier_name, p.date, p.payment_method,
           p.subtotal, p.tax_amount, p.discount_amount, p.total_amount, p.created_by,
           (SELECT COUNT(*) FROM purchase_items pi WHERE pi.purchase_id = p.id) AS item_count
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

  sql += ` ORDER BY p.date DESC, p.id DESC`;

  const rows = dbQuery(sql, params);

  const summary = {
    totalPurchases: rows.length,
    totalSpent: rows.reduce((acc, r) => acc + (r.total_amount || 0), 0),
    totalSubtotal: rows.reduce((acc, r) => acc + (r.subtotal || 0), 0),
    totalTax: rows.reduce((acc, r) => acc + (r.tax_amount || 0), 0)
  };

  res.json({ rows, summary });
});

// Inventory Valuation Report
reportRouter.get('/inventory', authenticate, (req: Request, res: Response) => {
  const { categoryId } = req.query;

  let sql = `
    SELECT p.id, p.name, p.sku, p.quantity, p.min_stock, p.unit, p.purchase_price, p.selling_price,
           c.name AS category_name,
           (p.quantity * p.purchase_price) AS total_cost_value,
           (p.quantity * p.selling_price) AS total_retail_value,
           ((p.selling_price - p.purchase_price) * p.quantity) AS potential_profit
    FROM products p
    JOIN categories c ON c.id = p.category_id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (categoryId && categoryId !== 'all') {
    sql += ` AND p.category_id = ?`;
    params.push(parseInt(String(categoryId)));
  }

  sql += ` ORDER BY total_retail_value DESC`;

  const rows = dbQuery(sql, params);

  const summary = {
    totalItems: rows.length,
    totalStockUnits: rows.reduce((acc, r) => acc + (r.quantity || 0), 0),
    totalCostValuation: rows.reduce((acc, r) => acc + (r.total_cost_value || 0), 0),
    totalRetailValuation: rows.reduce((acc, r) => acc + (r.total_retail_value || 0), 0),
    totalPotentialProfit: rows.reduce((acc, r) => acc + (r.potential_profit || 0), 0)
  };

  res.json({ rows, summary });
});

// Profit & Loss and Product Performance Report
reportRouter.get('/profit-loss', authenticate, (_req: Request, res: Response) => {
  // Calculate total sales revenue
  const salesSummary = dbQueryOne<{ revenue: number; discount: number; tax: number }>(`
    SELECT
      COALESCE(SUM(total_amount), 0) AS revenue,
      COALESCE(SUM(discount_amount), 0) AS discount,
      COALESCE(SUM(tax_amount), 0) AS tax
    FROM sales
    WHERE status = 'completed'
  `);

  // Calculate Cost of Goods Sold (COGS) from sold items * product purchase_price
  const cogsSummary = dbQueryOne<{ cogs: number; total_units_sold: number }>(`
    SELECT
      COALESCE(SUM(si.quantity * p.purchase_price), 0) AS cogs,
      COALESCE(SUM(si.quantity), 0) AS total_units_sold
    FROM sale_items si
    JOIN products p ON p.id = si.product_id
  `);

  const revenue = salesSummary?.revenue || 0;
  const cogs = cogsSummary?.cogs || 0;
  const grossProfit = revenue - cogs;
  const marginPercentage = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

  // Top products sold
  const topProducts = dbQuery(`
    SELECT
      p.id, p.name, p.sku, c.name AS category_name,
      SUM(si.quantity) AS units_sold,
      SUM(si.total_price) AS total_revenue,
      SUM(si.quantity * p.purchase_price) AS cost_of_goods,
      (SUM(si.total_price) - SUM(si.quantity * p.purchase_price)) AS item_profit
    FROM sale_items si
    JOIN products p ON p.id = si.product_id
    JOIN categories c ON c.id = p.category_id
    GROUP BY p.id
    ORDER BY total_revenue DESC
    LIMIT 10
  `);

  res.json({
    revenue,
    cogs,
    grossProfit,
    marginPercentage,
    totalUnitsSold: cogsSummary?.total_units_sold || 0,
    topProducts
  });
});
