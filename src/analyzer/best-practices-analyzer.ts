import * as cheerio from 'cheerio';
import { BestPracticesMetrics, Issue } from '../types';
import { CrawledPage } from '../crawler/crawler';

export class BestPracticesAnalyzer {
  analyze(page: CrawledPage): { metrics: BestPracticesMetrics; issues: Issue[] } {
    const $ = cheerio.load(page.html);
    const issues: Issue[] = [];

    // Check DOCTYPE
    const html = page.html.trim();
    const doctype = html.toLowerCase().startsWith('<!doctype html>');
    if (!doctype) {
      issues.push({
        severity: 'medium',
        category: 'Best Practices',
        title: 'Missing or Invalid DOCTYPE',
        description: 'Page does not have a valid HTML5 DOCTYPE',
        recommendation: 'Add <!DOCTYPE html> at the beginning of the document',
      });
    }

    // Check charset
    const charset = $('meta[charset]').length > 0 ||
                    $('meta[http-equiv="Content-Type"]').length > 0;
    if (!charset) {
      issues.push({
        severity: 'medium',
        category: 'Best Practices',
        title: 'Missing Character Set Declaration',
        description: 'No charset meta tag found',
        recommendation: 'Add <meta charset="UTF-8"> to the head section',
      });
    }

    // Check viewport
    const viewport = $('meta[name="viewport"]').length > 0;
    if (!viewport) {
      issues.push({
        severity: 'high',
        category: 'Best Practices',
        title: 'Missing Viewport Meta Tag',
        description: 'No viewport meta tag found',
        recommendation: 'Add <meta name="viewport" content="width=device-width, initial-scale=1.0"> for mobile responsiveness',
      });
    }

    // Check for deprecated HTML elements
    const deprecatedElements = [
      'center', 'font', 'marquee', 'blink', 'strike',
      'acronym', 'applet', 'basefont', 'big', 'dir', 'frame', 'frameset'
    ];

    let deprecated_apis = 0;
    deprecatedElements.forEach(tag => {
      const count = $(tag).length;
      if (count > 0) {
        deprecated_apis += count;
        issues.push({
          severity: 'medium',
          category: 'Best Practices',
          title: 'Deprecated HTML Element',
          description: `Found ${count} <${tag}> element(s)`,
          element: tag,
          recommendation: `Replace deprecated <${tag}> elements with modern alternatives`,
        });
      }
    });

    // Check for inline styles (excessive use)
    const inlineStyles = $('[style]').length;
    if (inlineStyles > 10) {
      issues.push({
        severity: 'low',
        category: 'Best Practices',
        title: 'Excessive Inline Styles',
        description: `Found ${inlineStyles} elements with inline styles`,
        recommendation: 'Move inline styles to external CSS files for better maintainability',
      });
    }

    // Check for console.log in scripts (simplified)
    let console_errors = 0;
    $('script:not([src])').each((_, element) => {
      const scriptContent = $(element).html() || '';
      const consoleMatches = scriptContent.match(/console\.(log|error|warn|debug)/g);
      if (consoleMatches) {
        console_errors += consoleMatches.length;
      }
    });

    if (console_errors > 0) {
      issues.push({
        severity: 'low',
        category: 'Best Practices',
        title: 'Console Statements in Production',
        description: `Found ${console_errors} console statement(s) in scripts`,
        recommendation: 'Remove console statements from production code',
      });
    }

    // Check for broken images
    $('img:not([src]), img[src=""]').each(() => {
      issues.push({
        severity: 'medium',
        category: 'Best Practices',
        title: 'Image Without Source',
        description: 'Image element has no src attribute',
        recommendation: 'Add a valid src attribute to all img elements',
      });
    });

    // Check for favicon
    const favicon = $('link[rel="icon"], link[rel="shortcut icon"]').length > 0;
    if (!favicon) {
      issues.push({
        severity: 'low',
        category: 'Best Practices',
        title: 'Missing Favicon',
        description: 'No favicon link found',
        recommendation: 'Add a favicon to improve brand recognition',
      });
    }

    // Check for Open Graph tags
    const ogTags = $('meta[property^="og:"]').length;
    if (ogTags === 0) {
      issues.push({
        severity: 'low',
        category: 'Best Practices',
        title: 'No Open Graph Tags',
        description: 'No Open Graph meta tags found',
        recommendation: 'Add Open Graph tags to control how content appears when shared on social media',
      });
    }

    // Check for Twitter Card tags
    const twitterTags = $('meta[name^="twitter:"]').length;
    if (twitterTags === 0) {
      issues.push({
        severity: 'low',
        category: 'Best Practices',
        title: 'No Twitter Card Tags',
        description: 'No Twitter Card meta tags found',
        recommendation: 'Add Twitter Card tags to enhance content appearance on Twitter',
      });
    }

    // Calculate score
    let score = 100;
    if (!doctype) score -= 10;
    if (!charset) score -= 10;
    if (!viewport) score -= 15;
    if (deprecated_apis > 0) score -= 15;
    if (console_errors > 0) score -= 5;
    if (!favicon) score -= 5;

    const metrics: BestPracticesMetrics = {
      score: Math.max(0, score),
      doctype,
      charset,
      viewport,
      console_errors,
      deprecated_apis,
    };

    return { metrics, issues };
  }
}
