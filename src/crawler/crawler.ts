import axios, { AxiosResponse } from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';
import { CrawlOptions } from '../types';

export interface CrawledPage {
  url: string;
  html: string;
  statusCode: number;
  headers: Record<string, string>;
  loadTime: number;
  pageSize: number;
  links: {
    internal: string[];
    external: string[];
  };
}

export class WebCrawler {
  private options: CrawlOptions;
  private visitedUrls: Set<string>;
  private baseUrl: URL;

  constructor(options: CrawlOptions) {
    this.options = options;
    this.visitedUrls = new Set();
    this.baseUrl = new URL('http://example.com'); // Will be set when crawling starts
  }

  async crawlSite(url: string): Promise<CrawledPage> {
    try {
      this.baseUrl = new URL(url);
      return await this.fetchPage(url);
    } catch (error) {
      throw new Error(`Failed to crawl ${url}: ${error}`);
    }
  }

  private async fetchPage(url: string): Promise<CrawledPage> {
    const startTime = Date.now();

    try {
      const response: AxiosResponse = await axios.get(url, {
        timeout: this.options.timeout,
        headers: {
          'User-Agent': this.options.userAgent,
        },
        maxRedirects: 5,
        validateStatus: (status) => status < 500, // Accept any status < 500
      });

      const loadTime = Date.now() - startTime;
      const html = response.data;
      const pageSize = Buffer.byteLength(html, 'utf8');

      const $ = cheerio.load(html);
      const links = this.extractLinks($, url);

      return {
        url,
        html,
        statusCode: response.status,
        headers: this.normalizeHeaders(response.headers),
        loadTime,
        pageSize,
        links,
      };
    } catch (error: any) {
      throw new Error(`Failed to fetch ${url}: ${error.message}`);
    }
  }

  private extractLinks($: cheerio.CheerioAPI, baseUrl: string): { internal: string[]; external: string[] } {
    const internal: string[] = [];
    const external: string[] = [];

    $('a[href]').each((_, element) => {
      const href = $(element).attr('href');
      if (!href) return;

      try {
        const absoluteUrl = new URL(href, baseUrl);

        // Remove fragment
        absoluteUrl.hash = '';
        const cleanUrl = absoluteUrl.toString();

        if (absoluteUrl.hostname === this.baseUrl.hostname) {
          if (!internal.includes(cleanUrl)) {
            internal.push(cleanUrl);
          }
        } else {
          if (!external.includes(cleanUrl)) {
            external.push(cleanUrl);
          }
        }
      } catch (error) {
        // Invalid URL, skip
      }
    });

    return { internal, external };
  }

  private normalizeHeaders(headers: any): Record<string, string> {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (typeof value === 'string') {
        normalized[key.toLowerCase()] = value;
      } else if (Array.isArray(value)) {
        normalized[key.toLowerCase()] = value.join(', ');
      }
    }
    return normalized;
  }

  async checkRobotsTxt(domain: string): Promise<boolean> {
    try {
      const robotsUrl = `${domain}/robots.txt`;
      const response = await axios.get(robotsUrl, {
        timeout: 5000,
        validateStatus: (status) => status === 200,
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async checkSitemap(domain: string): Promise<boolean> {
    const sitemapUrls = [
      `${domain}/sitemap.xml`,
      `${domain}/sitemap_index.xml`,
      `${domain}/sitemap1.xml`,
    ];

    for (const url of sitemapUrls) {
      try {
        const response = await axios.get(url, {
          timeout: 5000,
          validateStatus: (status) => status === 200,
        });
        if (response.status === 200) {
          return true;
        }
      } catch (error) {
        // Continue to next URL
      }
    }
    return false;
  }

  async checkBrokenLinks(links: string[], timeout: number = 5000): Promise<string[]> {
    const brokenLinks: string[] = [];
    const maxConcurrent = 5;

    for (let i = 0; i < links.length; i += maxConcurrent) {
      const batch = links.slice(i, i + maxConcurrent);
      const results = await Promise.allSettled(
        batch.map(link => this.checkLink(link, timeout))
      );

      results.forEach((result, index) => {
        if (result.status === 'rejected' || result.value === false) {
          brokenLinks.push(batch[index]);
        }
      });
    }

    return brokenLinks;
  }

  private async checkLink(url: string, timeout: number): Promise<boolean> {
    try {
      const response = await axios.head(url, {
        timeout,
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 400,
      });
      return response.status >= 200 && response.status < 400;
    } catch (error) {
      // If HEAD fails, try GET
      try {
        const response = await axios.get(url, {
          timeout,
          maxRedirects: 5,
          validateStatus: (status) => status >= 200 && status < 400,
        });
        return response.status >= 200 && response.status < 400;
      } catch (error) {
        return false;
      }
    }
  }
}
