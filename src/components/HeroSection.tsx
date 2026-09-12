// src/components/HeroSection.tsx

import React, { useEffect, useState } from 'react';
import {
  getStoreSettings,
  type HeroSectionSettings,
} from '../data/storeSettings';
import type { Product } from '../types/Product';
import { optimizeImage } from '../lib/imageOptimizer';

interface HeroSectionProps {
  override?: HeroSectionSettings;
  disableNavigation?: boolean;
  onHeroClick?: () => void;
  products?: Product[];
}

const DEFAULT_HERO: HeroSectionSettings = {
  enabled: false,
  eyebrow: '',
  headline: '',
  description: '',
  button_text: '',
  product_ids: [],
  image: '',
};

const HERO_ROTATION_KEY = 'ny2-hero-rotation-index';

const HeroSection: React.FC<HeroSectionProps> = ({
  override,
  disableNavigation = false,
  onHeroClick,
  products = [],
}) => {
  const [fetchedSettings, setFetchedSettings] =
    useState<HeroSectionSettings>(DEFAULT_HERO);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (override) {
      setLoaded(true);
      return;
    }

    let cancelled = false;

    const loadSettings = async () => {
      try {
        const storeSettings = await getStoreSettings();

        if (!cancelled) {
          setFetchedSettings({
            ...storeSettings.hero_section,
            product_ids: storeSettings.hero_section.product_ids ?? [],
          });
        }
      } catch (error) {
        if (!cancelled) {
          setFetchedSettings(DEFAULT_HERO);
        }

        console.error(
          'Failed to load hero section settings:',
          error
        );
      } finally {
        if (!cancelled) {
          setLoaded(true);
        }
      }
    };

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, [override]);

  const settings = override ?? fetchedSettings;

  // Sequential rotation index persisted via localStorage, prioritizing product.image
  const displayImage = React.useMemo(() => {
    if (settings.image) return settings.image;

    if (settings.product_ids?.length && products.length) {
      const linked = products.filter(p => settings.product_ids.includes(p.id));

      if (linked.length > 0) {
        let index = 0;
        try {
          const stored = Number(localStorage.getItem(HERO_ROTATION_KEY) ?? '0');
          index = Number.isFinite(stored) ? stored : 0;
        } catch {
          index = 0;
        }

        const nextIndex = index % linked.length;

        try {
          localStorage.setItem(HERO_ROTATION_KEY, String((index + 1) % linked.length));
        } catch {
          /* ignore storage errors */
        }

        const pick = linked[nextIndex];
        return pick.image || pick.images?.[0] || '';
      }
    }

    return '';
  }, [settings.image, settings.product_ids, products]);

  if (!override && (!loaded || !settings.enabled)) {
    return null;
  }

  const handleClick = (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    event.preventDefault();

    if (disableNavigation) {
      return;
    }

    if (onHeroClick) {
      onHeroClick();
      return;
    }
  };

  return (
    <section
      className={`relative z-10 overflow-hidden w-full bg-white flex items-center ${
        displayImage ? 'lg:min-h-[520px]' : 'lg:min-h-[360px]'
      }`}
    >
      <div className="mx-auto max-w-[1600px] w-full pl-5 sm:pl-8 lg:pl-14 xl:pl-20 pr-5 sm:pr-8 md:pr-0 pt-6 sm:pt-8 lg:pt-10 pb-6 sm:pb-8 lg:pb-8">
        
        {/* MOBILE-ONLY PREMIUM HERO */}
        <div className="md:hidden relative -mx-5 rounded-b-[28px] overflow-hidden mb-10">
          {displayImage ? (
            <div className="relative w-full aspect-[4/5]">
              <img
                src={optimizeImage(displayImage, 800)}
                alt={settings.headline || 'Hero'}
                width={800}
                height={1000}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6 pb-8">
                {settings.eyebrow.trim() && (
                  <p className="mb-2 text-[10px] font-semibold tracking-[0.25em] uppercase text-white/70">
                    {settings.eyebrow}
                  </p>
                )}
                {settings.headline.trim() && (
                  <h1 className="text-3xl font-semibold tracking-tight text-white leading-[0.95] whitespace-pre-line">
                    {settings.headline}
                  </h1>
                )}
                {settings.description.trim() && (
                  <p className="mt-2 text-sm leading-relaxed text-white/80 max-w-[85%]">
                    {settings.description}
                  </p>
                )}
                {settings.button_text.trim() && (
                  <button
                    type="button"
                    onClick={handleClick}
                    className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-[11px] font-semibold tracking-[0.14em] uppercase text-gray-950 active:scale-95 transition-transform"
                  >
                    {settings.button_text}
                    <span aria-hidden="true">→</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="px-1 py-8">
              {settings.eyebrow.trim() && (
                <p className="mb-2 text-[10px] font-semibold tracking-[0.25em] uppercase text-gray-500">
                  {settings.eyebrow}
                </p>
              )}
              {settings.headline.trim() && (
                <h1 className="text-4xl font-semibold tracking-tight text-gray-950 leading-[0.95] whitespace-pre-line">
                  {settings.headline}
                </h1>
              )}
              {settings.description.trim() && (
                <p className="mt-3 text-sm leading-relaxed text-gray-500">
                  {settings.description}
                </p>
              )}
              {settings.button_text.trim() && (
                <button
                  type="button"
                  onClick={handleClick}
                  className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-gray-950 px-6 py-3 text-[11px] font-semibold tracking-[0.14em] uppercase text-white active:scale-95 transition-transform"
                >
                  {settings.button_text}
                  <span aria-hidden="true">→</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Desktop Grid Layout (hidden on mobile via md:grid) */}
        <div className={`hidden md:grid ${displayImage ? 'md:grid-cols-2' : 'grid-cols-1'} items-center gap-6 sm:gap-8 lg:gap-0 relative z-10`}>
          {displayImage && (
            <div
              aria-hidden="true"
              className="hidden lg:block absolute -right-10 top-1/2 -translate-y-1/2 w-[520px] h-[520px] rounded-full opacity-30 blur-3xl -z-10"
              style={{ background: 'radial-gradient(circle, #C44D2B 0%, transparent 70%)' }}
            />
          )}
          
          {/* Text Content */}
          <div className={`order-last md:order-first relative z-20 ${displayImage ? 'max-w-xl pr-0 md:pr-6 lg:pr-10' : 'max-w-3xl'}`}>
            {settings.eyebrow.trim() && (
              <p className="mb-1.5 sm:mb-2.5 text-[10px] sm:text-xs font-medium tracking-[0.2em] uppercase text-gray-500">
                {settings.eyebrow}
              </p>
            )}

            {settings.headline.trim() && (
              <>
                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-gray-950 leading-[0.95] whitespace-pre-line">
                  {settings.headline}
                </h1>
                <div className="hidden lg:block w-16 h-[2px] bg-[#C44D2B] mt-4" />
              </>
            )}

            {settings.description.trim() && (
              <p className="mt-2 sm:mt-3.5 max-w-2xl text-xs sm:text-sm md:text-base leading-relaxed text-gray-500">
                {settings.description}
              </p>
            )}

            {settings.button_text.trim() && (
              <button
                type="button"
                onClick={handleClick}
                className="mt-4 sm:mt-6 inline-flex items-center justify-center border border-gray-950 bg-gray-950 px-4 py-2.5 sm:px-6 sm:py-3 text-[10px] sm:text-xs font-medium tracking-[0.12em] uppercase text-white transition-colors hover:bg-white hover:text-gray-950 relative z-30 cursor-pointer pointer-events-auto"
              >
                {settings.button_text}
              </button>
            )}
          </div>

          {/* Image Content */}
          {displayImage && (
            <div className="order-first md:order-last flex justify-center w-full mb-4 md:mb-0 relative z-10">
              <img
                src={optimizeImage(displayImage, 1200)}
                alt={settings.headline || 'Hero'}
                width={1200}
                height={1200}
                className="w-full h-auto max-h-[300px] sm:max-h-[420px] lg:max-h-[520px] object-contain"
              />
            </div>
          )}
        </div>

      </div>
    </section>
  );
};

export default HeroSection;