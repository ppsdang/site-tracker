import axios from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';

export interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
}

export class SitemapParser {
  async fetchSitemap(sitemapUrl: string): Promise<SitemapUrl[]> {
    try {
      const response = await axios.get(sitemapUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'SiteTracker/1.0 (Website Audit Bot)',
        },
      });

      const $ = cheerio.load(response.data, { xmlMode: true });
      const urls: SitemapUrl[] = [];

      // Check if this is a sitemap index
      const sitemapElements = $('sitemap');
      if (sitemapElements.length > 0) {
        // This is a sitemap index - fetch all sitemaps
        const sitemapPromises: Promise<SitemapUrl[]>[] = [];

        sitemapElements.each((_, elem) => {
          const loc = $(elem).find('loc').text();
          if (loc) {
            sitemapPromises.push(this.fetchSitemap(loc));
          }
        });

        const results = await Promise.all(sitemapPromises);
        return results.flat();
      }

      // Parse regular sitemap
      $('url').each((_, elem) => {
        const loc = $(elem).find('loc').text();
        const lastmod = $(elem).find('lastmod').text();
        const changefreq = $(elem).find('changefreq').text();
        const priority = $(elem).find('priority').text();

        if (loc) {
          urls.push({
            loc,
            lastmod: lastmod || undefined,
            changefreq: changefreq || undefined,
            priority: priority || undefined,
          });
        }
      });

      return urls;
    } catch (error) {
      console.error(`Failed to fetch sitemap ${sitemapUrl}:`, error);
      return [];
    }
  }

  async discoverSitemaps(domain: string): Promise<string[]> {
    const sitemapUrls: string[] = [];

    // Try common sitemap locations
    const commonLocations = [
      '/sitemap.xml',
      '/sitemap_index.xml',
      '/sitemap1.xml',
      '/sitemaps/sitemap.xml',
      '/sitemap/sitemap.xml',
    ];

    for (const location of commonLocations) {
      try {
        const url = `${domain}${location}`;
        const response = await axios.head(url, {
          timeout: 5000,
          validateStatus: (status) => status === 200,
        });

        if (response.status === 200) {
          sitemapUrls.push(url);
        }
      } catch (error) {
        // Continue to next location
      }
    }

    // Also check robots.txt for sitemap declarations
    try {
      const robotsUrl = `${domain}/robots.txt`;
      const response = await axios.get(robotsUrl, { timeout: 5000 });
      const lines = response.data.split('\n');

      for (const line of lines) {
        const match = line.match(/^Sitemap:\s*(.+)$/i);
        if (match) {
          const sitemapUrl = match[1].trim();
          if (!sitemapUrls.includes(sitemapUrl)) {
            sitemapUrls.push(sitemapUrl);
          }
        }
      }
    } catch (error) {
      // robots.txt not found or error
    }

    return sitemapUrls;
  }
}
