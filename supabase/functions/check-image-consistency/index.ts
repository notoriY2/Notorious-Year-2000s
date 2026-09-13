import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const GROQ_KEY = Deno.env.get('GROQ_API_KEY');
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const VISION_MODEL = 'qwen/qwen3.6-27b'; // Update to your active Groq vision model

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

async function toDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image (${res.status}): ${url}`);
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  const buf = new Uint8Array(await res.arrayBuffer());
  let binary = '';
  for (let i = 0; i < buf.length; i++) {
    binary += String.fromCharCode(buf[i]);
  }
  return `data:${contentType};base64,${btoa(binary)}`;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    if (!GROQ_KEY) throw new Error('GROQ_API_KEY is not configured.');

    const { referenceUrl, newUrl } = await req.json();
    if (!referenceUrl || !newUrl) throw new Error('Both referenceUrl and newUrl are required.');

    const [referenceDataUrl, candidateDataUrl] = await Promise.all([
      toDataUrl(referenceUrl),
      toDataUrl(newUrl),
    ]);

    const prompt = 'The first image is the reference/main product photo. The second image is a newly uploaded supporting photo. Check whether they look consistent (lighting style, background treatment, same product). Respond ONLY with strict JSON: {"consistent": boolean, "note": string}. Keep "note" under 20 words and only include it when consistent is false.';

    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: VISION_MODEL,
        max_tokens: 200,
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: referenceDataUrl } }, { type: 'image_url', image_url: { url: candidateDataUrl } }] }],
      }),
    });

    if (!response.ok) throw new Error(`Groq API error (${response.status}): ${await response.text()}`);

    const data = await response.json();
    const text: string = data.choices?.[0]?.message?.content ?? '{"consistent": true}';
    const cleaned = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});