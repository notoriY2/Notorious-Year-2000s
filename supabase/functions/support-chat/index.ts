import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const GROQ_KEY = Deno.env.get('GROQ_API_KEY');
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? 'https://notorious-y2.vercel.app';
const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are the customer support assistant for Notorious.Y2, a Y2K-inspired streetwear storefront. Answer questions about orders, shipping, returns, sizing, and the catalog professionally and concisely.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    if (!GROQ_KEY) throw new Error('GROQ_API_KEY is not configured.');

    const { message, history } = await req.json();
    if (!message?.trim()) throw new Error('message is required.');

    const trimmedHistory = (history ?? []).slice(-12);
    const messages = [{ role: 'system', content: SYSTEM_PROMPT }, ...trimmedHistory, { role: 'user', content: message }];

    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 400, messages }),
    });

    if (!response.ok) throw new Error(`Groq API error (${response.status}): ${await response.text()}`);

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content ?? "Sorry, I couldn't process that.";

    return new Response(JSON.stringify({ reply }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});