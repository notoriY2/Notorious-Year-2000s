import { supabase } from './supabase';

/**
 * Runs background removal server-side (remove.bg via the `remove-background`
 * edge function) on a file already sitting in Storage. Replaces the old
 * @imgly/background-removal client-side WASM pipeline, which downloaded a
 * multi-MB model into the browser on every upload.
 *
 * Fire-and-forget from the caller's perspective — upload the raw file,
 * show it immediately, and swap in this URL once it resolves.
 */
export const removeBackgroundOnServer = async (
  bucket: string,
  path: string
): Promise<string> => {
  const { data, error } = await supabase.functions.invoke('remove-background', {
    body: { bucket, path },
  });

  if (error) {
    const detail = await (error as any).context?.json?.().catch(() => null);
    throw new Error(detail?.error ?? error.message);
  }

  return data.url as string;
};