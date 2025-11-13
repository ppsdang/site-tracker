import * as cheerio from 'cheerio';
import { PerformanceMetrics, Issue } from '../types';
import { CrawledPage } from '../crawler/crawler';

export class PerformanceAnalyzer {
  analyze(page: CrawledPage): { metrics: PerformanceMetrics; issues: Issue[] } {
    const $ = cheerio.load(page.html);
    const issues: Issue[] = [];

    // Count resources
    const scripts = $('script[src]').length;
    const stylesheets = $('link[rel="stylesheet"]').length;
    const images = $('img').length;
    const requestCount = scripts + stylesheets + images + 1; // +1 for HTML

    // Page size analysis
    const pageSizeKB = page.pageSize / 1024;
    const pageSizeMB = pageSizeKB / 1024;

    if (pageSizeMB > 5) {
      issues.push({
        severity: 'critical',
        category: 'Performance',
        title: 'Page Size Too Large',
        description: `Page size is ${pageSizeMB.toFixed(2)} MB`,
        recommendation: 'Optimize images, minify CSS/JS, and enable compression to reduce page size below 3 MB',
      });
    } else if (pageSizeMB > 3) {
      issues.push({
        severity: 'high',
        category: 'Performance',
        title: 'Page Size Could Be Optimized',
        description: `Page size is ${pageSizeMB.toFixed(2)} MB`,
        recommendation: 'Consider optimizing images and resources to improve load times',
      });
    }

    // Load time analysis
    if (page.loadTime > 5000) {
      issues.push({
        severity: 'critical',
        category: 'Performance',
        title: 'Slow Page Load Time',
        description: `Page took ${(page.loadTime / 1000).toFixed(2)} seconds to load`,
        recommendation: 'Optimize server response time, enable caching, and minimize render-blocking resources',
      });
    } else if (page.loadTime > 3000) {
      issues.push({
        severity: 'high',
        category: 'Performance',
        title: 'Page Load Time Could Be Improved',
        description: `Page took ${(page.loadTime / 1000).toFixed(2)} seconds to load`,
        recommendation: 'Aim for load times under 3 seconds for better user experience',
      });
    }

    // Script analysis
    if (scripts > 20) {
      issues.push({
        severity: 'medium',
        category: 'Performance',
        title: 'Too Many Script Files',
        description: `Page loads ${scripts} external scripts`,
        recommendation: 'Combine and minify JavaScript files to reduce HTTP requests',
      });
    }

    // Stylesheet analysis
    if (stylesheets > 10) {
      issues.push({
        severity: 'medium',
        category: 'Performance',
        title: 'Too Many Stylesheet Files',
        description: `Page loads ${stylesheets} external stylesheets`,
        recommendation: 'Combine and minify CSS files to reduce HTTP requests',
      });
    }

    // Check for render-blocking resources
    const renderBlockingScripts = $('script[src]:not([async]):not([defer])').length;
    if (renderBlockingScripts > 0) {
      issues.push({
        severity: 'medium',
        category: 'Performance',
        title: 'Render-Blocking Scripts',
        description: `Found ${renderBlockingScripts} render-blocking script(s)`,
        recommendation: 'Add async or defer attributes to script tags to prevent render blocking',
      });
    }

    // Estimate Core Web Vitals (simplified)
    const estimatedTTFB = page.loadTime * 0.15; // Roughly 15% of total load time
    const estimatedFCP = page.loadTime * 0.35; // Roughly 35% of total load time
    const estimatedLCP = page.loadTime * 0.75; // Roughly 75% of total load time
    const estimatedCLS = requestCount > 50 ? 0.15 : 0.05; // More resources = more layout shift
    const estimatedTBT = scripts > 10 ? 300 : 100; // More scripts = more blocking time

    // Calculate score
    let score = 100;
    if (page.loadTime > 5000) score -= 30;
    else if (page.loadTime > 3000) score -= 20;
    else if (page.loadTime > 2000) score -= 10;

    if (pageSizeMB > 5) score -= 20;
    else if (pageSizeMB > 3) score -= 10;

    if (scripts > 20) score -= 10;
    if (stylesheets > 10) score -= 5;
    if (renderBlockingScripts > 0) score -= 10;

    const metrics: PerformanceMetrics = {
      score: Math.max(0, score),
      loadTime: page.loadTime,
      pageSize: page.pageSize,
      requestCount,
      timeToFirstByte: estimatedTTFB,
      firstContentfulPaint: estimatedFCP,
      largestContentfulPaint: estimatedLCP,
      cumulativeLayoutShift: estimatedCLS,
      totalBlockingTime: estimatedTBT,
    };

    return { metrics, issues };
  }
}
