import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const GROQ_KEY = Deno.env.get('GROQ_API_KEY');
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

// Comma-separated list, e.g. set ALLOWED_ORIGINS in Supabase secrets to:
// https://notorious-y2.vercel.app,https://notorious-y2-store.vercel.app
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
    if (!GROQ_KEY) throw new Error('GROQ_API_KEY is not configured.');

    const { cartCount, averageValue } = await req.json();
    const prompt = `Write a short abandoned-cart recovery email for Notorious.Y2.\nContext: ${cartCount ?? 'several'} customers left carts averaging R${averageValue ?? 'various amounts'}.\nTone: warm, confident, Y2K streetwear brand voice.\nReturn ONLY strict JSON: {"subject": "<sub under 60 chars>", "body": "<2-4 sentences>"}`;

    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 300, messages: [{ role: 'user', content: prompt }] }),
    });

    if (!response.ok) throw new Error(`Groq API error (${response.status}): ${await response.text()}`);

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());

    return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});