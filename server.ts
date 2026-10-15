import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { getDatabase } from './server/db.ts';
import { authRouter } from './server/routes/authRoutes.ts';
import { categoryRouter } from './server/routes/categoryRoutes.ts';
import { productRouter } from './server/routes/productRoutes.ts';
import { supplierRouter } from './server/routes/supplierRoutes.ts';
import { customerRouter } from './server/routes/customerRoutes.ts';
import { purchaseRouter } from './server/routes/purchaseRoutes.ts';
import { saleRouter } from './server/routes/saleRoutes.ts';
import { stockRouter } from './server/routes/stockRoutes.ts';
import { dashboardRouter } from './server/routes/dashboardRoutes.ts';
import { reportRouter } from './server/routes/reportRoutes.ts';
import { settingRouter } from './server/routes/settingRoutes.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  // Initialize Database
  console.log('Initializing SQLite Database...');
  await getDatabase();
  console.log('SQLite Database ready.');

  const app = express();

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // CORS support for hosting frontend on platforms like Netlify
  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (_req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // API Routes
  app.use('/api/auth', authRouter);
  app.use('/api/categories', categoryRouter);
  app.use('/api/products', productRouter);
  app.use('/api/suppliers', supplierRouter);
  app.use('/api/customers', customerRouter);
  app.use('/api/purchases', purchaseRouter);
  app.use('/api/sales', saleRouter);
  app.use('/api/stock', stockRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/reports', reportRouter);
  app.use('/api/settings', settingRouter);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Frontend integration (Vite dev middleware vs production build static)
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Nexus Inventory Management System listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
