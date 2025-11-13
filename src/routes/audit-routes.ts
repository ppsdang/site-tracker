import { Router, Request, Response } from 'express';
import { AuditService } from '../services/audit-service';
import { ComparisonService } from '../services/comparison-service';

export function createAuditRoutes(
  auditService: AuditService,
  comparisonService: ComparisonService
): Router {
  const router = Router();

  // Create a new audit
  router.post('/audits', async (req: Request, res: Response) => {
    try {
      const { url } = req.body;

      if (!url) {
        return res.status(400).json({ error: 'URL is required' });
      }

      // Validate URL format
      try {
        new URL(url);
      } catch (error) {
        return res.status(400).json({ error: 'Invalid URL format' });
      }

      const audit = await auditService.auditWebsite(url);
      res.status(201).json({
        success: true,
        data: audit,
      });
    } catch (error: any) {
      console.error('Error creating audit:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create audit',
      });
    }
  });

  // Get audit by ID
  router.get('/audits/:id', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid audit ID' });
      }

      const audit = auditService.getAuditById(id);

      if (!audit) {
        return res.status(404).json({ error: 'Audit not found' });
      }

      res.json({
        success: true,
        data: audit,
      });
    } catch (error: any) {
      console.error('Error fetching audit:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch audit',
      });
    }
  });

  // Get comparison for audit
  router.get('/audits/:id/comparison', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid audit ID' });
      }

      const comparison = comparisonService.compareAudits(id);

      if (!comparison) {
        return res.status(404).json({ error: 'Audit not found' });
      }

      res.json({
        success: true,
        data: comparison,
      });
    } catch (error: any) {
      console.error('Error fetching comparison:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch comparison',
      });
    }
  });

  // Compare with similar websites
  router.get('/audits/:id/compare-similar', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid audit ID' });
      }

      const comparison = comparisonService.compareWithSimilarWebsites(id);

      if (!comparison) {
        return res.status(404).json({ error: 'Audit not found' });
      }

      res.json({
        success: true,
        data: comparison,
      });
    } catch (error: any) {
      console.error('Error comparing with similar websites:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to compare with similar websites',
      });
    }
  });

  return router;
}
