import { Router, Request, Response } from 'express';
import { AuditService } from '../services/audit-service';
import { ComparisonService } from '../services/comparison-service';

export function createWebsiteRoutes(
  auditService: AuditService,
  comparisonService: ComparisonService
): Router {
  const router = Router();

  // Get all websites
  router.get('/websites', (_req: Request, res: Response) => {
    try {
      const websites = auditService.getAllWebsites();
      return res.json({
        success: true,
        data: websites,
      });
    } catch (error: any) {
      console.error('Error fetching websites:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch websites',
      });
    }
  });

  // Get website by URL
  router.get('/websites/by-url', (req: Request, res: Response) => {
    try {
      const { url } = req.query;

      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'URL parameter is required' });
      }

      const website = auditService.getWebsiteByUrl(url);

      if (!website) {
        return res.status(404).json({ error: 'Website not found' });
      }

      return res.json({
        success: true,
        data: website,
      });
    } catch (error: any) {
      console.error('Error fetching website:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch website',
      });
    }
  });

  // Get audits for a website
  router.get('/websites/:id/audits', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const limit = parseInt(req.query.limit as string) || 10;

      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid website ID' });
      }

      const audits = auditService.getAuditsForWebsite(id, limit);

      return res.json({
        success: true,
        data: audits,
      });
    } catch (error: any) {
      console.error('Error fetching audits:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch audits',
      });
    }
  });

  // Get latest audit for a website
  router.get('/websites/:id/latest-audit', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid website ID' });
      }

      const audit = auditService.getLatestAuditForWebsite(id);

      if (!audit) {
        return res.status(404).json({ error: 'No audit found for this website' });
      }

      return res.json({
        success: true,
        data: audit,
      });
    } catch (error: any) {
      console.error('Error fetching latest audit:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch latest audit',
      });
    }
  });

  // Get audit trend for a website
  router.get('/websites/:id/trend', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const limit = parseInt(req.query.limit as string) || 10;

      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid website ID' });
      }

      const trend = comparisonService.getAuditTrend(id, limit);

      return res.json({
        success: true,
        data: trend,
      });
    } catch (error: any) {
      console.error('Error fetching trend:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch trend',
      });
    }
  });

  // Delete a website (and all associated audits via CASCADE)
  router.delete('/websites/:id', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid website ID' });
      }

      const deleted = auditService.deleteWebsite(id);

      if (!deleted) {
        return res.status(404).json({ error: 'Website not found' });
      }

      return res.json({
        success: true,
        message: 'Website and all associated audits deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting website:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to delete website',
      });
    }
  });

  return router;
}
