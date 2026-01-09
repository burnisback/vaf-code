/**
 * Approval Manager
 *
 * Manages user approval checkpoints in the mega-complex pipeline.
 * Handles pausing, approving, and rejecting at each stage.
 */

// =============================================================================
// TYPES
// =============================================================================

/**
 * Types of content that can require approval
 */
export type ApprovalType =
  | 'research'
  | 'prd'
  | 'architecture'
  | 'phase'
  | 'fix';

/**
 * Status of an approval request
 */
export type ApprovalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'expired';

/**
 * An approval request
 */
export interface ApprovalRequest {
  /** Unique request ID */
  id: string;
  /** Type of approval */
  type: ApprovalType;
  /** Human-readable title */
  title: string;
  /** Description of what's being approved */
  description: string;
  /** Content to be approved (varies by type) */
  content: unknown;
  /** Estimated cost to proceed */
  estimatedCost?: number;
  /** Estimated time to proceed (ms) */
  estimatedTime?: number;
  /** Current status */
  status: ApprovalStatus;
  /** Feedback if rejected */
  rejectionReason?: string;
  /** When the request was created */
  createdAt: number;
  /** When the request was resolved */
  resolvedAt?: number;
  /** Expiration time (if any) */
  expiresAt?: number;
}

/**
 * Approval manager callbacks
 */
export interface ApprovalManagerCallbacks {
  /** Called when approval is requested */
  onApprovalRequested?: (request: ApprovalRequest) => void;
  /** Called when approval is granted */
  onApproved?: (request: ApprovalRequest) => void;
  /** Called when approval is rejected */
  onRejected?: (request: ApprovalRequest, reason?: string) => void;
  /** Called when approval expires */
  onExpired?: (request: ApprovalRequest) => void;
}

/**
 * Configuration for approval manager
 */
export interface ApprovalManagerConfig {
  /** Default timeout for approval requests (ms) */
  defaultTimeout?: number;
  /** Auto-approve settings */
  autoApprove?: Partial<Record<ApprovalType, boolean>>;
  /** Callbacks */
  callbacks?: ApprovalManagerCallbacks;
}

/**
 * Result of waiting for approval
 */
export interface ApprovalResult {
  /** Whether approved */
  approved: boolean;
  /** Rejection reason if rejected */
  reason?: string;
  /** How long it took to decide (ms) */
  decisionTime: number;
}

// =============================================================================
// DEFAULT CONFIG
// =============================================================================

const DEFAULT_CONFIG: Required<ApprovalManagerConfig> = {
  defaultTimeout: 0, // No timeout by default
  autoApprove: {},
  callbacks: {},
};

// =============================================================================
// APPROVAL MANAGER CLASS
// =============================================================================

/**
 * Manages approval workflow
 */
export class ApprovalManager {
  private config: Required<ApprovalManagerConfig>;
  private requests: Map<string, ApprovalRequest> = new Map();
  private waitingResolvers: Map<string, {
    resolve: (result: ApprovalResult) => void;
    timeoutId?: ReturnType<typeof setTimeout>;
  }> = new Map();

  constructor(config: ApprovalManagerConfig = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      autoApprove: { ...DEFAULT_CONFIG.autoApprove, ...config.autoApprove },
      callbacks: { ...DEFAULT_CONFIG.callbacks, ...config.callbacks },
    };
  }

  /**
   * Request approval for content
   */
  requestApproval(
    type: ApprovalType,
    title: string,
    description: string,
    content: unknown,
    options: {
      estimatedCost?: number;
      estimatedTime?: number;
      timeout?: number;
    } = {}
  ): ApprovalRequest {
    const id = `approval_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const request: ApprovalRequest = {
      id,
      type,
      title,
      description,
      content,
      estimatedCost: options.estimatedCost,
      estimatedTime: options.estimatedTime,
      status: 'pending',
      createdAt: Date.now(),
    };

    // Set expiration if timeout specified
    const timeout = options.timeout || this.config.defaultTimeout;
    if (timeout > 0) {
      request.expiresAt = Date.now() + timeout;
    }

    this.requests.set(id, request);

    // Check auto-approve
    if (this.config.autoApprove[type]) {
      // Auto-approve after a short delay (allow UI to update)
      setTimeout(() => this.approve(id), 100);
    } else {
      this.config.callbacks?.onApprovalRequested?.(request);
    }

    return request;
  }

  /**
   * Wait for approval of a request
   */
  async waitForApproval(requestId: string): Promise<ApprovalResult> {
    const request = this.requests.get(requestId);
    if (!request) {
      return { approved: false, reason: 'Request not found', decisionTime: 0 };
    }

    // If already resolved
    if (request.status !== 'pending') {
      return {
        approved: request.status === 'approved',
        reason: request.rejectionReason,
        decisionTime: (request.resolvedAt || Date.now()) - request.createdAt,
      };
    }

    // If auto-approved
    if (this.config.autoApprove[request.type]) {
      return { approved: true, decisionTime: 0 };
    }

    // Wait for resolution
    return new Promise((resolve) => {
      const entry: typeof this.waitingResolvers extends Map<string, infer V> ? V : never = { resolve };

      // Set timeout if expiration exists
      if (request.expiresAt) {
        const timeRemaining = request.expiresAt - Date.now();
        if (timeRemaining > 0) {
          entry.timeoutId = setTimeout(() => {
            this.expire(requestId);
          }, timeRemaining);
        } else {
          // Already expired
          this.expire(requestId);
          resolve({
            approved: false,
            reason: 'Request expired',
            decisionTime: request.expiresAt - request.createdAt,
          });
          return;
        }
      }

      this.waitingResolvers.set(requestId, entry);
    });
  }

  /**
   * Approve a request
   */
  approve(requestId: string): boolean {
    const request = this.requests.get(requestId);
    if (!request || request.status !== 'pending') {
      return false;
    }

    request.status = 'approved';
    request.resolvedAt = Date.now();

    this.config.callbacks?.onApproved?.(request);
    this.resolveWaiting(requestId, {
      approved: true,
      decisionTime: request.resolvedAt - request.createdAt,
    });

    return true;
  }

  /**
   * Reject a request
   */
  reject(requestId: string, reason?: string): boolean {
    const request = this.requests.get(requestId);
    if (!request || request.status !== 'pending') {
      return false;
    }

    request.status = 'rejected';
    request.rejectionReason = reason;
    request.resolvedAt = Date.now();

    this.config.callbacks?.onRejected?.(request, reason);
    this.resolveWaiting(requestId, {
      approved: false,
      reason,
      decisionTime: request.resolvedAt - request.createdAt,
    });

    return true;
  }

  /**
   * Expire a request
   */
  private expire(requestId: string): boolean {
    const request = this.requests.get(requestId);
    if (!request || request.status !== 'pending') {
      return false;
    }

    request.status = 'expired';
    request.resolvedAt = Date.now();

    this.config.callbacks?.onExpired?.(request);
    this.resolveWaiting(requestId, {
      approved: false,
      reason: 'Request expired',
      decisionTime: request.resolvedAt - request.createdAt,
    });

    return true;
  }

  /**
   * Get a pending request
   */
  getRequest(requestId: string): ApprovalRequest | undefined {
    return this.requests.get(requestId);
  }

  /**
   * Get all pending requests
   */
  getPendingRequests(): ApprovalRequest[] {
    return Array.from(this.requests.values()).filter(r => r.status === 'pending');
  }

  /**
   * Get the current pending request (if any)
   */
  getCurrentPendingRequest(): ApprovalRequest | undefined {
    return Array.from(this.requests.values())
      .filter(r => r.status === 'pending')
      .sort((a, b) => b.createdAt - a.createdAt)[0];
  }

  /**
   * Check if there's a pending approval
   */
  hasPendingApproval(): boolean {
    return this.getPendingRequests().length > 0;
  }

  /**
   * Get all requests
   */
  getAllRequests(): ApprovalRequest[] {
    return Array.from(this.requests.values());
  }

  /**
   * Get requests by type
   */
  getRequestsByType(type: ApprovalType): ApprovalRequest[] {
    return Array.from(this.requests.values()).filter(r => r.type === type);
  }

  /**
   * Clear all requests
   */
  clear(): void {
    // Reject all pending
    for (const request of this.requests.values()) {
      if (request.status === 'pending') {
        this.reject(request.id, 'Cleared');
      }
    }
    this.requests.clear();
  }

  /**
   * Update auto-approve settings
   */
  setAutoApprove(type: ApprovalType, enabled: boolean): void {
    this.config.autoApprove[type] = enabled;
  }

  /**
   * Check if a type is auto-approved
   */
  isAutoApproved(type: ApprovalType): boolean {
    return !!this.config.autoApprove[type];
  }

  /**
   * Get approval statistics
   */
  getStatistics(): {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    expired: number;
    averageDecisionTime: number;
    byType: Record<ApprovalType, { count: number; approved: number }>;
  } {
    const requests = Array.from(this.requests.values());

    const stats = {
      total: requests.length,
      pending: 0,
      approved: 0,
      rejected: 0,
      expired: 0,
      averageDecisionTime: 0,
      byType: {} as Record<ApprovalType, { count: number; approved: number }>,
    };

    let totalDecisionTime = 0;
    let decidedCount = 0;

    for (const request of requests) {
      switch (request.status) {
        case 'pending': stats.pending++; break;
        case 'approved': stats.approved++; break;
        case 'rejected': stats.rejected++; break;
        case 'expired': stats.expired++; break;
      }

      if (request.resolvedAt) {
        totalDecisionTime += request.resolvedAt - request.createdAt;
        decidedCount++;
      }

      if (!stats.byType[request.type]) {
        stats.byType[request.type] = { count: 0, approved: 0 };
      }
      stats.byType[request.type].count++;
      if (request.status === 'approved') {
        stats.byType[request.type].approved++;
      }
    }

    if (decidedCount > 0) {
      stats.averageDecisionTime = totalDecisionTime / decidedCount;
    }

    return stats;
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  /**
   * Resolve waiting promise for a request
   */
  private resolveWaiting(requestId: string, result: ApprovalResult): void {
    const entry = this.waitingResolvers.get(requestId);
    if (entry) {
      if (entry.timeoutId) {
        clearTimeout(entry.timeoutId);
      }
      entry.resolve(result);
      this.waitingResolvers.delete(requestId);
    }
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create an approval manager instance
 */
export function createApprovalManager(
  config?: ApprovalManagerConfig
): ApprovalManager {
  return new ApprovalManager(config);
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get human-readable title for approval type
 */
export function getApprovalTypeTitle(type: ApprovalType): string {
  const titles: Record<ApprovalType, string> = {
    research: 'Research Results',
    prd: 'Product Requirements',
    architecture: 'Technical Architecture',
    phase: 'Implementation Phase',
    fix: 'Error Fix',
  };
  return titles[type];
}

/**
 * Get description for approval type
 */
export function getApprovalTypeDescription(type: ApprovalType): string {
  const descriptions: Record<ApprovalType, string> = {
    research: 'Review the research findings before proceeding to product definition.',
    prd: 'Review the product requirements before generating technical architecture.',
    architecture: 'Review the technical architecture before starting implementation.',
    phase: 'Review the phase plan before executing tasks.',
    fix: 'Review the proposed fix before applying changes.',
  };
  return descriptions[type];
}

/**
 * Format decision time for display
 */
export function formatDecisionTime(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}
