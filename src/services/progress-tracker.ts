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
  private static cancellationFlags: Map<number, boolean> = new Map();

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
    // Also remove cancellation flag
    this.cancellationFlags.delete(auditId);
  }

  static cancelAudit(auditId: number): void {
    console.log(`Cancellation requested for audit ${auditId}`);
    this.cancellationFlags.set(auditId, true);

    // Emit cancellation event to SSE listeners
    const tracker = this.instances.get(auditId);
    if (tracker) {
      tracker.emitProgress({
        type: 'error',
        message: 'Audit cancelled by user',
      });
    }
  }

  static isCancelled(auditId: number): boolean {
    return this.cancellationFlags.get(auditId) || false;
  }

  emitProgress(event: ProgressEvent): void {
    this.emit('progress', event);
  }
}
