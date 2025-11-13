import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { Website, Audit, Issue } from '../types';

export class DatabaseManager {
  private db: Database.Database;

  constructor(dbPath: string) {
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initializeSchema();
  }

  private initializeSchema(): void {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    this.db.exec(schema);
  }

  // Website operations
  createWebsite(url: string, domain: string): number {
    const stmt = this.db.prepare(`
      INSERT INTO websites (url, domain, created_at)
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(url, domain, new Date().toISOString());
    return result.lastInsertRowid as number;
  }

  getWebsiteByUrl(url: string): Website | undefined {
    const stmt = this.db.prepare('SELECT * FROM websites WHERE url = ?');
    return stmt.get(url) as Website | undefined;
  }

  getWebsiteById(id: number): Website | undefined {
    const stmt = this.db.prepare('SELECT * FROM websites WHERE id = ?');
    return stmt.get(id) as Website | undefined;
  }

  updateWebsiteLastAudited(id: number): void {
    const stmt = this.db.prepare(`
      UPDATE websites SET last_audited_at = ? WHERE id = ?
    `);
    stmt.run(new Date().toISOString(), id);
  }

  getAllWebsites(): Website[] {
    const stmt = this.db.prepare('SELECT * FROM websites ORDER BY last_audited_at DESC');
    return stmt.all() as Website[];
  }

  // Audit operations
  createAudit(audit: Audit): number {
    const stmt = this.db.prepare(`
      INSERT INTO audits (
        website_id, url, health_score, audit_date, status,
        seo_score, title_tag, meta_description, h1_count, h2_count, h3_count,
        images_with_alt, total_images, internal_links, external_links, broken_links,
        canonical_tag, robots_txt, sitemap, structured_data,
        performance_score, load_time, page_size, request_count, ttfb, fcp, lcp, cls, tbt,
        accessibility_score, missing_alt_tags, color_contrast, aria_labels, form_labels,
        button_labels, html_lang, skip_links,
        security_score, https, mixed_content, hsts, csp, x_frame_options,
        x_content_type, referrer_policy,
        best_practices_score, doctype, charset, viewport, console_errors, deprecated_apis
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?, ?, ?
      )
    `);

    const result = stmt.run(
      audit.websiteId,
      audit.url,
      audit.healthScore,
      audit.auditDate,
      audit.status,
      // SEO
      audit.metrics.seo.score,
      audit.metrics.seo.titleTag ? 1 : 0,
      audit.metrics.seo.metaDescription ? 1 : 0,
      audit.metrics.seo.headings.h1Count,
      audit.metrics.seo.headings.h2Count,
      audit.metrics.seo.headings.h3Count,
      audit.metrics.seo.imageAltTags,
      audit.metrics.seo.totalImages,
      audit.metrics.seo.internalLinks,
      audit.metrics.seo.externalLinks,
      audit.metrics.seo.brokenLinks,
      audit.metrics.seo.canonicalTag ? 1 : 0,
      audit.metrics.seo.robotsTxt ? 1 : 0,
      audit.metrics.seo.sitemap ? 1 : 0,
      audit.metrics.seo.structuredData ? 1 : 0,
      // Performance
      audit.metrics.performance.score,
      audit.metrics.performance.loadTime,
      audit.metrics.performance.pageSize,
      audit.metrics.performance.requestCount,
      audit.metrics.performance.timeToFirstByte,
      audit.metrics.performance.firstContentfulPaint,
      audit.metrics.performance.largestContentfulPaint,
      audit.metrics.performance.cumulativeLayoutShift,
      audit.metrics.performance.totalBlockingTime,
      // Accessibility
      audit.metrics.accessibility.score,
      audit.metrics.accessibility.missingAltTags,
      audit.metrics.accessibility.colorContrast ? 1 : 0,
      audit.metrics.accessibility.ariaLabels ? 1 : 0,
      audit.metrics.accessibility.formLabels ? 1 : 0,
      audit.metrics.accessibility.buttonLabels ? 1 : 0,
      audit.metrics.accessibility.htmlLang ? 1 : 0,
      audit.metrics.accessibility.skipLinks ? 1 : 0,
      // Security
      audit.metrics.security.score,
      audit.metrics.security.https ? 1 : 0,
      audit.metrics.security.mixedContent ? 1 : 0,
      audit.metrics.security.securityHeaders.strictTransportSecurity ? 1 : 0,
      audit.metrics.security.securityHeaders.contentSecurityPolicy ? 1 : 0,
      audit.metrics.security.securityHeaders.xFrameOptions ? 1 : 0,
      audit.metrics.security.securityHeaders.xContentTypeOptions ? 1 : 0,
      audit.metrics.security.securityHeaders.referrerPolicy ? 1 : 0,
      // Best Practices
      audit.metrics.bestPractices.score,
      audit.metrics.bestPractices.doctype ? 1 : 0,
      audit.metrics.bestPractices.charset ? 1 : 0,
      audit.metrics.bestPractices.viewport ? 1 : 0,
      audit.metrics.bestPractices.console_errors,
      audit.metrics.bestPractices.deprecated_apis
    );

    return result.lastInsertRowid as number;
  }

  getAuditById(id: number): Audit | undefined {
    const stmt = this.db.prepare('SELECT * FROM audits WHERE id = ?');
    const row = stmt.get(id) as any;
    if (!row) return undefined;
    return this.mapRowToAudit(row);
  }

  getLatestAuditForWebsite(websiteId: number): Audit | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM audits
      WHERE website_id = ? AND status = 'completed'
      ORDER BY audit_date DESC
      LIMIT 1
    `);
    const row = stmt.get(websiteId) as any;
    if (!row) return undefined;
    return this.mapRowToAudit(row);
  }

  getAuditsForWebsite(websiteId: number, limit: number = 10): Audit[] {
    const stmt = this.db.prepare(`
      SELECT * FROM audits
      WHERE website_id = ?
      ORDER BY audit_date DESC
      LIMIT ?
    `);
    const rows = stmt.all(websiteId, limit) as any[];
    return rows.map(row => this.mapRowToAudit(row));
  }

  getPreviousAuditForWebsite(websiteId: number, currentAuditDate: string): Audit | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM audits
      WHERE website_id = ? AND audit_date < ? AND status = 'completed'
      ORDER BY audit_date DESC
      LIMIT 1
    `);
    const row = stmt.get(websiteId, currentAuditDate) as any;
    if (!row) return undefined;
    return this.mapRowToAudit(row);
  }

  private mapRowToAudit(row: any): Audit {
    return {
      id: row.id,
      websiteId: row.website_id,
      url: row.url,
      healthScore: row.health_score,
      auditDate: row.audit_date,
      status: row.status,
      metrics: {
        seo: {
          score: row.seo_score,
          titleTag: row.title_tag === 1,
          metaDescription: row.meta_description === 1,
          headings: {
            h1Count: row.h1_count,
            h2Count: row.h2_count,
            h3Count: row.h3_count,
            h4Count: 0,
            h5Count: 0,
            h6Count: 0,
          },
          imageAltTags: row.images_with_alt,
          totalImages: row.total_images,
          internalLinks: row.internal_links,
          externalLinks: row.external_links,
          brokenLinks: row.broken_links,
          canonicalTag: row.canonical_tag === 1,
          robotsTxt: row.robots_txt === 1,
          sitemap: row.sitemap === 1,
          structuredData: row.structured_data === 1,
        },
        performance: {
          score: row.performance_score,
          loadTime: row.load_time,
          pageSize: row.page_size,
          requestCount: row.request_count,
          timeToFirstByte: row.ttfb,
          firstContentfulPaint: row.fcp,
          largestContentfulPaint: row.lcp,
          cumulativeLayoutShift: row.cls,
          totalBlockingTime: row.tbt,
        },
        accessibility: {
          score: row.accessibility_score,
          missingAltTags: row.missing_alt_tags,
          colorContrast: row.color_contrast === 1,
          ariaLabels: row.aria_labels === 1,
          formLabels: row.form_labels === 1,
          buttonLabels: row.button_labels === 1,
          htmlLang: row.html_lang === 1,
          skipLinks: row.skip_links === 1,
        },
        security: {
          score: row.security_score,
          https: row.https === 1,
          mixedContent: row.mixed_content === 1,
          securityHeaders: {
            strictTransportSecurity: row.hsts === 1,
            contentSecurityPolicy: row.csp === 1,
            xFrameOptions: row.x_frame_options === 1,
            xContentTypeOptions: row.x_content_type === 1,
            referrerPolicy: row.referrer_policy === 1,
          },
          vulnerabilities: [],
        },
        bestPractices: {
          score: row.best_practices_score,
          doctype: row.doctype === 1,
          charset: row.charset === 1,
          viewport: row.viewport === 1,
          console_errors: row.console_errors,
          deprecated_apis: row.deprecated_apis,
        },
      },
      issues: this.getIssuesForAudit(row.id),
    };
  }

  // Issue operations
  createIssue(auditId: number, issue: Issue): number {
    const stmt = this.db.prepare(`
      INSERT INTO issues (audit_id, severity, category, title, description, element, recommendation)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      auditId,
      issue.severity,
      issue.category,
      issue.title,
      issue.description,
      issue.element || null,
      issue.recommendation
    );
    return result.lastInsertRowid as number;
  }

  getIssuesForAudit(auditId: number): Issue[] {
    const stmt = this.db.prepare('SELECT * FROM issues WHERE audit_id = ? ORDER BY severity');
    return stmt.all(auditId) as Issue[];
  }

  close(): void {
    this.db.close();
  }
}
