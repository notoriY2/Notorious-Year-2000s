import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req) => {
  const sig = req.headers.get('stripe-signature')!;
  const body = await req.text();

  const event = await stripe.webhooks.constructEventAsync(
    body, sig, Deno.env.get('STRIPE_WEBHOOK_SECRET')!
  );

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object as Stripe.PaymentIntent;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    // Mark the matching order Paid, e.g. by storing intent.id on the order
    // when you create it, then updating payment_status here.
    await supabase.from('orders')
      .update({ payment_status: 'Paid' })
      .eq('stripe_payment_intent_id', intent.id);
  }

  return new Response('ok', { status: 200 });
});