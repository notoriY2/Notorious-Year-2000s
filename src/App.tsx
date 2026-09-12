import {
  useEffect,
  useRef,
  useState,
  lazy,
  Suspense,
} from 'react';

import SplashScreen from './components/SplashScreen';
import ProductFloor from './components/ProductFloor';
import Cart from './components/Cart';
import AuthModal from './components/AuthModal';
import Wishlist from './components/Wishlist';
import BannerCollection from './components/BannerCollection';
import SupportChatWidget from './components/SupportChatWidget';
import { Routes, Route, useNavigate } from 'react-router-dom';

const AdminDashboardRoute = lazy(
  () => import('./routes/AdminDashboardRoute')
);
const ProductDetailRoute = lazy(() => import('./routes/ProductDetailRoute'));
const CheckoutRoute = lazy(() => import('./routes/CheckoutRoute'));
const MyAccountRoute = lazy(() => import('./routes/MyAccountRoute'));
const BannerCollectionRoute = lazy(() => import('./routes/BannerCollectionRoute'));

import { useCart } from './hooks/useCart';
import { useAuth } from './hooks/useAuth';
import { useCurrency } from './hooks/useCurrency';
import { useWishlist } from './hooks/useWishlist';
import { useProducts } from './hooks/useProducts';

import type { Product } from './types/Product';
import type { StorefrontBanner } from './data/banners';

import { trackEvent } from './lib/analytics';
import MobileTabBar from './components/MobileTabBar';

function App() {
  /* =========================================================
     UI STATE
  ========================================================= */

  const [showSplash, setShowSplash] = useState(
  () => !sessionStorage.getItem('ny2-splash-seen')
);

  const {
    products,
    isLoading: productsLoading,
  } = useProducts();

  const [viewMode, setViewMode] = useState<'floor' | 'grid'>('floor');

  const navigate = useNavigate();

  const [isCartOpen, setIsCartOpen] = useState(false);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const [
    authContextMessage,
    setAuthContextMessage,
  ] = useState<string | undefined>();

  const [isWishlistOpen, setIsWishlistOpen] = useState(false);

  /*
   * Hero collection remains local state because the hero section
   * is intentionally not routed.
   */
  const [heroBanner, setHeroBanner] =
    useState<StorefrontBanner | null>(null);

  const [isHeroCollectionOpen, setIsHeroCollectionOpen] =
    useState(false);

  /* =========================================================
     REFS
  ========================================================= */

  const cartRef = useRef<HTMLDivElement>(null);

  const wishlistRef = useRef<HTMLDivElement>(null);

  /* =========================================================
     DATA HOOKS
  ========================================================= */

  const {
    user,
    isLoading,
    signIn,
    signUp,
    signInWithProvider,
    signOut,
  } = useAuth();

  const {
    cartItems,
    addToCart,
    updateQuantity,
    removeItem,
    clearCart,
  } = useCart(user?.id ?? null);

  const {
    currencies,
    selectedCurrency,
    setSelectedCurrency,
    formatPrice,
  } = useCurrency();

  const {
    wishlistItems,
    toggleWishlist,
    removeFromWishlist,
    isInWishlist,
  } = useWishlist(user?.id ?? null);

  useEffect(() => {
    trackEvent('page_view');
  }, []);

  /* =========================================================
     SPLASH SCREEN
  ========================================================= */

  useEffect(() => {
  if (!showSplash) return;
  const t = window.setTimeout(() => {
    setShowSplash(false);
    sessionStorage.setItem('ny2-splash-seen', '1');
  }, 1200); // shortened from 3000ms, and only ever shown once per session
  return () => window.clearTimeout(t);
}, [showSplash]);

  /* =========================================================
     PRODUCT NAVIGATION
  ========================================================= */

  const handleProductClick = (product: Product) => {
    setIsCartOpen(false);
    setIsWishlistOpen(false);

    navigate(`/product/${product.slug ?? product.id}`);
  };

  /* =========================================================
     CART
  ========================================================= */

  const handleOpenCart = () => {
    setIsWishlistOpen(false);

    setIsCartOpen(true);
  };

  const handleCloseCart = () => {
    setIsCartOpen(false);
  };

  const handleCartProductClick = (product: Product) => {
    handleProductClick(product);
    setIsCartOpen(false);
  };

  /* =========================================================
     WISHLIST
  ========================================================= */

  const handleOpenWishlist = () => {
    setIsCartOpen(false);

    setIsWishlistOpen(true);
  };

  const handleCloseWishlist = () => {
    setIsWishlistOpen(false);
  };

  const handleWishlistProductClick = (product: Product) => {
    handleProductClick(product);
    setIsWishlistOpen(false);
  };

  /* =========================================================
     BANNER COLLECTION
  ========================================================= */

  const handleBannerClick = (
    banner: StorefrontBanner
  ) => {
    setIsCartOpen(false);
    setIsWishlistOpen(false);

    navigate(`/collection/${banner.id}`);
  };

  /* =========================================================
     HERO COLLECTION
  ========================================================= */

  const handleHeroClick = (
    productIds: string[],
    title: string
  ) => {
    const heroProducts = products.filter(
      (product) => productIds.includes(product.id)
    );

    if (heroProducts.length === 0) {
      return;
    }

    setIsCartOpen(false);
    setIsWishlistOpen(false);

    setHeroBanner({
      id: 'hero-section',
      title,
      image: '',
      position: 'Top',
      products: heroProducts,
      productIds,
    } as StorefrontBanner & {
      productIds: string[];
    });

    setIsHeroCollectionOpen(true);
  };

  const handleCloseHeroCollection = () => {
    setIsHeroCollectionOpen(false);
    setHeroBanner(null);
  };

  const handleHeroCollectionProductClick = (
    product: Product
  ) => {
    setIsHeroCollectionOpen(false);
    setHeroBanner(null);

    handleProductClick(product);
  };

  /* =========================================================
     CHECKOUT
  ========================================================= */

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      return;
    }

    setIsCartOpen(false);
    setIsWishlistOpen(false);

    navigate('/checkout');
  };

  /* =========================================================
     AUTH
  ========================================================= */

  const handleOpenAuth = (message?: string) => {
    setAuthContextMessage(message);
    setIsAuthModalOpen(true);
  };

  const handleCloseAuth = () => {
    setIsAuthModalOpen(false);
  };

  /* =========================================================
     ADMIN
  ========================================================= */

  const handleOpenAdminDashboard = () => {
    setIsCartOpen(false);
    setIsWishlistOpen(false);

    navigate('/admin');
  };

  /* =========================================================
     MY ACCOUNT
  ========================================================= */

  const handleOpenMyAccount = () => {
    setIsCartOpen(false);
    setIsWishlistOpen(false);

    navigate('/account');
  };

  /* =========================================================
     OUTSIDE CLICK HANDLER
  ========================================================= */

  useEffect(() => {
    const handleClickOutside = (
      event: MouseEvent
    ) => {
      const target = event.target as Node;

      if (
        isCartOpen &&
        cartRef.current &&
        !cartRef.current.contains(target)
      ) {
        const cartButton =
          document.querySelector(
            '[data-cart-button]'
          );

        if (
          !cartButton ||
          !cartButton.contains(target)
        ) {
          setIsCartOpen(false);
        }
      }

      if (
        isWishlistOpen &&
        wishlistRef.current &&
        !wishlistRef.current.contains(target)
      ) {
        const wishlistButton =
          document.querySelector(
            '[data-wishlist-button]'
          );

        if (
          !wishlistButton ||
          !wishlistButton.contains(target)
        ) {
          setIsWishlistOpen(false);
        }
      }
    };

    document.addEventListener(
      'mousedown',
      handleClickOutside
    );

    return () => {
      document.removeEventListener(
        'mousedown',
        handleClickOutside
      );
    };
  }, [
    isCartOpen,
    isWishlistOpen,
  ]);

  /* =========================================================
     CART COUNT
  ========================================================= */

  const cartItemsCount =
    cartItems.reduce(
      (total, item) =>
        total + item.quantity,
      0
    );

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <>
      <Routes>
        {/* =====================================================
            SHOP / HOME
        ===================================================== */}

        <Route
          path="/"
          element={
            <ProductFloor
              products={products}
              isLoading={productsLoading}
              cartItems={cartItems}
              onAddToCart={addToCart}
              onOpenCart={handleOpenCart}
              onProductClick={handleProductClick}
              currencies={currencies}
              selectedCurrency={selectedCurrency}
              onCurrencyChange={setSelectedCurrency}
              formatPrice={formatPrice}
              user={user}
              onAuthClick={handleOpenAuth}
              onSignOut={signOut}
              wishlistItems={wishlistItems}
              onToggleWishlist={toggleWishlist}
              onOpenWishlist={handleOpenWishlist}
              onOpenAdminDashboard={
                handleOpenAdminDashboard
              }
              onOpenMyAccount={
                handleOpenMyAccount
              }
              onBannerClick={handleBannerClick}
              onHeroClick={handleHeroClick}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
          }
        />

        {/* =====================================================
            PRODUCT DETAIL
        ===================================================== */}

        <Route
          path="/product/:slugOrId"
          element={
            <Suspense fallback={<div className="fixed inset-0 bg-white" />}>
              <ProductDetailRoute
                products={products}
                onAddToCart={addToCart}
                formatPrice={formatPrice}
                onToggleWishlist={toggleWishlist}
                isInWishlist={isInWishlist}
                currencies={currencies}
                selectedCurrency={selectedCurrency}
                onCurrencyChange={setSelectedCurrency}
                user={user}
                onAuthClick={handleOpenAuth}
                onSignOut={signOut}
                wishlistItems={wishlistItems}
                cartItems={cartItems}
                isCartOpen={isCartOpen}
                onOpenCart={handleOpenCart}
                onCloseCart={handleCloseCart}
                onUpdateCartQuantity={
                  updateQuantity
                }
                onRemoveCartItem={removeItem}
                onOpenWishlist={
                  handleOpenWishlist
                }
                cartItemsCount={cartItemsCount}
                onOpenAdminDashboard={
                  handleOpenAdminDashboard
                }
                onOpenMyAccount={
                  handleOpenMyAccount
                }
              />
            </Suspense>
          }
        />

        {/* =====================================================
            BANNER COLLECTION
        ===================================================== */}

        <Route
          path="/collection/:bannerId"
          element={
            <Suspense fallback={<div className="fixed inset-0 bg-white" />}>
              <BannerCollectionRoute
                onProductClick={handleProductClick}
                onAddToCart={addToCart}
                formatPrice={formatPrice}
                currencies={currencies}
                selectedCurrency={selectedCurrency}
                onCurrencyChange={
                  setSelectedCurrency
                }
                user={user}
                onAuthClick={handleOpenAuth}
                wishlistItems={wishlistItems}
                onOpenWishlist={
                  handleOpenWishlist
                }
                cartItemsCount={cartItemsCount}
                onOpenCart={handleOpenCart}
                onOpenAdminDashboard={
                  handleOpenAdminDashboard
                }
                onOpenMyAccount={
                  handleOpenMyAccount
                }
              />
            </Suspense>
          }
        />

        {/* =====================================================
            CHECKOUT
        ===================================================== */}

        <Route
          path="/checkout"
          element={
            <Suspense fallback={<div className="fixed inset-0 bg-white" />}>
              <CheckoutRoute
                items={cartItems}
                formatPrice={formatPrice}
                user={user}
                onAuthClick={handleOpenAuth}
                onSignIn={signIn}
                onSignUp={signUp}
                onSignInWithProvider={
                  signInWithProvider
                }
                isAuthLoading={isLoading}
                clearCart={clearCart}
              />
            </Suspense>
          }
        />

        {/* =====================================================
            MY ACCOUNT
        ===================================================== */}

        <Route
          path="/account"
          element={
            <Suspense fallback={<div className="fixed inset-0 bg-white" />}>
              <MyAccountRoute
                user={user}
                onSignOut={signOut}
              />
            </Suspense>
          }
        />

        {/* =====================================================
            ADMIN
        ===================================================== */}

        <Route
          path="/admin"
          element={
            <Suspense
              fallback={
                <div className="fixed inset-0 z-[60] bg-white" />
              }
            >
              <AdminDashboardRoute
                user={user}
                onSignOut={signOut}
              />
            </Suspense>
          }
        />
      </Routes>

      {/* =======================================================
          HERO-LINKED COLLECTION

          Hero collections intentionally remain local state
          rather than using a URL route.
      ======================================================= */}

      {isHeroCollectionOpen && heroBanner && (
        <BannerCollection
          banner={heroBanner}
          isOpen={isHeroCollectionOpen}
          onClose={handleCloseHeroCollection}
          onProductClick={
            handleHeroCollectionProductClick
          }
          onAddToCart={addToCart}
          formatPrice={formatPrice}
          currencies={currencies}
          selectedCurrency={selectedCurrency}
          onCurrencyChange={
            setSelectedCurrency
          }
          user={user}
          onAuthClick={handleOpenAuth}
          wishlistItems={wishlistItems}
          onOpenWishlist={
            handleOpenWishlist
          }
          cartItemsCount={cartItemsCount}
          onOpenCart={handleOpenCart}
          onOpenAdminDashboard={
            handleOpenAdminDashboard
          }
          onOpenMyAccount={
            handleOpenMyAccount
          }
        />
      )}

      {/* =======================================================
          AUTH MODAL
      ======================================================= */}

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          handleCloseAuth();
          setAuthContextMessage(undefined);
        }}
        onSignIn={signIn}
        onSignUp={signUp}
        onSignInWithProvider={
          signInWithProvider
        }
        isLoading={isLoading}
        contextMessage={authContextMessage}
      />

      {/* =======================================================
          WISHLIST
      ======================================================= */}

      <Wishlist
        ref={wishlistRef}
        isOpen={isWishlistOpen}
        onClose={handleCloseWishlist}
        items={wishlistItems}
        onRemoveItem={removeFromWishlist}
        onAddToCart={addToCart}
        formatPrice={formatPrice}
        onProductClick={
          handleWishlistProductClick
        }
      />

      {/* =======================================================
          CART
      ======================================================= */}

      <Cart
        ref={cartRef}
        isOpen={isCartOpen}
        onClose={handleCloseCart}
        items={cartItems}
        onUpdateQuantity={updateQuantity}
        onRemoveItem={removeItem}
        formatPrice={formatPrice}
        onProductClick={
          handleCartProductClick
        }
        onAddToCart={addToCart}
        onCheckout={handleCheckout}
      />
<SupportChatWidget />
      {/* =======================================================
          MOBILE TAB BAR
      ======================================================= */}

{!showSplash && (
      <MobileTabBar
        activeTab="shop"
        wishlistCount={wishlistItems.length}
        cartCount={cartItemsCount}
        user={user}
        onShopClick={() => {
          navigate('/');
          setIsCartOpen(false);
          setIsWishlistOpen(false);
          handleCloseHeroCollection();
          setViewMode('floor');

          window.scrollTo({
            top: 0,
            behavior: 'smooth',
          });
        }}
        onWishlistClick={() => {
          handleCloseHeroCollection();
          handleOpenWishlist();
        }}
        onCartClick={() => {
          handleCloseHeroCollection();
          handleOpenCart();
        }}
        onAccountClick={() => {
          handleCloseHeroCollection();

          user
            ? handleOpenMyAccount()
            : handleOpenAuth();
        }}
      />
)}
      {/* =======================================================
          SPLASH SCREEN
      ======================================================= */}

      <SplashScreen
        isVisible={showSplash}
      />
    </>
  );
}

export default App;