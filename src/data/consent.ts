import { supabase } from '../lib/supabase';

export type ConsentType = 'marketing_email' | 'analytics_tracking';
export type ConsentSource =
  | 'checkout_checkbox'
  | 'footer_signup'
  | 'account_settings'
  | 'cookie_banner';

export interface RecordConsentInput {
  userId: string | null;
  email: string;
  consentType: ConsentType;
  granted: boolean;
  source: ConsentSource;
}

export const recordConsent = async (input: RecordConsentInput): Promise<void> => {
  const { error } = await supabase.from('consent_records').insert({
    user_id: input.userId,
    email: input.email,
    consent_type: input.consentType,
    granted: input.granted,
    source: input.source,
  });

  if (error) {
    console.error('Failed to record consent:', error);
    throw error;
  }
};