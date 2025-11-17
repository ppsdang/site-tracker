import * as cheerio from 'cheerio';
import { AccessibilityMetrics, Issue } from '../types';
import { CrawledPage } from '../crawler/crawler';

export class AccessibilityAnalyzer {
  analyze(page: CrawledPage): { metrics: AccessibilityMetrics; issues: Issue[] } {
    const $ = cheerio.load(page.html);
    const issues: Issue[] = [];

    // Missing alt tags
    const images = $('img');
    let missingAltTags = 0;

    images.each((_, element) => {
      const alt = $(element).attr('alt');
      if (alt === undefined || alt.trim() === '') {
        missingAltTags++;
      }
    });

    if (missingAltTags > 0) {
      issues.push({
        severity: 'high',
        category: 'Accessibility',
        title: 'Images Missing Alt Text',
        description: `${missingAltTags} image(s) are missing alt attributes`,
        recommendation: 'Add descriptive alt text to all images for screen reader users',
      });
    }

    // HTML lang attribute
    const htmlLang = $('html').attr('lang') !== undefined;
    if (!htmlLang) {
      issues.push({
        severity: 'high',
        category: 'Accessibility',
        title: 'Missing Language Declaration',
        description: 'The HTML element does not have a lang attribute',
        recommendation: 'Add lang attribute to the HTML element (e.g., <html lang="en">)',
      });
    }

    // Form labels
    let formLabels = true;
    const inputs = $('input[type="text"], input[type="email"], input[type="password"], textarea');

    inputs.each((_, element) => {
      const id = $(element).attr('id');
      const ariaLabel = $(element).attr('aria-label');
      const hasLabel = id ? $(`label[for="${id}"]`).length > 0 : false;

      if (!hasLabel && !ariaLabel) {
        formLabels = false;
        issues.push({
          severity: 'medium',
          category: 'Accessibility',
          title: 'Form Input Missing Label',
          description: 'Form input field does not have an associated label',
          element: $(element).attr('name') || 'unnamed input',
          recommendation: 'Add a <label> element or aria-label attribute for screen reader users',
        });
      }
    });

    // Button labels
    const buttons = $('button');
    let buttonLabels = true;

    buttons.each((_, element) => {
      const text = $(element).text().trim();
      const ariaLabel = $(element).attr('aria-label');
      const title = $(element).attr('title');

      if (!text && !ariaLabel && !title) {
        buttonLabels = false;
        issues.push({
          severity: 'medium',
          category: 'Accessibility',
          title: 'Button Missing Accessible Name',
          description: 'Button has no text content or aria-label',
          recommendation: 'Add descriptive text or aria-label to buttons',
        });
      }
    });

    // ARIA labels
    const ariaElements = $('[aria-label], [aria-labelledby], [role]');
    const ariaLabels = ariaElements.length > 0;

    // Skip links
    const skipLinks = $('a[href^="#"]').filter((_, el) => {
      const text = $(el).text().toLowerCase();
      return text.includes('skip') || text.includes('main content');
    }).length > 0;

    if (!skipLinks) {
      issues.push({
        severity: 'low',
        category: 'Accessibility',
        title: 'No Skip Navigation Link',
        description: 'Page does not have a skip navigation link',
        recommendation: 'Add a "Skip to main content" link for keyboard users',
      });
    }

    // Color contrast (simplified check - just warn)
    issues.push({
      severity: 'low',
      category: 'Accessibility',
      title: 'Color Contrast Not Verified',
      description: 'Color contrast ratios should be manually verified',
      recommendation: 'Ensure text has at least 4.5:1 contrast ratio with background (WCAG AA)',
    });

    // Check for ARIA roles
    const landmarks = $('[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"]').length;
    if (landmarks === 0) {
      issues.push({
        severity: 'medium',
        category: 'Accessibility',
        title: 'No ARIA Landmarks',
        description: 'Page does not use ARIA landmark roles',
        recommendation: 'Add ARIA landmarks (main, navigation, banner, contentinfo) to improve navigation',
      });
    }

    // Calculate score
    let score = 100;
    if (missingAltTags > 0) score -= 20;
    if (!htmlLang) score -= 15;
    if (!formLabels) score -= 15;
    if (!buttonLabels) score -= 10;
    if (!skipLinks) score -= 5;
    if (landmarks === 0) score -= 10;

    const metrics: AccessibilityMetrics = {
      score: Math.max(0, score),
      missingAltTags,
      colorContrast: true, // Simplified - would need actual contrast calculation
      ariaLabels,
      formLabels,
      buttonLabels,
      htmlLang,
      skipLinks,
    };

    return { metrics, issues };
  }
}
