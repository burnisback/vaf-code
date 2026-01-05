// Analytics abstraction layer
// Supports Plausible, PostHog, or custom analytics
// Set NEXT_PUBLIC_ANALYTICS_PROVIDER to 'plausible' or 'posthog' to enable

type AnalyticsEvent =
  | 'page_view'
  | 'cta_click'
  | 'signup_submit'
  | 'signup_success'
  | 'demo_submit'
  | 'demo_success'
  | 'pricing_view'
  | 'plan_select'
  | 'faq_expand'
  | 'workflow_step_view';

interface AnalyticsProps {
  [key: string]: string | number | boolean | undefined;
}

// Mock analytics store for development
const analyticsLog: { event: AnalyticsEvent; props?: AnalyticsProps; timestamp: Date }[] = [];

export function track(event: AnalyticsEvent, props?: AnalyticsProps): void {
  const provider = process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER;

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Analytics] ${event}`, props);
    analyticsLog.push({ event, props, timestamp: new Date() });
  }

  // Plausible integration
  if (provider === 'plausible' && typeof window !== 'undefined') {
    const plausible = (window as Window & { plausible?: (event: string, options?: { props: AnalyticsProps }) => void }).plausible;
    if (plausible) {
      plausible(event, props ? { props } : undefined);
    }
  }

  // PostHog integration
  if (provider === 'posthog' && typeof window !== 'undefined') {
    const posthog = (window as Window & { posthog?: { capture: (event: string, props?: AnalyticsProps) => void } }).posthog;
    if (posthog) {
      posthog.capture(event, props);
    }
  }
}

export function getAnalyticsLog() {
  return analyticsLog;
}

export function clearAnalyticsLog() {
  analyticsLog.length = 0;
}
