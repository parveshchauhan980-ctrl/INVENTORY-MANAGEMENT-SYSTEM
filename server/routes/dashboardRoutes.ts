import { Router, Request, Response } from 'express';
import { dbQuery, dbQueryOne } from '../db.ts';
import { authenticate } from '../auth.ts';

export const dashboardRouter = Router();

dashboardRouter.get('/summary', authenticate, (_req: Request, res: Response) => {
  // Counts
  const productsCount = dbQueryOne<{ count: number }>('SELECT COUNT(*) as count FROM products')?.count || 0;
  const categoriesCount = dbQueryOne<{ count: number }>('SELECT COUNT(*) as count FROM categories')?.count || 0;
  const suppliersCount = dbQueryOne<{ count: number }>('SELECT COUNT(*) as count FROM suppliers')?.count || 0;
  const customersCount = dbQueryOne<{ count: number }>('SELECT COUNT(*) as count FROM customers')?.count || 0;

  // Stock stats
  const stockStats = dbQueryOne<{
    total_quantity: number;
    total_cost_value: number;
    total_retail_value: number;
    low_stock_count: number;
    out_of_stock_count: number;
  }>(`
    SELECT
      COALESCE(SUM(quantity), 0) AS total_quantity,
      COALESCE(SUM(quantity * purchase_price), 0) AS total_cost_value,
      COALESCE(SUM(quantity * selling_price), 0) AS total_retail_value,
      COALESCE(SUM(CASE WHEN quantity > 0 AND quantity <= min_stock THEN 1 ELSE 0 END), 0) AS low_stock_count,
      COALESCE(SUM(CASE WHEN quantity <= 0 THEN 1 ELSE 0 END), 0) AS out_of_stock_count
    FROM products
  `);

  // Financial stats
  const salesStats = dbQueryOne<{ total_revenue: number; total_orders: number }>(`
    SELECT
      COALESCE(SUM(total_amount), 0) AS total_revenue,
      COUNT(*) AS total_orders
    FROM sales
    WHERE status = 'completed'
  `);

  const purchaseStats = dbQueryOne<{ total_cost: number; total_orders: number }>(`
    SELECT
      COALESCE(SUM(total_amount), 0) AS total_cost,
      COUNT(*) AS total_orders
    FROM purchases
    WHERE status = 'received'
  `);

  // Low stock alert items
  const lowStockProducts = dbQuery(`
    SELECT p.id, p.name, p.sku, p.quantity, p.min_stock, p.unit, p.selling_price, c.name AS category_name
    FROM products p
    JOIN categories c ON c.id = p.category_id
    WHERE p.quantity <= p.min_stock
    ORDER BY p.quantity ASC
    LIMIT 6
  `);

  // Recent sales
  const recentSales = dbQuery(`
    SELECT s.id, s.invoice_number, s.customer_name, s.date, s.total_amount, s.payment_method, s.payment_status
    FROM sales s
    ORDER BY s.date DESC, s.id DESC
    LIMIT 5
  `);

  // Recent purchases
  const recentPurchases = dbQuery(`
    SELECT p.id, p.purchase_number, s.name AS supplier_name, p.date, p.total_amount, p.payment_status
    FROM purchases p
    JOIN suppliers s ON s.id = p.supplier_id
    ORDER BY p.date DESC, p.id DESC
    LIMIT 5
  `);

  // Category breakdown
  const categoryBreakdown = dbQuery(`
    SELECT c.name, c.color,
           COUNT(p.id) AS product_count,
           COALESCE(SUM(p.quantity), 0) AS total_quantity,
           COALESCE(SUM(p.quantity * p.selling_price), 0) AS total_value
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id
    GROUP BY c.id
    ORDER BY total_value DESC
  `);

  // Sales trend by month (approximate last 6 months)
  const monthlyTrends = dbQuery(`
    SELECT
      strftime('%Y-%m', date) AS month,
      SUM(total_amount) AS revenue,
      COUNT(id) AS sales_count
    FROM sales
    GROUP BY strftime('%Y-%m', date)
    ORDER BY month ASC
    LIMIT 6
  `);

  res.json({
    kpis: {
      totalProducts: productsCount,
      totalCategories: categoriesCount,
      totalSuppliers: suppliersCount,
      totalCustomers: customersCount,
      totalStockQuantity: stockStats?.total_quantity || 0,
      totalStockCostValue: stockStats?.total_cost_value || 0,
      totalStockRetailValue: stockStats?.total_retail_value || 0,
      totalSalesRevenue: salesStats?.total_revenue || 0,
      totalSalesOrders: salesStats?.total_orders || 0,
      totalPurchasesCost: purchaseStats?.total_cost || 0,
      totalPurchasesOrders: purchaseStats?.total_orders || 0,
      lowStockCount: stockStats?.low_stock_count || 0,
      outOfStockCount: stockStats?.out_of_stock_count || 0
    },
    lowStockProducts,
    recentSales,
    recentPurchases,
    categoryBreakdown,
    monthlyTrends
  });
});
