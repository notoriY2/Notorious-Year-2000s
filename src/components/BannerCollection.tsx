// src/components/BannerCollection.tsx
//
// Full-page overlay opened when a customer clicks a PromoBanner (or the
// hero CTA, via a synthetic "pseudo-banner" — see App.tsx's
// handleHeroClick). Reuses ProductDetail.tsx's header chrome (logo,
// currency selector, account/wishlist/cart icons) so it reads as the
// same app rather than a bolted-on page, and reuses ProductGrid.tsx as-is
// for the body — no new grid component needed.
//
// Phase 6: removed the FLOOR/GRID view toggle from the header entirely.
// This component always shows a grid — there is no floor layout for a
// banner's (or the hero's) product set — so the toggle was meaningless
// here and has been dropped rather than kept as a dead/no-op control.
// Closing back to the storefront floor is still available via the logo.

import React, { useState, useEffect } from 'react';
import {
  Heart,
  ShoppingBag,
  User,
  LayoutDashboard,
} from 'lucide-react';

import { StorefrontBanner } from '../data/banners';
import { Product } from '../types/Product';
import ProductGrid from './ProductGrid';
import CurrencySelector from './CurrencySelector';
import ShopFooter from './ShopFooter';
import { Currency } from '../hooks/useCurrency';
import { User as UserType } from '../hooks/useAuth';
import { optimizeImage } from '../lib/imageOptimizer';

interface BannerCollectionProps {
  banner: StorefrontBanner | null;
  isOpen: boolean;
  onClose: () => void;
  onProductClick: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  formatPrice: (price: number) => string;

  currencies: Currency[];
  selectedCurrency: Currency;
  onCurrencyChange: (currency: Currency) => void;

  user: UserType | null;
  onAuthClick: (message?: string) => void;

  wishlistItems: Product[];
  onOpenWishlist: () => void;

  cartItemsCount: number;
  onOpenCart: () => void;

  onOpenAdminDashboard: () => void;
  onOpenMyAccount: () => void;
}

const FONT = "'Helvetica Neue', Arial, sans-serif";

const BannerCollection: React.FC<BannerCollectionProps> = ({
  banner,
  isOpen,
  onClose,
  onProductClick,
  onAddToCart,
  formatPrice,
  currencies,
  selectedCurrency,
  onCurrencyChange,
  user,
  onAuthClick,
  wishlistItems,
  onOpenWishlist,
  cartItemsCount,
  onOpenCart,
  onOpenAdminDashboard,
  onOpenMyAccount,
}) => {
  const [hoveredProduct, setHoveredProduct] =
    useState<Product | null>(null);

  const [mousePosition, setMousePosition] = useState({
    x: 0,
    y: 0,
  });

  const [showFooter, setShowFooter] = useState(false);

  const wishlistCount = wishlistItems.length;

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePosition({
      x: e.clientX,
      y: e.clientY,
    });
  };

  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
  if (!isOpen) return;

  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  return () => {
    document.body.style.overflow = previousOverflow;
  };
}, [isOpen]);

  // Footer scroll listener tied to scrollContainerRef
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    
    const handleScroll = () => {
      const isNearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 100;
      setShowFooter(isNearBottom);
    };

    el.addEventListener('scroll', handleScroll, { passive: true });

    return () => el.removeEventListener('scroll', handleScroll);
  }, [banner?.id]);

  if (!isOpen || !banner) {
    return null;
  }

  return (
    <>
      <div
        ref={scrollContainerRef}
        className="fixed inset-x-0 top-0 h-[100dvh] bg-white z-[55] overflow-y-auto"
        onMouseMove={handleMouseMove}
      >
        <div className="min-h-[100dvh]">

          {/* =====================================================
              HEADER — matches ProductDetail.tsx's chrome for visual
              continuity across overlays, minus the FLOOR/GRID toggle.
          ===================================================== */}

          <header
            className="fixed top-0 left-0 right-0 z-[40] bg-white bg-opacity-95 backdrop-blur-sm border-b border-gray-100 px-2 sm:px-4 md:px-6"
          >
            <div className="flex items-center justify-between py-2 sm:py-4 md:py-6 max-w-7xl mx-auto">

              {/* BRAND */}
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Go to store"
                  className="flex items-center space-x-1 sm:space-x-2 md:space-x-3 cursor-pointer"
                >
                  <img
                    src={optimizeImage("/logo/13 (1).png", 48)}
                    alt="Notorious Y2"
                    width={48}
                    height={48}
                    className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 object-contain"
                  />

                  <h1
                    className="hidden sm:block text-sm sm:text-base md:text-lg lg:text-xl font-light tracking-[0.15em] sm:tracking-[0.2em] md:tracking-[0.3em] text-black"
                    style={{
                      fontFamily: FONT,
                      fontWeight: 100,
                    }}
                  >
                    Notorious.Y2
                  </h1>

                  <h1
                    className="sm:hidden text-sm font-light tracking-[0.15em] text-black"
                    style={{
                      fontFamily: FONT,
                      fontWeight: 100,
                    }}
                  >
                    Y2
                  </h1>
                </button>
              </div>

              {/* HEADER ACTIONS */}
              <div className="flex items-center space-x-1 sm:space-x-2 md:space-x-4">

                {/* CURRENCY */}
                <CurrencySelector
                  currencies={currencies}
                  selectedCurrency={selectedCurrency}
                  onCurrencyChange={onCurrencyChange}
                />

                {/* ACCOUNT */}
                <div className="hidden lg:flex items-center">
                  {user ? (
                    <button
                      type="button"
                      onClick={onOpenMyAccount}
                      className="p-0.5 sm:p-1 hover:bg-gray-50 rounded-full transition-colors duration-200 flex items-center justify-center"
                      title="My Account"
                      aria-label="Open My Account"
                    >
                      {user.avatar ? (
                        <img
                          src={optimizeImage(user.avatar, 24)}
                          alt={user.name || 'Account'}
                          width={24}
                          height={24}
                          className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 rounded-full bg-black text-white flex items-center justify-center text-[8px] sm:text-[9px] md:text-[10px] font-light">
                          {user.name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                      )}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="hidden md:flex items-center space-x-1 px-2 py-1 text-xs hover:bg-gray-50 rounded-lg transition-colors duration-200"
                        onClick={() => onAuthClick()}
                      >
                        <User size={14} />
                        <span>Sign In</span>
                      </button>

                      <button
                        type="button"
                        className="md:hidden p-1 hover:bg-gray-50 rounded-full transition-colors duration-200 flex items-center justify-center"
                        onClick={() => onAuthClick()}
                        aria-label="Sign in"
                      >
                        <User
                          size={16}
                          className="sm:w-5 sm:h-5 md:w-6 md:h-6 text-black"
                        />
                      </button>
                    </>
                  )}
                </div>

                {/* ADMIN */}
                {user?.isAdmin && (
                  <button
                    type="button"
                    onClick={onOpenAdminDashboard}
                    className="p-1 sm:p-2 hover:bg-gray-50 rounded-full transition-colors duration-200"
                    title="Admin Dashboard"
                    aria-label="Open Admin Dashboard"
                  >
                    <LayoutDashboard
                      size={16}
                      className="sm:w-5 sm:h-5 md:w-6 md:h-6 text-black"
                    />
                  </button>
                )}

                {/* WISHLIST */}
                <button
                  type="button"
                  onClick={onOpenWishlist}
                  data-wishlist-button
                  className="hidden lg:flex relative p-1 sm:p-2 hover:bg-gray-50 rounded-full transition-colors duration-200 items-center justify-center"
                  aria-label="Open wishlist"
                >
                  <Heart
                    size={16}
                    className="sm:w-5 sm:h-5 md:w-6 md:h-6 text-black"
                  />

                  {wishlistCount > 0 && (
                    <span
                      className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs rounded-full w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 flex items-center justify-center font-medium"
                      style={{ fontSize: '10px' }}
                    >
                      {wishlistCount}
                    </span>
                  )}
                </button>

                {/* CART */}
                <button
                  type="button"
                  onClick={onOpenCart}
                  data-cart-button
                  className="hidden lg:flex relative p-1 sm:p-2 hover:bg-gray-50 rounded-full transition-colors duration-200 items-center justify-center"
                  aria-label="Open cart"
                >
                  <ShoppingBag
                    size={16}
                    className="sm:w-5 sm:h-5 md:w-6 md:h-6 text-black"
                  />

                  {cartItemsCount > 0 && (
                    <span
                      className="absolute -top-0.5 -right-0.5 bg-black text-white text-xs rounded-full w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 flex items-center justify-center font-medium"
                      style={{ fontSize: '10px' }}
                    >
                      {cartItemsCount}
                    </span>
                  )}
                </button>

              </div>
            </div>
          </header>

          {/* =====================================================
              COLLECTION BODY
          ===================================================== */}

          <div className="pt-16 sm:pt-20 md:pt-24 px-4 sm:px-8 md:px-12 pb-24 lg:pb-16">

            <h1
              className="font-[100] uppercase leading-[0.9] tracking-tight text-black mb-2"
              style={{
                fontFamily: FONT,
                fontSize: 'clamp(2rem, 7vw, 4.5rem)',
              }}
            >
              {banner.title}
            </h1>

            <p className="text-sm text-gray-500 font-light tracking-wide mb-8 md:mb-12">
              {banner.products.length}{' '}
              {banner.products.length === 1
                ? 'item'
                : 'items'}
            </p>

            {banner.products.length === 0 ? (
              <div className="py-24 text-center">
                <p className="text-gray-500 font-light">
                  No products are linked to this collection yet.
                </p>
              </div>
            ) : (
              <ProductGrid
                products={banner.products}
                onAddToCart={onAddToCart}
                onProductClick={onProductClick}
                formatPrice={formatPrice}
                onHover={setHoveredProduct}
              />
            )}

            <div className="h-0 md:h-[1.65cm]" />
          </div>

        </div>
      </div>

      {/* =====================================================
          FIXED FOOTER SLIDE-UP WRAPPER
      ===================================================== */}
      <div
  className={`fixed bottom-14 lg:bottom-0 left-0 right-0 z-[55] transition-transform duration-300 ${
    showFooter ? 'translate-y-0' : 'translate-y-full'
  }`}
>
  <ShopFooter />
</div>

      {/* =====================================================
          HOVER PRODUCT TOOLTIP
      ===================================================== */}

      {hoveredProduct && (
        <div
          className="fixed pointer-events-none z-[55] bg-white px-3 py-2 text-sm font-medium tracking-wide text-black border border-black"
          style={{
            left: mousePosition.x + 15,
            top: mousePosition.y - 10,
            fontFamily: FONT,
          }}
        >
          {hoveredProduct.name.toUpperCase()}
        </div>
      )}
    </>
  );
};

export default BannerCollection;