import { EventEmitter } from 'events';

export interface ProgressEvent {
  type: 'sitemap' | 'crawling' | 'analyzing' | 'completed' | 'error';
  message: string;
  crawledCount?: number;
  totalUrls?: number;
  queuedCount?: number;
  issuesCount?: number;
  currentUrl?: string;
  percentage?: number;
}

export class ProgressTracker extends EventEmitter {
  private static instances: Map<number, ProgressTracker> = new Map();

  static getTracker(auditId: number): ProgressTracker {
    if (!this.instances.has(auditId)) {
      this.instances.set(auditId, new ProgressTracker());
    }
    return this.instances.get(auditId)!;
  }

  static removeTracker(auditId: number): void {
    const tracker = this.instances.get(auditId);
    if (tracker) {
      tracker.removeAllListeners();
      this.instances.delete(auditId);
    }
  }

  emitProgress(event: ProgressEvent): void {
    this.emit('progress', event);
  }
}
