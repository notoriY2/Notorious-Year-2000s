import React, { useEffect, useState } from 'react';
import { getAnalyticsConsent, setAnalyticsConsentValue } from '../lib/consent';
import { recordConsent } from '../data/consent';
import { useAuth } from '../hooks/useAuth';

const CookieConsentBanner: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    setVisible(getAnalyticsConsent() === null);
  }, []);

  const respond = async (granted: boolean) => {
    setAnalyticsConsentValue(granted ? 'granted' : 'denied');
    setVisible(false);

    try {
      await recordConsent({
        userId: user?.id ?? null,
        email: user?.email ?? 'anonymous@visitor.local',
        consentType: 'analytics_tracking',
        granted,
        source: 'cookie_banner',
      });
    } catch {
      /* non-blocking — the local flag already governs tracking */
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-[90] bg-black text-white px-4 py-4 sm:px-6 flex flex-col sm:flex-row items-center gap-3 sm:gap-6">
      <p className="text-xs sm:text-sm text-gray-200 flex-1">
        We use cookies to understand how you shop with us and improve the storefront. You can accept or decline non-essential analytics tracking.
      </p>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => respond(false)}
          className="px-4 py-2 text-xs uppercase tracking-wide border border-white/40 hover:border-white transition-colors"
        >
          Decline
        </button>
        <button
          type="button"
          onClick={() => respond(true)}
          className="px-4 py-2 text-xs uppercase tracking-wide bg-white text-black hover:bg-gray-200 transition-colors"
        >
          Accept
        </button>
      </div>
    </div>
  );
};

export default CookieConsentBanner;