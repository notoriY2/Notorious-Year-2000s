import { supabase } from './supabase';

const SESSION_KEY = 'ny2-session-id';
const BATCH_INTERVAL_MS = 5000;
const MAX_BATCH_SIZE = 20;

let queue: Record<string, unknown>[] = [];
let flushTimer: number | null = null;

const getSessionId = (): string => {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
};

const getDevice = (): string =>
  /Mobi|Android/i.test(navigator.userAgent) ? 'mobile'
  : /Tablet|iPad/i.test(navigator.userAgent) ? 'tablet'
  : 'desktop';

const flush = () => {
  if (queue.length === 0) return;
  const batch = queue;
  queue = [];
  void supabase.from('analytics_events').insert(batch).then(({ error }) => {
    if (error) console.error('Failed to flush analytics batch:', error);
  });
};

// Fire on tab close so the last few events aren't lost.
window.addEventListener('pagehide', flush);

export const trackEvent = (eventType: string, path?: string): void => {
  queue.push({
    event_type: eventType,
    path: path ?? window.location.pathname,
    referrer: document.referrer || null,
    device: getDevice(),
    session_id: getSessionId(),
  });

  if (queue.length >= MAX_BATCH_SIZE) {
    flush();
    return;
  }

  if (flushTimer === null) {
    flushTimer = window.setTimeout(() => {
      flushTimer = null;
      flush();
    }, BATCH_INTERVAL_MS);
  }
};