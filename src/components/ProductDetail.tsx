// src/components/ProductDetail.tsx
import React, { useState, useEffect } from 'react';
import {
  Heart,
  Facebook,
  Instagram,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  User,
  LayoutDashboard,
} from 'lucide-react';

import { Product } from '../types/Product';
import { fetchRecommendationPool } from '../hooks/useProducts';
import ImageGallery from './ImageGallery';
import CurrencySelector from './CurrencySelector';
import { Currency } from '../hooks/useCurrency';
import { User as UserType } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { useSwipeToDismiss } from '../hooks/useSwipeToDismiss';
import { notifyWhenInStock } from '../data/stockNotifications';
import SizeGuideModal from './SizeGuideModal';
import { optimizeImage } from '../lib/imageOptimizer';

import ShopFooter from './ShopFooter';

interface ProductDetailProps {
  product: Product | null;
  allProducts: Product[];
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (product: Product, size?: string) => void;
  formatPrice: (price: number) => string;
  onToggleWishlist: (product: Product) => void;
  isInWishlist: (productId: string) => boolean;
  currencies: Currency[];
  selectedCurrency: Currency;
  onCurrencyChange: (currency: Currency) => void;
  user: UserType | null;
  onAuthClick: (message?: string) => void;
  onSignOut: () => void;
  wishlistItems: Product[];
  cartItems: any[];
  isCartOpen: boolean;
  onOpenCart: () => void;
  onCloseCart: () => void;
  onUpdateCartQuantity: (uniqueId: string, quantity: number) => void;
  onRemoveCartItem: (uniqueId: string) => void;
  onOpenWishlist: () => void;
  cartItemsCount: number;
  onProductClick: (product: Product) => void;
  onOpenAdminDashboard: () => void;
  onOpenMyAccount: () => void;
}

/**
 * Picks the default size to show as selected when a product first
 * loads (or changes). Prefers the first IN-STOCK size so we don't
 * default customers onto a size they can't actually buy; falls back
 * to the first size at all if every size is out of stock, and to an
 * empty string if the product has no size data yet.
 */
const getDefaultSize = (product: Product | null): string => {
  if (!product?.sizes || product.sizes.length === 0) {
    return '';
  }

  const firstInStock = product.sizes.find(
    (sizeOption) => sizeOption.available > 0
  );

  return (firstInStock ?? product.sizes[0]).size;
};

const ProductDetail: React.FC<ProductDetailProps> = ({
  product,
  allProducts,
  isOpen,
  onClose,
  onAddToCart,
  formatPrice,
  onToggleWishlist,
  isInWishlist,
  currencies,
  selectedCurrency,
  onCurrencyChange,
  user,
  onAuthClick,
  wishlistItems,
  onOpenCart,
  onOpenWishlist,
  cartItemsCount,
  onProductClick,
  onOpenAdminDashboard,
  onOpenMyAccount,
}) => {
  const wishlistCount = wishlistItems.length;

  /*
   * The ProductDetail header has the same FLOOR / GRID controls
   * as the main store.
   *
   * These are kept locally because ProductDetail does not receive
   * a setViewMode callback from its parent.
   */
  const [selectedSize, setSelectedSize] = useState(
    getDefaultSize(product)
  );

  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const [notifySize, setNotifySize] = useState<string | null>(null);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [notifySent, setNotifySent] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [hoveredProduct, setHoveredProduct] = useState<Product | null>(null);
  const [currentRecommendationPage, setCurrentRecommendationPage] =
    useState(0);
  const [addToCartSuccess, setAddToCartSuccess] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const [mobileImageIndex, setMobileImageIndex] = useState(0);

  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  const [showFooter, setShowFooter] = useState(false);
  const [barVisible, setBarVisible] = useState(false);

  // Semantic ("AI") recommendations — falls back to the plain
  // same-category recommendations below when there are no matches
  // yet (e.g. embeddings haven't been generated for this catalog).
  const [semanticRecs] = useState<Product[] | null>(null);
  const [recommendationPool, setRecommendationPool] = useState<Product[]>([]);

  useEffect(() => {
    let cancelled = false;

    fetchRecommendationPool().then(list => {
      if (!cancelled) setRecommendationPool(list);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  /*useEffect(() => {
    if (!product) return;
    let cancelled = false;
    getSemanticRecommendations(product.id).then(recs => {
      if (!cancelled) setSemanticRecs(recs);
    });
    return () => {
      cancelled = true;
    };
  }, [product?.id]);*/

  useEffect(() => {
    const t = setTimeout(() => setBarVisible(true), 50);
    return () => clearTimeout(t);
  }, [product?.id]);

  const { dragY: heroDragY, onTouchStart: heroTouchStart, onTouchMove: heroTouchMove, onTouchEnd: heroTouchEnd } = 
    useSwipeToDismiss(onClose, 100);

  useEffect(() => {
  if (!isOpen) return;

  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  return () => {
    document.body.style.overflow = previousOverflow;
  };
}, [isOpen]);

  useEffect(() => {
  const el = scrollContainerRef.current;
  if (!el) return;

  const handleScroll = () => {
    const isNearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 100;
    setShowFooter(isNearBottom);
  };

  el.addEventListener('scroll', handleScroll, { passive: true });

  return () => el.removeEventListener('scroll', handleScroll);
}, [product?.id]);
  
  React.useEffect(() => {
    setMobileImageIndex(0);
  }, [product?.id]);

  React.useEffect(() => {
    if (product) {
      setSelectedSize(getDefaultSize(product));
      setQuantity(1);
      setCurrentRecommendationPage(0);
      // Reset the notify-me capture form when the product changes so
      // it doesn't carry a stale size/email over to a new product.
      setNotifySize(null);
      setNotifyEmail('');
      setNotifySent(false);
    }
  }, [product]);

  /*
   * VIEW TRACKING
   *
   * Fire-and-forget insert into product_views whenever a product is
   * opened. This is intentionally not awaited and never blocks
   * render — a failed insert here should never affect the shopping
   * experience. The bump_product_views trigger (Phase 0) picks this
   * up automatically and increments products.views, which is what
   * drives conversion_rate in the admin analytics.
   */
  React.useEffect(() => {
    if (!isOpen || !product) {
      return;
    }

    supabase
      .from('product_views')
      .insert({
        product_id: product.id,
        user_id: user?.id ?? null,
      })
      .then(({ error }) => {
        if (error) {
          console.error(
            'Failed to record product view:',
            error
          );
        }
      });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, product?.id]);

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePosition({
      x: e.clientX,
      y: e.clientY,
    });
  };

  if (!isOpen || !product) return null;

  /**
   * images[0] is the main/floor image.
   * Everything from index 1 onward is a supporting image.
   *
   * The product detail page uses supporting images first.
   */
  const getProductImages = () => {
    const supportingImages =
      product.images && product.images.length > 1
        ? product.images.slice(1)
        : [];

    if (supportingImages.length > 0) {
      const imgs = [...supportingImages];

      while (imgs.length < 4) {
        imgs.push(
          supportingImages[imgs.length % supportingImages.length]
        );
      }

      return imgs.slice(0, 4);
    }

    // Fallback if no supporting images exist.
    return [
      product.image,
      product.image,
      product.image,
      product.image,
    ];
  };

  const productImages = getProductImages();

  /**
   * Shared image logic for STYLE WITH and YOU MAY ALSO LIKE.
   *
   * Normal state:
   * first supporting image
   *
   * Hover:
   * second supporting image
   */
  const getCardImages = (item: Product) => {
    const supportingImages =
      item.images && item.images.length > 1
        ? item.images.slice(1)
        : [];

    const normalImage =
      supportingImages[0] ||
      item.images?.[0] ||
      item.image;

    const hoverImage =
      supportingImages[1] ||
      normalImage;

    return {
      normalImage,
      hoverImage,
    };
  };

  const getStyleWithProducts = () => {
    const pool = recommendationPool.length > 0 ? recommendationPool : allProducts;
    const homeProducts = pool.filter(
      (p) => p.id !== product.id
    );

    if (product.category === 'top') {
      return homeProducts
        .filter((p) => p.category !== 'top')
        .slice(0, 8);
    }

    if (product.category === 'bottom') {
      return homeProducts
        .filter((p) => p.category !== 'bottom')
        .slice(0, 8);
    }

    return homeProducts
      .filter((p) => p.category !== 'accessory')
      .slice(0, 8);
  };

  const getYouMayLikeProducts = () => {
    const pool = recommendationPool.length > 0 ? recommendationPool : allProducts;
    const homeProducts = pool.filter(
      (p) => p.id !== product.id
    );

    return homeProducts
      .filter((p) => p.category === product.category)
      .slice(0, 8);
  };

  const styleWithProducts = getStyleWithProducts();

  // Prefer AI/semantic matches when available; otherwise fall back to
  // the plain same-category list so this section is never empty.
  const allRecommendations =
    semanticRecs && semanticRecs.length > 0
      ? semanticRecs
      : getYouMayLikeProducts();

  const getProductFeatures = (currentProduct: Product) => {
    if (currentProduct.category === 'top') {
      return [
        'Heavyweight Cotton',
        'Waist-Length Fit',
        'Relaxed Fit',
        'Premium Construction',
        'Everyday Streetwear',
      ];
    }

    if (currentProduct.category === 'bottom') {
      return [
        '100% Cotton Plaid',
        'Relaxed Fit',
        '6 Pockets (2 Front, 2 Back, 2 Leg)',
        'Button Flap Front & Back Welt Pockets',
        'Cargo Pockets',
        'Drawstring Hem',
        'Exposed Button Fly',
      ];
    }

    return [
      'Premium Materials',
      'Adjustable',
      'One Size Fits Most',
      'Durable Construction',
      'Stylish Design',
    ];
  };

  const openGallery = (index: number) => {
    setSelectedImageIndex(index);
    setIsGalleryOpen(true);
  };

  const handleAddToCart = async () => {
    setIsAddingToCart(true);
    setAddToCartSuccess(false);

    await new Promise((resolve) =>
      setTimeout(resolve, 300)
    );

    for (let i = 0; i < quantity; i++) {
      onAddToCart(product, selectedSize);
    }

    setAddToCartSuccess(true);

    setTimeout(() => {
      setAddToCartSuccess(false);
    }, 2000);

    setIsAddingToCart(false);
  };

  const handleWishlistToggle = (productToToggle: Product) => {
    if (!user) {
      onAuthClick('Sign in to save items to your wishlist.');
      return;
    }
    onToggleWishlist(productToToggle);
  };

  const handleProductClick = (clickedProduct: Product) => {
  onProductClick(clickedProduct);
};

  const visibleItems = 4;

  /*
   * Number of recommendation pages.
   *
   * We calculate this from the actual number of recommendations
   * rather than hard-coding the value.
   */
  const maxSlides = Math.max(
    0,
    allRecommendations.length - visibleItems
  );

  const youMayLikeProducts = allRecommendations.slice(
    currentRecommendationPage,
    currentRecommendationPage + visibleItems
  );

  const nextRecommendations = () => {
    setCurrentRecommendationPage((prev) =>
      Math.min(prev + 1, maxSlides)
    );
  };

  const prevRecommendations = () => {
    setCurrentRecommendationPage((prev) =>
      Math.max(prev - 1, 0)
    );
  };

  // Real per-size availability, sourced from the product_inventory
  // join (see lib/mapProduct.ts). Falls back to an empty array so the
  // SIZE block below simply renders nothing if inventory data hasn't
  // loaded for some reason, rather than showing hardcoded sizes that
  // may not match what's actually in stock.
  const availableSizes = product.sizes ?? [];

  const isAddToCartDisabled =
    isAddingToCart ||
    product.soldOut ||
    (availableSizes.length > 0 &&
      !availableSizes.some(
        (sizeOption) =>
          sizeOption.size === selectedSize &&
          sizeOption.available > 0
      ));

  return (
    <>
      <div
        ref={scrollContainerRef}
        className="fixed inset-x-0 top-0 h-[100dvh] bg-white z-[55] overflow-y-auto"
        onMouseMove={handleMouseMove}
      >
        <div className="min-h-[100dvh] pt-[32px] sm:pt-[52px] md:pt-[72px]">

          {/* =====================================================
              HEADER
          ====================================================== */}

          <header
            className="fixed top-0 left-0 right-0 z-40 bg-white bg-opacity-95 backdrop-blur-sm border-b border-gray-100 px-2 sm:px-4 md:px-6"
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
                          src={user.avatar}
                          alt={user.name || 'Account'}
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
              PRODUCT CONTENT
          ====================================================== */}

          <div className="flex flex-col lg:flex-row">

            {/* PRODUCT IMAGES */}
            <div className="order-1 hidden lg:grid lg:flex-none lg:w-2/3 grid-cols-2 gap-0">
              {productImages.map((img, i) => (
                <div
                  key={i}
                  className="cursor-pointer"
                  onClick={() => openGallery(i)}
                  style={{ width: '100%', height: 'auto', aspectRatio: '4/6.4' }}
                >
                  <img
                    src={optimizeImage(img, 800)}
                    alt={`${product.name} - View ${i + 1}`}
                    className="w-full h-full object-cover"
                    loading={i === 0 ? 'eager' : 'lazy'}
                    decoding="async"
                    width="800"
                    height="1280"
                  />
                </div>
              ))}
            </div>

            {/* Mobile-only single image carousel */}
            <div 
              className="order-1 lg:hidden relative w-full touch-none"
              style={{
                aspectRatio: '3/4',
                transform: `translateY(${heroDragY}px)`,
                opacity: 1 - Math.min(heroDragY / 300, 0.6),
                transition: heroDragY === 0 ? 'transform 200ms ease-out, opacity 200ms ease-out' : 'none',
              }}
              onTouchStart={heroTouchStart}
              onTouchMove={heroTouchMove}
              onTouchEnd={heroTouchEnd}
            >
              <img
                src={optimizeImage(productImages[mobileImageIndex], 800)}
                alt={`${product.name} - View ${mobileImageIndex + 1}`}
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => openGallery(mobileImageIndex)}
                width="800"
                height="1067"
              />
              {productImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setMobileImageIndex(prev => (prev - 1 + productImages.length) % productImages.length)
                    }
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 flex items-center justify-center"
                    aria-label="Previous image"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setMobileImageIndex(prev => (prev + 1) % productImages.length)
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 flex items-center justify-center"
                    aria-label="Next image"
                  >
                    <ChevronRight size={18} />
                  </button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {productImages.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setMobileImageIndex(i)}
                        className={`w-1.5 h-1.5 rounded-full ${i === mobileImageIndex ? 'bg-black' : 'bg-black/30'}`}
                        aria-label={`Go to image ${i + 1}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* PRODUCT INFORMATION */}
            <div className="order-2 lg:order-2 lg:w-1/3 p-4 md:p-8 space-y-4 md:space-y-6">

              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-3 mb-2">
                    <h1
                      className="text-xl md:text-2xl font-light tracking-[0.1em] uppercase"
                      style={{
                        fontFamily:
                          'Helvetica Neue, Arial, sans-serif',
                        fontWeight: '300',
                      }}
                    >
                      {product.name.toUpperCase()}
                    </h1>

                    <button
                      type="button"
                      onClick={() =>
                        handleWishlistToggle(product)
                      }
                      className="p-2.5 sm:p-2 hover:bg-gray-50 rounded-full transition-colors duration-200"
                      aria-label="Toggle wishlist"
                    >
                      <Heart
                        size={24}
                        className={
                          isInWishlist(product.id)
                            ? 'text-red-500 fill-red-500'
                            : 'text-gray-600'
                        }
                      />
                    </button>
                  </div>

                  <p className="text-xl md:text-2xl font-light">
                    {formatPrice(product.price)}
                  </p>
                </div>
              </div>

              {/* FEATURES */}
              <div>
                <ul className="space-y-1 text-sm">
                  {getProductFeatures(product).map(
                    (feature, index) => (
                      <li
                        key={index}
                        className="flex items-start"
                      >
                        <span className="mr-2">•</span>
                        <span>{feature}</span>
                      </li>
                    )
                  )}
                </ul>
              </div>

              {/* SIZE */}
              {availableSizes.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-light tracking-wide text-sm md:text-base">
                      SIZE{' '}
                      <span className="font-normal">{selectedSize}</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowSizeGuide(true)}
                      className="text-xs text-gray-400 underline hover:text-black"
                    >
                      Size Guide
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-2">
                    {availableSizes.map((sizeOption) => {
                      const isOutOfStock = sizeOption.available <= 0;

                      return (
                        <div key={sizeOption.size} className="flex flex-col items-center">
                          <button
                            type="button"
                            disabled={isOutOfStock}
                            onClick={() => setSelectedSize(sizeOption.size)}
                            className={`px-3 py-2 text-center transition-colors text-sm border ${
                              isOutOfStock
                                ? 'text-gray-300 border-gray-200 line-through cursor-not-allowed'
                                : selectedSize === sizeOption.size
                                ? 'text-black font-medium bg-gray-100'
                                : 'text-gray-600 hover:text-black'
                            }`}
                          >
                            {sizeOption.size}
                          </button>

                          {isOutOfStock && (
                            <button
                              type="button"
                              onClick={() => {
                                setNotifySize(sizeOption.size);
                                setNotifySent(false);
                              }}
                              className="text-[10px] text-gray-400 hover:text-black underline mt-1"
                            >
                              Notify me
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {notifySize && (
                    <div className="mt-3 p-3 border border-gray-200 bg-gray-50 flex items-center gap-2">
                      {notifySent ? (
                        <p className="text-xs text-green-700">
                          We'll email you when size {notifySize} is back.
                        </p>
                      ) : (
                        <>
                          <input
                            type="email"
                            value={notifyEmail}
                            onChange={e => setNotifyEmail(e.target.value)}
                            placeholder="you@example.com"
                            className="flex-1 text-sm px-2 py-1.5 border border-gray-300 focus:outline-none focus:border-black"
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              if (!notifyEmail.trim() || !notifySize) return;
                              await notifyWhenInStock(product.id, notifySize, notifyEmail);
                              setNotifySent(true);
                            }}
                            className="px-3 py-1.5 bg-black text-white text-xs whitespace-nowrap"
                          >
                            Notify Me
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* QUANTITY */}
              <div>
                <h3 className="font-light mb-3 tracking-wide text-sm md:text-base">
                  QTY
                </h3>

                <div className="flex items-center space-x-4">
                  <button
                    type="button"
                    onClick={() =>
                      setQuantity(
                        Math.max(1, quantity - 1)
                      )
                    }
                    className="w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center border border-gray-300 hover:border-gray-400 transition-colors"
                  >
                    -
                  </button>

                  <span className="w-12 text-center font-medium text-sm md:text-base">
                    {quantity}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setQuantity(quantity + 1)
                    }
                    className="w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center border border-gray-300 hover:border-gray-400 transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* ADD TO CART */}
              <div className="relative">
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={isAddToCartDisabled}
                  className={`w-full py-3 md:py-4 font-light tracking-[0.2em] transition-all duration-300 border text-sm md:text-base transform ${
                    product.soldOut
                      ? 'bg-gray-100 text-gray-500 border-gray-200'
                      : addToCartSuccess
                      ? 'bg-green-500 text-white border-green-500'
                      : 'bg-black text-white border-black hover:bg-gray-800 hover:scale-105'
                  } ${
                    isAddToCartDisabled
                      ? 'cursor-not-allowed opacity-60'
                      : 'cursor-pointer'
                  } ${
                    isAddingToCart
                      ? 'animate-pulse'
                      : ''
                  }`}
                  style={{
                    fontFamily:
                      'Helvetica Neue, Arial, sans-serif',
                  }}
                >
                  {product.soldOut
                    ? 'SOLD OUT'
                    : addToCartSuccess
                    ? '✓ ADDED TO BAG'
                    : isAddingToCart
                    ? 'ADDING...'
                    : 'ADD TO BAG'}
                </button>

                {addToCartSuccess && (
                  <div className="absolute inset-0 bg-green-500 text-white flex items-center justify-center font-light tracking-[0.2em] text-sm md:text-base animate-bounce">
                    ✓ ADDED TO BAG
                  </div>
                )}
              </div>

              {/* SHARE */}
              <div className="flex items-center justify-center space-x-4 pt-4 border-t border-gray-100">
                <span className="text-sm text-gray-600 mr-2">
                  Share:
                </span>

                <button
                  type="button"
                  onClick={() =>
                    window.open(
                      `https://instagram.com/share?url=${encodeURIComponent(
                        window.location.href
                      )}`,
                      '_blank'
                    )
                  }
                  className="p-2 hover:bg-gray-50 rounded-full transition-colors duration-200"
                  aria-label="Share on Instagram"
                >
                  <Instagram
                    size={18}
                    className="text-pink-600"
                  />
                </button>

                <button
                  type="button"
                  onClick={() =>
                    window.open(
                      `https://facebook.com/sharer/sharer.php?u=${encodeURIComponent(
                        window.location.href
                      )}`,
                      '_blank'
                    )
                  }
                  className="p-2 hover:bg-gray-50 rounded-full transition-colors duration-200"
                  aria-label="Share on Facebook"
                >
                  <Facebook
                    size={18}
                    className="text-blue-600"
                  />
                </button>

                <button
                  type="button"
                  onClick={() =>
                    window.open(
                      `https://twitter.com/intent/tweet?url=${encodeURIComponent(
                        window.location.href
                      )}&text=Check out this ${encodeURIComponent(
                        product.name
                      )}`,
                      '_blank'
                    )
                  }
                  className="p-2 hover:bg-gray-50 rounded-full transition-colors duration-200"
                  aria-label="Share on Twitter"
                >
                  <svg
                    className="w-4 h-4 text-blue-400"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    window.open(
                      `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(
                        window.location.href
                      )}&description=Check out this ${encodeURIComponent(
                        product.name
                      )}`,
                      '_blank'
                    )
                  }
                  className="p-2 hover:bg-gray-50 rounded-full transition-colors duration-200"
                  aria-label="Share on Pinterest"
                >
                  <svg
                    className="w-4 h-4 text-red-500"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.174-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.402.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.357-.629-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24.009 12.017 24.009c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641.001.012.001z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* REMAINING IMAGES — mobile only, shown after purchase info */}
          <div className="order-3 lg:hidden grid grid-cols-2 gap-0 w-full">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="cursor-pointer"
                onClick={() => openGallery(i)}
                style={{ width: '100%', height: 'auto', aspectRatio: '4/6.4' }}
              >
                <img
                  src={optimizeImage(productImages[i], 800)}
                  alt={`${product.name} - View ${i + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                  width="800"
                  height="1280"
                />
              </div>
            ))}
          </div>

          {/* =====================================================
            STYLE WITH
          ====================================================== */}

          <div className="border-t border-gray-200 pt-8 md:pt-12 px-4 md:px-8">
            <h2
              className="text-lg md:text-xl font-light mb-6 md:mb-8 tracking-[0.2em]"
              style={{
                fontFamily:
                  'Helvetica Neue, Arial, sans-serif',
              }}
            >
              STYLE WITH
            </h2>

            <div className="flex md:grid md:grid-cols-4 gap-4 md:gap-8 overflow-x-auto snap-x snap-mandatory md:overflow-visible pb-2 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0">
              {styleWithProducts.map((relatedProduct) => {
                const {
                  normalImage,
                  hoverImage,
                } = getCardImages(relatedProduct);

                return (
                  <div
                    key={relatedProduct.id}
                    className="relative group cursor-pointer shrink-0 w-[46vw] sm:w-[46vw] md:w-auto snap-center"
                    onClick={() =>
                      handleProductClick(relatedProduct)
                    }
                    onMouseEnter={() =>
                      setHoveredProduct(relatedProduct)
                    }
                    onMouseLeave={() =>
                      setHoveredProduct(null)
                    }
                  >
                    <div
                      className="relative w-full overflow-hidden"
                      style={{
                        aspectRatio: '3/5.6',
                      }}
                    >
                      <img
                        src={optimizeImage(normalImage, 500)}
                        alt={relatedProduct.name}
                        loading="lazy"
                        decoding="async"
                        width="500"
                        height="933"
                        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300 opacity-100 group-hover:opacity-0"
                      />

                      <img
                        src={optimizeImage(hoverImage, 500)}
                        alt={`${relatedProduct.name} - Alternate`}
                        loading="lazy"
                        decoding="async"
                        width="500"
                        height="933"
                        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300 opacity-0 group-hover:opacity-100"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleWishlistToggle(
                          relatedProduct
                        );
                      }}
                      className="absolute top-2 right-2 md:top-4 md:right-4 p-1 md:p-2 hover:scale-110 transition-all duration-200"
                      aria-label="Toggle wishlist"
                    >
                      <Heart
                        size={16}
                        className="md:w-5 md:h-5"
                        style={{
                          color: isInWishlist(
                            relatedProduct.id
                          )
                            ? '#C44D2B'
                            : '#666',
                          fill: isInWishlist(
                            relatedProduct.id
                          )
                            ? '#C44D2B'
                            : 'none',
                        }}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* =====================================================
            YOU MAY ALSO LIKE
          ====================================================== */}

          <div className="border-t border-gray-200 pt-8 md:pt-12 pb-8 md:pb-16 px-4 md:px-8">
            <div className="flex items-center justify-between mb-6 md:mb-8">
              <h2
                className="text-lg md:text-xl font-light tracking-[0.2em]"
                style={{
                  fontFamily:
                    'Helvetica Neue, Arial, sans-serif',
                }}
              >
                YOU MAY ALSO LIKE
              </h2>

              <div className="flex items-center space-x-2 md:space-x-4">
                <button
                  type="button"
                  onClick={prevRecommendations}
                  disabled={currentRecommendationPage === 0}
                  className="p-2 border border-gray-300 hover:border-gray-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Previous recommendations"
                >
                  <ChevronLeft
                    size={16}
                    className="md:w-5 md:h-5"
                  />
                </button>

                <button
                  type="button"
                  onClick={nextRecommendations}
                  disabled={
                    currentRecommendationPage >=
                    maxSlides
                  }
                  className="p-2 border border-gray-300 hover:border-gray-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Next recommendations"
                >
                  <ChevronRight
                    size={16}
                    className="md:w-5 md:h-5"
                  />
                </button>
              </div>
            </div>

            <div className="flex md:grid md:grid-cols-4 gap-4 md:gap-8 overflow-x-auto snap-x snap-mandatory md:overflow-visible pb-2 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0">
              {youMayLikeProducts.map((relatedProduct) => {
                const {
                  normalImage,
                  hoverImage,
                } = getCardImages(relatedProduct);

                return (
                  <div
                    key={relatedProduct.id}
                    className="relative group cursor-pointer shrink-0 w-[46vw] sm:w-[46vw] md:w-auto snap-center"
                    onClick={() =>
                      handleProductClick(relatedProduct)
                    }
                    onMouseEnter={() =>
                      setHoveredProduct(relatedProduct)
                    }
                    onMouseLeave={() =>
                      setHoveredProduct(null)
                    }
                  >
                    <div
                      className="relative w-full overflow-hidden"
                      style={{
                        aspectRatio: '3/5.6',
                      }}
                    >
                      <img
                        src={optimizeImage(normalImage, 500)}
                        alt={relatedProduct.name}
                        loading="lazy"
                        decoding="async"
                        width="500"
                        height="933"
                        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300 opacity-100 group-hover:opacity-0"
                      />

                      <img
                        src={optimizeImage(hoverImage, 500)}
                        alt={`${relatedProduct.name} - Alternate`}
                        loading="lazy"
                        decoding="async"
                        width="500"
                        height="933"
                        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300 opacity-0 group-hover:opacity-100"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleWishlistToggle(
                          relatedProduct
                        );
                      }}
                      className="absolute top-2 right-2 md:top-4 md:right-4 p-1 md:p-2 hover:scale-110 transition-all duration-200"
                      aria-label="Toggle wishlist"
                    >
                      <Heart
                        size={16}
                        className="md:w-5 md:h-5"
                        style={{
                          color: isInWishlist(
                            relatedProduct.id
                          )
                            ? '#C44D2B'
                            : '#666',
                          fill: isInWishlist(
                            relatedProduct.id
                          )
                            ? '#C44D2B'
                            : 'none',
                        }}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

                    <div style={{ height: '3cm' }} />

          {/* =====================================================
              FOOTER
          ====================================================== */}

          <div
            className={`fixed bottom-14 lg:bottom-0 left-0 right-0 z-30 transition-transform duration-300 ${
              showFooter ? 'translate-y-0' : 'translate-y-full'
            }`}
          >
            <ShopFooter />
          </div>

        </div>
      </div>

      {/* MOBILE STICKY ADD TO BAG */}
      <div
        className="lg:hidden fixed bottom-14 left-0 right-0 z-50 bg-white border-t border-gray-200 px-4 py-3 flex items-center gap-3"
        style={{
          paddingBottom: '0.75rem',
          transform: barVisible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 300ms ease-out',
        }}
      >
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-gray-400 truncate">
            {product.name}
          </p>
          <p className="text-base font-medium">{formatPrice(product.price)}</p>
        </div>

        <button
          type="button"
          onClick={handleAddToCart}
          disabled={isAddToCartDisabled}
          className={`ml-auto flex-shrink-0 px-6 py-3 text-xs font-light tracking-[0.2em] uppercase transition-colors ${
            product.soldOut
              ? 'bg-gray-100 text-gray-500'
              : addToCartSuccess
              ? 'bg-green-500 text-white'
              : 'bg-black text-white hover:bg-gray-800'
          } ${isAddToCartDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          {product.soldOut ? 'SOLD OUT' : addToCartSuccess ? '✓ ADDED' : isAddingToCart ? 'ADDING...' : 'ADD TO BAG'}
        </button>
      </div>

      {/* Spacer so the sticky bar doesn't cover the footer's bottom content on mobile */}
      <div className="lg:hidden h-20" />

      {/* =====================================================
          HOVER PRODUCT TOOLTIP
      ====================================================== */}

      {hoveredProduct && (
        <div
          className="fixed pointer-events-none z-50 bg-white px-3 py-2 text-sm font-medium tracking-wide text-black border border-black"
          style={{
            left: mousePosition.x + 15,
            top: mousePosition.y - 10,
            fontFamily:
              'Helvetica Neue, Arial, sans-serif',
          }}
        >
          {hoveredProduct.name.toUpperCase()}
        </div>
      )}

      {/* =====================================================
          IMAGE GALLERY
      ====================================================== */}

      <ImageGallery
        images={productImages}
        productName={product.name}
        isOpen={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
        initialIndex={selectedImageIndex}
      />

      <SizeGuideModal isOpen={showSizeGuide} onClose={() => setShowSizeGuide(false)} />
    </>
  );
};

export default ProductDetail;