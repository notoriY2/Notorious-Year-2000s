import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const REMOVE_BG_KEY = Deno.env.get('REMOVE_BG_API_KEY')!;
const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? 'https://notorious-y2.vercel.app';
const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Takes a path already sitting in Storage (uploaded raw, fast), runs it
// through remove.bg server-side, and writes the processed PNG back to
// the same bucket. Nothing about this blocks the original upload —
// callers invoke this AFTER returning the raw image URL to the client.
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bucket, path } = await req.json();

    if (!bucket || !path) {
      throw new Error('bucket and path are required.');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from(bucket)
      .download(path);

    if (downloadError || !fileBlob) {
      throw new Error(`Failed to download source image: ${downloadError?.message}`);
    }

    const form = new FormData();
    form.append('image_file', fileBlob, path.split('/').pop());
    form.append('size', 'auto');

    const bgResponse = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: { 'X-Api-Key': REMOVE_BG_KEY },
      body: form,
    });

    if (!bgResponse.ok) {
      throw new Error(`remove.bg error (${bgResponse.status}): ${await bgResponse.text()}`);
    }

    const processedBytes = new Uint8Array(await bgResponse.arrayBuffer());
    const processedPath = path.replace(/\.[^.]+$/, '') + '-nobg.png';

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(processedPath, processedBytes, {
        contentType: 'image/png',
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Failed to upload processed image: ${uploadError.message}`);
    }

    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(processedPath);

    return new Response(
      JSON.stringify({ url: publicUrlData.publicUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});