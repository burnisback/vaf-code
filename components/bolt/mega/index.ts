/**
 * Mega-Complex Component Exports
 *
 * React components for mega-complex project orchestration.
 *
 * @example
 * ```tsx
 * import { MegaComplexPanel, MegaComplexMessage, MegaComplexBadge } from '@/components/bolt/mega';
 *
 * <MegaComplexPanel
 *   state={orchestrationState}
 *   context={orchestrationContext}
 *   onApprove={handleApprove}
 *   onPause={handlePause}
 * />
 *
 * <MegaComplexMessage
 *   type="research"
 *   title="Research Complete"
 *   content="Found 5 competitors and 10 key features"
 *   onViewDetails={() => setActiveTab('research')}
 * />
 * ```
 */

export { MegaComplexPanel } from './MegaComplexPanel';
export { MegaComplexMessage, MegaComplexBadge, type MegaComplexMessageType } from './MegaComplexMessage';
