import { DatabaseManager } from '../database/db';
import { AuditComparison, Audit, Issue, MetricChanges } from '../types';

export class ComparisonService {
  private db: DatabaseManager;

  constructor(db: DatabaseManager) {
    this.db = db;
  }

  compareAudits(currentAuditId: number): AuditComparison | null {
    const currentAudit = this.db.getAuditById(currentAuditId);
    if (!currentAudit) {
      return null;
    }

    const previousAudit = this.db.getPreviousAuditForWebsite(
      currentAudit.websiteId,
      currentAudit.auditDate
    );

    if (!previousAudit) {
      // No previous audit to compare with
      return {
        current: currentAudit,
        previous: undefined,
        changes: {
          healthScoreDiff: 0,
          metricChanges: {
            seo: 0,
            performance: 0,
            accessibility: 0,
            security: 0,
            bestPractices: 0,
          },
          newIssues: currentAudit.issues,
          resolvedIssues: [],
        },
      };
    }

    // Calculate metric changes
    const metricChanges: MetricChanges = {
      seo: currentAudit.metrics.seo.score - previousAudit.metrics.seo.score,
      performance: currentAudit.metrics.performance.score - previousAudit.metrics.performance.score,
      accessibility: currentAudit.metrics.accessibility.score - previousAudit.metrics.accessibility.score,
      security: currentAudit.metrics.security.score - previousAudit.metrics.security.score,
      bestPractices: currentAudit.metrics.bestPractices.score - previousAudit.metrics.bestPractices.score,
    };

    // Calculate health score difference
    const healthScoreDiff = currentAudit.healthScore - previousAudit.healthScore;

    // Find new and resolved issues
    const newIssues = this.findNewIssues(currentAudit.issues, previousAudit.issues);
    const resolvedIssues = this.findResolvedIssues(currentAudit.issues, previousAudit.issues);

    return {
      current: currentAudit,
      previous: previousAudit,
      changes: {
        healthScoreDiff,
        metricChanges,
        newIssues,
        resolvedIssues,
      },
    };
  }

  compareWithSimilarWebsites(currentAuditId: number): {
    current: Audit;
    similar: Audit[];
    averageScores: {
      healthScore: number;
      seo: number;
      performance: number;
      accessibility: number;
      security: number;
      bestPractices: number;
    };
  } | null {
    const currentAudit = this.db.getAuditById(currentAuditId);
    if (!currentAudit) {
      return null;
    }

    // Get all websites
    const allWebsites = this.db.getAllWebsites();

    // Get latest audits for other websites
    const similarAudits: Audit[] = [];
    for (const website of allWebsites) {
      if (website.id !== currentAudit.websiteId) {
        const latestAudit = this.db.getLatestAuditForWebsite(website.id!);
        if (latestAudit && latestAudit.status === 'completed') {
          similarAudits.push(latestAudit);
        }
      }
    }

    if (similarAudits.length === 0) {
      return {
        current: currentAudit,
        similar: [],
        averageScores: {
          healthScore: currentAudit.healthScore,
          seo: currentAudit.metrics.seo.score,
          performance: currentAudit.metrics.performance.score,
          accessibility: currentAudit.metrics.accessibility.score,
          security: currentAudit.metrics.security.score,
          bestPractices: currentAudit.metrics.bestPractices.score,
        },
      };
    }

    // Calculate average scores
    const totalScores = similarAudits.reduce(
      (acc, audit) => ({
        healthScore: acc.healthScore + audit.healthScore,
        seo: acc.seo + audit.metrics.seo.score,
        performance: acc.performance + audit.metrics.performance.score,
        accessibility: acc.accessibility + audit.metrics.accessibility.score,
        security: acc.security + audit.metrics.security.score,
        bestPractices: acc.bestPractices + audit.metrics.bestPractices.score,
      }),
      { healthScore: 0, seo: 0, performance: 0, accessibility: 0, security: 0, bestPractices: 0 }
    );

    const count = similarAudits.length;
    const averageScores = {
      healthScore: Math.round(totalScores.healthScore / count),
      seo: Math.round(totalScores.seo / count),
      performance: Math.round(totalScores.performance / count),
      accessibility: Math.round(totalScores.accessibility / count),
      security: Math.round(totalScores.security / count),
      bestPractices: Math.round(totalScores.bestPractices / count),
    };

    return {
      current: currentAudit,
      similar: similarAudits,
      averageScores,
    };
  }

  private findNewIssues(currentIssues: Issue[], previousIssues: Issue[]): Issue[] {
    return currentIssues.filter(currentIssue => {
      return !previousIssues.some(
        prevIssue =>
          prevIssue.title === currentIssue.title &&
          prevIssue.category === currentIssue.category
      );
    });
  }

  private findResolvedIssues(currentIssues: Issue[], previousIssues: Issue[]): Issue[] {
    return previousIssues.filter(prevIssue => {
      return !currentIssues.some(
        currentIssue =>
          currentIssue.title === prevIssue.title &&
          currentIssue.category === prevIssue.category
      );
    });
  }

  getAuditTrend(websiteId: number, limit: number = 10): {
    audits: Audit[];
    trend: {
      dates: string[];
      healthScores: number[];
      seoScores: number[];
      performanceScores: number[];
      accessibilityScores: number[];
      securityScores: number[];
      bestPracticesScores: number[];
    };
  } {
    const audits = this.db.getAuditsForWebsite(websiteId, limit).reverse(); // Oldest to newest

    const trend = {
      dates: audits.map(a => a.auditDate),
      healthScores: audits.map(a => a.healthScore),
      seoScores: audits.map(a => a.metrics.seo.score),
      performanceScores: audits.map(a => a.metrics.performance.score),
      accessibilityScores: audits.map(a => a.metrics.accessibility.score),
      securityScores: audits.map(a => a.metrics.security.score),
      bestPracticesScores: audits.map(a => a.metrics.bestPractices.score),
    };

    return { audits, trend };
  }
}
