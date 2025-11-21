import { Router, Request, Response } from 'express';
import { AuditService } from '../services/audit-service';
import { ComparisonService } from '../services/comparison-service';
import { ProgressTracker } from '../services/progress-tracker';

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

      // Start the audit in the background (don't await)
      const auditPromise = auditService.auditWebsite(url);

      // Get the initial audit data (status='in_progress') to return immediately
      // Wait briefly to get the auditId
      const audit = await Promise.race([
        auditPromise,
        new Promise<any>((resolve) => {
          // Give it a second to create the audit record and start
          setTimeout(async () => {
            // Check if we have a recently created audit for this URL (any status)
            const website = auditService.getWebsiteByUrl(url);
            console.log(`[DEBUG] Looking for in_progress audit for website ID: ${website?.id}`);
            if (website) {
              const latestAudit = auditService.getLatestAuditForWebsiteAnyStatus(website.id!);
              console.log(`[DEBUG] Found audit:`, latestAudit ? `ID=${latestAudit.id}, status=${latestAudit.status}` : 'null');
              if (latestAudit && latestAudit.status === 'in_progress') {
                console.log(`[DEBUG] Returning audit ID ${latestAudit.id} to frontend`);
                resolve(latestAudit);
              } else {
                console.log(`[DEBUG] No in_progress audit found, waiting for completion...`);
              }
            }
          }, 500);
        })
      ]);

      // Continue the audit in the background
      auditPromise.catch(error => {
        console.error('Background audit error:', error);
      });

      console.log(`[DEBUG] POST /api/audits returning:`, audit ? `ID=${audit.id}, status=${audit.status}` : 'null');

      return res.status(201).json({
        success: true,
        data: audit,
      });
    } catch (error: any) {
      console.error('Error creating audit:', error);
      return res.status(500).json({
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

      return res.json({
        success: true,
        data: audit,
      });
    } catch (error: any) {
      console.error('Error fetching audit:', error);
      return res.status(500).json({
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

      return res.json({
        success: true,
        data: comparison,
      });
    } catch (error: any) {
      console.error('Error fetching comparison:', error);
      return res.status(500).json({
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

      return res.json({
        success: true,
        data: comparison,
      });
    } catch (error: any) {
      console.error('Error comparing with similar websites:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to compare with similar websites',
      });
    }
  });

  // Get all pages for an audit
  router.get('/audits/:id/pages', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid audit ID' });
      }

      const pages = auditService.getPagesForAudit(id);

      return res.json({
        success: true,
        data: pages,
      });
    } catch (error: any) {
      console.error('Error fetching pages:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch pages',
      });
    }
  });

  // Get all links for an audit
  router.get('/audits/:id/links', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid audit ID' });
      }

      const links = auditService.getLinksForAudit(id);

      return res.json({
        success: true,
        data: links,
      });
    } catch (error: any) {
      console.error('Error fetching links:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch links',
      });
    }
  });

  // Cancel an audit
  router.post('/audits/:id/cancel', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid audit ID' });
      }

      // Check if audit exists and is in progress
      const audit = auditService.getAuditById(id);

      if (!audit) {
        return res.status(404).json({ error: 'Audit not found' });
      }

      if (audit.status !== 'in_progress') {
        return res.status(400).json({
          error: `Cannot cancel audit with status '${audit.status}'`
        });
      }

      // Set cancellation flag to stop the crawl
      ProgressTracker.cancelAudit(id);

      // Update audit status in database
      auditService.updateAuditStatus(id, 'cancelled');

      console.log(`Audit ${id} cancelled successfully`);

      return res.json({
        success: true,
        message: 'Audit cancelled successfully',
      });
    } catch (error: any) {
      console.error('Error cancelling audit:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to cancel audit',
      });
    }
  });

  // SSE endpoint for real-time audit progress
  router.get('/audits/:id/progress', (req: Request, res: Response): void => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid audit ID' });
      return;
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering in nginx

    // Send initial connection message
    console.log(`[DEBUG SSE] Client connected to audit ${id} progress stream`);
    res.write('data: {"type":"connected","message":"Connected to progress stream"}\n\n');

    // Get or create progress tracker for this audit
    const tracker = ProgressTracker.getTracker(id);
    console.log(`[DEBUG SSE] ProgressTracker obtained for audit ${id}`);

    // Listen for progress events
    const progressHandler = (event: any) => {
      try {
        console.log(`[DEBUG SSE] Sending event to client:`, event.type, event.crawledCount);
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      } catch (error) {
        console.error('Error writing SSE data:', error);
      }
    };

    tracker.on('progress', progressHandler);
    console.log(`[DEBUG SSE] Listening for progress events on audit ${id}`);

    // Handle client disconnect
    req.on('close', () => {
      console.log(`Client disconnected from audit ${id} progress stream`);
      tracker.removeListener('progress', progressHandler);
      res.end();
    });

    // Keep connection alive with periodic heartbeat
    const heartbeat = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch (error) {
        clearInterval(heartbeat);
      }
    }, 15000); // Send heartbeat every 15 seconds

    // Cleanup on response end
    res.on('finish', () => {
      clearInterval(heartbeat);
    });

    // Keep connection alive - no return needed for SSE endpoints
  });

  return router;
}
