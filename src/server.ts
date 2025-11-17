import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';
import { DatabaseManager } from './database/db';
import { AuditService } from './services/audit-service';
import { ComparisonService } from './services/comparison-service';
import { createAuditRoutes } from './routes/audit-routes';
import { createWebsiteRoutes } from './routes/website-routes';
import { CrawlOptions } from './types';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000;
const DATABASE_PATH = process.env.DATABASE_PATH || './data/site-tracker.db';

// Initialize Express app
const app = express();

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development
}));
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Initialize database and services
const db = new DatabaseManager(DATABASE_PATH);

const crawlOptions: CrawlOptions = {
  maxDepth: parseInt(process.env.MAX_CRAWL_DEPTH || '3'),
  maxPages: parseInt(process.env.MAX_PAGES_PER_SITE || '50'),
  timeout: parseInt(process.env.TIMEOUT_MS || '30000'),
  userAgent: process.env.USER_AGENT || 'SiteTracker/1.0 (Website Audit Bot)',
  respectRobotsTxt: true,
};

const auditService = new AuditService(db, crawlOptions);
const comparisonService = new ComparisonService(db);

// Routes
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'Site Tracker API',
    version: '1.0.0',
    description: 'Website audit and health checker similar to Ahrefs',
    endpoints: {
      audits: {
        'POST /api/audits': 'Create a new website audit',
        'GET /api/audits/:id': 'Get audit by ID',
        'GET /api/audits/:id/comparison': 'Get comparison with previous audit',
        'GET /api/audits/:id/compare-similar': 'Compare with similar websites',
      },
      websites: {
        'GET /api/websites': 'Get all websites',
        'GET /api/websites/by-url': 'Get website by URL',
        'GET /api/websites/:id/audits': 'Get audits for a website',
        'GET /api/websites/:id/latest-audit': 'Get latest audit for a website',
        'GET /api/websites/:id/trend': 'Get audit trend for a website',
      },
    },
  });
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount routes
app.use('/api', createAuditRoutes(auditService, comparisonService));
app.use('/api', createWebsiteRoutes(auditService, comparisonService));

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════╗
║         Site Tracker API Server                   ║
╚═══════════════════════════════════════════════════╝

Server is running on: http://localhost:${PORT}
Database: ${DATABASE_PATH}
Environment: ${process.env.NODE_ENV || 'development'}

API Documentation:
- POST   /api/audits              Create new audit
- GET    /api/audits/:id          Get audit details
- GET    /api/audits/:id/comparison    Compare with previous
- GET    /api/websites            List all websites
- GET    /api/websites/:id/audits List website audits
- GET    /api/websites/:id/trend  Get audit trend

Example:
curl -X POST http://localhost:${PORT}/api/audits \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://example.com"}'
  `);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  db.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down gracefully...');
  db.close();
  process.exit(0);
});

export default app;
