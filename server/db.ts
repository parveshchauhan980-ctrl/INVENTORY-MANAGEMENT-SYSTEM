import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'inventory.sqlite');

let dbInstance: Database | null = null;

export async function getDatabase(): Promise<Database> {
  if (dbInstance) return dbInstance;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    try {
      const fileBuffer = fs.readFileSync(DB_PATH);
      dbInstance = new SQL.Database(fileBuffer);
    } catch (err) {
      console.error('Failed reading existing SQLite file, creating fresh DB:', err);
      dbInstance = new SQL.Database();
    }
  } else {
    dbInstance = new SQL.Database();
  }

  // Enable foreign keys
  dbInstance.run('PRAGMA foreign_keys = ON;');

  // Initialize tables and seed
  await initializeSchema(dbInstance);

  return dbInstance;
}

export function saveDatabase(): void {
  if (!dbInstance) return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (err) {
    console.error('Error saving SQLite database to disk:', err);
  }
}

// Helper to run query and return array of objects
export function dbQuery<T = any>(sql: string, params: any[] = []): T[] {
  if (!dbInstance) throw new Error('Database not initialized');
  const stmt = dbInstance.prepare(sql);
  if (params && params.length > 0) {
    stmt.bind(params);
  }
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return results;
}

// Helper to run query and return first object or null
export function dbQueryOne<T = any>(sql: string, params: any[] = []): T | null {
  const rows = dbQuery<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

let inTransaction = false;

// Helper to execute write command and save
export function dbExecute(sql: string, params: any[] = []): { changes: number; lastInsertRowid: number } {
  if (!dbInstance) throw new Error('Database not initialized');
  dbInstance.run(sql, params);
  
  const idResult = dbQueryOne<{ id: number }>('SELECT last_insert_rowid() AS id');
  const changesResult = dbQueryOne<{ changes: number }>('SELECT changes() AS changes');
  
  if (!inTransaction) {
    saveDatabase();
  }

  return {
    lastInsertRowid: idResult?.id || 0,
    changes: changesResult?.changes || 0
  };
}

// Transaction wrapper
export function dbTransaction<T>(fn: () => T): T {
  if (!dbInstance) throw new Error('Database not initialized');
  if (inTransaction) {
    return fn();
  }
  inTransaction = true;
  dbInstance.run('BEGIN TRANSACTION;');
  try {
    const result = fn();
    dbInstance.run('COMMIT;');
    inTransaction = false;
    saveDatabase();
    return result;
  } catch (err) {
    inTransaction = false;
    console.error('Error inside dbTransaction:', err);
    try {
      dbInstance.run('ROLLBACK;');
    } catch (_) {
      // Transaction may have already been aborted by SQLite
    }
    throw err;
  }
}

async function initializeSchema(db: Database) {
  // Schema creation
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
      phone TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      code TEXT NOT NULL UNIQUE,
      description TEXT,
      color TEXT DEFAULT '#6366f1',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact_person TEXT,
      email TEXT,
      phone TEXT NOT NULL,
      address TEXT,
      tax_id TEXT,
      outstanding_balance REAL DEFAULT 0.0,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT NOT NULL,
      address TEXT,
      customer_type TEXT DEFAULT 'retail' CHECK (customer_type IN ('retail', 'wholesale')),
      outstanding_balance REAL DEFAULT 0.0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sku TEXT NOT NULL UNIQUE,
      barcode TEXT,
      brand TEXT,
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
      unit TEXT NOT NULL DEFAULT 'pcs',
      purchase_price REAL NOT NULL,
      selling_price REAL NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      min_stock INTEGER NOT NULL DEFAULT 5,
      location TEXT,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'in_stock',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_number TEXT NOT NULL UNIQUE,
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
      date DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'received',
      payment_status TEXT NOT NULL DEFAULT 'paid',
      payment_method TEXT DEFAULT 'bank_transfer',
      subtotal REAL NOT NULL DEFAULT 0.0,
      tax_amount REAL NOT NULL DEFAULT 0.0,
      discount_amount REAL NOT NULL DEFAULT 0.0,
      total_amount REAL NOT NULL DEFAULT 0.0,
      notes TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      total_price REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT NOT NULL UNIQUE,
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      customer_name TEXT NOT NULL,
      date DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'completed',
      payment_status TEXT NOT NULL DEFAULT 'paid',
      payment_method TEXT DEFAULT 'cash',
      subtotal REAL NOT NULL DEFAULT 0.0,
      tax_rate REAL NOT NULL DEFAULT 18.0,
      tax_amount REAL NOT NULL DEFAULT 0.0,
      discount_amount REAL NOT NULL DEFAULT 0.0,
      total_amount REAL NOT NULL DEFAULT 0.0,
      notes TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
      product_name TEXT NOT NULL,
      sku TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      total_price REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stock_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      quantity_change INTEGER NOT NULL,
      previous_quantity INTEGER NOT NULL,
      new_quantity INTEGER NOT NULL,
      reason TEXT,
      reference_id TEXT,
      user_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Check if users exist, seed if empty
  const userCheck = dbQueryOne<{ count: number }>('SELECT COUNT(*) as count FROM users');
  if (!userCheck || userCheck.count === 0) {
    await seedInitialData(db);
  } else {
    // Ensure primary admin account exists
    const ownerCheck = dbQueryOne<{ id: number }>('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', ['parveshchauhan980@gmail.com']);
    if (!ownerCheck) {
      const salt = bcrypt.genSaltSync(10);
      const adminPassword = bcrypt.hashSync('admin123', salt);
      db.run(
        `INSERT INTO users (name, email, password, role, phone, status) VALUES ('Parvesh Chauhan', 'parveshchauhan980@gmail.com', '${adminPassword}', 'admin', '+91 98765 43210', 'active');`
      );
      saveDatabase();
    }
    const managerCheck = dbQueryOne<{ id: number }>('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', ['manager@inventory.com']);
    if (!managerCheck) {
      const salt = bcrypt.genSaltSync(10);
      const adminPassword = bcrypt.hashSync('admin123', salt);
      db.run(
        `INSERT INTO users (name, email, password, role, phone, status) VALUES ('Priya Mehta (Manager)', 'manager@inventory.com', '${adminPassword}', 'admin', '+91 98234 56789', 'active');`
      );
      saveDatabase();
    }
  }
}

export async function seedInitialData(db: Database) {
  console.log('Seeding initial data...');
  const salt = bcrypt.genSaltSync(10);
  const adminPassword = bcrypt.hashSync('admin123', salt);

  // Users
  db.run(`
    INSERT INTO users (name, email, password, role, phone, status) VALUES
    ('Parvesh Chauhan', 'admin@inventory.com', '${adminPassword}', 'admin', '+91 98765 43210', 'active'),
    ('Parvesh Chauhan', 'parveshchauhan980@gmail.com', '${adminPassword}', 'admin', '+91 98765 43210', 'active'),
    ('Priya Mehta', 'manager@inventory.com', '${adminPassword}', 'admin', '+91 98234 56789', 'active'),
    ('Rahul Sharma', 'staff@inventory.com', '${adminPassword}', 'staff', '+91 98123 45678', 'active');
  `);

  // Settings
  db.run(`
    INSERT OR REPLACE INTO settings (key, value) VALUES
    ('company_name', 'Nexus Inventory Systems Pvt. Ltd.'),
    ('currency', '₹'),
    ('tax_rate', '18'),
    ('address', 'Plot 42, Tech Park, Phase II, Hinjewadi, Pune - 411057'),
    ('phone', '+91 (020) 8765-4321'),
    ('email', 'contact@nexusinventory.com'),
    ('gstin', '27AABCN8932K1ZP');
  `);

  // Categories
  db.run(`
    INSERT INTO categories (name, code, description, color) VALUES
    ('Electronics & IT', 'CAT-ELEC', 'Laptops, peripherals, memory, network gear and accessories', '#3b82f6'),
    ('Office Stationery', 'CAT-STAT', 'Paper, notebooks, desk organizers, printers and inks', '#10b981'),
    ('Industrial Tools', 'CAT-TOOL', 'Power tools, precision hand tools, measuring instruments', '#f59e0b'),
    ('Safety & PPE', 'CAT-SAFE', 'Helmets, safety goggles, gloves and emergency equipment', '#ef4444'),
    ('Packaging & Shipping', 'CAT-PACK', 'Carton boxes, bubble wraps, tapes and thermal labels', '#8b5cf6');
  `);

  // Suppliers
  db.run(`
    INSERT INTO suppliers (name, contact_person, email, phone, address, tax_id, outstanding_balance) VALUES
    ('Apex Electronics Distribution', 'Vikram Malhotra', 'vikram@apexelectronics.in', '+91 98220 11223', 'Industrial Area, Andheri East, Mumbai', '27AAACA1234A1Z1', 12500.00),
    ('Prime Stationery & Paper Co.', 'Sunita Deshmukh', 'sales@primestationery.com', '+91 98330 22334', 'GIDC Estate, Sector 18, Vapi, Gujarat', '24AABCS5678B1Z2', 4500.00),
    ('Global Industrial Hardware Ltd.', 'Anand Verma', 'anand@globalhardware.com', '+91 98440 33445', 'Peenya Industrial Area, Bengaluru', '29AABCG9101C1Z3', 0.00),
    ('Protective Gear Tech', 'Deepak Joshi', 'orders@protecgear.co.in', '+91 98550 44556', 'MIDC Bhosari, Pune', '27AABCP3456D1Z4', 18000.00);
  `);

  // Customers
  db.run(`
    INSERT INTO customers (name, email, phone, address, customer_type, outstanding_balance) VALUES
    ('Modern Tech Solutions', 'procurement@moderntech.io', '+91 99112 33445', 'Infotech Park, Viman Nagar, Pune', 'wholesale', 8500.00),
    ('St. Xavier College CS Dept', 'hod.cs@stxavier.edu.in', '+91 99223 44556', 'College Campus, F.C. Road, Pune', 'wholesale', 0.00),
    ('Amitabh Sen', 'amitabh.sen@gmail.com', '+91 99334 55667', 'B-402, Greenwoods Apts, Baner, Pune', 'retail', 0.00),
    ('Pooja Nair Enterprises', 'pooja@nairenterprises.com', '+91 99445 66778', 'Shivaji Nagar Market, Pune', 'retail', 1200.00);
  `);

  // Products
  db.run(`
    INSERT INTO products (name, sku, barcode, brand, category_id, unit, purchase_price, selling_price, quantity, min_stock, location, description, status) VALUES
    ('Logitech MX Master 3S Mouse', 'ELEC-LOGI-001', '890103092811', 'Logitech', 1, 'pcs', 6500.00, 8999.00, 18, 5, 'Aisle 1-Rack B', 'High precision ergonomic wireless performance mouse', 'in_stock'),
    ('Dell 24" IPS FHD Monitor (P2422H)', 'ELEC-DELL-002', '890103092812', 'Dell', 1, 'pcs', 11500.00, 14999.00, 7, 3, 'Aisle 1-Rack C', '24 inch Full HD IPS commercial workstation display', 'in_stock'),
    ('SanDisk 1TB Portable SSD Extreme', 'ELEC-SAND-003', '890103092813', 'SanDisk', 1, 'pcs', 7200.00, 9499.00, 4, 6, 'Aisle 1-Rack A', 'Ultra-fast NVMe portable storage with IP55 rating', 'low_stock'),
    ('Keychron K2 Mechanical Keyboard', 'ELEC-KEY-004', '890103092814', 'Keychron', 1, 'pcs', 5800.00, 7999.00, 0, 4, 'Aisle 1-Rack D', 'Compact 75% wireless mechanical keyboard Gateron Brown', 'out_of_stock'),
    ('HP LaserJet Toner Cartridge 12A', 'STAT-HP-001', '890103092815', 'HP', 2, 'box', 1800.00, 2450.00, 22, 5, 'Aisle 2-Rack A', 'High yield monochrome laser printer toner cartridge', 'in_stock'),
    ('JK Copier Paper A4 75 GSM (500 Sheets)', 'STAT-JK-002', '890103092816', 'JK Paper', 2, 'box', 260.00, 360.00, 65, 15, 'Aisle 2-Rack B', 'Premium multipurpose copier printing ream', 'in_stock'),
    ('Bosch Professional Cordless Drill 12V', 'TOOL-BOS-001', '890103092817', 'Bosch', 3, 'pcs', 4200.00, 5800.00, 3, 5, 'Aisle 3-Rack A', 'Lightweight compact drill driver with 2 Li-ion batteries', 'low_stock'),
    ('Stanley 65-Piece Tool Kit Set', 'TOOL-STA-002', '890103092818', 'Stanley', 3, 'box', 2400.00, 3499.00, 11, 4, 'Aisle 3-Rack B', 'Professional mechanic tool box with sockets and wrenches', 'in_stock'),
    ('3M High-Impact Safety Goggles', 'SAFE-3M-001', '890103092819', '3M', 4, 'pcs', 180.00, 299.00, 45, 10, 'Aisle 4-Rack A', 'Anti-fog splash resistant industrial safety eyewear', 'in_stock'),
    ('Karam Industrial Safety Helmet Yellow', 'SAFE-KAR-002', '890103092820', 'Karam', 4, 'pcs', 220.00, 380.00, 30, 8, 'Aisle 4-Rack B', 'CE certified ratchet headband construction helmet', 'in_stock'),
    ('Heavy-Duty Corrugated Boxes (12x10x8)', 'PACK-BOX-001', '890103092821', 'PackPro', 5, 'box', 28.00, 45.00, 120, 30, 'Aisle 5-Rack A', '3-ply sturdy carton shipping storage boxes', 'in_stock');
  `);

  // Purchases
  db.run(`
    INSERT INTO purchases (purchase_number, supplier_id, date, status, payment_status, payment_method, subtotal, tax_amount, total_amount, notes, created_by) VALUES
    ('PO-2026-0001', 1, '2026-10-01', 'received', 'paid', 'bank_transfer', 65000.00, 11700.00, 76700.00, 'Quarterly replenishment for electronics', 'Parvesh Chauhan (Admin)'),
    ('PO-2026-0002', 2, '2026-10-05', 'received', 'paid', 'bank_transfer', 23000.00, 4140.00, 27140.00, 'Stationery bulk procurement', 'Parvesh Chauhan (Admin)'),
    ('PO-2026-0003', 3, '2026-10-10', 'received', 'paid', 'bank_transfer', 37800.00, 6804.00, 44604.00, 'Industrial workshop tools order', 'Rahul Sharma (Staff)');
  `);

  // Purchase items
  db.run(`
    INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_price, total_price) VALUES
    (1, 1, 10, 6500.00, 65000.00),
    (2, 5, 10, 1800.00, 18000.00),
    (2, 6, 20, 250.00, 5000.00),
    (3, 7, 6, 4200.00, 25200.00),
    (3, 8, 5, 2520.00, 12600.00);
  `);

  // Sales
  db.run(`
    INSERT INTO sales (invoice_number, customer_id, customer_name, date, status, payment_status, payment_method, subtotal, tax_rate, tax_amount, discount_amount, total_amount, notes, created_by) VALUES
    ('INV-2026-0001', 1, 'Modern Tech Solutions', '2026-10-08', 'completed', 'paid', 'bank_transfer', 44995.00, 18.0, 8099.10, 500.00, 52594.10, 'Corporate workstations accessories order', 'Parvesh Chauhan (Admin)'),
    ('INV-2026-0002', 2, 'St. Xavier College CS Dept', '2026-10-11', 'completed', 'paid', 'upi', 29998.00, 18.0, 5399.64, 0.00, 35397.64, 'CS Computer lab monitors upgrade', 'Rahul Sharma (Staff)'),
    ('INV-2026-0003', 3, 'Amitabh Sen', '2026-10-13', 'completed', 'paid', 'cash', 8999.00, 18.0, 1619.82, 0.00, 10618.82, 'Walk-in retail purchase', 'Rahul Sharma (Staff)');
  `);

  // Sale items
  db.run(`
    INSERT INTO sale_items (sale_id, product_id, product_name, sku, quantity, unit_price, total_price) VALUES
    (1, 1, 'Logitech MX Master 3S Mouse', 'ELEC-LOGI-001', 5, 8999.00, 44995.00),
    (2, 2, 'Dell 24" IPS FHD Monitor (P2422H)', 'ELEC-DELL-002', 2, 14999.00, 29998.00),
    (3, 1, 'Logitech MX Master 3S Mouse', 'ELEC-LOGI-001', 1, 8999.00, 8999.00);
  `);

  // Stock logs
  db.run(`
    INSERT INTO stock_logs (product_id, type, quantity_change, previous_quantity, new_quantity, reason, reference_id, user_name) VALUES
    (1, 'purchase', 10, 14, 24, 'Stock received via PO', 'PO-2026-0001', 'Parvesh Chauhan (Admin)'),
    (1, 'sale', -5, 24, 19, 'Billed in invoice', 'INV-2026-0001', 'Parvesh Chauhan (Admin)'),
    (1, 'sale', -1, 19, 18, 'Retail counter sale', 'INV-2026-0003', 'Rahul Sharma (Staff)'),
    (2, 'sale', -2, 9, 7, 'Billed in invoice', 'INV-2026-0002', 'Rahul Sharma (Staff)'),
    (4, 'adjustment_out', -2, 2, 0, 'Damaged during transit audit', 'ADJ-AUDIT-01', 'Parvesh Chauhan (Admin)');
  `);

  saveDatabase();
  console.log('Seed data inserted successfully.');
}
