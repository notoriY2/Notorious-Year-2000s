const ANALYTICS_CONSENT_KEY = 'ny2-analytics-consent';

export type AnalyticsConsentValue = 'granted' | 'denied';

export const getAnalyticsConsent = (): AnalyticsConsentValue | null => {
  try {
    const value = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
    return value === 'granted' || value === 'denied' ? value : null;
  } catch {
    return null;
  }
};

export const setAnalyticsConsentValue = (value: AnalyticsConsentValue): void => {
  try {
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, value);
  } catch {
    /* ignore storage errors */
  }
};