export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'staff';
  phone?: string;
  status?: string;
  created_at?: string;
}

export interface Category {
  id: number;
  name: string;
  code: string;
  description?: string;
  color: string;
  product_count?: number;
  created_at?: string;
}

export interface Supplier {
  id: number;
  name: string;
  contact_person?: string;
  email?: string;
  phone: string;
  address?: string;
  tax_id?: string;
  outstanding_balance: number;
  status?: string;
  total_orders?: number;
  total_purchased?: number;
  created_at?: string;
}

export interface Customer {
  id: number;
  name: string;
  email?: string;
  phone: string;
  address?: string;
  customer_type: 'retail' | 'wholesale';
  outstanding_balance: number;
  total_invoices?: number;
  total_spent?: number;
  created_at?: string;
}

export interface Product {
  id: number;
  name: string;
  sku: string;
  barcode?: string;
  brand?: string;
  category_id: number;
  category_name?: string;
  category_color?: string;
  unit: string;
  purchase_price: number;
  selling_price: number;
  quantity: number;
  min_stock: number;
  location?: string;
  description?: string;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
  stock_value_cost?: number;
  stock_value_retail?: number;
  created_at?: string;
  updated_at?: string;
}

export interface PurchaseItem {
  id?: number;
  purchase_id?: number;
  product_id: number;
  product_name?: string;
  sku?: string;
  unit?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface Purchase {
  id: number;
  purchase_number: string;
  supplier_id: number;
  supplier_name?: string;
  supplier_email?: string;
  supplier_phone?: string;
  supplier_address?: string;
  supplier_tax_id?: string;
  date: string;
  status: 'received' | 'pending' | 'cancelled';
  payment_status: 'paid' | 'partial' | 'pending';
  payment_method: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  notes?: string;
  created_by?: string;
  created_at?: string;
  total_items?: number;
  items?: PurchaseItem[];
}

export interface SaleItem {
  id?: number;
  sale_id?: number;
  product_id: number;
  product_name: string;
  sku: string;
  unit?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface Sale {
  id: number;
  invoice_number: string;
  customer_id?: number | null;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  customer_address?: string;
  customer_type?: string;
  date: string;
  status: 'completed' | 'pending' | 'cancelled';
  payment_status: 'paid' | 'pending';
  payment_method: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  notes?: string;
  created_by?: string;
  created_at?: string;
  total_items?: number;
  items?: SaleItem[];
}

export interface StockLog {
  id: number;
  product_id: number;
  product_name: string;
  sku: string;
  unit?: string;
  category_name?: string;
  type: 'purchase' | 'sale' | 'adjustment_in' | 'adjustment_out' | 'damage' | 'return' | 'initial_stock';
  quantity_change: number;
  previous_quantity: number;
  new_quantity: number;
  reason?: string;
  reference_id?: string;
  user_name?: string;
  created_at: string;
}

export interface DashboardKPIs {
  totalProducts: number;
  totalCategories: number;
  totalSuppliers: number;
  totalCustomers: number;
  totalStockQuantity: number;
  totalStockCostValue: number;
  totalStockRetailValue: number;
  totalSalesRevenue: number;
  totalSalesOrders: number;
  totalPurchasesCost: number;
  totalPurchasesOrders: number;
  lowStockCount: number;
  outOfStockCount: number;
}

export interface CompanySettings {
  company_name?: string;
  currency?: string;
  tax_rate?: string;
  address?: string;
  phone?: string;
  email?: string;
  gstin?: string;
}
