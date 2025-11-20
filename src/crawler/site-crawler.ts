import { WebCrawler, CrawledPage } from './crawler';
import { SitemapParser, SitemapUrl } from './sitemap-parser';
import { RobotsParser } from './robots-parser';
import { CrawlOptions } from '../types';
import crypto from 'crypto';
import { URL } from 'url';
import { ProgressTracker } from '../services/progress-tracker';

export interface PageData extends CrawledPage {
  metaRobots: {
    noindex: boolean;
    nofollow: boolean;
  };
  canonical?: string;
  contentHash: string;
  incomingLinks: string[];
  outgoingLinks: string[];
  inSitemap: boolean;
}

export interface CrawlResult {
  pages: Map<string, PageData>;
  issues: CrawlIssue[];
  sitemapUrls: string[];
  crawledCount: number;
  skippedCount: number;
}

export interface CrawlIssue {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  url: string;
  message: string;
  details?: any;
}

export class SiteCrawler {
  private crawler: WebCrawler;
  private sitemapParser: SitemapParser;
  private robotsParser: RobotsParser;
  private options: CrawlOptions;
  private baseUrl: URL;
  private visitedUrls: Set<string>;
  private urlQueue: string[];
  private pages: Map<string, PageData>;
  private sitemapUrls: Set<string>;
  private auditId?: number;
  private progressTracker?: ProgressTracker;

  constructor(options: CrawlOptions, auditId?: number) {
    this.options = options;
    this.crawler = new WebCrawler(options);
    this.sitemapParser = new SitemapParser();
    this.robotsParser = new RobotsParser();
    this.visitedUrls = new Set();
    this.urlQueue = [];
    this.pages = new Map();
    this.sitemapUrls = new Set();
    this.baseUrl = new URL('http://example.com');
    this.auditId = auditId;
    if (auditId) {
      this.progressTracker = ProgressTracker.getTracker(auditId);
    }
  }

  async crawlSite(url: string): Promise<CrawlResult> {
    this.baseUrl = new URL(url);
    const domain = `${this.baseUrl.protocol}//${this.baseUrl.hostname}`;

    console.log(`Starting full site crawl for: ${domain}`);

    // Step 1: Parse robots.txt
    console.log('Parsing robots.txt...');
    await this.robotsParser.parse(domain);

    // Step 2: Discover and parse sitemaps
    console.log('Discovering sitemaps...');
    const sitemapUrls = await this.sitemapParser.discoverSitemaps(domain);

    // Add sitemaps from robots.txt
    const robotsSitemaps = this.robotsParser.getSitemaps();
    sitemapUrls.push(...robotsSitemaps);

    console.log(`Found ${sitemapUrls.length} sitemap(s)`);

    // Parse all sitemaps
    const sitemapPages: SitemapUrl[] = [];
    for (const sitemapUrl of sitemapUrls) {
      const pages = await this.sitemapParser.fetchSitemap(sitemapUrl);
      sitemapPages.push(...pages);
    }

    console.log(`Found ${sitemapPages.length} URLs in sitemap(s)`);

    // Emit sitemap progress
    if (this.progressTracker) {
      this.progressTracker.emitProgress({
        type: 'sitemap',
        message: `Discovered ${sitemapPages.length} URLs from sitemap(s)`,
        totalUrls: sitemapPages.length,
      });
    }

    // Store sitemap URLs
    sitemapPages.forEach(page => this.sitemapUrls.add(this.normalizeUrl(page.loc)));

    // Step 3: Add sitemap URLs to queue
    for (const page of sitemapPages) {
      const normalizedUrl = this.normalizeUrl(page.loc);
      if (this.isSameDomain(normalizedUrl) && !this.visitedUrls.has(normalizedUrl)) {
        this.urlQueue.push(normalizedUrl);
      }
    }

    // Also add the starting URL if not in sitemap
    const startUrl = this.normalizeUrl(url);
    if (!this.visitedUrls.has(startUrl)) {
      this.urlQueue.unshift(startUrl);
    }

    // Step 4: Crawl pages
    let crawledCount = 0;
    let skippedCount = 0;

    while (this.urlQueue.length > 0 && crawledCount < this.options.maxPages) {
      // Check for cancellation
      if (this.auditId && ProgressTracker.isCancelled(this.auditId)) {
        console.log(`Audit ${this.auditId} cancelled by user - stopping crawl`);
        break;
      }

      const currentUrl = this.urlQueue.shift()!;

      if (this.visitedUrls.has(currentUrl)) {
        continue;
      }

      // Check robots.txt
      if (!this.robotsParser.isAllowed(currentUrl)) {
        console.log(`Skipped (robots.txt): ${currentUrl}`);
        skippedCount++;
        this.visitedUrls.add(currentUrl);
        continue;
      }

      try {
        console.log(`Crawling [${crawledCount + 1}/${this.options.maxPages}]: ${currentUrl}`);
        const pageData = await this.crawlPage(currentUrl);
        this.pages.set(currentUrl, pageData);
        this.visitedUrls.add(currentUrl);
        crawledCount++;

        // Emit crawling progress
        if (this.progressTracker) {
          const percentage = Math.round((crawledCount / this.options.maxPages) * 100);
          this.progressTracker.emitProgress({
            type: 'crawling',
            message: `Crawling pages`,
            crawledCount,
            totalUrls: Math.max(this.urlQueue.length + crawledCount, sitemapPages.length),
            queuedCount: this.urlQueue.length,
            currentUrl,
            percentage,
          });
        }

        // Discover new URLs from internal links (if not nofollow)
        if (!pageData.metaRobots.nofollow) {
          for (const link of pageData.links.internal) {
            const normalizedLink = this.normalizeUrl(link);
            if (!this.visitedUrls.has(normalizedLink) && !this.urlQueue.includes(normalizedLink)) {
              this.urlQueue.push(normalizedLink);
            }
          }
        }

        // Small delay to be respectful
        await this.delay(100);
      } catch (error) {
        console.error(`Error crawling ${currentUrl}:`, error);
        skippedCount++;
        this.visitedUrls.add(currentUrl);
      }
    }

    console.log(`Crawl complete. Crawled: ${crawledCount}, Skipped: ${skippedCount}`);

    // Emit analyzing progress
    if (this.progressTracker) {
      this.progressTracker.emitProgress({
        type: 'analyzing',
        message: `Analyzing crawled pages and detecting issues`,
        crawledCount,
      });
    }

    // Step 5: Build link graph and detect issues
    this.buildLinkGraph();
    const issues = this.detectIssues();

    // Emit completion progress
    if (this.progressTracker) {
      this.progressTracker.emitProgress({
        type: 'completed',
        message: `Crawl completed`,
        crawledCount,
        issuesCount: issues.length,
      });
    }

    // Cleanup tracker
    if (this.auditId) {
      ProgressTracker.removeTracker(this.auditId);
    }

    return {
      pages: this.pages,
      issues,
      sitemapUrls: Array.from(this.sitemapUrls),
      crawledCount,
      skippedCount,
    };
  }

  private async crawlPage(url: string): Promise<PageData> {
    const crawledPage = await this.crawler.crawlSite(url);

    // Parse meta robots
    const metaRobots = this.parseMetaRobots(crawledPage.html);

    // Extract canonical URL
    const canonical = this.extractCanonical(crawledPage.html);

    // Calculate content hash for duplicate detection
    const contentHash = this.calculateContentHash(crawledPage.html);

    const inSitemap = this.sitemapUrls.has(this.normalizeUrl(url));

    return {
      ...crawledPage,
      metaRobots,
      canonical,
      contentHash,
      incomingLinks: [],
      outgoingLinks: crawledPage.links.internal,
      inSitemap,
    };
  }

  private parseMetaRobots(html: string): { noindex: boolean; nofollow: boolean } {
    const cheerio = require('cheerio');
    const $ = cheerio.load(html);

    const robotsMeta = $('meta[name="robots"]').attr('content') || '';
    const noindex = robotsMeta.toLowerCase().includes('noindex');
    const nofollow = robotsMeta.toLowerCase().includes('nofollow');

    return { noindex, nofollow };
  }

  private extractCanonical(html: string): string | undefined {
    const cheerio = require('cheerio');
    const $ = cheerio.load(html);

    const canonical = $('link[rel="canonical"]').attr('href');
    return canonical ? this.normalizeUrl(canonical) : undefined;
  }

  private calculateContentHash(html: string): string {
    const cheerio = require('cheerio');
    const $ = cheerio.load(html);

    // Remove scripts, styles, and extract only text content
    $('script, style, noscript, nav, header, footer').remove();
    const textContent = $('body').text().replace(/\s+/g, ' ').trim();

    // Calculate MD5 hash
    return crypto.createHash('md5').update(textContent).digest('hex');
  }

  private buildLinkGraph(): void {
    // Build incoming links for each page
    for (const [sourceUrl, pageData] of this.pages) {
      for (const targetUrl of pageData.outgoingLinks) {
        const normalizedTarget = this.normalizeUrl(targetUrl);
        const targetPage = this.pages.get(normalizedTarget);

        if (targetPage && !targetPage.incomingLinks.includes(sourceUrl)) {
          targetPage.incomingLinks.push(sourceUrl);
        }
      }
    }
  }

  private detectIssues(): CrawlIssue[] {
    const issues: CrawlIssue[] = [];

    for (const [url, pageData] of this.pages) {
      // 1. Orphan pages (no incoming internal links)
      if (pageData.incomingLinks.length === 0 && url !== this.normalizeUrl(this.baseUrl.toString())) {
        issues.push({
          type: 'orphan_page',
          severity: 'high',
          url,
          message: 'Orphan page with no incoming internal links',
          details: { incomingLinks: 0 },
        });
      }

      // 2. Pages with no outgoing links
      if (pageData.outgoingLinks.length === 0) {
        issues.push({
          type: 'no_outgoing_links',
          severity: 'medium',
          url,
          message: 'Page has no outgoing internal links',
        });
      }

      // 3. Noindex pages in sitemap
      if (pageData.inSitemap && pageData.metaRobots.noindex) {
        issues.push({
          type: 'noindex_in_sitemap',
          severity: 'critical',
          url,
          message: 'Page with noindex meta tag found in sitemap',
        });
      }

      // 4. Non-canonical page in sitemap
      if (pageData.inSitemap && pageData.canonical && pageData.canonical !== url) {
        issues.push({
          type: 'non_canonical_in_sitemap',
          severity: 'high',
          url,
          message: 'Non-canonical page found in sitemap',
          details: { canonicalUrl: pageData.canonical },
        });
      }

      // 5. Canonical URL has no incoming links
      if (pageData.canonical && pageData.canonical === url) {
        const canonicalPage = this.pages.get(url);
        if (canonicalPage && canonicalPage.incomingLinks.length === 0) {
          issues.push({
            type: 'canonical_no_incoming_links',
            severity: 'medium',
            url,
            message: 'Canonical URL has no incoming internal links',
          });
        }
      }

      // 6. Pages not in sitemap but crawled (discovered through links)
      if (!pageData.inSitemap && !pageData.metaRobots.noindex) {
        issues.push({
          type: 'missing_from_sitemap',
          severity: 'medium',
          url,
          message: 'Page not found in sitemap but discovered through internal links',
        });
      }
    }

    // 7. Duplicate content detection
    const contentHashMap = new Map<string, string[]>();
    for (const [url, pageData] of this.pages) {
      if (!contentHashMap.has(pageData.contentHash)) {
        contentHashMap.set(pageData.contentHash, []);
      }
      contentHashMap.get(pageData.contentHash)!.push(url);
    }

    for (const [_hash, urls] of contentHashMap) {
      if (urls.length > 1) {
        // Check if any of these pages have canonical tags pointing to each other
        const hasCanonical = urls.some(url => {
          const page = this.pages.get(url);
          return page && page.canonical && urls.includes(page.canonical);
        });

        if (!hasCanonical) {
          for (const url of urls) {
            issues.push({
              type: 'duplicate_content',
              severity: 'high',
              url,
              message: 'Duplicate content detected without proper canonical tag',
              details: { duplicateUrls: urls.filter(u => u !== url) },
            });
          }
        }
      }
    }

    return issues;
  }

  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url, this.baseUrl);
      // Remove fragment, trailing slash, and normalize
      urlObj.hash = '';
      let normalized = urlObj.toString();
      if (normalized.endsWith('/') && urlObj.pathname !== '/') {
        normalized = normalized.slice(0, -1);
      }
      return normalized;
    } catch (error) {
      return url;
    }
  }

  private isSameDomain(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname === this.baseUrl.hostname;
    } catch (error) {
      return false;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
