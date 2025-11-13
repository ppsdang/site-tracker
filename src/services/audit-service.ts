import { WebCrawler } from '../crawler/crawler';
import { SEOAnalyzer } from '../analyzer/seo-analyzer';
import { PerformanceAnalyzer } from '../analyzer/performance-analyzer';
import { AccessibilityAnalyzer } from '../analyzer/accessibility-analyzer';
import { SecurityAnalyzer } from '../analyzer/security-analyzer';
import { BestPracticesAnalyzer } from '../analyzer/best-practices-analyzer';
import { DatabaseManager } from '../database/db';
import { Audit, CrawlOptions, Issue, AuditMetrics } from '../types';
import { URL } from 'url';

export class AuditService {
  private crawler: WebCrawler;
  private seoAnalyzer: SEOAnalyzer;
  private performanceAnalyzer: PerformanceAnalyzer;
  private accessibilityAnalyzer: AccessibilityAnalyzer;
  private securityAnalyzer: SecurityAnalyzer;
  private bestPracticesAnalyzer: BestPracticesAnalyzer;
  private db: DatabaseManager;

  constructor(db: DatabaseManager, crawlOptions: CrawlOptions) {
    this.db = db;
    this.crawler = new WebCrawler(crawlOptions);
    this.seoAnalyzer = new SEOAnalyzer();
    this.performanceAnalyzer = new PerformanceAnalyzer();
    this.accessibilityAnalyzer = new AccessibilityAnalyzer();
    this.securityAnalyzer = new SecurityAnalyzer();
    this.bestPracticesAnalyzer = new BestPracticesAnalyzer();
  }

  async auditWebsite(url: string): Promise<Audit> {
    try {
      // Validate and normalize URL
      const parsedUrl = new URL(url);
      const normalizedUrl = `${parsedUrl.protocol}//${parsedUrl.hostname}${parsedUrl.pathname}`;
      const domain = `${parsedUrl.protocol}//${parsedUrl.hostname}`;

      console.log(`Starting audit for: ${normalizedUrl}`);

      // Check if website exists in database
      let website = this.db.getWebsiteByUrl(domain);
      if (!website) {
        const websiteId = this.db.createWebsite(domain, parsedUrl.hostname);
        website = this.db.getWebsiteById(websiteId);
      }

      if (!website) {
        throw new Error('Failed to create website record');
      }

      // Crawl the page
      console.log('Crawling page...');
      const crawledPage = await this.crawler.crawlSite(normalizedUrl);

      // Run all analyzers
      console.log('Analyzing SEO...');
      const seoResult = this.seoAnalyzer.analyze(crawledPage);

      console.log('Analyzing performance...');
      const performanceResult = this.performanceAnalyzer.analyze(crawledPage);

      console.log('Analyzing accessibility...');
      const accessibilityResult = this.accessibilityAnalyzer.analyze(crawledPage);

      console.log('Analyzing security...');
      const securityResult = this.securityAnalyzer.analyze(crawledPage);

      console.log('Analyzing best practices...');
      const bestPracticesResult = this.bestPracticesAnalyzer.analyze(crawledPage);

      // Check robots.txt and sitemap
      console.log('Checking robots.txt and sitemap...');
      const hasRobotsTxt = await this.crawler.checkRobotsTxt(domain);
      const hasSitemap = await this.crawler.checkSitemap(domain);

      seoResult.metrics.robotsTxt = hasRobotsTxt;
      seoResult.metrics.sitemap = hasSitemap;

      if (!hasRobotsTxt) {
        seoResult.issues.push({
          severity: 'medium',
          category: 'SEO',
          title: 'Missing robots.txt',
          description: 'No robots.txt file found',
          recommendation: 'Add a robots.txt file to guide search engine crawlers',
        });
      }

      if (!hasSitemap) {
        seoResult.issues.push({
          severity: 'medium',
          category: 'SEO',
          title: 'Missing Sitemap',
          description: 'No XML sitemap found',
          recommendation: 'Create and submit an XML sitemap to help search engines discover your content',
        });
      }

      // Check for broken links (sample first 10 internal links)
      console.log('Checking for broken links...');
      const linksToCheck = crawledPage.links.internal.slice(0, 10);
      const brokenLinks = await this.crawler.checkBrokenLinks(linksToCheck);
      seoResult.metrics.brokenLinks = brokenLinks.length;

      if (brokenLinks.length > 0) {
        seoResult.issues.push({
          severity: 'medium',
          category: 'SEO',
          title: 'Broken Links Detected',
          description: `Found ${brokenLinks.length} broken link(s)`,
          recommendation: 'Fix or remove broken links to improve user experience and SEO',
        });
      }

      // Combine all issues
      const allIssues: Issue[] = [
        ...seoResult.issues,
        ...performanceResult.issues,
        ...accessibilityResult.issues,
        ...securityResult.issues,
        ...bestPracticesResult.issues,
      ];

      // Calculate overall health score (weighted average)
      const weights = {
        seo: 0.25,
        performance: 0.25,
        accessibility: 0.20,
        security: 0.20,
        bestPractices: 0.10,
      };

      const healthScore = Math.round(
        seoResult.metrics.score * weights.seo +
        performanceResult.metrics.score * weights.performance +
        accessibilityResult.metrics.score * weights.accessibility +
        securityResult.metrics.score * weights.security +
        bestPracticesResult.metrics.score * weights.bestPractices
      );

      const metrics: AuditMetrics = {
        seo: seoResult.metrics,
        performance: performanceResult.metrics,
        accessibility: accessibilityResult.metrics,
        security: securityResult.metrics,
        bestPractices: bestPracticesResult.metrics,
      };

      // Create audit record
      const audit: Audit = {
        websiteId: website.id!,
        url: normalizedUrl,
        healthScore,
        auditDate: new Date().toISOString(),
        status: 'completed',
        metrics,
        issues: allIssues,
      };

      console.log('Saving audit to database...');
      const auditId = this.db.createAudit(audit);
      audit.id = auditId;

      // Save issues
      allIssues.forEach(issue => {
        this.db.createIssue(auditId, issue);
      });

      // Update website's last audited date
      this.db.updateWebsiteLastAudited(website.id!);

      console.log(`Audit completed with health score: ${healthScore}`);

      return audit;
    } catch (error: any) {
      console.error('Audit failed:', error);
      throw new Error(`Audit failed: ${error.message}`);
    }
  }

  getAuditById(id: number): Audit | undefined {
    return this.db.getAuditById(id);
  }

  getLatestAuditForWebsite(websiteId: number): Audit | undefined {
    return this.db.getLatestAuditForWebsite(websiteId);
  }

  getAuditsForWebsite(websiteId: number, limit: number = 10): Audit[] {
    return this.db.getAuditsForWebsite(websiteId, limit);
  }

  getAllWebsites() {
    return this.db.getAllWebsites();
  }

  getWebsiteByUrl(url: string) {
    return this.db.getWebsiteByUrl(url);
  }
}
