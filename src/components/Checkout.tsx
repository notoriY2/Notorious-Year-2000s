// src/components/Checkout.tsx

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  X,
  ChevronDown,
  Info,
  Search,
  Lock,
  Check,
  ArrowLeft,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

import {
  CartItem,
} from '../types/Product';

import {
  User as UserType,
} from '../hooks/useAuth';

import {
  createOrder,
  claimGuestOrder, 
  CreateOrderPayload,
  CreateOrderItemInput,
} from '../data/admin';

import SizeGuideModal from './SizeGuideModal';
import InfoModal from './InfoModal';
import { trackEvent } from '../lib/analytics'
// Add near the top of Checkout.tsx, with the other imports:
import { openSupportChat } from '../lib/supportChatBus';
import { supabase } from '../lib/supabase';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { recordConsent } from '../data/consent';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

/* =========================================================
   TYPES
========================================================= */

interface CheckoutProps {
  isOpen: boolean;
  onClose: () => void;

  items: CartItem[];

  formatPrice: (
    price: number
  ) => string;

  onBackToShopping: () => void;

  user?: UserType | null;

  onAuthClick?: () => void;

  onSignIn?: (
    email: string,
    password: string
  ) => Promise<void>;

  onSignUp?: (
    email: string,
    password: string,
    name: string
  ) => Promise<void>;

  onSignInWithProvider?: (
    provider:
      | 'google'
      | 'facebook'
      | 'instagram'
  ) => Promise<void>;

  isAuthLoading?: boolean;

  /*
   * Clears the cart (guest localStorage cart or the authenticated
   * cart_items rows) after an order has actually been placed in the
   * database. Optional so this component doesn't break for any older
   * call site that hasn't wired it through yet — but Checkout always
   * calls it on a successful order when it's provided.
   */
  clearCart?: () => Promise<void>;
}

/* =========================================================
   PROVINCES
========================================================= */

const SOUTH_AFRICAN_PROVINCES = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'Northern Cape',
  'North West',
  'Western Cape',
];

/* =========================================================
   STRIPE PAYMENT FORM SUB-COMPONENT
========================================================= */

const StripePaymentForm = ({ onSuccess }: { onSuccess: () => void }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const handlePay = async () => {
    if (!stripe || !elements) return;
    setProcessing(true);
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    });
    if (error) {
      setError(error.message ?? 'Payment failed.');
      setProcessing(false);
    } else {
      onSuccess();
    }
  };

  return (
    <div className="p-5 space-y-4">
      <PaymentElement />
      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      <button
        type="button"
        onClick={handlePay}
        disabled={processing}
        className="w-full h-16 bg-black text-white text-sm tracking-[0.22em] uppercase hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
      >
        {processing ? 'Processing…' : 'Pay now'}
      </button>
    </div>
  );
};

/* =========================================================
   COMPONENT
========================================================= */

const Checkout: React.FC<
  CheckoutProps
> = ({
  isOpen,
  onClose,
  items,
  formatPrice,
  onBackToShopping,
  user,
  onAuthClick,
  onSignIn,
  onSignUp,
  onSignInWithProvider,
  isAuthLoading = false,
  clearCart,
}) => {
  /* =======================================================
     FORM STATE
  ======================================================= */
const idempotencyKeyRef = useRef<string>(crypto.randomUUID());

  const [
    formData,
    setFormData,
  ] = useState({
    email:
      user?.email ?? '',

    emailOffers: false,

    country:
      'South Africa',

    firstName: '',
    lastName: '',
    address: '',
    apartment: '',
    city: '',
    state: '',
    zipCode: '',
    phone: '',

    paymentMethod:
      'credit_card',

    useBillingAddress:
      true,

    billingCountry:
      'South Africa',

    billingFirstName: '',
    billingLastName: '',
    billingAddress: '',
    billingApartment: '',
    billingCity: '',
    billingState: '',
    billingZipCode: '',
    billingPhone: '',

    rememberMe: true,
    mobilePhone: '',
  });

  /* =======================================================
     AUTH STATE
  ======================================================= */

  const [
    showLoginForm,
    setShowLoginForm,
  ] = useState(false);

  const [
    loginEmail,
    setLoginEmail,
  ] = useState('');

  const [
    loginPassword,
    setLoginPassword,
  ] = useState('');

  const [
    loginName,
    setLoginName,
  ] = useState('');

  const [
    isSignUp,
    setIsSignUp,
  ] = useState(false);

  const [
    loginError,
    setLoginError,
  ] = useState('');

  const [lastOrderId, setLastOrderId] = useState('');
  const [discountCode, setDiscountCode] = useState('');
const [appliedDiscount, setAppliedDiscount] = useState<{ code: string; type: string; value: number } | null>(null);
const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false);
const [showSizeGuide, setShowSizeGuide] = useState(false);
const [infoModal, setInfoModal] = useState<'shipping' | 'returns' | 'faq' | null>(null);
const [showAccountPrompt, setShowAccountPrompt] = useState(false);
const [conversionPassword, setConversionPassword] = useState('');
const [conversionStatus, setConversionStatus] = useState<'idle' | 'loading' | 'done'>('idle');
const [sessionId] = useState(() => crypto.randomUUID());
const [discountError, setDiscountError] = useState('');
const [clientSecret, setClientSecret] = useState<string | null>(null);

const handleApplyDiscount = async () => {
  setDiscountError('');
  
  const { data: allowed, error: rpcError } = await supabase.rpc('check_discount_rate_limit', {
    p_session_id: sessionId,
  });

  if (rpcError || allowed === false) {
    setDiscountError('Too many attempts, try again shortly');
    return;
  }

  const { data } = await supabase
    .from('discounts').select('*').eq('code', discountCode.trim().toUpperCase()).eq('status', 'Active').maybeSingle();
  
  if (data) {
    setAppliedDiscount({ code: data.code, type: data.type, value: Number(data.value) });
  } else {
    setDiscountError('Invalid or expired discount code');
  }
};
  /* =======================================================
     CHECKOUT STATE
  ======================================================= */

  const [
    isProcessing,
    setIsProcessing,
  ] = useState(false);

  const [
    orderComplete,
    setOrderComplete,
  ] = useState(false);

  const [
    orderNumber,
    setOrderNumber,
  ] = useState('');

  /*
   * Inline error shown on the main checkout form when a real order
   * submission fails (e.g. the createOrder() call below throws).
   * Deliberately NOT shown on the success screen — a failure must
   * never route the customer to "Order Confirmed".
   */
  const [
    checkoutError,
    setCheckoutError,
  ] = useState<string | null>(null);

  /* =======================================================
     SYNC USER EMAIL
  ======================================================= */

  useEffect(() => {
    if (user?.email) {
      setFormData(
        previous => ({
          ...previous,
          email:
            user.email ?? '',
        })
      );
    }
  }, [user]);

  /* =======================================================
     BODY SCROLL LOCK
  ======================================================= */

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow =
      document.body.style
        .overflow;

    document.body.style.overflow =
      'hidden';

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [isOpen]);

  /* =======================================================
     TOTALS
  ======================================================= */

  const subtotal =
    useMemo(
      () =>
        items.reduce(
          (
            sum,
            item
          ) =>
            sum +
            item.price *
              item.quantity,
          0
        ),
      [items]
    );
// Matches the 15% VAT rate AdminFinance's Tax Report tab already
// assumes elsewhere in the app.
const VAT_RATE = 0.15;

const shipping = 0;

const discountAmount = useMemo(() => {
  if (!appliedDiscount) return 0;
  if (appliedDiscount.type === 'Percentage') return subtotal * (appliedDiscount.value / 100);
  if (appliedDiscount.type === 'Fixed') return Math.min(appliedDiscount.value, subtotal);
  return 0; // Free Shipping handled via `shipping` separately
}, [appliedDiscount, subtotal]);

// Tax is calculated on the discounted subtotal, not the raw subtotal —
// customers shouldn't pay VAT on the portion they didn't end up paying for.
const tax = useMemo(
  () => Math.max(0, subtotal - discountAmount) * VAT_RATE,
  [subtotal, discountAmount]
);

const total = subtotal + shipping + tax - discountAmount;

  /* =======================================================
     FETCH STRIPE CLIENT SECRET
  ======================================================= */

  useEffect(() => {
    if (!isOpen || total <= 0) return;

    let isMounted = true;
    supabase.functions.invoke('create-payment-intent', {
      body: { amount: Math.round(total * 100), currency: 'zar' },
    }).then(({ data, error }) => {
      if (!isMounted) return;
      if (error) {
        console.error('Failed to create payment intent:', error);
      } else if (data?.clientSecret) {
        setClientSecret(data.clientSecret);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [isOpen, total]);

  const itemCount =
    items.reduce(
      (
        sum,
        item
      ) =>
        sum +
        item.quantity,
      0
    );

  /* =======================================================
     INPUT HANDLER
  ======================================================= */

  const handleInputChange = (
    field: string,
    value:
      | string
      | boolean
  ) => {
    setFormData(
      previous => ({
        ...previous,
        [field]: value,
      })
    );
  };

  /* =======================================================
     BUILD ORDER PAYLOAD FROM FORM DATA
  ======================================================= */

  const buildShippingAddress = ():
    Record<string, unknown> => ({
      line1: formData.address,
      line2:
        formData.apartment ||
        undefined,
      city: formData.city,
      state: formData.state,
      zip: formData.zipCode,
      country: formData.country,
      phone:
        formData.phone ||
        undefined,
    });

  const buildBillingAddress = ():
    Record<string, unknown> => {
    if (
      formData.useBillingAddress
    ) {
      return buildShippingAddress();
    }

    return {
      line1:
        formData.billingAddress,
      line2:
        formData.billingApartment ||
        undefined,
      city:
        formData.billingCity,
      state:
        formData.billingState,
      zip:
        formData.billingZipCode,
      country:
        formData.billingCountry,
      phone:
        formData.billingPhone ||
        undefined,
    };
  };

  /* =======================================================
     CHECKOUT COMPLETION

     Replaces the old setTimeout simulation with a real
     createOrder() call (data/admin.ts). This is what makes
     invoices (DB trigger), admin_activity_log (via later status
     changes), and admin_notifications (notify_new_order trigger)
     start populating for real orders instead of never firing.
  ======================================================= */

  const completeOrder = async () => {
    setCheckoutError(null);

    try {
      const customerName =
        `${formData.firstName} ${formData.lastName}`.trim() ||
        user?.name ||
        'Guest';

      const customerEmail =
        formData.email ||
        user?.email ||
        '';

      if (!customerEmail) {
        throw new Error(
          'Please provide an email address before placing your order.'
        );
      }

      const orderItems: CreateOrderItemInput[] =
        items.map(item => ({
          productId: item.id,
          productName: item.name,
          size: item.selectedSize,
          color: item.selectedColor,
          quantity: item.quantity,
          unitPrice: item.price,
        }));

      const orderPayload: CreateOrderPayload = {
        userId: user?.id ?? null,
        customerName,
        customerEmail,
        customerPhone:
          formData.phone ||
          undefined,
        subtotal,
        shipping,
        tax,
        total,
        discountCode: appliedDiscount?.code,
        discountAmount,

        idempotencyKey: idempotencyKeyRef.current,
        // Notorious.Y2's storefront default currency (see
        // data/storeSettings.ts / store_info.currency). Checkout
        // doesn't currently receive the visitor's selected display
        // currency as a prop, so orders are always recorded in the
        // store's base currency regardless of what was shown on
        // screen — matching how prices are stored elsewhere.
        currencyCode: 'ZAR',

        paymentMethod:
          formData.paymentMethod === 'credit_card'
            ? 'Credit Card'
            : formData.paymentMethod,

        shippingAddress:
          buildShippingAddress(),

        billingAddress:
          buildBillingAddress(),
      };

      const result =
        await createOrder(
          orderPayload,
          orderItems
        );
        if (formData.emailOffers) {
  void recordConsent({
    userId: user?.id ?? null,
    email: customerEmail,
    consentType: 'marketing_email',
    granted: true,
    source: 'checkout_checkbox',
  });
}

      // Empty the cart now that the order genuinely exists in the
      // database — guest localStorage cart or the authenticated
      // cart_items rows, depending on the session.
      if (clearCart) {
        await clearCart();
      }

      // Real order number from the database (set_order_number()
      // trigger, format NY2-XXXXX) instead of a Date.now() stand-in.
      setOrderNumber(result.orderNumber);
setLastOrderId(result.id);   // ADD THIS
setIsProcessing(false);
setOrderComplete(true);

if (!user) {
  setShowAccountPrompt(true);
}

      if (user) {
  window.setTimeout(() => {
    onClose();
    setOrderComplete(false);
    setOrderNumber('');
  }, 3500);
}
    } catch (error) {
      console.error(
        'Failed to place order:',
        error
      );

      // Failure must never show the success screen — surface an
      // inline error on the checkout form instead and let the
      // customer retry.
      setIsProcessing(false);

      setCheckoutError(
        error instanceof Error
          ? error.message
          : 'Something went wrong placing your order. Please try again.'
      );
    }
  };

  /* =======================================================
     EXPRESS CHECKOUT
  ======================================================= */

  const handleExpressCheckout = () => {
    if (
      items.length === 0 ||
      isProcessing
    ) {
      return;
    }

    setCheckoutError(null);
setIsProcessing(true);
trackEvent('checkout_start');
void completeOrder();
  };

  /* =======================================================
     NORMAL CHECKOUT
  ======================================================= */

  const handleSubmit = (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    if (
      items.length === 0 ||
      isProcessing
    ) {
      return;
    }

    setCheckoutError(null);
setIsProcessing(true);
trackEvent('checkout_start');
void completeOrder();
  };

  /* =======================================================
     EXTERNAL LINK
  ======================================================= */

  const handleLinkClick = (
    url: string
  ) => {
    window.open(
      url,
      '_blank',
      'noopener,noreferrer'
    );
  };

  /* =======================================================
     SUPPORT
  ======================================================= */

  const handleEmailClick =
    () => {
      window.location.href =
        'mailto:support@notorious.y2.com';
    };

  const handlePhoneClick =
    () => {
      window.location.href =
        'tel:+27635035882';
    };

  /* =======================================================
     LOGIN
  ======================================================= */

  const handleLoginSubmit =
    async (
      event: React.FormEvent
    ) => {
      event.preventDefault();

      setLoginError('');

      try {
        if (
          isSignUp &&
          onSignUp
        ) {
          await onSignUp(
            loginEmail,
            loginPassword,
            loginName
          );
        } else if (
          onSignIn
        ) {
          await onSignIn(
            loginEmail,
            loginPassword
          );
        } else if (
          onAuthClick
        ) {
          onAuthClick();

          return;
        }

        setLoginEmail('');
        setLoginPassword('');
        setLoginName('');

        setShowLoginForm(
          false
        );

        setIsSignUp(
          false
        );
      } catch {
        setLoginError(
          'Authentication failed. Please check your details and try again.'
        );
      }
    };

  /* =======================================================
     SOCIAL LOGIN
  ======================================================= */

  const handleSocialLogin =
    async (
      provider:
        | 'google'
        | 'facebook'
        | 'instagram'
    ) => {
      setLoginError('');

      try {
        if (
          onSignInWithProvider
        ) {
          await onSignInWithProvider(
            provider
          );

          setShowLoginForm(
            false
          );
        } else if (
          onAuthClick
        ) {
          onAuthClick();
        }
      } catch {
        setLoginError(
          'Social login failed. Please try again.'
        );
      }
    };

  /* =======================================================
     LOGIN TOGGLE
  ======================================================= */

  const toggleLoginForm =
    () => {
      if (
        onAuthClick &&
        !onSignIn
      ) {
        onAuthClick();

        return;
      }

      setShowLoginForm(
        previous => !previous
      );

      setLoginError('');
    };

  /* =======================================================
     CLOSED
  ======================================================= */

  if (!isOpen) {
    return null;
  }

  /* =======================================================
     ORDER COMPLETE
  ======================================================= */

  // Snippet for CheckoutModal.tsx / Order Confirmation View

  if (orderComplete) {
    return (
      <div className="fixed inset-x-0 top-0 h-[100dvh] z-[100] bg-white overflow-y-auto">
        <div className="min-h-[100dvh] flex items-center justify-center px-6 py-16">
          <div className="w-full max-w-lg text-center">
            <div className="w-20 h-20 bg-black text-white rounded-full flex items-center justify-center mx-auto mb-8">
              <Check
                size={38}
                strokeWidth={1.5}
              />
            </div>

            <p className="text-xs uppercase tracking-[0.35em] text-gray-500 mb-4">
              Notorious.Y2
            </p>

            <h1
              className="text-3xl md:text-4xl font-light tracking-wide mb-5"
              style={{
                fontFamily:
                  'Helvetica Neue, Arial, sans-serif',
              }}
            >
              Order Confirmed
            </h1>

            <p
              className="text-gray-600 font-light leading-relaxed mb-8"
              style={{
                fontFamily:
                  'Helvetica Neue, Arial, sans-serif',
              }}
            >
              Thank you for your purchase.
              Your order has been received
              and your confirmation details
              will be sent to your email.
            </p>

            <div className="border border-gray-200 p-5 mb-8">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-2">
                Order number
              </p>

              <p className="text-lg font-light tracking-wide">
                #{orderNumber}
              </p>
            </div>

            {showAccountPrompt && conversionStatus !== 'done' && (
              <div className="border border-gray-200 p-5 mb-8 text-left">
                <p className="text-sm font-medium mb-1">Create an account to track this order</p>
                <p className="text-xs text-gray-500 mb-4">
                  We'll use {formData.email} — just set a password.
                </p>
                <input
                  type="password"
                  placeholder="Password"
                  value={conversionPassword}
                  onChange={e => setConversionPassword(e.target.value)}
                  className="w-full h-12 px-4 border border-gray-300 mb-3 focus:outline-none focus:border-black"
                />
                <button
                  type="button"
                  disabled={conversionStatus === 'loading' || !conversionPassword}
                  onClick={async () => {
                    if (!onSignUp) return;
                    setConversionStatus('loading');
                    try {
                      await onSignUp(
  formData.email,
  conversionPassword,
  `${formData.firstName} ${formData.lastName}`.trim()
);
setConversionStatus('done');
await claimGuestOrder(lastOrderId, formData.email);
                    } catch {
                      setConversionStatus('idle');
                    }
                  }}
                  className="w-full h-12 bg-black text-white text-sm tracking-wide disabled:opacity-50"
                >
                  {conversionStatus === 'loading' ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            )}

            {conversionStatus === 'done' && (
              <p className="text-sm text-green-600 mb-8">Account created — you're all set.</p>
            )}

            <button
              type="button"
              onClick={() => {
                onClose();
                setOrderComplete(
                  false
                );
              }}
              className="px-8 py-4 bg-black text-white text-sm tracking-[0.2em] uppercase hover:bg-gray-800 transition-colors"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* =======================================================
     PROCESSING
  ======================================================= */

  if (isProcessing) {
    return (
      <div className="fixed inset-x-0 top-0 h-[100dvh] z-[100] bg-white">
        <div className="min-h-[100dvh] flex items-center justify-center px-6">
          <div className="text-center">
            <div className="w-16 h-16 border border-gray-200 border-t-black rounded-full animate-spin mx-auto mb-8" />

            <h1
              className="text-xl font-light tracking-wide mb-3"
              style={{
                fontFamily:
                  'Helvetica Neue, Arial, sans-serif',
              }}
            >
              Processing Your Order
            </h1>

            <p
              className="text-sm text-gray-500 font-light"
              style={{
                fontFamily:
                  'Helvetica Neue, Arial, sans-serif',
              }}
            >
              Please wait while we
              process your payment.
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* =======================================================
     MAIN CHECKOUT
  ======================================================= */

  return (
    <div className="fixed inset-x-0 top-0 h-[100dvh] z-[100] bg-white overflow-y-auto">
      <div className="min-h-[100dvh]">
        {/* =================================================
            HEADER
        ================================================= */}

        <header className="fixed top-0 inset-x-0 z-20 bg-white border-b border-gray-200">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 h-16 md:h-20 flex items-center justify-between">
            <button
              type="button"
              onClick={
                onBackToShopping
              }
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-black transition-colors"
            >
              <ArrowLeft
                size={17}
                strokeWidth={1.5}
              />

              <span className="hidden sm:inline">
                Back to shopping
              </span>
            </button>

            <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3">
              <img
                src="/logo/13 (1).png"
                alt="Notorious Y2"
                className="w-8 h-8 md:w-9 md:h-9 object-contain"
              />

              <span
                className="text-sm md:text-base tracking-[0.3em] font-light text-black"
                style={{
                  fontFamily:
                    'Helvetica Neue, Arial, sans-serif',
                }}
              >
                Notorious.Y2
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close checkout"
              className="p-2 text-gray-600 hover:text-black hover:bg-gray-50 transition-colors"
            >
              <X
                size={23}
                strokeWidth={1.5}
              />
            </button>
          </div>
        </header>
        <div className="h-16 md:h-20" />

{/* MOBILE STICKY SUMMARY */}
<div className="lg:hidden sticky top-16 z-10 bg-gray-50 border-b border-gray-200">
  <button
    type="button"
    onClick={() => setMobileSummaryOpen(prev => !prev)}
    className="w-full flex items-center justify-between px-4 py-3"
  >
    <span className="flex items-center gap-2 text-sm text-gray-700">
      <ChevronDown
        size={16}
        className={`transition-transform ${mobileSummaryOpen ? 'rotate-180' : ''}`}
      />
      Order summary · {itemCount} {itemCount === 1 ? 'item' : 'items'}
    </span>
    <span className="text-sm font-medium">{formatPrice(total)}</span>
  </button>

  {mobileSummaryOpen && (
    <div className="px-4 pb-4 space-y-3">
      {items.map(item => (
        <div key={item.uniqueId} className="flex items-center gap-3">
          <img src={item.image} alt={item.name} className="w-12 h-12 object-cover border border-gray-200 bg-white flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-800 truncate">{item.name}</p>
            <p className="text-xs text-gray-400">Qty {item.quantity}</p>
          </div>
          <span className="text-xs text-gray-600 whitespace-nowrap">
            {formatPrice(item.price * item.quantity)}
          </span>
        </div>
      ))}
    </div>
  )}
</div>
        {/* =================================================
            CONTENT
        ================================================= */}

        <div className="max-w-[1440px] mx-auto">
          <div className="flex flex-col lg:flex-row">
            {/* =============================================
                LEFT / FORM
            ============================================= */}

            <main className="flex-1 px-4 py-8 sm:px-6 lg:px-10 xl:px-16">
              <div className="max-w-2xl mx-auto lg:mx-0 lg:ml-auto lg:mr-10">
                {/* =========================================
                    EXPRESS CHECKOUT
                ========================================= */}

                <section className="mb-10">
                  <div className="flex items-center justify-between mb-5">
                    <h2
                      className="text-lg font-light tracking-wide"
                      style={{
                        fontFamily:
                          'Helvetica Neue, Arial, sans-serif',
                      }}
                    >
                      Express checkout
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
  onClick={handleExpressCheckout}
  disabled={isProcessing}
  className="bg-purple-600 text-white py-4 px-6 font-medium hover:bg-purple-700 transition-colors flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed"
>
                      <span className="text-xl font-bold">
                        shop
                      </span>

                      <span className="text-xl font-bold ml-1">
                        Pay
                      </span>
                    </button>

                    <button
  onClick={handleExpressCheckout}
  disabled={isProcessing}
  className="bg-black text-white py-4 px-6 font-medium hover:bg-gray-800 transition-colors flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed"
>
                      <span className="text-xl font-medium">
                        G
                      </span>

                      <span className="text-xl ml-2">
                        Pay
                      </span>
                    </button>
                  </div>

                  <div className="relative my-8">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200" />
                    </div>

                    <div className="relative flex justify-center">
                      <span className="px-4 bg-white text-xs tracking-[0.2em] text-gray-400">
                        OR
                      </span>
                    </div>
                  </div>
                </section>

                {/* =========================================
                    CHECKOUT FORM
                ========================================= */}

                <form
                  onSubmit={
                    handleSubmit
                  }
                  className="space-y-10"
                >
                  {/* =======================================
                      CONTACT
                  ======================================= */}

                  <section>
                    <div className="flex items-center justify-between mb-5">
                      <h3
                        className="text-lg font-light tracking-wide"
                        style={{
                          fontFamily:
                            'Helvetica Neue, Arial, sans-serif',
                        }}
                      >
                        Contact
                      </h3>

                      {!user && (
                        <button
                          type="button"
                          onClick={
                            toggleLoginForm
                          }
                          className="text-sm text-[#b58627] hover:text-black transition-colors"
                        >
                          {showLoginForm
                            ? 'Cancel'
                            : 'Log in'}
                        </button>
                      )}
                    </div>

                    {user ? (
                      <div className="border border-gray-200 bg-gray-50 p-5">
                        <p className="text-sm font-medium mb-1">
                          {user.email}
                        </p>

                        <p className="text-xs text-gray-500">
                          Logged in as{' '}
                          {user.name}
                        </p>
                      </div>
                    ) : showLoginForm ? (
                      /*
                       * IMPORTANT:
                       *
                       * This is intentionally NOT another
                       * <form>. Nested forms are invalid HTML.
                       */
                      <div className="border border-gray-200 bg-gray-50 p-5">
                        <div className="flex items-center justify-between mb-5">
                          <h4 className="font-medium">
                            {isSignUp
                              ? 'Create Account'
                              : 'Sign In'}
                          </h4>

                          <button
                            type="button"
                            onClick={() => {
                              setIsSignUp(
                                previous =>
                                  !previous
                              );

                              setLoginError(
                                ''
                              );
                            }}
                            className="text-xs text-gray-500 hover:text-black transition-colors"
                          >
                            {isSignUp
                              ? 'Already have an account?'
                              : 'Need an account?'}
                          </button>
                        </div>

                        {loginError && (
                          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-sm">
                            {loginError}
                          </div>
                        )}

                        {isSignUp && (
                          <input
                            type="text"
                            placeholder="Full name"
                            value={
                              loginName
                            }
                            onChange={event =>
                              setLoginName(
                                event.target
                                  .value
                              )
                            }
                            className="w-full h-12 px-4 mb-3 border border-gray-300 bg-white focus:outline-none focus:border-black transition-colors font-light"
                            required
                          />
                        )}

                        <input
                          type="email"
                          placeholder="Email"
                          value={
                            loginEmail
                          }
                          onChange={event =>
                            setLoginEmail(
                              event.target
                                .value
                            )
                          }
                          className="w-full h-12 px-4 mb-3 border border-gray-300 bg-white focus:outline-none focus:border-black transition-colors font-light"
                          required
                        />

                        <input
                          type="password"
                          placeholder="Password"
                          value={
                            loginPassword
                          }
                          onChange={event =>
                            setLoginPassword(
                              event.target
                                .value
                            )
                          }
                          className="w-full h-12 px-4 mb-4 border border-gray-300 bg-white focus:outline-none focus:border-black transition-colors font-light"
                          required
                        />

                        <button
                          type="button"
                          disabled={
                            isAuthLoading
                          }
                          onClick={
                            handleLoginSubmit
                          }
                          className="w-full h-12 bg-black text-white text-sm tracking-[0.15em] hover:bg-gray-800 disabled:opacity-50 transition-colors"
                        >
                          {isAuthLoading
                            ? 'LOADING...'
                            : isSignUp
                            ? 'CREATE ACCOUNT'
                            : 'SIGN IN'}
                        </button>

                        <div className="relative my-5">
                          <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-300" />
                          </div>

                          <div className="relative flex justify-center">
                            <span className="px-3 bg-gray-50 text-xs text-gray-500">
                              Or continue with
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          {/* GOOGLE */}

                          <button
                            type="button"
                            onClick={() =>
                              handleSocialLogin(
                                'google'
                              )
                            }
                            disabled={
                              isAuthLoading
                            }
                            className="h-11 border border-gray-300 bg-white flex items-center justify-center hover:bg-gray-100 transition-colors"
                            aria-label="Continue with Google"
                          >
                            <svg
                              className="w-5 h-5"
                              viewBox="0 0 24 24"
                            >
                              <path
                                fill="#4285F4"
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                              />

                              <path
                                fill="#34A853"
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                              />

                              <path
                                fill="#FBBC05"
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                              />

                              <path
                                fill="#EA4335"
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                              />
                            </svg>
                          </button>

                          {/* FACEBOOK */}

                          <button
                            type="button"
                            onClick={() =>
                              handleSocialLogin(
                                'facebook'
                              )
                            }
                            disabled={
                              isAuthLoading
                            }
                            className="h-11 border border-gray-300 bg-white flex items-center justify-center hover:bg-gray-100 transition-colors"
                            aria-label="Continue with Facebook"
                          >
                            <svg
                              className="w-5 h-5 text-blue-600"
                              fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                            </svg>
                          </button>

                          {/* INSTAGRAM */}

                          <button
                            type="button"
                            onClick={() =>
                              handleSocialLogin(
                                'instagram'
                              )
                            }
                            disabled={
                              isAuthLoading
                            }
                            className="h-11 border border-gray-300 bg-white flex items-center justify-center hover:bg-gray-100 transition-colors"
                            aria-label="Continue with Instagram"
                          >
                            <svg
                              className="w-5 h-5 text-pink-600"
                              fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path d="M12.017 0C8.396 0 7.989.013 7.041.072 6.094.131 5.42.333 4.844.63c-.611.324-1.13.756-1.649 1.275-.518.52-.95 1.038-1.275 1.649-.297.576-.499 1.25-.558 2.197C.013 7.75 0 8.157 0 11.778v.444c0 3.621.013 4.028.072 4.976.059.947.261 1.621.558 2.197.324.611.756 1.13 1.275 1.649.52.518 1.038.95 1.649 1.275.576.297 1.25.499 2.197.558.948.059 1.355.072 4.976.072h.444c3.621 0 4.028-.013 4.976-.072.947-.059 1.621-.261 2.197-.558.611-.324 1.13-.756 1.649-1.275.518-.52.95-1.038 1.275-1.649.297-.576.499-1.25.558-2.197.059-.948.072-1.355.072-4.976v-.444c0-3.621-.013-4.028-.072-4.976-.059-.947-.261-1.621-.558-2.197-.324-.611-.756-1.13-1.275-1.649-.518-.52-.95-1.038-1.275-1.649-.297-.576-.499-1.25-.558-2.197C16.028.013 15.621 0 12 0h-.017zm-.117 2.164h.234c3.534 0 3.952.01 5.347.072.889.041 1.374.19 1.695.315.426.166.73.364 1.048.682.318.318.516.622.682 1.048.125.321.274.806.315 1.695.062 1.395.072 1.813.072 5.347 0 3.534-.01 3.952-.072 5.347-.041.889-.19 1.374-.315 1.695-.166.426-.364.73-.682 1.048-.318.318-.622.516-1.048.682-.321.125-.806.274-1.695.315-1.395.062-1.813.072-5.347.072-3.534 0-3.952-.01-5.347-.072-.889-.041-1.374-.19-1.695-.315-.426-.166-.73-.364-1.048-.682-.318-.318-.516-.622-.682-1.048-.125-.321-.274-.806-.315-1.695-.062-1.395-.072-1.813-.072-5.347 0-3.534.01-3.952.072-5.347.041-.889.19-1.374.315-1.695.166-.426.364-.73.682-1.048.318-.318.622-.622 1.048-.682.321-.125.806-.274 1.695-.315 1.221-.056 1.693-.067 4.113-.07v.003zm-.004 3.709c-2.987 0-5.41 2.423-5.41 5.41s2.423 5.41 5.41 5.41 5.41-2.423 5.41-5.41-2.423-5.41-5.41-5.41zm0 8.916c-1.937 0-3.506-1.569-3.506-3.506s1.569-3.506 3.506-3.506 3.506 1.569 3.506 3.506-1.569 3.506-3.506 3.506zM19.54 5.277c0 .698-.566 1.265-1.265 1.265-.698 0-1.265-.567-1.265-1.265 0-.698.567-1.265 1.265-1.265.698 0 1.265.567 1.265 1.265z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <input
                        type="email"
                        placeholder="Email"
                        value={
                          formData.email
                        }
                        onChange={event =>
                          handleInputChange(
                            'email',
                            event.target
                              .value
                          )
                        }
                        className="w-full h-14 px-4 border border-gray-300 focus:outline-none focus:border-black transition-colors font-light"
                        required
                      />
                    )}

                    <label className="flex items-center gap-3 mt-4">
                      <input
                        type="checkbox"
                        checked={
                          formData.emailOffers
                        }
                        onChange={event =>
                          handleInputChange(
                            'emailOffers',
                            event.target
                              .checked
                          )
                        }
                        className="w-4 h-4"
                        style={{
                          accentColor:
                            '#B58627',
                        }}
                      />

                      <span className="text-sm text-gray-500 font-light">
                        Email me with news
                        and offers
                      </span>
                    </label>
                  </section>

                  {/* =======================================
                      DELIVERY
                  ======================================= */}

                  <section>
                    <h3
                      className="text-lg font-light tracking-wide mb-5"
                      style={{
                        fontFamily:
                          'Helvetica Neue, Arial, sans-serif',
                      }}
                    >
                      Delivery
                    </h3>

                    <div className="space-y-4">
                      {/* Country */}

                      <div>
                        <label className="block text-xs text-gray-500 mb-2">
                          Country / Region
                        </label>

                        <div className="relative">
                          <select
                            value={
                              formData.country
                            }
                            onChange={event =>
                              handleInputChange(
                                'country',
                                event.target
                                  .value
                              )
                            }
                            className="w-full h-14 px-4 pr-12 border border-gray-300 bg-white appearance-none focus:outline-none focus:border-black font-light"
                          >
                            <option value="South Africa">
                              South Africa
                            </option>

                            <option value="Botswana">
                              Botswana
                            </option>

                            <option value="Namibia">
                              Namibia
                            </option>

                            <option value="Zimbabwe">
                              Zimbabwe
                            </option>

                            <option value="United Kingdom">
                              United Kingdom
                            </option>

                            <option value="United States">
                              United States
                            </option>
                          </select>

                          <ChevronDown
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                            size={19}
                            strokeWidth={1.5}
                          />
                        </div>
                      </div>

                      {/* Names */}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <input
                          type="text"
                          placeholder="First name"
                          value={
                            formData.firstName
                          }
                          onChange={event =>
                            handleInputChange(
                              'firstName',
                              event.target
                                .value
                            )
                          }
                          className="w-full h-14 px-4 border border-gray-300 focus:outline-none focus:border-black font-light"
                          required
                        />

                        <input
                          type="text"
                          placeholder="Last name"
                          value={
                            formData.lastName
                          }
                          onChange={event =>
                            handleInputChange(
                              'lastName',
                              event.target
                                .value
                            )
                          }
                          className="w-full h-14 px-4 border border-gray-300 focus:outline-none focus:border-black font-light"
                          required
                        />
                      </div>

                      {/* Address */}

                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Address"
                          value={
                            formData.address
                          }
                          onChange={event =>
                            handleInputChange(
                              'address',
                              event.target
                                .value
                            )
                          }
                          className="w-full h-14 px-4 pr-12 border border-gray-300 focus:outline-none focus:border-black font-light"
                          required
                        />

                        <Search
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                          size={19}
                          strokeWidth={1.5}
                        />
                      </div>

                      {/* Apartment */}

                      <input
                        type="text"
                        placeholder="Apartment, suite, etc. (optional)"
                        value={
                          formData.apartment
                        }
                        onChange={event =>
                          handleInputChange(
                            'apartment',
                            event.target
                              .value
                          )
                        }
                        className="w-full h-14 px-4 border border-gray-300 focus:outline-none focus:border-black font-light"
                      />

                      {/* City / Province / Postal */}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <input
                          type="text"
                          placeholder="City"
                          value={
                            formData.city
                          }
                          onChange={event =>
                            handleInputChange(
                              'city',
                              event.target
                                .value
                            )
                          }
                          className="w-full h-14 px-4 border border-gray-300 focus:outline-none focus:border-black font-light"
                          required
                        />

                        <div className="relative">
                          <select
                            value={
                              formData.state
                            }
                            onChange={event =>
                              handleInputChange(
                                'state',
                                event.target
                                  .value
                              )
                            }
                            className="w-full h-14 px-4 pr-10 border border-gray-300 bg-white appearance-none focus:outline-none focus:border-black font-light"
                            required
                          >
                            <option value="">
                              Province
                            </option>

                            {SOUTH_AFRICAN_PROVINCES.map(
                              province => (
                                <option
                                  key={
                                    province
                                  }
                                  value={
                                    province
                                  }
                                >
                                  {
                                    province
                                  }
                                </option>
                              )
                            )}
                          </select>

                          <ChevronDown
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                            size={18}
                          />
                        </div>

                        <input
                          type="text"
                          placeholder="Postal code"
                          value={
                            formData.zipCode
                          }
                          onChange={event =>
                            handleInputChange(
                              'zipCode',
                              event.target
                                .value
                            )
                          }
                          className="w-full h-14 px-4 border border-gray-300 focus:outline-none focus:border-black font-light"
                          required
                        />
                      </div>

                      {/* Phone */}

                      <div className="relative">
                        <input
                          type="tel"
                          placeholder="Phone (optional)"
                          value={
                            formData.phone
                          }
                          onChange={event =>
                            handleInputChange(
                              'phone',
                              event.target
                                .value
                            )
                          }
                          className="w-full h-14 px-4 pr-12 border border-gray-300 focus:outline-none focus:border-black font-light"
                        />

                        <Info
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                          size={18}
                          strokeWidth={1.5}
                        />
                      </div>
                    </div>
                  </section>

                  {/* =======================================
                      SHIPPING
                  ======================================= */}

                  <section>
                    <h3
                      className="text-lg font-light tracking-wide mb-5"
                      style={{
                        fontFamily:
                          'Helvetica Neue, Arial, sans-serif',
                      }}
                    >
                      Shipping method
                    </h3>

                    <div className="border border-gray-200 bg-gray-50 p-5">
                      <div className="flex items-start gap-3">
                        <ShieldCheck
                          size={19}
                          className="text-gray-500 mt-0.5"
                          strokeWidth={1.5}
                        />

                        <div>
                          <p className="text-sm font-medium mb-1">
                            Shipping calculated
                            after your address
                          </p>

                          <p className="text-xs text-gray-500 leading-relaxed">
                            Enter your complete
                            delivery address to
                            determine the available
                            shipping options.
                          </p>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* =======================================
                    PAYMENT
   ======================================= */}

<section>
  <h3
    className="text-lg font-light tracking-wide mb-2"
    style={{
      fontFamily:
        'Helvetica Neue, Arial, sans-serif',
    }}
  >
    Payment
  </h3>

  <p className="text-sm text-gray-500 font-light mb-5">
    All transactions are secure
    and encrypted.
  </p>

  <div className="border border-gray-300">
    <div className="p-5 bg-gray-50 border-b border-gray-300">
      <label className="flex items-center gap-3">
        <input
          type="radio"
          name="payment"
          value="credit_card"
          checked={
            formData.paymentMethod ===
            'credit_card'
          }
          onChange={event =>
            handleInputChange(
              'paymentMethod',
              event.target
                .value
            )
          }
          className="w-4 h-4"
          style={{
            accentColor:
              '#B58627',
          }}
        />

        <span className="text-sm font-medium">
          Credit card
        </span>

        <div className="ml-auto hidden sm:flex items-center gap-1">
          <span className="px-2 py-1 bg-white border border-gray-200 text-[9px] font-bold text-blue-700">
            VISA
          </span>

          <span className="px-2 py-1 bg-white border border-gray-200 text-[9px] font-bold">
            MC
          </span>

          <span className="px-2 py-1 bg-white border border-gray-200 text-[9px] font-bold text-blue-600">
            AMEX
          </span>
        </div>
      </label>
    </div>

    {formData.paymentMethod === 'credit_card' && (
      clientSecret ? (
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <StripePaymentForm onSuccess={completeOrder} />
        </Elements>
      ) : (
        <div className="p-8 text-center text-sm text-gray-500">
          Loading payment gateway...
        </div>
      )
    )}
  </div>

  {/* Shop Pay */}

  <div className="mt-4 border border-purple-200 bg-purple-50 p-4">
    <div className="flex items-center gap-3">
      <div className="bg-[#5a31f4] text-white px-3 py-1.5 text-sm font-bold">
        shop
        <span className="font-normal">Pay</span>
      </div>

      <span className="text-sm text-gray-600 font-light">
        Pay in full or in installments.
      </span>
    </div>
  </div>

  {/* Discount Code Section */}
  <div className="mt-4 space-y-2">
    <div className="flex gap-2">
      <input
        type="text"
        placeholder="Discount code"
        value={discountCode}
        onChange={e => setDiscountCode(e.target.value)}
        className="flex-1 h-12 px-4 border border-gray-300 focus:outline-none focus:border-black font-light text-sm"
      />
      <button
        type="button"
        onClick={handleApplyDiscount}
        className="px-6 h-12 border border-gray-300 bg-black text-white hover:bg-gray-800 transition-colors text-sm font-medium tracking-wide"
      >
        Apply
      </button>
    </div>
    {appliedDiscount && (
      <p className="text-xs text-green-600 font-medium">Applied {appliedDiscount.code}</p>
    )}
    {discountError && !appliedDiscount && (
      <p className="text-xs text-red-600 font-medium">{discountError}</p>
    )}
  </div>
</section>

                  {/* =======================================
                      REMEMBER ME
                  ======================================= */}

                  {!user && (
                    <section>
                      <h3
                        className="text-lg font-light tracking-wide mb-5"
                        style={{
                          fontFamily:
                            'Helvetica Neue, Arial, sans-serif',
                        }}
                      >
                        Remember me
                      </h3>

                      <label className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={
                            formData.rememberMe
                          }
                          onChange={event =>
                            handleInputChange(
                              'rememberMe',
                              event.target
                                .checked
                            )
                          }
                          className="w-4 h-4 mt-0.5"
                          style={{
                            accentColor:
                              '#B58627',
                          }}
                        />

                        <span className="text-sm text-gray-500 font-light leading-relaxed">
                          Save my information for
                          a faster checkout.
                        </span>
                      </label>

                      {formData.rememberMe && (
                        <div className="mt-4 border border-gray-300 p-4 flex items-center gap-3">
                          <span className="text-gray-400">
                            +27
                          </span>

                          <input
                            type="tel"
                            placeholder="Mobile phone number"
                            value={
                              formData.mobilePhone
                            }
                            onChange={event =>
                              handleInputChange(
                                'mobilePhone',
                                event.target
                                  .value
                              )
                            }
                            className="flex-1 outline-none border-none font-light"
                          />
                        </div>
                      )}
                    </section>
                  )}

                  {/* =======================================
                      ORDER ERROR

                      Shown when a real createOrder() call fails.
                      Deliberately never reached from the success
                      path — a failed order must keep the customer on
                      this form so they can fix and retry, not be
                      routed to "Order Confirmed".
                  ======================================= */}

                  {checkoutError && (
                    <div className="flex items-start gap-3 border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                      <AlertCircle
                        size={18}
                        className="mt-0.5 flex-shrink-0"
                      />

                      <div>
                        <p className="font-medium mb-0.5">
                          We couldn't place your order
                        </p>

                        <p className="text-red-600">
                          {checkoutError}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* =======================================
                      SECURITY
                  ======================================= */}

                  <div className="flex items-center justify-between border-t border-gray-200 pt-6 text-xs text-gray-500">
                    <div className="flex items-center gap-2">
                      <Lock
                        size={15}
                        strokeWidth={1.5}
                      />

                      <span>
                        Secure and encrypted
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <ShieldCheck
                        size={15}
                        strokeWidth={1.5}
                      />

                      <span>
                        Secure checkout
                      </span>
                    </div>
                  </div>

                  {/* =======================================
                      TERMS
                  ======================================= */}

                  <p className="text-xs text-gray-500 text-center leading-relaxed">
                    By continuing, you agree to
                    the applicable terms of service
                    and privacy policy.
                  </p>
                </form>
              </div>
            </main>

            {/* =============================================
                RIGHT / ORDER SUMMARY
            ============================================= */}

            <aside className="lg:w-[430px] xl:w-[480px] bg-gray-50 border-t lg:border-t-0 lg:border-l border-gray-200 px-4 py-8 sm:px-6 lg:px-10 xl:px-12">
              <div className="lg:sticky lg:top-28">
                {/* =========================================
                    HELP
                ========================================= */}

                <div className="bg-white border border-gray-200 p-5 mb-7">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium tracking-wide">
                      Need help?
                    </h3>

                    <span className="text-[10px] uppercase tracking-[0.2em] text-gray-400">
                      Support
                    </span>
                  </div>

                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={
                        handleEmailClick
                      }
                      className="block text-left text-xs text-[#B58627] hover:text-black hover:underline transition-colors"
                    >
                      support@notorious.y2.com
                    </button>

                    <button
                      type="button"
                      onClick={
                        handlePhoneClick
                      }
                      className="block text-left text-xs text-[#B58627] hover:text-black hover:underline transition-colors"
                    >
                      +27 63 503 5882
                    </button>

                    <button
  type="button"
  onClick={() => openSupportChat()}
  className="block text-left text-xs text-[#B58627] hover:text-black hover:underline transition-colors"
>
  Help Center
</button>
                  </div>
                </div>

                {/* =========================================
                    ITEMS
                ========================================= */}

                <div className="space-y-5">
                  {items.map(
                    item => (
                      <div
                        key={
                          item.uniqueId
                        }
                        className="flex items-start gap-4"
                      >
                        {/* IMAGE */}

                        <div className="relative flex-shrink-0">
                          <img
                            src={
                              item.image
                            }
                            alt={
                              item.name
                            }
                            className="w-20 h-20 object-cover border border-gray-200 bg-white"
                          />

                          <div className="absolute -top-2 -right-2 min-w-5 h-5 px-1 bg-black text-white text-[10px] flex items-center justify-center rounded-full">
                            {
                              item.quantity
                            }
                          </div>
                        </div>

                        {/* INFO */}

                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-light text-gray-900 leading-snug">
                            {
                              item.name
                            }
                          </h4>

                          {(
                            item.selectedColor ||
                            item.selectedSize
                          ) && (
                            <p className="text-xs text-gray-500 mt-1">
                              {item.selectedColor ??
                                ''}

                              {item.selectedColor &&
                              item.selectedSize
                                ? ' / '
                                : ''}

                              {item.selectedSize ??
                                ''}
                            </p>
                          )}
                        </div>

                        {/* PRICE */}

                        <div className="text-sm font-light text-right whitespace-nowrap">
                          {formatPrice(
                            item.price *
                              item.quantity
                          )}
                        </div>
                      </div>
                    )
                  )}
                </div>

                {/* =========================================
                    SUMMARY
                ========================================= */}

                <div className="border-t border-gray-200 mt-8 pt-6 space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 font-light">
                      Subtotal ·{' '}
                      {itemCount}{' '}
                      {itemCount ===
                      1
                        ? 'item'
                        : 'items'}
                    </span>

                    <span className="font-light">
                      {formatPrice(
                        subtotal
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
  <span className="text-gray-500 font-light">
    Shipping
  </span>

  <span className="text-gray-500 font-light text-right">
    Calculated at checkout
  </span>
</div>

<div className="flex items-center justify-between text-sm">
  <span className="text-gray-500 font-light">
    Tax (VAT 15%)
  </span>

  <span className="font-light">
    {formatPrice(tax)}
  </span>
</div>
                </div>

                

                {/* =========================================
                    TOTAL
                ========================================= */}

                <div className="border-t border-gray-200 mt-6 pt-6">
                  <div className="flex items-end justify-between">
                    <span className="text-lg font-light tracking-wide">
                      Total
                    </span>

                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-1">
                        ZAR
                      </div>

                      <div className="text-2xl font-light tracking-wide">
                        {formatPrice(
                          total
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* =========================================
                    LINKS
                ========================================= */}

                <div className="border-t border-gray-200 mt-8 pt-6">
                  <div className="grid grid-cols-2 gap-y-3">
                    <button
  type="button"
  onClick={() => setInfoModal('shipping')}
  className="text-left text-xs text-gray-500 hover:text-black hover:underline transition-colors"
>
  Shipping Info
</button>

<button
  type="button"
  onClick={() => setInfoModal('returns')}
  className="text-left text-xs text-gray-500 hover:text-black hover:underline transition-colors"
>
  Returns Policy
</button>

<button
  type="button"
  onClick={() => setShowSizeGuide(true)}
  className="text-left text-xs text-gray-500 hover:text-black hover:underline transition-colors"
>
  Size Guide
</button>

<button
  type="button"
  onClick={() => setInfoModal('faq')}
  className="text-left text-xs text-gray-500 hover:text-black hover:underline transition-colors"
>
  FAQ
</button>
                  </div>
                </div>

                {/* =========================================
                    EMPTY CART
                ========================================= */}

                {items.length ===
                  0 && (
                  <div className="mt-8 border border-gray-200 bg-white p-6 text-center">
                    <p className="text-sm text-gray-500 mb-4">
                      Your cart is
                      empty.
                    </p>

                    <button
                      type="button"
                      onClick={
                        onBackToShopping
                      }
                      className="text-xs uppercase tracking-[0.2em] text-black underline underline-offset-4"
                    >
                      Continue shopping
                    </button>
                  </div>
                )}


                <SizeGuideModal isOpen={showSizeGuide} onClose={() => setShowSizeGuide(false)} />

<InfoModal isOpen={infoModal === 'shipping'} onClose={() => setInfoModal(null)} title="Shipping Info">
  <p>We ship across South Africa via our courier partners, with delivery in 2–5 business days for most areas.</p>
  <p>Orders over R500 qualify for free standard shipping. Shipping costs for smaller orders are calculated at checkout based on your delivery address.</p>
  <p>Once your order ships, you'll receive a tracking number by email — you can also check status any time from My Account → Orders.</p>
</InfoModal>

<InfoModal isOpen={infoModal === 'returns'} onClose={() => setInfoModal(null)} title="Returns Policy">
  <p>Not the right fit? You can request a return within 14 days of delivery for unworn items in original condition with tags attached.</p>
  <p>Start a return from My Account → Returns, or contact support@notorious.y2.com with your order number.</p>
  <p>Refunds are issued to your original payment method once we receive and inspect the returned item.</p>
</InfoModal>

<InfoModal isOpen={infoModal === 'faq'} onClose={() => setInfoModal(null)} title="FAQ">
  <div>
    <p className="font-medium text-gray-900 mb-1">How long does delivery take?</p>
    <p>2–5 business days for most South African addresses.</p>
  </div>
  <div>
    <p className="font-medium text-gray-900 mb-1">Can I change my order after placing it?</p>
    <p>Contact us as soon as possible at support@notorious.y2.com — we can usually amend an order before it ships.</p>
  </div>
  <div>
    <p className="font-medium text-gray-900 mb-1">Do you ship internationally?</p>
    <p>Not yet — currently we ship within South Africa only.</p>
  </div>
  <div>
    <p className="font-medium text-gray-900 mb-1">What payment methods do you accept?</p>
    <p>Credit/debit cards via Stripe, with more options coming soon.</p>
  </div>
</InfoModal>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;