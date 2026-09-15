import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = Deno.env.get('CAMPAIGN_FROM_EMAIL') ?? 'Notorious.Y2 <onboarding@resend.dev>';

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ??
  'https://notorious-y2.vercel.app,https://notorious-y2-store.vercel.app,http://localhost:5173'
).split(',').map(o => o.trim());

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured.');

    const { campaignId } = await req.json();
    if (!campaignId) throw new Error('campaignId is required.');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const webhookBase = `${supabaseUrl}/functions/v1/campaign-webhook`;

    // Re-check admin status server-side — this call runs with the
    // service role key, so it must not trust the UI alone to have
    // gated the "Send Now" button.
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const { data: authData } = await supabase.auth.getUser(jwt);
    if (!authData?.user) throw new Error('Not authenticated.');

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin, admin_role')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (!profile?.is_admin || profile.admin_role === 'Viewer') {
      throw new Error('Only admins can send campaigns.');
    }

    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) throw new Error('Campaign not found.');
    if (!campaign.body_html?.trim()) throw new Error('This campaign has no email content to send.');

    // Resolve the opted-in audience. Every audience is filtered through
    // consent_records so a campaign can never reach someone who didn't
    // grant marketing_email consent via the checkout checkbox, footer
    // signup, or account settings.
    const { data: consentRows, error: consentError } = await supabase
      .from('consent_records')
      .select('email, granted, source, created_at')
      .eq('consent_type', 'marketing_email')
      .order('created_at', { ascending: false });

    if (consentError) throw consentError;

    const latestByEmail = new Map<string, { granted: boolean; source: string }>();
    for (const row of consentRows ?? []) {
      const key = row.email.toLowerCase();
      if (!latestByEmail.has(key)) {
        latestByEmail.set(key, { granted: row.granted, source: row.source });
      }
    }

    let recipientEmails = [...latestByEmail.entries()]
      .filter(([, v]) => v.granted)
      .map(([email]) => email);

    if (campaign.audience === 'Newsletter Subscribers') {
      recipientEmails = recipientEmails.filter(
        email => latestByEmail.get(email)?.source === 'footer_signup'
      );
    } else if (campaign.audience === 'VIP Customers') {
      const { data: vipRows } = await supabase
        .from('admin_customers_view')
        .select('email')
        .eq('status', 'VIP');
      const vipSet = new Set((vipRows ?? []).map(r => r.email.toLowerCase()));
      recipientEmails = recipientEmails.filter(email => vipSet.has(email));
    } else if (campaign.audience === 'Abandoned Cart') {
      const { data: cartRows } = await supabase
        .from('abandoned_carts')
        .select('customer_email')
        .eq('recovered', false);
      const cartSet = new Set((cartRows ?? []).map(r => r.customer_email.toLowerCase()));
      recipientEmails = recipientEmails.filter(email => cartSet.has(email));
    }
    // 'All Customers' uses the full opted-in list as-is.

    if (recipientEmails.length === 0) {
      throw new Error('No opted-in recipients match this campaign\'s audience.');
    }

    let sentCount = 0;

    for (const email of recipientEmails) {
      const { data: recipientRow, error: recipientError } = await supabase
        .from('campaign_recipients')
        .upsert({ campaign_id: campaignId, email }, { onConflict: 'campaign_id,email' })
        .select('token')
        .single();

      if (recipientError || !recipientRow) {
        console.error('Failed to create recipient row for', email, recipientError);
        continue;
      }

      const token = recipientRow.token;
      const pixelUrl = `${webhookBase}/open?token=${token}`;

      // Wrap every link so clicks route through the webhook first (which
      // logs the click, then 302-redirects to the real destination).
      const wrappedHtml = campaign.body_html.replace(
        /href="(https?:\/\/[^"]+)"/g,
        (_match: string, url: string) =>
          `href="${webhookBase}/click?token=${token}&url=${encodeURIComponent(url)}"`
      );

      const htmlWithPixel =
        `${wrappedHtml}<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none" />`;

      const sendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: email,
          subject: campaign.subject || campaign.name,
          html: htmlWithPixel,
        }),
      });

      if (sendResponse.ok) {
        sentCount += 1;
      } else {
        console.error('Resend send failed for', email, await sendResponse.text());
      }
    }

    const { error: updateError } = await supabase
      .from('campaigns')
      .update({
        status: 'Active',
        emails_sent: (campaign.emails_sent ?? 0) + sentCount,
        sent_at: new Date().toISOString(),
      })
      .eq('id', campaignId);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ sent: sentCount, total: recipientEmails.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});