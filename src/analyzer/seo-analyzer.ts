import * as cheerio from 'cheerio';
import { SEOMetrics, Issue } from '../types';
import { CrawledPage } from '../crawler/crawler';

export class SEOAnalyzer {
  analyze(page: CrawledPage): { metrics: SEOMetrics; issues: Issue[] } {
    const $ = cheerio.load(page.html);
    const issues: Issue[] = [];

    // Title tag
    const titleTag = $('title').length > 0;
    const titleText = $('title').text();
    if (!titleTag) {
      issues.push({
        severity: 'critical',
        category: 'SEO',
        title: 'Missing Title Tag',
        description: 'The page does not have a title tag',
        recommendation: 'Add a descriptive title tag (50-60 characters) to help search engines understand your page content',
      });
    } else if (titleText.length < 30) {
      issues.push({
        severity: 'medium',
        category: 'SEO',
        title: 'Title Tag Too Short',
        description: `Title tag is only ${titleText.length} characters`,
        recommendation: 'Use a title tag between 50-60 characters for optimal SEO',
      });
    } else if (titleText.length > 60) {
      issues.push({
        severity: 'low',
        category: 'SEO',
        title: 'Title Tag Too Long',
        description: `Title tag is ${titleText.length} characters (may be truncated in search results)`,
        recommendation: 'Keep title tags under 60 characters to avoid truncation',
      });
    }

    // Meta description
    const metaDescription = $('meta[name="description"]').length > 0;
    const metaDescText = $('meta[name="description"]').attr('content') || '';
    if (!metaDescription) {
      issues.push({
        severity: 'high',
        category: 'SEO',
        title: 'Missing Meta Description',
        description: 'The page does not have a meta description',
        recommendation: 'Add a meta description (150-160 characters) to improve click-through rates from search results',
      });
    } else if (metaDescText.length < 120) {
      issues.push({
        severity: 'medium',
        category: 'SEO',
        title: 'Meta Description Too Short',
        description: `Meta description is only ${metaDescText.length} characters`,
        recommendation: 'Use a meta description between 150-160 characters',
      });
    }

    // Headings structure
    const h1Count = $('h1').length;
    const h2Count = $('h2').length;
    const h3Count = $('h3').length;
    const h4Count = $('h4').length;
    const h5Count = $('h5').length;
    const h6Count = $('h6').length;

    if (h1Count === 0) {
      issues.push({
        severity: 'high',
        category: 'SEO',
        title: 'Missing H1 Heading',
        description: 'The page does not have an H1 heading',
        recommendation: 'Add one H1 heading that describes the main topic of the page',
      });
    } else if (h1Count > 1) {
      issues.push({
        severity: 'medium',
        category: 'SEO',
        title: 'Multiple H1 Headings',
        description: `The page has ${h1Count} H1 headings`,
        recommendation: 'Use only one H1 heading per page for better SEO structure',
      });
    }

    // Images and alt tags
    const images = $('img');
    const totalImages = images.length;
    let imageAltTags = 0;

    images.each((_, element) => {
      const alt = $(element).attr('alt');
      if (alt !== undefined && alt.trim() !== '') {
        imageAltTags++;
      } else {
        const src = $(element).attr('src');
        issues.push({
          severity: 'medium',
          category: 'SEO',
          title: 'Missing Image Alt Tag',
          description: `Image without alt attribute: ${src}`,
          element: src,
          recommendation: 'Add descriptive alt text to all images for better accessibility and SEO',
        });
      }
    });

    // Links
    const internalLinks = page.links.internal.length;
    const externalLinks = page.links.external.length;

    if (internalLinks < 3) {
      issues.push({
        severity: 'medium',
        category: 'SEO',
        title: 'Few Internal Links',
        description: `Page has only ${internalLinks} internal links`,
        recommendation: 'Add more internal links to help users navigate and improve site structure',
      });
    }

    // Canonical tag
    const canonicalTag = $('link[rel="canonical"]').length > 0;
    if (!canonicalTag) {
      issues.push({
        severity: 'low',
        category: 'SEO',
        title: 'Missing Canonical Tag',
        description: 'No canonical URL specified',
        recommendation: 'Add a canonical tag to prevent duplicate content issues',
      });
    }

    // Structured data
    const structuredData = $('script[type="application/ld+json"]').length > 0;
    if (!structuredData) {
      issues.push({
        severity: 'low',
        category: 'SEO',
        title: 'No Structured Data',
        description: 'No JSON-LD structured data found',
        recommendation: 'Add structured data (Schema.org) to enhance search engine understanding',
      });
    }

    // Calculate score
    let score = 100;
    if (!titleTag) score -= 15;
    if (!metaDescription) score -= 10;
    if (h1Count === 0) score -= 10;
    if (h1Count > 1) score -= 5;
    if (totalImages > 0 && imageAltTags / totalImages < 0.8) score -= 10;
    if (internalLinks < 3) score -= 5;
    if (!canonicalTag) score -= 5;
    if (!structuredData) score -= 5;

    const metrics: SEOMetrics = {
      score: Math.max(0, score),
      titleTag,
      metaDescription,
      headings: { h1Count, h2Count, h3Count, h4Count, h5Count, h6Count },
      imageAltTags,
      totalImages,
      internalLinks,
      externalLinks,
      brokenLinks: 0, // Will be filled by crawler
      canonicalTag,
      robotsTxt: false, // Will be filled by crawler
      sitemap: false, // Will be filled by crawler
      structuredData,
    };

    return { metrics, issues };
  }
}
