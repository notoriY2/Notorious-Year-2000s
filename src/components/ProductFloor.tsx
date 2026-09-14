// src/components/ProductFloor.tsx

import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
} from 'react';

import {
  ShoppingBag,
  User,
  Grid3X3,
  Sparkles,
  Heart,
  LayoutDashboard,
  Search,
} from 'lucide-react';

import {
  Product,
  CartItem,
} from '../types/Product';

import SearchOverlay from './SearchOverlay';
import ProductItem from './ProductItem';
import ProductGrid from './ProductGrid';
import CurrencySelector from './CurrencySelector';
import PromoBanner from './PromoBanner';
import AnnouncementBar from './AnnouncementBar';
import HeroSection from './HeroSection';

import {
  getStoreSettings,
  type StoreSettings,
} from '../data/storeSettings';

import { Currency } from '../hooks/useCurrency';
import { User as UserType } from '../hooks/useAuth';
import { useBanners } from '../hooks/useBanners';
import { StorefrontBanner } from '../data/banners';
import ShopFooter from './ShopFooter';
import { FLOOR_LAYOUT } from '../data/floorLayout';

interface ProductFloorProps {
  products: Product[];
  cartItems: CartItem[];
  isLoading?: boolean;

  onAddToCart: (
    product: Product
  ) => void;

  onOpenCart: () => void;

  onProductClick: (
    product: Product
  ) => void;

  currencies: Currency[];

  selectedCurrency: Currency;

  onCurrencyChange: (
    currency: Currency
  ) => void;

  formatPrice: (
    price: number
  ) => string;

  user: UserType | null;

  onAuthClick: (message?: string) => void;

  onSignOut: () => void;

  wishlistItems: Product[];

  onToggleWishlist: (
    product: Product
  ) => void;

  onOpenWishlist: () => void;

  onOpenAdminDashboard: () => void;

  onOpenMyAccount: () => void;

  // Opens the full-page BannerCollection overlay for the clicked
  // banner. Forwarded straight through to every <PromoBanner>.
  onBannerClick: (
    banner: StorefrontBanner
  ) => void;

  // Opens the hero section's product collection.
  onHeroClick?: (
    productIds: string[],
    title: string
  ) => void;

  viewMode: 'floor' | 'grid';
  onViewModeChange: (mode: 'floor' | 'grid') => void;
}

const SKELETON_COUNT = 18;

const ProductFloor: React.FC<ProductFloorProps> = ({
  products,
  cartItems,
  isLoading = false,
  onAddToCart,
  onOpenCart,
  onProductClick,
  currencies,
  selectedCurrency,
  onCurrencyChange,
  formatPrice,
  user,
  onAuthClick,
  wishlistItems,
  onOpenWishlist,
  onOpenAdminDashboard,
  onOpenMyAccount,
  onBannerClick,
  onHeroClick,
  viewMode,
  onViewModeChange,
}) => {
  const parseVh = (calcStr: string): number => {
  const match = calcStr.match(/(-?\d+(\.\d+)?)[sdl]?vh/);
  return match ? parseFloat(match[1]) : 0;
};

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  /* =========================================================
     BASIC COUNTS
  ========================================================= */

  const totalItems = cartItems.reduce(
    (sum, item) =>
      sum + item.quantity,
    0
  );

  

  const wishlistCount =
    wishlistItems.length;

  /* =========================================================
     BANNERS
  ========================================================= */

  const { banners } = useBanners();

  /* =========================================================
     STOREFRONT SETTINGS
  ========================================================= */

  const [
    storeSettings,
    setStoreSettings,
  ] = useState<StoreSettings | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadStoreSettings = async () => {
      try {
        const settings =
          await getStoreSettings();

        if (!cancelled) {
          setStoreSettings(settings);
        }
      } catch (error) {
        console.error(
          'Failed to load storefront settings:',
          error
        );
      }
    };

    void loadStoreSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  /* =========================================================
     STATE
  ========================================================= */

  const [
    hoveredProduct,
    setHoveredProduct,
  ] = useState<Product | null>(
    null
  );

  const [
    mousePosition,
    setMousePosition,
  ] = useState({
    x: 0,
    y: 0,
  });

  const [
    visibleProducts,
    setVisibleProducts,
  ] = useState<Product[]>([]);

  const [
    showFooter,
    setShowFooter,
  ] = useState(false);

  /* =========================================================
     REFS
  ========================================================= */

  const animationTimersRef =
    useRef<number[]>([]);

  /* =========================================================
     DEDUPLICATE PRODUCTS
  ========================================================= */

  const uniqueProducts =
    useMemo(() => {
      const seen =
        new Set<string>();

      return products.filter(
        (product) => {
          if (!product?.id) {
            return false;
          }

          if (
            seen.has(product.id)
          ) {
            return false;
          }

          seen.add(product.id);

          return true;
        }
      );
    }, [products]);

  /* =========================================================
     FLOOR-ELIGIBLE PRODUCTS
  ========================================================= */

  const floorEligibleProducts =
    useMemo(
      () =>
        uniqueProducts.filter(
          (product) =>
            product.showOnFloor !== false
        ),
      [uniqueProducts]
    );

  /* =========================================================
     FEATURED PRODUCTS
  ========================================================= */

  const featuredProducts =
    useMemo(() => {
      const settings =
        storeSettings?.featured_products;

      if (
        !settings?.enabled ||
        !settings.product_ids?.length
      ) {
        return [];
      }

      const productsById =
        new Map(
          uniqueProducts.map(
            (product) => [
              product.id,
              product,
            ]
          )
        );

      return settings.product_ids
        .map(
          (id) =>
            productsById.get(id)
        )
        .filter(
          (
            product
          ): product is Product =>
            Boolean(product)
        );
    }, [
      storeSettings,
      uniqueProducts,
    ]);

  /* =========================================================
     ANIMATE PRODUCTS INTO VIEW
  ========================================================= */

  useEffect(() => {
    animationTimersRef.current.forEach((timer) => {
      window.clearTimeout(timer);
    });

    animationTimersRef.current = [];
    setVisibleProducts([]);

    const startTimer = window.setTimeout(() => {
      floorEligibleProducts.forEach((product, index) => {
        const timer = window.setTimeout(() => {
          setVisibleProducts((previous) => {
            if (previous.some((item) => item.id === product.id)) {
              return previous;
            }
            return [...previous, product];
          });
        }, index * 40);

        animationTimersRef.current.push(timer);
      });
    }, 100);

    animationTimersRef.current.push(startTimer);

    return () => {
      animationTimersRef.current.forEach((timer) => {
        window.clearTimeout(timer);
      });
      animationTimersRef.current = [];
    };
  }, [floorEligibleProducts]);

  /* =========================================================
     WINDOW RESIZE (Optimized to prevent premature flushing)
  ========================================================= */

  useEffect(() => {
    let resizeTimer: number | null = null;

    const handleResize = () => {
      if (resizeTimer !== null) {
        window.clearTimeout(resizeTimer);
      }

      resizeTimer = window.setTimeout(() => {
        // Keep resize handling lightweight without disrupting entrance animations
      }, 100);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimer !== null) {
        window.clearTimeout(resizeTimer);
      }
    };
  }, []);

  /* =========================================================
     FOOTER VISIBILITY
  ========================================================= */

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const isNearBottom = currentScrollY + windowHeight >= documentHeight - 100;
      setShowFooter(isNearBottom);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  /* =========================================================
     MOUSE
  ========================================================= */

  const handleMouseMove = (
    event: React.MouseEvent
  ) => {
    setMousePosition({
      x: event.clientX,
      y: event.clientY,
    });
  };

  const handleProductHover = (
    product: Product | null
  ) => {
    setHoveredProduct(
      product
    );
  };

  /* =========================================================
     FLOOR HEIGHT
  ========================================================= */

  const desktopRows =
    Math.ceil(
      floorEligibleProducts.length / 6
    );

  const mobileRows =
    Math.ceil(
      floorEligibleProducts.length / 3
    );

    const desktopHeightVh = Math.max(
  150,
  Math.max(0, ...floorEligibleProducts.map(p => parseVh(p.position.top))) + 40
);

  const mobileHeightVh = Math.max(
  55,
  Math.max(0, ...floorEligibleProducts.map(p => parseVh(p.mobilePosition?.top ?? p.position.top))) + 28
);

  /* =========================================================
     HERO CTA
  ========================================================= */

  const handleHeroClick = () => {
    const productIds =
      storeSettings?.hero_section
        ?.product_ids ?? [];

    const title =
      storeSettings?.hero_section
        ?.headline ?? '';

    if (onHeroClick) {
      onHeroClick(productIds, title);
    }
  };

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div
      className="min-h-screen bg-white relative overflow-hidden pt-[64px] sm:pt-[76px] md:pt-[88px]"
      onMouseMove={
        handleMouseMove
      }
    >
      {/* =====================================================
          ANNOUNCEMENT BAR
      ===================================================== */}

      <AnnouncementBar />

      {/* =====================================================
          HEADER
      ===================================================== */}

      <header
        className="fixed top-0 left-0 right-0 z-40 bg-white bg-opacity-95 backdrop-blur-sm border-b border-gray-100 px-2 sm:px-4 md:px-6"
      >
        <div className="relative flex items-center justify-between py-2 sm:py-4 md:py-6 max-w-7xl mx-auto">

          {/* BRAND */}

          <a
            href="/"
            aria-label="Go to home"
            className="flex items-center space-x-1 sm:space-x-2 md:space-x-3 cursor-pointer"
          >
            <img
              src="/logo/13 (1).png"
              alt="Notorious Y2"
              className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 object-contain"
            />

            <h1
              className="hidden sm:block text-sm sm:text-base md:text-lg lg:text-xl font-light tracking-[0.15em] sm:tracking-[0.2em] md:tracking-[0.3em] text-black"
              style={{
                fontFamily:
                  'Helvetica Neue, Arial, sans-serif',
                fontWeight: 100,
              }}
            >
              Notorious.Y2
            </h1>

            <h1
              className="sm:hidden text-sm font-light tracking-[0.15em] text-black"
              style={{
                fontFamily:
                  'Helvetica Neue, Arial, sans-serif',
                fontWeight: 100,
              }}
            >
              Y2
            </h1>
          </a>

          {/* MOBILE FLOOR/GRID TOGGLE — centered in header */}
          <div className="lg:hidden absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center bg-gray-100 rounded-full p-1">
            <button
              type="button"
              onClick={() => onViewModeChange('floor')}
              aria-label="Floor view"
              className={`p-2 rounded-full transition-all duration-200 ${
                viewMode === 'floor' ? 'bg-white text-black shadow-sm' : 'text-gray-500'
              }`}
            >
              <Sparkles size={16} />
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('grid')}
              aria-label="Grid view"
              className={`p-2 rounded-full transition-all duration-200 ${
                viewMode === 'grid' ? 'bg-black text-white shadow-sm' : 'text-gray-500'
              }`}
            >
              <Grid3X3 size={16} />
            </button>
          </div>

          {/* HEADER ACTIONS */}

          <div className="flex items-center space-x-1 sm:space-x-2 md:space-x-4">

            {/* CURRENCY */}

            <CurrencySelector
              currencies={
                currencies
              }
              selectedCurrency={
                selectedCurrency
              }
              onCurrencyChange={
                onCurrencyChange
              }
            />

            <button
  type="button"
  onClick={() => setIsSearchOpen(true)}
  className="p-1 sm:p-2 hover:bg-gray-50 rounded-full transition-colors duration-200"
  aria-label="Search products"
>
  <Search size={18} className="sm:w-5 sm:h-5 text-black" />
</button>

            {/* DESKTOP VIEW TOGGLE */}

            <div className="hidden lg:flex items-center bg-gray-100 rounded-lg p-1">
              <button
                type="button"
                onClick={() =>
                  onViewModeChange(
                    'floor'
                  )
                }
                className={`flex items-center space-x-2 px-2 py-1 rounded-md text-xs font-medium transition-all duration-200 ${
                  viewMode ===
                  'floor'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-gray-600 hover:text-black'
                }`}
              >
                <Sparkles
                  size={14}
                />

                <span>
                  FLOOR
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onViewModeChange(
                    'grid'
                  )
                }
                className={`flex items-center space-x-2 px-2 py-1 rounded-md text-xs font-medium transition-all duration-200 ${
                  viewMode ===
                  'grid'
                    ? 'bg-black text-white shadow-sm'
                    : 'text-gray-600 hover:text-black'
                }`}
              >
                <Grid3X3
                  size={14}
                />

                <span>
                  GRID
                </span>
              </button>
            </div>

            {/* ACCOUNT */}
            <div className="hidden lg:flex items-center">
              {user ? (
                <button
                  type="button"
                  onClick={onOpenMyAccount}
                  className="p-1 hover:bg-gray-50 rounded-full transition-colors duration-200"
                  title="My Account"
                  aria-label="Open My Account"
                >
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name || 'Account'}
                      className="w-6 h-6 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-[10px] font-light">
                      {user.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  className="flex items-center space-x-1 px-3 py-1.5 text-xs hover:bg-gray-50 rounded-lg transition-colors duration-200"
                  onClick={() => onAuthClick()}
                >
                  <User size={16} />
                  <span>Sign In</span>
                </button>
              )}
            </div>

            {/* ADMIN */}

            {user?.isAdmin && (
              <button
                type="button"
                onClick={
                  onOpenAdminDashboard
                }
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
              className="hidden lg:flex relative p-2 hover:bg-gray-50 rounded-full transition-colors duration-200 items-center justify-center"
              aria-label="Open wishlist"
            >
              <Heart
                size={20}
                className="text-black"
              />

              {wishlistCount > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs rounded-full w-4 h-4 md:w-5 md:h-5 flex items-center justify-center font-medium"
                  style={{
                    fontSize: '10px',
                  }}
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
              className="hidden lg:flex relative p-2 hover:bg-gray-50 rounded-full transition-colors duration-200 items-center justify-center"
              aria-label="Open cart"
            >
              <ShoppingBag
                size={20}
                className="text-black"
              />

              {totalItems > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 bg-black text-white text-xs rounded-full w-4 h-4 md:w-5 md:h-5 flex items-center justify-center font-medium"
                  style={{
                    fontSize: '10px',
                  }}
                >
                  {totalItems}
                </span>
              )}
            </button>

          </div>
        </div>
      </header>

      {/* =====================================================
          PRODUCT FLOOR
      ===================================================== */}

      <div
  className={`pt-0 relative ${
    viewMode ===
    'floor'
      ? 'pb-28 sm:pb-48'
      : 'pb-12 sm:pb-16'
  }`}
>
        {/* BACKGROUND */}

        <div
          className={`absolute inset-0 ${
            viewMode ===
            'floor'
              ? 'bg-gradient-to-b from-gray-50/30 to-white'
              : 'bg-white'
          }`}
        />

{isLoading && (
  <div className="fixed inset-0 z-20 flex flex-col items-center justify-center px-6 text-center bg-transparent pointer-events-none">
    <div className="relative w-28 h-28 sm:w-36 sm:h-36 mb-8">
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 w-full h-full animate-spin"
        style={{ animationDuration: '2.4s' }}
      >
        <circle
          cx="50" cy="50" r="46"
          fill="none"
          stroke="#C44D2B"
          strokeWidth="3"
          strokeDasharray="10 8"
          strokeLinecap="round"
        />
      </svg>
      <img
        src="/logo/13 (1).png"
        alt="Notorious Y2"
        className="absolute inset-0 m-auto w-[72%] h-[72%] object-contain"
      />
    </div>
    <p className="text-xs text-gray-500 tracking-[0.35em] font-dark">
      LOADING....
    </p>
  </div>
)}

{viewMode === 'floor' ? (
          <div className="relative z-10">

            {/* HERO */}

            <HeroSection products={uniqueProducts} onHeroClick={handleHeroClick} />

            {/* PROMOTIONAL BANNERS */}

            {banners.length > 0 && (
              <div className="relative">
                {banners.map(
                  (banner) => (
                    <PromoBanner
                      key={
                        banner.id
                      }
                      banner={
                        banner
                      }
                      onBannerClick={
                        onBannerClick
                      }
                    />
                  )
                )}
              </div>
            )}

            {/* FEATURED PRODUCTS */}

            {featuredProducts.length >
              0 && (
              <section className="relative bg-white border-y border-gray-100 py-10 sm:py-14 md:py-16">

                <div className="px-4 sm:px-8 md:px-12 mb-6 sm:mb-8">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-gray-400 mb-2">
                        NOTORIOUS.Y2
                      </p>

                      <h2 className="text-2xl sm:text-3xl md:text-4xl font-light tracking-tight text-black">
                        Featured
                      </h2>
                    </div>

                    <span className="text-[10px] sm:text-xs uppercase tracking-[0.15em] text-gray-400">
                      {featuredProducts.length}{' '}
                      {featuredProducts.length ===
                      1
                        ? 'Piece'
                        : 'Pieces'}
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto px-4 sm:px-8 md:px-12">
                  <div className="flex gap-4 sm:gap-6 md:gap-8 min-w-max pb-2">

                    {featuredProducts.map(
                      (product) => (
                        <button
                          key={
                            product.id
                          }
                          type="button"
                          onClick={() =>
                            onProductClick(
                              product
                          )
                        }
                        className="group relative flex-shrink-0 w-36 sm:w-44 md:w-52 text-left"
                        >
                          <div className="aspect-[3/4] bg-gray-50 overflow-hidden">
                            <img
                              src={
                                product.images?.[0] ||
                                product.image
                            }
                            alt={
                              product.name
                            }
                            className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-[1.03]"
                          />
                        </div>

                        <div className="pt-3">
                            <p className="text-xs sm:text-sm text-black truncate">
                              {
                                product.name
                            }
                            </p>

                            <p className="mt-1 text-xs text-gray-400">
                              {formatPrice(
                                product.price
                              )}
                            </p>
                        </div>
                      </button>
                    )
                  )}

                </div>
              </div>
            </section>
          )}

          {/* PRODUCT FLOOR */}

          <div
  className="relative w-full px-0 product-floor-container mb-4 md:mb-6"
  style={{
    '--floor-h-mobile': `${mobileHeightVh}dvh`,
    '--floor-h-desktop': `${desktopHeightVh}dvh`,
  } as React.CSSProperties}
>
              {isLoading && visibleProducts.length === 0 && (  <>    {FLOOR_LAYOUT.slice(0, SKELETON_COUNT).map((slot, index) => (      <div        key={`skeleton-${index}`}        className="absolute bg-gray-100 animate-pulse rounded-lg"        style={{          top: slot.position.top,          left: slot.position.left,          transform: `translate(-17%, 0) rotate(${slot.rotation}deg) scale(${slot.scale * 0.8})`,          zIndex: slot.zIndex,          width: '90px',          height: '120px',        }}      />    ))}  </>)}
              {visibleProducts.map(
                (product) => (
                  <ProductItem
                    key={
                      product.id
                    }
                    product={
                      product
                    }
                    onAddToCart={
                      onAddToCart
                    }
                    onProductClick={
                      onProductClick
                    }
                    onHover={
                      handleProductHover
                    }
                />
              )
            )}
          </div>
          </div>
        ) : (
          <div
            className="px-0 mb-[49px] md:mb-[calc(50px+0.37cm)]"
          >
            
            <ProductGrid
              products={
                visibleProducts
              }
              onAddToCart={
                onAddToCart
              }
              onProductClick={
                onProductClick
              }
              formatPrice={
                formatPrice
              }
              onHover={
                handleProductHover
              }
            />
          </div>
        )}
      </div>

      {/* =====================================================
          CURSOR PRODUCT TOOLTIP
      ===================================================== */}

      {hoveredProduct && (
        <div
          className="fixed pointer-events-none z-50 bg-white px-3 py-2 text-sm font-light tracking-[0.2em] text-black border border-black"
          style={{
            left:
              mousePosition.x +
              15,
            top:
              mousePosition.y -
              10,
            fontFamily:
              'Helvetica Neue, Arial, sans-serif',
            fontWeight: 100,
          }}
        >
          {hoveredProduct.name.toUpperCase()}
        </div>
    )}

      {/* =====================================================
          FOOTER
      ===================================================== */}
      <div
        className={`fixed bottom-14 lg:bottom-0 left-0 right-0 z-30 transition-transform duration-300 ${
          showFooter ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <ShopFooter />
      </div>

      <SearchOverlay
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        products={uniqueProducts}
        onAddToCart={onAddToCart}
        onProductClick={onProductClick}
        formatPrice={formatPrice}
      />
    </div>
  );
};

export default ProductFloor;