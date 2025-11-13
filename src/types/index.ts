export interface Website {
  id?: number;
  url: string;
  domain: string;
  createdAt: string;
  lastAuditedAt: string;
}

export interface Audit {
  id?: number;
  websiteId: number;
  url: string;
  healthScore: number;
  auditDate: string;
  status: 'completed' | 'in_progress' | 'failed';
  metrics: AuditMetrics;
  issues: Issue[];
}

export interface AuditMetrics {
  seo: SEOMetrics;
  performance: PerformanceMetrics;
  accessibility: AccessibilityMetrics;
  security: SecurityMetrics;
  bestPractices: BestPracticesMetrics;
}

export interface SEOMetrics {
  score: number;
  titleTag: boolean;
  metaDescription: boolean;
  headings: HeadingStructure;
  imageAltTags: number;
  totalImages: number;
  internalLinks: number;
  externalLinks: number;
  brokenLinks: number;
  canonicalTag: boolean;
  robotsTxt: boolean;
  sitemap: boolean;
  structuredData: boolean;
}

export interface HeadingStructure {
  h1Count: number;
  h2Count: number;
  h3Count: number;
  h4Count: number;
  h5Count: number;
  h6Count: number;
}

export interface PerformanceMetrics {
  score: number;
  loadTime: number;
  pageSize: number;
  requestCount: number;
  timeToFirstByte: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
  totalBlockingTime: number;
}

export interface AccessibilityMetrics {
  score: number;
  missingAltTags: number;
  colorContrast: boolean;
  ariaLabels: boolean;
  formLabels: boolean;
  buttonLabels: boolean;
  htmlLang: boolean;
  skipLinks: boolean;
}

export interface SecurityMetrics {
  score: number;
  https: boolean;
  mixedContent: boolean;
  securityHeaders: SecurityHeaders;
  vulnerabilities: string[];
}

export interface SecurityHeaders {
  strictTransportSecurity: boolean;
  contentSecurityPolicy: boolean;
  xFrameOptions: boolean;
  xContentTypeOptions: boolean;
  referrerPolicy: boolean;
}

export interface BestPracticesMetrics {
  score: number;
  doctype: boolean;
  charset: boolean;
  viewport: boolean;
  console_errors: number;
  deprecated_apis: number;
}

export interface Issue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  element?: string;
  recommendation: string;
}

export interface AuditComparison {
  current: Audit;
  previous?: Audit;
  changes: {
    healthScoreDiff: number;
    metricChanges: MetricChanges;
    newIssues: Issue[];
    resolvedIssues: Issue[];
  };
}

export interface MetricChanges {
  seo: number;
  performance: number;
  accessibility: number;
  security: number;
  bestPractices: number;
}

export interface CrawlOptions {
  maxDepth: number;
  maxPages: number;
  timeout: number;
  userAgent: string;
  respectRobotsTxt: boolean;
}
