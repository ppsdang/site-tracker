import * as cheerio from 'cheerio';
import { SecurityMetrics, Issue } from '../types';
import { CrawledPage } from '../crawler/crawler';

export class SecurityAnalyzer {
  analyze(page: CrawledPage): { metrics: SecurityMetrics; issues: Issue[] } {
    const $ = cheerio.load(page.html);
    const issues: Issue[] = [];
    const headers = page.headers;

    // Check HTTPS
    const https = page.url.startsWith('https://');
    if (!https) {
      issues.push({
        severity: 'critical',
        category: 'Security',
        title: 'Not Using HTTPS',
        description: 'Website is not using HTTPS encryption',
        recommendation: 'Implement HTTPS to secure data transmission and improve SEO',
      });
    }

    // Check for mixed content
    let mixedContent = false;
    if (https) {
      $('img[src^="http:"], script[src^="http:"], link[href^="http:"]').each(() => {
        mixedContent = true;
      });

      if (mixedContent) {
        issues.push({
          severity: 'high',
          category: 'Security',
          title: 'Mixed Content Detected',
          description: 'HTTPS page loads resources over HTTP',
          recommendation: 'Update all resource URLs to use HTTPS to prevent security warnings',
        });
      }
    }

    // Security headers
    const hsts = headers['strict-transport-security'] !== undefined;
    const csp = headers['content-security-policy'] !== undefined;
    const xFrameOptions = headers['x-frame-options'] !== undefined;
    const xContentType = headers['x-content-type-options'] !== undefined;
    const referrerPolicy = headers['referrer-policy'] !== undefined;

    if (!hsts && https) {
      issues.push({
        severity: 'high',
        category: 'Security',
        title: 'Missing HSTS Header',
        description: 'Strict-Transport-Security header not set',
        recommendation: 'Add HSTS header to force HTTPS connections',
      });
    }

    if (!csp) {
      issues.push({
        severity: 'medium',
        category: 'Security',
        title: 'Missing Content-Security-Policy',
        description: 'Content-Security-Policy header not set',
        recommendation: 'Implement CSP to prevent XSS and data injection attacks',
      });
    }

    if (!xFrameOptions) {
      issues.push({
        severity: 'medium',
        category: 'Security',
        title: 'Missing X-Frame-Options',
        description: 'X-Frame-Options header not set',
        recommendation: 'Add X-Frame-Options header to prevent clickjacking attacks',
      });
    }

    if (!xContentType) {
      issues.push({
        severity: 'medium',
        category: 'Security',
        title: 'Missing X-Content-Type-Options',
        description: 'X-Content-Type-Options header not set',
        recommendation: 'Add X-Content-Type-Options: nosniff to prevent MIME type sniffing',
      });
    }

    if (!referrerPolicy) {
      issues.push({
        severity: 'low',
        category: 'Security',
        title: 'Missing Referrer-Policy',
        description: 'Referrer-Policy header not set',
        recommendation: 'Add Referrer-Policy header to control referrer information',
      });
    }

    // Check for inline scripts (potential XSS risk)
    const inlineScripts = $('script:not([src])').length;
    if (inlineScripts > 5) {
      issues.push({
        severity: 'low',
        category: 'Security',
        title: 'Multiple Inline Scripts',
        description: `Found ${inlineScripts} inline scripts`,
        recommendation: 'Consider moving scripts to external files and using CSP nonce/hash',
      });
    }

    // Check for form without HTTPS
    if (!https) {
      const forms = $('form').length;
      if (forms > 0) {
        issues.push({
          severity: 'critical',
          category: 'Security',
          title: 'Forms Over HTTP',
          description: 'Forms are being submitted over unencrypted HTTP',
          recommendation: 'Use HTTPS to protect form data transmission',
        });
      }
    }

    // Check for vulnerable JavaScript libraries (simplified)
    const scripts = $('script[src]');
    const vulnerabilities: string[] = [];

    scripts.each((_, element) => {
      const src = $(element).attr('src') || '';
      // Check for old jQuery versions (simplified)
      if (src.includes('jquery') && (src.includes('1.') || src.includes('2.'))) {
        vulnerabilities.push('Potentially outdated jQuery version detected');
      }
    });

    if (vulnerabilities.length > 0) {
      issues.push({
        severity: 'medium',
        category: 'Security',
        title: 'Potentially Vulnerable Libraries',
        description: vulnerabilities.join(', '),
        recommendation: 'Update JavaScript libraries to latest secure versions',
      });
    }

    // Calculate score
    let score = 100;
    if (!https) score -= 40;
    if (mixedContent) score -= 20;
    if (!hsts && https) score -= 10;
    if (!csp) score -= 10;
    if (!xFrameOptions) score -= 5;
    if (!xContentType) score -= 5;
    if (vulnerabilities.length > 0) score -= 10;

    const metrics: SecurityMetrics = {
      score: Math.max(0, score),
      https,
      mixedContent,
      securityHeaders: {
        strictTransportSecurity: hsts,
        contentSecurityPolicy: csp,
        xFrameOptions,
        xContentTypeOptions: xContentType,
        referrerPolicy,
      },
      vulnerabilities,
    };

    return { metrics, issues };
  }
}
