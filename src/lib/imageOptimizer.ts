/**
 * Routes any public image URL through wsrv.nl for free on-the-fly
 * resizing + format negotiation (WebP/AVIF where supported) and edge
 * caching. Falls back gracefully — if wsrv is ever down, browsers
 * just get a slower load of the original, never a broken image.
 *
 * IMPORTANT: wsrv.nl can only fetch publicly resolvable ABSOLUTE
 * URLs. Root-relative paths (e.g. the seed catalog's '/products/1.png',
 * served from this app's own /public folder) must be resolved against
 * the current origin first, or wsrv.nl has no domain to fetch from and
 * every one of those images breaks.
 */
export const optimizeImage = (
  url: string,
  width: number,
  quality = 80
): string => {
  if (!url) return url;

  const isAbsolute = /^https?:\/\//i.test(url);

  const absoluteUrl = isAbsolute
    ? url
    : `${window.location.origin}${url.startsWith('/') ? url : `/${url}`}`;

  const encoded = encodeURIComponent(absoluteUrl);
  return `https://wsrv.nl/?url=${encoded}&w=${width}&q=${quality}&output=webp`;
};