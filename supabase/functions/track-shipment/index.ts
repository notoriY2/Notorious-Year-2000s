import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? 'https://notorious-y2.vercel.app';
const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Swap this out for a real carrier API (AfterShip, EasyPost, Shippo, etc.)
// once you have credentials — the contract this function must keep is:
// read { orderId }, write/update a carrier_shipments row, return that row
// in the CarrierShipment shape data/admin.ts expects.
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orderId } = await req.json();
    if (!orderId) throw new Error('orderId is required.');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Look up the order's existing tracking number (set by the admin
    // in AdminOrders.tsx's "Tracking Number" field).
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('tracking_number')
      .eq('id', orderId)
      .single();

    if (orderError) throw orderError;

    // --- Placeholder carrier response until a real API is wired in ---
    const simulatedStatus = order?.tracking_number ? 'In Transit' : 'Awaiting Pickup';
    const nowIso = new Date().toISOString();

    const shipmentUpdate = {
      order_id: orderId,
      carrier: order?.tracking_number ? 'Generic Carrier' : null,
      tracking_number: order?.tracking_number ?? null,
      status: simulatedStatus,
      estimated_delivery: null,
      last_checked_at: nowIso,
      events: [{ label: simulatedStatus, timestamp: nowIso }],
    };

    const { data: saved, error: upsertError } = await supabase
      .from('carrier_shipments')
      .upsert(shipmentUpdate, { onConflict: 'order_id' })
      .select('*')
      .single();

    if (upsertError) throw upsertError;

    return new Response(
      JSON.stringify({
        orderId: saved.order_id,
        carrier: saved.carrier,
        trackingNumber: saved.tracking_number,
        status: saved.status,
        estimatedDelivery: saved.estimated_delivery,
        lastCheckedAt: saved.last_checked_at,
        events: saved.events ?? [],
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});