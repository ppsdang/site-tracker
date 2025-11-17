import { SiteCrawler } from '../crawler/site-crawler';
import { SEOAnalyzer } from '../analyzer/seo-analyzer';
import { PerformanceAnalyzer } from '../analyzer/performance-analyzer';
import { AccessibilityAnalyzer } from '../analyzer/accessibility-analyzer';
import { SecurityAnalyzer } from '../analyzer/security-analyzer';
import { BestPracticesAnalyzer } from '../analyzer/best-practices-analyzer';
import { DatabaseManager } from '../database/db';
import { Audit, CrawlOptions, Issue, AuditMetrics } from '../types';
import { URL } from 'url';
import * as cheerio from 'cheerio';

export class AuditService {
  private siteCrawler: SiteCrawler;
  private seoAnalyzer: SEOAnalyzer;
  private performanceAnalyzer: PerformanceAnalyzer;
  private accessibilityAnalyzer: AccessibilityAnalyzer;
  private securityAnalyzer: SecurityAnalyzer;
  private bestPracticesAnalyzer: BestPracticesAnalyzer;
  private db: DatabaseManager;

  constructor(db: DatabaseManager, crawlOptions: CrawlOptions) {
    this.db = db;
    this.siteCrawler = new SiteCrawler(crawlOptions);
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
      const domain = `${parsedUrl.protocol}//${parsedUrl.hostname}`;

      console.log(`Starting full site audit for: ${domain}`);

      // Check if website exists in database
      let website = this.db.getWebsiteByUrl(domain);
      if (!website) {
        const websiteId = this.db.createWebsite(domain, parsedUrl.hostname);
        website = this.db.getWebsiteById(websiteId);
      }

      if (!website) {
        throw new Error('Failed to create website record');
      }

      // Perform full site crawl
      console.log('Starting full site crawl...');
      const crawlResult = await this.siteCrawler.crawlSite(url);

      console.log(`Crawled ${crawlResult.crawledCount} pages, found ${crawlResult.issues.length} site-wide issues`);

      // Analyze all crawled pages
      const allIssues: Issue[] = [...crawlResult.issues.map(ci => ({
        severity: ci.severity,
        category: 'Site Structure',
        title: ci.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        description: ci.message,
        element: ci.url,
        recommendation: this.getRecommendation(ci.type),
      }))];

      let totalSeoScore = 0;
      let totalPerformanceScore = 0;
      let totalAccessibilityScore = 0;
      let totalSecurityScore = 0;
      let totalBestPracticesScore = 0;
      let analyzedCount = 0;

      // Create initial audit record
      const initialAudit: Audit = {
        websiteId: website.id!,
        url: domain,
        healthScore: 0,
        auditDate: new Date().toISOString(),
        status: 'in_progress',
        metrics: this.getEmptyMetrics(),
        issues: [],
      };

      const auditId = this.db.createAudit(initialAudit);

      // Analyze each page
      for (const [pageUrl, pageData] of crawlResult.pages) {
        try {
          console.log(`Analyzing: ${pageUrl}`);

          // Run analyzers on this page
          const seoResult = this.seoAnalyzer.analyze(pageData);
          const performanceResult = this.performanceAnalyzer.analyze(pageData);
          const accessibilityResult = this.accessibilityAnalyzer.analyze(pageData);
          const securityResult = this.securityAnalyzer.analyze(pageData);
          const bestPracticesResult = this.bestPracticesAnalyzer.analyze(pageData);

          // Add page-specific issues
          allIssues.push(...seoResult.issues, ...performanceResult.issues,
            ...accessibilityResult.issues, ...securityResult.issues,
            ...bestPracticesResult.issues);

          // Accumulate scores
          totalSeoScore += seoResult.metrics.score;
          totalPerformanceScore += performanceResult.metrics.score;
          totalAccessibilityScore += accessibilityResult.metrics.score;
          totalSecurityScore += securityResult.metrics.score;
          totalBestPracticesScore += bestPracticesResult.metrics.score;
          analyzedCount++;

          // Extract page metadata
          const $ = cheerio.load(pageData.html);
          const title = $('title').text() || '';
          const metaDesc = $('meta[name="description"]').attr('content') || '';
          const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
          const wordCount = bodyText.split(' ').length;

          // Store page data
          this.db.createPage(auditId, {
            url: pageUrl,
            statusCode: pageData.statusCode,
            title,
            metaDescription: metaDesc,
            wordCount,
            crawledAt: new Date().toISOString(),
            canonicalUrl: pageData.canonical,
            contentHash: pageData.contentHash,
            noindex: pageData.metaRobots.noindex,
            nofollow: pageData.metaRobots.nofollow,
            inSitemap: pageData.inSitemap,
            incomingLinksCount: pageData.incomingLinks.length,
            outgoingLinksCount: pageData.outgoingLinks.length,
            loadTime: pageData.loadTime,
            pageSize: pageData.pageSize,
          });

          // Store link relationships
          for (const targetUrl of pageData.outgoingLinks) {
            this.db.createLink(auditId, pageUrl, targetUrl);
          }
        } catch (error) {
          console.error(`Error analyzing ${pageUrl}:`, error);
        }
      }

      // Calculate average scores
      const avgSeoScore = analyzedCount > 0 ? totalSeoScore / analyzedCount : 0;
      const avgPerformanceScore = analyzedCount > 0 ? totalPerformanceScore / analyzedCount : 0;
      const avgAccessibilityScore = analyzedCount > 0 ? totalAccessibilityScore / analyzedCount : 0;
      const avgSecurityScore = analyzedCount > 0 ? totalSecurityScore / analyzedCount : 0;
      const avgBestPracticesScore = analyzedCount > 0 ? totalBestPracticesScore / analyzedCount : 0;

      // Calculate overall health score
      const weights = {
        seo: 0.25,
        performance: 0.25,
        accessibility: 0.20,
        security: 0.20,
        bestPractices: 0.10,
      };

      const healthScore = Math.round(
        avgSeoScore * weights.seo +
        avgPerformanceScore * weights.performance +
        avgAccessibilityScore * weights.accessibility +
        avgSecurityScore * weights.security +
        avgBestPracticesScore * weights.bestPractices
      );

      const metrics: AuditMetrics = {
        seo: {
          score: Math.round(avgSeoScore),
          titleTag: true,
          metaDescription: true,
          headings: { h1Count: 0, h2Count: 0, h3Count: 0, h4Count: 0, h5Count: 0, h6Count: 0 },
          imageAltTags: 0,
          totalImages: 0,
          internalLinks: crawlResult.crawledCount,
          externalLinks: 0,
          brokenLinks: 0,
          canonicalTag: true,
          robotsTxt: true,
          sitemap: crawlResult.sitemapUrls.length > 0,
          structuredData: false,
        },
        performance: {
          score: Math.round(avgPerformanceScore),
          loadTime: 0,
          pageSize: 0,
          requestCount: 0,
          timeToFirstByte: 0,
          firstContentfulPaint: 0,
          largestContentfulPaint: 0,
          cumulativeLayoutShift: 0,
          totalBlockingTime: 0,
        },
        accessibility: {
          score: Math.round(avgAccessibilityScore),
          missingAltTags: 0,
          colorContrast: true,
          ariaLabels: true,
          formLabels: true,
          buttonLabels: true,
          htmlLang: true,
          skipLinks: false,
        },
        security: {
          score: Math.round(avgSecurityScore),
          https: domain.startsWith('https'),
          mixedContent: false,
          securityHeaders: {
            strictTransportSecurity: false,
            contentSecurityPolicy: false,
            xFrameOptions: false,
            xContentTypeOptions: false,
            referrerPolicy: false,
          },
          vulnerabilities: [],
        },
        bestPractices: {
          score: Math.round(avgBestPracticesScore),
          doctype: true,
          charset: true,
          viewport: true,
          console_errors: 0,
          deprecated_apis: 0,
        },
      };

      // Create final audit
      const audit: Audit = {
        id: auditId,
        websiteId: website.id!,
        url: domain,
        healthScore,
        auditDate: new Date().toISOString(),
        status: 'completed',
        metrics,
        issues: allIssues,
      };

      // Save all issues
      allIssues.forEach(issue => {
        this.db.createIssue(auditId, issue);
      });

      // Update website's last audited date
      this.db.updateWebsiteLastAudited(website.id!);

      console.log(`Audit completed. Health score: ${healthScore}, Pages: ${crawlResult.crawledCount}, Issues: ${allIssues.length}`);

      return audit;
    } catch (error: any) {
      console.error('Audit failed:', error);
      throw new Error(`Audit failed: ${error.message}`);
    }
  }

  private getEmptyMetrics(): AuditMetrics {
    return {
      seo: {
        score: 0,
        titleTag: false,
        metaDescription: false,
        headings: { h1Count: 0, h2Count: 0, h3Count: 0, h4Count: 0, h5Count: 0, h6Count: 0 },
        imageAltTags: 0,
        totalImages: 0,
        internalLinks: 0,
        externalLinks: 0,
        brokenLinks: 0,
        canonicalTag: false,
        robotsTxt: false,
        sitemap: false,
        structuredData: false,
      },
      performance: {
        score: 0,
        loadTime: 0,
        pageSize: 0,
        requestCount: 0,
        timeToFirstByte: 0,
        firstContentfulPaint: 0,
        largestContentfulPaint: 0,
        cumulativeLayoutShift: 0,
        totalBlockingTime: 0,
      },
      accessibility: {
        score: 0,
        missingAltTags: 0,
        colorContrast: false,
        ariaLabels: false,
        formLabels: false,
        buttonLabels: false,
        htmlLang: false,
        skipLinks: false,
      },
      security: {
        score: 0,
        https: false,
        mixedContent: false,
        securityHeaders: {
          strictTransportSecurity: false,
          contentSecurityPolicy: false,
          xFrameOptions: false,
          xContentTypeOptions: false,
          referrerPolicy: false,
        },
        vulnerabilities: [],
      },
      bestPractices: {
        score: 0,
        doctype: false,
        charset: false,
        viewport: false,
        console_errors: 0,
        deprecated_apis: 0,
      },
    };
  }

  private getRecommendation(issueType: string): string {
    const recommendations: Record<string, string> = {
      'orphan_page': 'Add internal links from other pages to make this page discoverable',
      'no_outgoing_links': 'Add relevant internal links to help users navigate your site',
      'noindex_in_sitemap': 'Remove this page from sitemap or remove the noindex directive',
      'non_canonical_in_sitemap': 'Only include canonical URLs in your sitemap',
      'canonical_no_incoming_links': 'Add internal links pointing to this canonical URL',
      'missing_from_sitemap': 'Add this page to your XML sitemap',
      'duplicate_content': 'Use canonical tags to specify the preferred version of this content',
    };

    return recommendations[issueType] || 'Review and fix this issue';
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

  getPagesForAudit(auditId: number) {
    return this.db.getPagesForAudit(auditId);
  }

  getLinksForAudit(auditId: number) {
    return this.db.getLinksForAudit(auditId);
  }
}
