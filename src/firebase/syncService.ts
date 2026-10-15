import { doc, setDoc, getDocs, collection } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './config';
import { api } from '../api/client';
import { Product, Category, Supplier, Customer, Sale, Purchase, StockLog } from '../types';

export interface CloudSyncResult {
  productsCount: number;
  categoriesCount: number;
  suppliersCount: number;
  customersCount: number;
  salesCount: number;
  purchasesCount: number;
  syncedAt: string;
}

export async function syncAllToFirebase(): Promise<CloudSyncResult> {
  const [prodsRes, catsRes, supsRes, custsRes, salesRes, purchRes] = await Promise.all([
    api.get<{ products: Product[] }>('/api/products'),
    api.get<{ categories: Category[] }>('/api/categories'),
    api.get<{ suppliers: Supplier[] }>('/api/suppliers'),
    api.get<{ customers: Customer[] }>('/api/customers'),
    api.get<{ sales: Sale[] }>('/api/sales'),
    api.get<{ purchases: Purchase[] }>('/api/purchases')
  ]);

  const syncedAt = new Date().toISOString();

  // Sync Categories
  for (const cat of catsRes.categories) {
    const path = `categories/${cat.id}`;
    try {
      await setDoc(doc(db, 'categories', String(cat.id)), {
        id: cat.id,
        name: cat.name,
        code: cat.code,
        description: cat.description || '',
        color: cat.color || '#6366f1',
        syncedAt
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  }

  // Sync Products
  for (const prod of prodsRes.products) {
    const path = `products/${prod.id}`;
    try {
      await setDoc(doc(db, 'products', String(prod.id)), {
        id: prod.id,
        name: prod.name,
        sku: prod.sku,
        barcode: prod.barcode || '',
        brand: prod.brand || '',
        categoryId: prod.category_id,
        categoryName: prod.category_name || '',
        unit: prod.unit,
        purchasePrice: prod.purchase_price,
        sellingPrice: prod.selling_price,
        quantity: prod.quantity,
        minStock: prod.min_stock,
        location: prod.location || '',
        description: prod.description || '',
        status: prod.status,
        syncedAt
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  }

  // Sync Suppliers
  for (const sup of supsRes.suppliers) {
    const path = `suppliers/${sup.id}`;
    try {
      await setDoc(doc(db, 'suppliers', String(sup.id)), {
        id: sup.id,
        name: sup.name,
        contactPerson: sup.contact_person || '',
        email: sup.email || '',
        phone: sup.phone,
        address: sup.address || '',
        taxId: sup.tax_id || '',
        outstandingBalance: sup.outstanding_balance || 0,
        syncedAt
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  }

  // Sync Customers
  for (const cust of custsRes.customers) {
    const path = `customers/${cust.id}`;
    try {
      await setDoc(doc(db, 'customers', String(cust.id)), {
        id: cust.id,
        name: cust.name,
        email: cust.email || '',
        phone: cust.phone,
        address: cust.address || '',
        customerType: cust.customer_type,
        outstandingBalance: cust.outstanding_balance || 0,
        syncedAt
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  }

  // Sync Purchases
  for (const po of purchRes.purchases) {
    const path = `purchases/${po.id}`;
    try {
      await setDoc(doc(db, 'purchases', String(po.id)), {
        id: po.id,
        purchaseNumber: po.purchase_number,
        supplierId: po.supplier_id,
        supplierName: po.supplier_name,
        date: po.date,
        status: po.status,
        paymentStatus: po.payment_status,
        paymentMethod: po.payment_method,
        totalAmount: po.total_amount,
        syncedAt
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  }

  // Sync Sales
  for (const sale of salesRes.sales) {
    const path = `sales/${sale.id}`;
    try {
      await setDoc(doc(db, 'sales', String(sale.id)), {
        id: sale.id,
        invoiceNumber: sale.invoice_number,
        customerName: sale.customer_name,
        date: sale.date,
        status: sale.status,
        paymentMethod: sale.payment_method,
        subtotal: sale.subtotal,
        taxAmount: sale.tax_amount,
        totalAmount: sale.total_amount,
        syncedAt
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  }

  return {
    productsCount: prodsRes.products.length,
    categoriesCount: catsRes.categories.length,
    suppliersCount: supsRes.suppliers.length,
    customersCount: custsRes.customers.length,
    salesCount: salesRes.sales.length,
    purchasesCount: purchRes.purchases.length,
    syncedAt
  };
}
