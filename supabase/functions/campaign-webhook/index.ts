import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// 1x1 transparent GIF — always returned for /open, even on failure, so a
// tracking hiccup never shows a broken image in the customer's inbox.
const TRANSPARENT_GIF = Uint8Array.from(
  atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7'),
  c => c.charCodeAt(0)
);

const DEFAULT_REDIRECT = 'https://notorious-y2-store.vercel.app';

serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/campaign-webhook/, '');
  const token = url.searchParams.get('token');

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const recalcStats = async (campaignId: string) => {
    const { data: recipients } = await supabase
      .from('campaign_recipients')
      .select('opened_at, clicked_at')
      .eq('campaign_id', campaignId);

    const total = recipients?.length ?? 0;
    const opens = recipients?.filter(r => r.opened_at).length ?? 0;
    const clicks = recipients?.filter(r => r.clicked_at).length ?? 0;
    const openRate = total > 0 ? Math.round((opens / total) * 1000) / 10 : 0;

    await supabase.from('campaigns').update({ open_rate: openRate, clicks }).eq('id', campaignId);
  };

  if (!token) {
    return path === '/open'
      ? new Response(TRANSPARENT_GIF, { headers: { 'Content-Type': 'image/gif' } })
      : Response.redirect(DEFAULT_REDIRECT, 302);
  }

  const { data: recipient } = await supabase
    .from('campaign_recipients')
    .select('id, campaign_id, opened_at, clicked_at')
    .eq('token', token)
    .maybeSingle();

  if (path === '/open') {
    if (recipient && !recipient.opened_at) {
      await supabase
        .from('campaign_recipients')
        .update({ opened_at: new Date().toISOString() })
        .eq('id', recipient.id);
      await recalcStats(recipient.campaign_id);
    }
    return new Response(TRANSPARENT_GIF, {
      headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' },
    });
  }

  if (path === '/click') {
    const targetUrl = url.searchParams.get('url') ?? DEFAULT_REDIRECT;

    if (recipient) {
      const updates: Record<string, string> = {};
      if (!recipient.opened_at) updates.opened_at = new Date().toISOString();
      if (!recipient.clicked_at) updates.clicked_at = new Date().toISOString();

      if (Object.keys(updates).length > 0) {
        await supabase.from('campaign_recipients').update(updates).eq('id', recipient.id);
        await recalcStats(recipient.campaign_id);
      }
    }

    return Response.redirect(targetUrl, 302);
  }

  return new Response('Not found', { status: 404 });
});