// src/components/PromoBanner.tsx
//
// Storefront "sample sale"-style promo block: a huge centered headline
// (banner.title, left to wrap naturally rather than needing a second
// DB field for line breaks) with a fixed decorative "CLICK HERE"
// marker scrawl overlapping it. The whole block is a single click
// target — clicking anywhere records a click and opens the banner's
// product collection via onBannerClick.
//
// NOTE: the scrawl is intentionally a fixed visual style applied to
// every banner the same way (fixed offsets, not tied to where
// banner.title actually wraps) — not stored per-banner in the DB. If
// that ever needs to be admin-editable, that's a small addition — a
// `cta_text` column on banners, swapped in for the literal "CLICK" /
// "HERE" strings below.
//
// Phase 6: removed the linked-products thumbnail strip, centered the
// headline, dropped the forced uppercase transform (the reference
// design keeps the title's own casing, e.g. "sample sale"), switched
// to a heavy/black weight, tightened line-height so the two lines
// nearly touch, and repositioned the scrawl to sit right-of-center
// over the headline per the reference screenshot.

import React from 'react';

import { StorefrontBanner, incrementBannerClick } from '../data/banners';

interface PromoBannerProps {
  banner: StorefrontBanner;
  onBannerClick: (banner: StorefrontBanner) => void;
}

const FONT = "'Helvetica Neue', Arial, sans-serif";
const MARKER_FONT = "'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive";
const MARKER_RED = '#E31B0C';

const PromoBanner: React.FC<PromoBannerProps> = ({
  banner,
  onBannerClick,
}) => {
  const handleClick = () => {
    // Fire-and-forget — a missed click count should never block
    // navigation into the banner's collection.
    void incrementBannerClick(banner.id);

    onBannerClick(banner);
  };

  return (
    <button
  type="button"
  onClick={handleClick}
  aria-label={`View the ${banner.title} collection`}
  className="relative block w-full text-center bg-white overflow-hidden group/banner my-10 md:my-16"
  style={{ fontFamily: FONT }}
>
      {/* =====================================================
          HEADLINE + SCRAWL — centered, heavy weight, tight leading
      ===================================================== */}

      <div className="relative flex flex-col items-center mx-auto px-8 pt-20 pb-16">
        <h2
          className="relative mx-auto font-black leading-[0.78] tracking-tight text-black transition-transform duration-500 ease-out group-hover/banner:-translate-y-1"
          style={{
            fontSize: 'clamp(2.75rem, 11vw, 7.5rem)',
          }}
        >
          {banner.title}
        </h2>

        <ClickHereScrawl />
      </div>
    </button>
  );
};

/* ============================================================
   CLICK HERE SCRAWL
   Fixed decorative element — bold red marker strokes laid directly
   over the headline, centered horizontally.
============================================================ */

const ClickHereScrawl: React.FC = () => (
  <div
    className="pointer-events-none select-none absolute inset-0 z-10"
    aria-hidden="true"
  >
    <span
      className="absolute uppercase"
      style={{
        top: '6%',
        left: '50%',
        fontFamily: MARKER_FONT,
        fontWeight: 900,
        color: MARKER_RED,
        fontSize: 'clamp(2.2rem, 9vw, 6rem)',
        letterSpacing: '0.02em',
        transform: 'translateX(-50%) rotate(-8deg)',
        WebkitTextStroke: '1.5px ' + MARKER_RED,
      }}
    >
      Click
    </span>

    <span
      className="absolute uppercase"
      style={{
        top: '44%',
        left: '50%',
        fontFamily: MARKER_FONT,
        fontWeight: 900,
        color: MARKER_RED,
        fontSize: 'clamp(2.2rem, 9vw, 6rem)',
        letterSpacing: '0.02em',
        transform: 'translateX(-50%) rotate(-4deg)',
        WebkitTextStroke: '1.5px ' + MARKER_RED,
      }}
    >
      Here
    </span>
  </div>
);

export default PromoBanner;