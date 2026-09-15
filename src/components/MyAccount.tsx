import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  X,
  FileText,
  RotateCcw,
  CreditCard,
  Ticket,
  Wallet,
  Gift,
  User,
  Receipt,
  Package,
  CheckCircle,
  Truck,
  Search,
  Plus,
  ArrowUpRight,
  ChevronRight,
  MapPin,
  CalendarDays,
  Mail,
  Phone,
  Lock,
  Download,
  MoreHorizontal,
  CircleDollarSign,
  Clock3,
  AlertCircle,
  Loader2,
  Menu,
} from 'lucide-react';

import { User as UserType } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { AdminToastProvider, useAdminToast } from './admin/AdminUI';

interface MyAccountProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserType | null;
  onSignOut: () => void;
}

type SectionId =
  | 'orders'
  | 'invoices'
  | 'returns'
  | 'payments'
  | 'coupons'
  | 'credit'
  | 'personal'
  | 'paymentHistory';

const FONT = "'Helvetica Neue', Arial, sans-serif";
const ACCENT = '#C44D2B';

/* ========================================================================== */
/* DATABASE TYPES                                                             */
/* ========================================================================== */

interface OrderRow {
  id: string;
  order_number: string | null;
  total: number | string;
  payment_status: string;
  fulfillment_status: string;
  created_at: string;
  currency_code: string;
}

interface InvoiceRow {
  id: string;
  invoice_number: string | null;
  order_id: string;
  amount: number | string;
  status: string;
  issued_at: string;
}

interface ReturnRow {
  id: string;
  order_id: string;
  user_id: string | null;
  reason: string;
  status: string;
  refund_amount: number | string;
  created_at: string;
}

interface PaymentMethodRow {
  id: string;
  type: string;
  title: string;
  last4: string | null;
  expiry: string | null;
  is_default: boolean;
  created_at: string;
}

interface PaymentTransactionRow {
  id: string;
  order_id: string | null;
  type: string;
  method: string | null;
  amount: number | string;
  fee: number | string;
  net: number | string;
  status: string;
  created_at: string;
}

interface DiscountRow {
  id: string;
  code: string;
  type: string;
  value: number | string;
  min_order: number | string;
  usage_limit: number | null;
  used_count: number;
  starts_at: string;
  ends_at: string | null;
  status: string;
  description: string | null;
}

interface ProfileRow {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  phone: string | null;
  date_of_birth: string | null;
  default_address: string | null;
}

interface CreditAccountRow {
  user_id: string;
  balance: number | string;
}

/* ========================================================================== */
/* NAVIGATION                                                                 */
/* ========================================================================== */

const navItems: {
  id: SectionId;
  label: string;
  icon: React.ReactNode;
}[] = [
  {
    id: 'orders',
    label: 'Orders',
    icon: <Package size={19} strokeWidth={1.5} />,
  },
  {
    id: 'invoices',
    label: 'Invoices',
    icon: <FileText size={19} strokeWidth={1.5} />,
  },
  {
    id: 'returns',
    label: 'Returns',
    icon: <RotateCcw size={19} strokeWidth={1.5} />,
  },
  {
    id: 'payments',
    label: 'Payments & Credit',
    icon: <CreditCard size={19} strokeWidth={1.5} />,
  },
  {
    id: 'coupons',
    label: 'Coupons & Offers',
    icon: <Ticket size={19} strokeWidth={1.5} />,
  },
  {
    id: 'credit',
    label: 'Credit & Refunds',
    icon: <Wallet size={19} strokeWidth={1.5} />,
  },
  {
    id: 'personal',
    label: 'Personal Details',
    icon: <User size={19} strokeWidth={1.5} />,
  },
  {
    id: 'paymentHistory',
    label: 'Payment History',
    icon: <Receipt size={19} strokeWidth={1.5} />,
  },
];

/* ========================================================================== */
/* COMPONENT                                                                  */
/* ========================================================================== */

const MyAccount: React.FC<MyAccountProps> = ({
  isOpen,
  onClose,
  user,
  onSignOut,
}) => {
  const [activeSection, setActiveSection] =
    useState<SectionId>('orders');

  /* ------------------------------------------------------------------------ */
  /* DATABASE DATA                                                             */
  /* ------------------------------------------------------------------------ */

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [returns, setReturns] = useState<ReturnRow[]>([]);
  const [paymentMethods, setPaymentMethods] =
    useState<PaymentMethodRow[]>([]);
  const [paymentHistory, setPaymentHistory] =
    useState<PaymentTransactionRow[]>([]);
  const [coupons, setCoupons] =
    useState<DiscountRow[]>([]);

  const [creditBalance, setCreditBalance] =
    useState(0);

  const [profile, setProfile] =
    useState<ProfileRow | null>(null);

  /* ------------------------------------------------------------------------ */
  /* LOADING STATE                                                             */
  /* ------------------------------------------------------------------------ */

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] =
    useState(false);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [loadError, setLoadError] =
    useState<string | null>(null);

  /* ------------------------------------------------------------------------ */
  /* UI STATE                                                                  */
  /* ------------------------------------------------------------------------ */

  const [isAddCardOpen, setIsAddCardOpen] =
    useState(false);

  const [isReturnModalOpen, setIsReturnModalOpen] =
    useState(false);

  const [searchQuery, setSearchQuery] =
    useState('');

  const [voucherInput, setVoucherInput] =
    useState('');

  const { showToast: showAdminToast } = useAdminToast();

  /* Card form */
  const [cardNumber, setCardNumber] =
    useState('');

  const [cardExpiry, setCardExpiry] =
    useState('');

  const [cardCvc, setCardCvc] =
    useState('');

  /* Return form */
  const [returnOrderNum, setReturnOrderNum] =
    useState('');

  const [returnReason, setReturnReason] =
    useState('Wrong size');

  /* Personal details */
  const [fullName, setFullName] =
    useState(user?.name || '');

  const [phone, setPhone] =
    useState('');

  const [dob, setDob] =
    useState('');

  const [address, setAddress] =
    useState('');

  /* ======================================================================== */
  /* LOAD ACCOUNT DATA                                                        */
  /* ======================================================================== */

  const loadAccountData = useCallback(
    async (userId: string) => {
      setIsLoading(true);
      setLoadError(null);

      try {
        /* ------------------------------------------------------------------ */
        /* INDEPENDENT ACCOUNT QUERIES                                        */
        /*                                                                      */
        /* Profile, orders, returns, payment methods, transactions, discounts */
        /* and credit do not depend on one another, so fetch them together.    */
        /* Invoices remain below because they require the returned order IDs.  */
        /* ------------------------------------------------------------------ */

        const [
          profileResult,
          ordersResult,
          returnsResult,
          methodsResult,
          transactionsResult,
          discountsResult,
          creditResult,
        ] = await Promise.all([
          supabase
            .from('profiles')
            .select(
              `
                id,
                email,
                name,
                avatar,
                phone,
                date_of_birth,
                default_address
              `
            )
            .eq('id', userId)
            .maybeSingle(),

          supabase
            .from('orders')
            .select(
              `
                id,
                order_number,
                total,
                payment_status,
                fulfillment_status,
                created_at,
                currency_code
              `
            )
            .eq('user_id', userId)
            .order('created_at', {
              ascending: false,
            }),

          supabase
            .from('returns')
            .select(
              `
                id,
                order_id,
                user_id,
                reason,
                status,
                refund_amount,
                created_at
              `
            )
            .eq('user_id', userId)
            .order('created_at', {
              ascending: false,
            }),

          supabase
            .from('payment_methods')
            .select(
              `
                id,
                type,
                title,
                last4,
                expiry,
                is_default,
                created_at
              `
            )
            .eq('user_id', userId)
            .order('is_default', {
              ascending: false,
            })
            .order('created_at', {
              ascending: false,
            }),

          supabase
            .from('payment_transactions')
            .select(
              `
                id,
                order_id,
                type,
                method,
                amount,
                fee,
                net,
                status,
                created_at
              `
            )
            .eq('user_id', userId)
            .order('created_at', {
              ascending: false,
            }),

          supabase
            .from('discounts')
            .select(
              `
                id,
                code,
                type,
                value,
                min_order,
                usage_limit,
                used_count,
                starts_at,
                ends_at,
                status,
                description
              `
            )
            .in('status', [
              'Active',
              'Scheduled',
            ])
            .order('created_at', {
              ascending: false,
            }),

          supabase
            .from('credit_accounts')
            .select(
              `
                user_id,
                balance
              `
            )
            .eq('user_id', userId)
            .maybeSingle(),
        ]);

        if (profileResult.error) {
          throw profileResult.error;
        }

        if (ordersResult.error) {
          throw ordersResult.error;
        }

        if (returnsResult.error) {
          throw returnsResult.error;
        }

        if (methodsResult.error) {
          throw methodsResult.error;
        }

        if (transactionsResult.error) {
          throw transactionsResult.error;
        }

        if (discountsResult.error) {
          throw discountsResult.error;
        }

        if (creditResult.error) {
          throw creditResult.error;
        }

        const profileData =
          profileResult.data as ProfileRow | null;

        const orderData =
          (ordersResult.data || []) as OrderRow[];

        setProfile(profileData);
        setOrders(orderData);

        setReturns(
          (returnsResult.data || []) as ReturnRow[]
        );

        setPaymentMethods(
          (methodsResult.data || []) as PaymentMethodRow[]
        );

        setPaymentHistory(
          (transactionsResult.data || []) as PaymentTransactionRow[]
        );

        setCoupons(
          (discountsResult.data || []) as DiscountRow[]
        );

        const creditData =
          creditResult.data as CreditAccountRow | null;

        setCreditBalance(
          Number(creditData?.balance || 0)
        );

        if (profileData) {
          setFullName(profileData.name || '');
          setPhone(profileData.phone || '');
          setDob(profileData.date_of_birth || '');
          setAddress(profileData.default_address || '');
        } else {
          setFullName(user?.name || '');
          setPhone('');
          setDob('');
          setAddress('');
        }

        /* ------------------------------------------------------------------ */
        /* INVOICES                                                           */
        /* ------------------------------------------------------------------ */

        let invoiceData: InvoiceRow[] = [];

        if (orderData.length > 0) {
          const orderIds =
            orderData.map(order => order.id);

          const invoicesResult = await supabase
            .from('invoices')
            .select(
              `
                id,
                invoice_number,
                order_id,
                amount,
                status,
                issued_at
              `
            )
            .in(
              'order_id',
              orderIds
            )
            .order('issued_at', {
              ascending: false,
            });

          if (invoicesResult.error) {
            throw invoicesResult.error;
          }

          invoiceData =
            (invoicesResult.data || []) as InvoiceRow[];
        }

        setInvoices(invoiceData);
      } catch (error) {
        console.error(
          '[NOTORIOUS.Y2] Failed to load account data:',
          error
        );

        setLoadError(
          error instanceof Error
            ? error.message
            : 'Unable to load account data.'
        );
      } finally {
        setIsLoading(false);
      }
    },
    [user?.name]
  );

  /* ======================================================================== */
  /* LOAD WHEN USER CHANGES                                                    */
  /* ======================================================================== */

  useEffect(() => {
    if (!user?.id) {
      setOrders([]);
      setInvoices([]);
      setReturns([]);
      setPaymentMethods([]);
      setPaymentHistory([]);
      setCoupons([]);
      setCreditBalance(0);
      setProfile(null);

      setFullName('');
      setPhone('');
      setDob('');
      setAddress('');

      return;
    }

    void loadAccountData(user.id);
  }, [user?.id, loadAccountData]);

  /* ======================================================================== */
  /* HELPERS                                                                   */
  /* ======================================================================== */

    const showToast = useCallback(
    (message: string, type: 'success' | 'error' = 'success') =>
      showAdminToast(type, message),
    [showAdminToast]
  );

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString(
      'en-ZA',
      {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }
    );

  const money = (value: number | string) =>
    `R${Number(value || 0).toLocaleString(
      'en-ZA',
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    )}`;

  const getOrderNumber = (
    orderId: string
  ) => {
    return (
      orders.find(
        order => order.id === orderId
      )?.order_number ||
      orderId.slice(0, 8)
    );
  };

  const getOrderByNumber = (
    orderNumber: string
  ) =>
    orders.find(
      order =>
        order.order_number === orderNumber
    );

  /* ======================================================================== */
  /* DERIVED DATA                                                              */
  /* ======================================================================== */

  const filteredOrders = useMemo(() => {
    const query =
      searchQuery.trim().toLowerCase();

    if (!query) {
      return orders;
    }

    return orders.filter(order => {
      const orderNumber =
        order.order_number?.toLowerCase() || '';

      const fulfillment =
        order.fulfillment_status.toLowerCase();

      const payment =
        order.payment_status.toLowerCase();

      const date =
        order.created_at.toLowerCase();

      return (
        orderNumber.includes(query) ||
        fulfillment.includes(query) ||
        payment.includes(query) ||
        date.includes(query)
      );
    });
  }, [orders, searchQuery]);

  const totalSpent = useMemo(
    () =>
      orders.reduce(
        (sum, order) =>
          order.fulfillment_status !==
          'Cancelled'
            ? sum + Number(order.total || 0)
            : sum,
        0
      ),
    [orders]
  );

  const deliveredOrders = useMemo(
    () =>
      orders.filter(
        order =>
          order.fulfillment_status ===
          'Delivered'
      ).length,
    [orders]
  );

  /* ======================================================================== */
  /* ACTIONS                                                                   */
  /* ======================================================================== */

  // ============================================================
  // HANDLE ADD CARD
  // ============================================================

  const handleAddCard = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!user?.id) {
      showToast(
        'You must be signed in to add a payment method.',
        'error'
      );
      return;
    }

    if (!cardNumber || !cardExpiry) {
      return;
    }

    setIsSubmitting(true);

    try {
      const cleanCardNumber =
        cardNumber.replace(/\s/g, '');

      const last4 =
        cleanCardNumber.slice(-4);

      const type = 'Visa';

      const { data, error } =
        await supabase
          .from('payment_methods')
          .insert({
            user_id: user.id,
            type,
            title: `Visa ending in ${last4}`,
            last4,
            expiry: cardExpiry,
            is_default:
              paymentMethods.length === 0,
          })
          .select(
            `
              id,
              type,
              title,
              last4,
              expiry,
              is_default,
              created_at
            `
          )
          .single();

      if (error) {
        throw error;
      }

      if (data) {
        setPaymentMethods(prev => [
          data as PaymentMethodRow,
          ...prev,
        ]);
      }

      setIsAddCardOpen(false);

      setCardNumber('');
      setCardExpiry('');
      setCardCvc('');

      showToast(
        'Payment method added successfully.'
      );
    } catch (error) {
      console.error(
        '[NOTORIOUS.Y2] Failed to add payment method:',
        error
      );

      showToast(
        error instanceof Error
          ? error.message
          : 'Unable to add payment method.',
        'error'
      );
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleCreateReturn = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

        if (!user?.id) {
      showToast(
        'You must be signed in to request a return.',
        'error'
      );
      return;
    }

    const eligibleOrders =
      orders.filter(
        order =>
          order.fulfillment_status ===
          'Delivered'
      );

    const targetOrder =
      getOrderByNumber(returnOrderNum) ||
      eligibleOrders[0];

        if (!targetOrder) {
      showToast(
        'You do not have an eligible delivered order.',
        'error'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } =
        await supabase
          .from('returns')
          .insert({
            order_id: targetOrder.id,
            user_id: user.id,
            reason: returnReason,
            status: 'Requested',
            refund_amount:
              Number(targetOrder.total || 0),
          })
          .select(
            `
              id,
              order_id,
              user_id,
              reason,
              status,
              refund_amount,
              created_at
            `
          )
          .single();

      if (error) {
        throw error;
      }

      if (data) {
        setReturns(prev => [
          data as ReturnRow,
          ...prev,
        ]);
      }

      setReturnOrderNum('');
      setReturnReason('Wrong size');

      setIsReturnModalOpen(false);

      showToast(
        `Return requested for order ${targetOrder.order_number}`
      );
    } catch (error) {
      console.error(
        '[NOTORIOUS.Y2] Failed to create return:',
        error
      );

      showToast(
        error instanceof Error
          ? error.message
          : 'Unable to create return.',
        'error'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRedeemVoucher = async () => {
        if (!user?.id) {
      showToast(
        'You must be signed in to redeem a voucher.',
        'error'
      );
      return;
    }

    const code =
      voucherInput.trim().toUpperCase();

    if (!code) {
      return;
    }

    setIsSubmitting(true);

    try {
      const today =
        new Date()
          .toISOString()
          .split('T')[0];

      const { data: discount, error } =
        await supabase
          .from('discounts')
          .select(
            `
              id,
              code,
              type,
              value,
              min_order,
              usage_limit,
              used_count,
              starts_at,
              ends_at,
              status,
              description
            `
          )
          .eq('code', code)
          .eq('status', 'Active')
          .lte('starts_at', today)
          .or(
            `ends_at.is.null,ends_at.gte.${today}`
          )
          .maybeSingle();

      if (error) {
        throw error;
      }

      if (!discount) {
        showToast(
          'That voucher is not currently available.',
          'error'
        );
        return;
      }

      const typedDiscount =
        discount as DiscountRow;

      if (
        typedDiscount.usage_limit !== null &&
        typedDiscount.used_count >=
          typedDiscount.usage_limit
      ) {
        showToast(
          'That voucher has reached its usage limit.',
          'error'
        );
        return;
      }

      if (
        typedDiscount.type !== 'Fixed'
      ) {
        showToast(
          'This coupon is a promotional discount and cannot be converted into account credit.',
          'error'
        );
        return;
      }

      const creditAmount =
        Number(typedDiscount.value || 0);

      if (creditAmount <= 0) {
        showToast(
          'This voucher does not contain a credit value.',
          'error'
        );
        return;
      }

      const {
        error: creditError,
      } = await supabase
        .from('credit_transactions')
        .insert({
          user_id: user.id,
          amount: creditAmount,
          reason: 'Voucher redemption',
          voucher_code: typedDiscount.code,
        });

      if (creditError) {
        throw creditError;
      }

      const { data: updatedCredit } =
        await supabase
          .from('credit_accounts')
          .select('user_id, balance')
          .eq('user_id', user.id)
          .maybeSingle();

      setCreditBalance(
        Number(
          updatedCredit?.balance || 0
        )
      );

      setVoucherInput('');

      showToast(
        `Voucher redeemed successfully (+${money(
          creditAmount
        )} credit)`,
        'success'
      );
    } catch (error) {
      console.error(
        '[NOTORIOUS.Y2] Failed to redeem voucher:',
        error
      );

      showToast(
        error instanceof Error
          ? error.message
          : 'Unable to redeem voucher.',
        'error'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveProfile = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!user?.id) {
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } =
        await supabase
          .from('profiles')
          .update({
            name: fullName.trim(),
            phone:
              phone.trim() || null,
            date_of_birth:
              dob || null,
            default_address:
              address.trim() || null,
          })
          .eq('id', user.id)
          .select(
            `
              id,
              email,
              name,
              avatar,
              phone,
              date_of_birth,
              default_address
            `
          )
          .single();

      if (error) {
        throw error;
      }

      setProfile(data as ProfileRow);

      showToast(
        'Personal details updated successfully.',
        'success'
      );
    } catch (error) {
      console.error(
        '[NOTORIOUS.Y2] Failed to update profile:',
        error
      );

      showToast(
        error instanceof Error
          ? error.message
          : 'Unable to update your details.',
        'error'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ======================================================================== */
  /* SECTION HEADER                                                            */
  /* ======================================================================== */

  const SectionHeader = ({
    eyebrow,
    title,
    description,
    action,
  }: {
    eyebrow: string;
    title: string;
    description?: string;
    action?: React.ReactNode;
  }) => (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5 mb-8">
      <div>
        <p
          className="text-[10px] text-gray-400 uppercase tracking-[0.25em] mb-2"
          style={{ fontFamily: FONT }}
        >
          {eyebrow}
        </p>

        <h2
          className="text-2xl md:text-3xl font-light tracking-tight text-black"
          style={{ fontFamily: FONT }}
        >
          {title}
        </h2>

        {description && (
          <p className="text-sm text-gray-500 font-light mt-2 max-w-xl">
            {description}
          </p>
        )}
      </div>

      {action}
    </div>
  );

  /* ======================================================================== */
  /* ORDERS                                                                    */
  /* ======================================================================== */

  const renderOrders = () => (
    <div>
      <SectionHeader
        eyebrow="Your account"
        title="Orders"
        description="Track your latest purchases, deliveries and order history."
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-8">
        <AccountStat
          label="Total Orders"
          value={orders.length.toString()}
          icon={<Package size={17} />}
        />

        <AccountStat
          label="Delivered"
          value={deliveredOrders.toString()}
          icon={<CheckCircle size={17} />}
        />

        <AccountStat
          label="Total Spent"
          value={money(totalSpent)}
          icon={<CircleDollarSign size={17} />}
        />

        <AccountStat
          label="Credit"
          value={money(creditBalance)}
          icon={<Wallet size={17} />}
        />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-gray-400">
            Recent orders
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search
            size={15}
            strokeWidth={1.5}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
          />

          <input
            type="text"
            placeholder="Search orders..."
            value={searchQuery}
            onChange={e =>
              setSearchQuery(e.target.value)
            }
            className="w-full pl-10 pr-10 py-3 bg-white border border-gray-200 text-xs font-light focus:outline-none focus:border-black transition-colors"
            style={{ fontFamily: FONT }}
          />

          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {isLoading && orders.length === 0 ? (
        <LoadingState />
      ) : filteredOrders.length === 0 ? (
        <EmptyState
          icon={<Search size={20} />}
          title="No orders found"
          description={
            searchQuery
              ? 'Try another order number, date or status.'
              : 'Your orders will appear here after you make a purchase.'
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredOrders.map(order => {
            const status =
              order.fulfillment_status;

            return (
              <div
                key={order.id}
                className="group bg-white border border-gray-200 p-5 md:p-6 hover:border-gray-300 hover:shadow-sm transition-all duration-300"
              >
                <div className="flex flex-col lg:flex-row lg:items-center gap-5">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-10 h-10 bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
                      <Package
                        size={18}
                        strokeWidth={1.4}
                        className="text-gray-500"
                      />
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-black">
                          #
                          {order.order_number ||
                            order.id.slice(0, 8)}
                        </p>

                        <OrderStatusBadge
                          status={status}
                        />
                      </div>

                      <p className="text-xs text-gray-400 mt-1.5">
                        {formatDate(
                          order.created_at
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="hidden xl:flex items-center gap-2 min-w-[210px]">
                    <OrderProgress
                      status={status}
                    />
                  </div>

                  <div className="lg:text-right">
                    <p className="text-[9px] text-gray-400 uppercase tracking-[0.2em] mb-1">
                      Total
                    </p>

                    <p className="text-base font-light text-black">
                      {money(order.total)}
                    </p>
                  </div>

                  <button
                    onClick={() =>
                      showToast(
                        `Order ${
                          order.order_number ||
                          order.id.slice(0, 8)
                        }`
                      )
                    }
                    className="flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 text-[10px] uppercase tracking-[0.15em] text-gray-600 hover:text-white hover:bg-black hover:border-black transition-all"
                  >
                    View
                    <ArrowUpRight size={13} />
                  </button>
                </div>

                <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    {status === 'Shipped' && (
                      <>
                        <Truck size={14} />
                        <span>
                          Package is currently in transit
                        </span>
                      </>
                    )}

                    {status === 'Delivered' && (
                      <>
                        <CheckCircle size={14} />
                        <span>
                          Delivered successfully
                        </span>
                      </>
                    )}

                    {status === 'Cancelled' && (
                      <>
                        <AlertCircle size={14} />
                        <span>
                          Order was cancelled
                        </span>
                      </>
                    )}

                    {status === 'Processing' && (
                      <>
                        <Clock3 size={14} />
                        <span>
                          Order is being prepared
                        </span>
                      </>
                    )}

                    {status === 'Pending' && (
                      <>
                        <Clock3 size={14} />
                        <span>
                          Order is pending
                        </span>
                      </>
                    )}
                  </div>

                  {invoices.some(
                    invoice =>
                      invoice.order_id ===
                      order.id
                  ) && (
                    <button
                      onClick={() =>
                        showToast(
                          `Invoice available for ${
                            order.order_number ||
                            order.id.slice(0, 8)
                          }`
                        )
                      }
                      className="text-[10px] uppercase tracking-[0.15em] text-gray-400 hover:text-black flex items-center gap-1 transition-colors"
                    >
                      Invoice
                      <ChevronRight size={12} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  /* ======================================================================== */
  /* INVOICES                                                                  */
  /* ======================================================================== */

  const renderInvoices = () => (
    <div>
      <SectionHeader
        eyebrow="Billing"
        title="Invoices"
        description="View and download invoices for your previous orders."
      />

      {invoices.length === 0 ? (
        <EmptyState
          icon={<FileText size={20} />}
          title="No invoices"
          description="Invoices will appear here when they are generated for your orders."
        />
      ) : (
        <div className="bg-white border border-gray-200 overflow-hidden">
          <div className="hidden md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <TableHeader>
                    Invoice
                  </TableHeader>
                  <TableHeader>
                    Order
                  </TableHeader>
                  <TableHeader>
                    Date
                  </TableHeader>
                  <TableHeader>
                    Amount
                  </TableHeader>
                  <TableHeader>
                    Status
                  </TableHeader>
                  <TableHeader align="right">
                    Action
                  </TableHeader>
                </tr>
              </thead>

              <tbody>
                {invoices.map(invoice => (
                  <tr
                    key={invoice.id}
                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors"
                  >
                    <TableCell strong>
                      {invoice.invoice_number ||
                        invoice.id.slice(0, 8)}
                    </TableCell>

                    <TableCell>
                      {getOrderNumber(
                        invoice.order_id
                      )}
                    </TableCell>

                    <TableCell>
                      {formatDate(
                        invoice.issued_at
                      )}
                    </TableCell>

                    <TableCell>
                      {money(invoice.amount)}
                    </TableCell>

                    <TableCell>
                      <StatusPill
                        status={
                          invoice.status
                        }
                      />
                    </TableCell>

                    <TableCell align="right">
                      <button
                        onClick={() =>
                          showToast(
                            'Invoice download will be connected to invoice storage next.'
                          )
                        }
                        className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] text-gray-500 hover:text-black"
                      >
                        <Download size={13} />
                        Download
                      </button>
                    </TableCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden divide-y divide-gray-100">
            {invoices.map(invoice => (
              <div
                key={invoice.id}
                className="p-5"
              >
                <div className="flex justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">
                      {invoice.invoice_number ||
                        invoice.id.slice(0, 8)}
                    </p>

                    <p className="text-xs text-gray-400 mt-1">
                      Order{' '}
                      {getOrderNumber(
                        invoice.order_id
                      )}
                    </p>
                  </div>

                  <StatusPill
                    status={invoice.status}
                  />
                </div>

                <div className="flex justify-between items-end mt-5">
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.18em] text-gray-400">
                      Amount
                    </p>

                    <p className="text-sm mt-1">
                      {money(invoice.amount)}
                    </p>
                  </div>

                  <button
                    onClick={() =>
                      showToast(
                        'Invoice download will be connected to invoice storage next.'
                      )
                    }
                    className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em]"
                  >
                    <Download size={13} />
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  /* ======================================================================== */
  /* RETURNS                                                                   */
  /* ======================================================================== */

  const renderReturns = () => (
    <div>
      <SectionHeader
        eyebrow="Orders"
        title="Returns & Exchanges"
        description="Manage returns and track the status of your refund requests."
        action={
          <button
            onClick={() => {
              const firstEligible =
                orders.find(
                  order =>
                    order.fulfillment_status ===
                    'Delivered'
                );

              setReturnOrderNum(
                firstEligible?.order_number || ''
              );

              setIsReturnModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-black text-white text-[10px] uppercase tracking-[0.16em] hover:bg-[#C44D2B] transition-colors"
          >
            <Plus size={14} />
            Start New Return
          </button>
        }
      />

      {returns.length === 0 ? (
        <EmptyState
          icon={<RotateCcw size={20} />}
          title="No returns"
          description="You currently have no return requests."
        />
      ) : (
        <div className="space-y-3">
          {returns.map(item => (
            <div
              key={item.id}
              className="bg-white border border-gray-200 p-5 md:p-6"
            >
              <div className="flex flex-col md:flex-row md:items-center gap-5">
                <div className="w-11 h-11 bg-gray-50 border border-gray-100 flex items-center justify-center">
                  <RotateCcw
                    size={18}
                    strokeWidth={1.5}
                    className="text-gray-500"
                  />
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium">
                      Order #
                      {getOrderNumber(
                        item.order_id
                      )}
                    </p>

                    <StatusPill
                      status={item.status}
                    />
                  </div>

                  <p className="text-xs text-gray-400 mt-1.5">
                    Requested{' '}
                    {formatDate(
                      item.created_at
                    )}
                  </p>

                  <p className="text-xs text-gray-500 mt-2">
                    Reason: {item.reason}
                  </p>
                </div>

                <div className="md:text-right">
                  <p className="text-[9px] uppercase tracking-[0.18em] text-gray-400">
                    Refund amount
                  </p>

                  <p className="text-lg font-light mt-1">
                    {money(item.refund_amount)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  /* ======================================================================== */
  /* PAYMENTS                                                                  */
  /* ======================================================================== */

  const renderPayments = () => (
    <div>
      <SectionHeader
        eyebrow="Billing"
        title="Payment Methods"
        description="Manage the payment methods connected to your account."
        action={
          <button
            onClick={() =>
              setIsAddCardOpen(true)
            }
            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-black text-white text-[10px] uppercase tracking-[0.16em] hover:bg-[#C44D2B] transition-colors"
          >
            <Plus size={14} />
            Add Payment Method
          </button>
        }
      />

      {paymentMethods.length === 0 ? (
        <EmptyState
          icon={<CreditCard size={20} />}
          title="No saved payment methods"
          description="Add a payment card to make future checkout faster."
        />
      ) : (
        <div className="space-y-3">
          {paymentMethods.map(method => (
            <div
              key={method.id}
              className="bg-white border border-gray-200 p-5 md:p-6"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-50 border border-gray-100 flex items-center justify-center">
                  <CreditCard
                    size={20}
                    strokeWidth={1.4}
                    className="text-gray-600"
                  />
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium">
                      {method.title}
                    </p>

                    {method.is_default && (
                      <span className="px-2 py-1 bg-black text-white text-[8px] uppercase tracking-[0.15em]">
                        Default
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-gray-400 mt-1">
                    {method.type}
                    {method.last4
                      ? ` · •••• ${method.last4}`
                      : ''}
                    {method.expiry
                      ? ` · Expires ${method.expiry}`
                      : ''}
                  </p>
                </div>

                <button
                  onClick={() =>
                    showToast(
                      `${method.title} selected`
                    )
                  }
                  className="hidden sm:flex p-2 text-gray-400 hover:text-black"
                >
                  <MoreHorizontal size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 p-4 bg-gray-50 border border-gray-100 flex gap-3">
        <Lock
          size={15}
          className="text-gray-500 flex-shrink-0 mt-0.5"
        />

        <p className="text-xs text-gray-500 leading-relaxed">
          Only the payment details required by
          your account are stored. Full card
          numbers are never displayed here.
        </p>
      </div>
    </div>
  );

  /* ======================================================================== */
  /* COUPONS                                                                   */
  /* ======================================================================== */

  const renderCoupons = () => (
    <div>
      <SectionHeader
        eyebrow="Member benefits"
        title="Coupons & Offers"
        description="Exclusive offers and promotional codes available to you."
      />

      {coupons.length === 0 ? (
        <EmptyState
          icon={<Ticket size={20} />}
          title="No offers available"
          description="There are currently no active or scheduled offers for your account."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {coupons.map(coupon => (
            <div
              key={coupon.id}
              className="relative overflow-hidden bg-black text-white p-6 min-h-[190px] flex flex-col justify-between group"
            >
              <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full border border-white/10" />

              <div className="absolute -right-2 -bottom-10 w-32 h-32 rounded-full border border-white/5" />

              <div className="relative">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 border border-white/20 flex items-center justify-center">
                    <Ticket size={16} />
                  </div>

                  <span
                    className="text-[8px] uppercase tracking-[0.18em]"
                    style={{
                      color: '#D9795B',
                    }}
                  >
                    {coupon.status}
                  </span>
                </div>

                <p className="text-lg font-medium tracking-[0.08em] mt-5">
                  {coupon.code}
                </p>

                <p className="text-xs text-gray-400 mt-1">
                  {coupon.description ||
                    `${coupon.type} discount`}
                </p>

                <p className="text-[10px] text-gray-500 mt-2">
                  {coupon.type ===
                    'Percentage' &&
                    `${Number(
                      coupon.value
                    )}% off`}
                  {coupon.type === 'Fixed' &&
                    `${money(
                      coupon.value
                    )} off`}
                  {coupon.type ===
                    'Free Shipping' &&
                    'Free shipping'}
                </p>
              </div>

              <div className="relative flex items-center justify-between pt-5">
                <p className="text-[9px] uppercase tracking-[0.15em] text-gray-500">
                  {coupon.ends_at
                    ? `Expires ${formatDate(
                        coupon.ends_at
                      )}`
                    : 'No expiry'}
                </p>

                <button
                  onClick={() =>
                    setVoucherInput(
                      coupon.code
                    )
                  }
                  className="text-[9px] uppercase tracking-[0.15em] border-b border-white/30 pb-1 hover:border-white transition-colors"
                >
                  Use Code
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  /* ======================================================================== */
  /* CREDIT                                                                    */
  /* ======================================================================== */

  const renderCredit = () => (
    <div>
      <SectionHeader
        eyebrow="Account balance"
        title="Credit & Refunds"
        description="View your available account credit and redeem eligible gift vouchers."
      />

      <div className="bg-black text-white p-7 md:p-9 mb-4 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-40 h-40 border border-white/10 rounded-full translate-x-1/3 -translate-y-1/3" />

        <div className="absolute right-12 bottom-0 w-24 h-24 border border-white/5 rounded-full translate-y-1/2" />

        <div className="relative">
          <div className="flex items-center gap-2 mb-8">
            <Wallet
              size={17}
              strokeWidth={1.5}
            />

            <span className="text-[9px] uppercase tracking-[0.2em] text-gray-400">
              Available credit
            </span>
          </div>

          <p className="text-4xl md:text-5xl font-extralight tracking-tight">
            {money(creditBalance)}
          </p>

          <p className="text-xs text-gray-500 mt-3">
            Credit can be applied to eligible
            future purchases.
          </p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 bg-gray-50 flex items-center justify-center">
            <Gift size={16} />
          </div>

          <div>
            <h3 className="text-sm font-medium">
              Redeem Gift Voucher
            </h3>

            <p className="text-xs text-gray-400 mt-0.5">
              Enter an eligible fixed-value
              voucher code below.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder="ENTER VOUCHER CODE"
            value={voucherInput}
            onChange={e =>
              setVoucherInput(
                e.target.value.toUpperCase()
              )
            }
            className="flex-1 px-4 py-3 text-xs font-light border border-gray-200 focus:outline-none focus:border-black uppercase tracking-wide"
            style={{
              fontFamily: FONT,
            }}
          />

          <button
            onClick={handleRedeemVoucher}
            disabled={isSubmitting}
            className="px-6 py-3 bg-black text-white text-[10px] uppercase tracking-[0.16em] hover:bg-[#C44D2B] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2
                size={14}
                className="animate-spin"
              />
            ) : (
              <Gift size={14} />
            )}

            Redeem
          </button>
        </div>
      </div>
    </div>
  );

  /* ======================================================================== */
  /* PERSONAL DETAILS                                                          */
  /* ======================================================================== */

  const renderPersonal = () => (
    <div>
      <SectionHeader
        eyebrow="Account"
        title="Personal Details"
        description="Keep your contact and delivery information up to date."
      />

      <form
        onSubmit={handleSaveProfile}
        className="bg-white border border-gray-200"
      >
        <div className="p-6 md:p-8">
          <div className="flex items-center gap-4 pb-6 mb-6 border-b border-gray-100">
            <div
              className="w-14 h-14 flex items-center justify-center text-white text-lg font-light"
              style={{
                backgroundColor: ACCENT,
              }}
            >
              {(
                fullName ||
                profile?.name ||
                user?.name ||
                'U'
              )
                .charAt(0)
                .toUpperCase()}
            </div>

            <div>
              <p className="text-sm font-medium">
                {fullName ||
                  profile?.name ||
                  user?.name ||
                  'Your Account'}
              </p>

              <p className="text-xs text-gray-400 mt-1">
                {profile?.email ||
                  user?.email}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormField
              label="Full Name"
              icon={<User size={14} />}
            >
              <input
                type="text"
                value={fullName}
                onChange={e =>
                  setFullName(
                    e.target.value
                  )
                }
                className="form-input"
              />
            </FormField>

            <FormField
              label="Email Address"
              icon={<Mail size={14} />}
            >
              <input
                type="email"
                value={
                  profile?.email ||
                  user?.email ||
                  ''
                }
                disabled
                className="form-input bg-gray-50 text-gray-400 cursor-not-allowed"
              />
            </FormField>

            <FormField
              label="Phone Number"
              icon={<Phone size={14} />}
            >
              <input
                type="text"
                value={phone}
                onChange={e =>
                  setPhone(
                    e.target.value
                  )
                }
                className="form-input"
              />
            </FormField>

            <FormField
              label="Date of Birth"
              icon={<CalendarDays size={14} />}
            >
              <input
                type="date"
                value={dob}
                onChange={e =>
                  setDob(e.target.value)
                }
                className="form-input"
              />
            </FormField>
          </div>

          <div className="mt-5">
            <FormField
              label="Shipping Address"
              icon={<MapPin size={14} />}
            >
              <input
                type="text"
                value={address}
                onChange={e =>
                  setAddress(
                    e.target.value
                  )
                }
                className="form-input"
              />
            </FormField>
          </div>
        </div>

        <div className="px-6 md:px-8 py-5 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-[10px] text-gray-400 uppercase tracking-[0.12em]">
            Changes will apply to your account
          </p>

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-7 py-3 bg-black text-white text-[10px] uppercase tracking-[0.16em] hover:bg-[#C44D2B] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting && (
              <Loader2
                size={13}
                className="animate-spin"
              />
            )}

            Save Changes
          </button>
        </div>
      </form>
    </div>
  );

  /* ======================================================================== */
  /* PAYMENT HISTORY                                                           */
  /* ======================================================================== */

  const renderPaymentHistory = () => (
    <div>
      <SectionHeader
        eyebrow="Billing"
        title="Payment History"
        description="A record of payments and refunds made through your account."
      />

      {paymentHistory.length === 0 ? (
        <EmptyState
          icon={<Receipt size={20} />}
          title="No payment history"
          description="Your completed payments and refunds will appear here."
        />
      ) : (
        <div className="bg-white border border-gray-200 overflow-hidden">
          <div className="hidden md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <TableHeader>
                    Date
                  </TableHeader>

                  <TableHeader>
                    Payment Method
                  </TableHeader>

                  <TableHeader>
                    Type
                  </TableHeader>

                  <TableHeader>
                    Amount
                  </TableHeader>

                  <TableHeader>
                    Status
                  </TableHeader>
                </tr>
              </thead>

              <tbody>
                {paymentHistory.map(
                  payment => (
                    <tr
                      key={payment.id}
                      className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors"
                    >
                      <TableCell>
                        {formatDate(
                          payment.created_at
                        )}
                      </TableCell>

                      <TableCell strong>
                        {payment.method ||
                          'Payment'}
                      </TableCell>

                      <TableCell>
                        {payment.type}
                      </TableCell>

                      <TableCell>
                        {money(
                          payment.amount
                        )}
                      </TableCell>

                      <TableCell>
                        <StatusPill
                          status={
                            payment.status
                          }
                        />
                      </TableCell>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>

          <div className="md:hidden divide-y divide-gray-100">
            {paymentHistory.map(
              payment => (
                <div
                  key={payment.id}
                  className="p-5"
                >
                  <div className="flex justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">
                        {payment.method ||
                          payment.type}
                      </p>

                      <p className="text-xs text-gray-400 mt-1">
                        {formatDate(
                          payment.created_at
                        )}
                      </p>
                    </div>

                    <StatusPill
                      status={
                        payment.status
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between mt-5">
                    <span className="text-[9px] uppercase tracking-[0.15em] text-gray-400">
                      {payment.type}
                    </span>

                    <p className="text-lg font-light">
                      {money(
                        payment.amount
                      )}
                    </p>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );

  /* ======================================================================== */
  /* RENDER SECTION                                                            */
  /* ======================================================================== */

  const renderSection = () => {
    switch (activeSection) {
      case 'orders':
        return renderOrders();

      case 'invoices':
        return renderInvoices();

      case 'returns':
        return renderReturns();

      case 'payments':
        return renderPayments();

      case 'coupons':
        return renderCoupons();

      case 'credit':
        return renderCredit();

      case 'personal':
        return renderPersonal();

      case 'paymentHistory':
        return renderPaymentHistory();

      default:
        return null;
    }
  };

  const currentLabel =
    navItems.find(
      item =>
        item.id === activeSection
    )?.label || 'Orders';

  /* ======================================================================== */
  /* RENDER                                                                    */
  /* ======================================================================== */

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-x-0 top-0 h-[100dvh] bg-[#f7f7f6] z-[60] overflow-hidden flex animate-fadeIn"
      style={{
        fontFamily: FONT,
      }}
    >

{mobileSidebarOpen && (
  <div
    className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-40 lg:hidden"
    onClick={() => setMobileSidebarOpen(false)}
  />
)}

      {/* ==================================================================== */}
      {/* DESKTOP SIDEBAR                                                      */}
      {/* ==================================================================== */}

      <aside
  className={`fixed lg:static inset-y-0 left-0 w-[280px] bg-white border-r border-gray-200 flex flex-col flex-shrink-0 z-50 transform transition-transform duration-300 ${
    mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
  }`}
>
        <div className="px-7 py-7 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <img
              src="/logo/13 (1).png"
              alt="Notorious Y2"
              className="w-12 h-12 object-contain"
            />

            <div>
              <h1 className="text-[17px] tracking-[0.27em] font-light text-black">
                Notorious.Y2
              </h1>

              <p className="text-[9px] text-gray-400 tracking-[0.25em] uppercase mt-1">
                My Account
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-light bg-black hover:bg-[#C44D2B] transition-colors cursor-pointer overflow-hidden">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                (
                  fullName ||
                  user?.name ||
                  'U'
                )
                  .charAt(0)
                  .toUpperCase()
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs text-black truncate font-light">
                {fullName ||
                  user?.name ||
                  'User'}
              </p>

              <p className="text-[10px] text-gray-400 truncate">
                {user?.email}
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5">
          <p className="px-4 mb-3 text-[9px] uppercase tracking-[0.25em] text-gray-400">
            Account
          </p>

          <div className="space-y-1">
            {navItems.map(item => {
              const isActive =
                activeSection ===
                item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => {
  setActiveSection(item.id);
  setMobileSidebarOpen(false);
}}
                  className={`relative w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-200 group ${
                    isActive
                      ? 'bg-gray-50 text-black'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-black'
                  }`}
                >
                  {isActive && (
                    <span
                      className="absolute left-0 top-2 bottom-2 w-[2px]"
                      style={{
                        backgroundColor:
                          ACCENT,
                      }}
                    />
                  )}

                  <span
                    className="w-7 flex items-center justify-center"
                    style={{
                      color: isActive
                        ? ACCENT
                        : undefined,
                    }}
                  >
                    {item.icon}
                  </span>

                  <span className="text-xs tracking-[0.04em] font-light flex-1">
                    {item.label}
                  </span>

                  {isActive && (
                    <ChevronRight
                      size={13}
                      className="text-gray-400"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="p-5 border-t border-gray-100">
          <a
            href="/"
            className="flex items-center gap-3 px-3 py-3 text-xs text-gray-500 hover:text-black transition-colors"
          >
            <ArrowUpRight size={16} />
            <span>View Store</span>
          </a>

          <button
            onClick={() => {
              onSignOut();
              onClose();
            }}
            className="w-full flex items-center gap-3 px-3 py-3 text-xs text-gray-500 hover:text-black transition-colors"
          >
            <LogOutIcon />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ==================================================================== */}
      {/* MAIN                                                                  */}
      {/* ==================================================================== */}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-5 lg:px-9 py-4 flex items-center justify-between flex-shrink-0">
          
<button
  onClick={() => setMobileSidebarOpen(true)}
  className="lg:hidden mr-3 w-9 h-9 flex items-center justify-center border border-gray-200 hover:border-black transition-colors"
  aria-label="Open menu"
>
  <Menu size={17} strokeWidth={1.5} />
</button>
          <div>
            <p className="hidden md:block text-[9px] uppercase tracking-[0.22em] text-gray-400 mb-1">
              Notorious.Y2
            </p>

            <h2 className="text-sm font-light tracking-[0.12em] uppercase text-black">
              {currentLabel}
            </h2>
          </div>

          <div className="flex items-center gap-2 md:gap-5">
            <a
              href="/"
              className="hidden sm:flex items-center gap-1.5 text-[9px] text-gray-400 hover:text-black transition-colors tracking-[0.16em] uppercase"
            >
              View Store
              <ArrowUpRight size={12} />
            </a>

            <div className="w-px h-5 bg-gray-200 hidden sm:block" />

            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center border border-gray-200 hover:border-black hover:bg-black hover:text-white transition-all"
              aria-label="Close account"
            >
              <X
                size={17}
                strokeWidth={1.5}
              />
            </button>
          </div>
        </header>

        {/* ================================================================== */}
        {/* LOAD ERROR                                                          */}
        {/* ================================================================== */}

        {loadError && (
          <div className="bg-red-50 border-b border-red-100 px-5 lg:px-9 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-red-700">
              <AlertCircle size={14} />

              <span>
                Unable to load some account data.
              </span>
            </div>

            {user?.id && (
              <button
                onClick={() =>
                  void loadAccountData(
                    user.id
                  )
                }
                className="text-[9px] uppercase tracking-[0.15em] text-red-700 hover:text-black"
              >
                Retry
              </button>
            )}
          </div>
        )}

        {/* ================================================================== */}
        {/* MOBILE NAV                                                         */}
        {/* ================================================================== */}

          <div className="lg:hidden fixed top-[65px] inset-x-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-200 px-4 py-3 overflow-x-auto flex-shrink-0 shadow-[0_4px_12px_-8px_rgba(0,0,0,0.15)]">
    <div className="flex items-center gap-2 min-w-max snap-x">
      {navItems.map(item => {
        const isActive = activeSection === item.id;
        return (
          <button
            key={item.id}
            onClick={() => { setActiveSection(item.id); setMobileSidebarOpen(false); }}
            className={`snap-start flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[10px] uppercase tracking-[0.12em] whitespace-nowrap transition-all duration-200 ${
              isActive
                ? 'text-white bg-black shadow-sm'
                : 'text-gray-500 bg-gray-50 hover:bg-gray-100'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  </div>
  <div className="lg:hidden h-[57px]" />

        {/* ================================================================== */}
        {/* CONTENT                                                             */}
        {/* ================================================================== */}

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[1180px] mx-auto px-5 py-7 md:px-8 md:py-10 lg:px-10 lg:py-12">
            {renderSection()}
          </div>
        </main>
      </div>

      {/* ==================================================================== */}
      {/* ADD PAYMENT MODAL                                                    */}
      {/* ==================================================================== */}

      {isAddCardOpen && (
        <Modal
          title="Add Payment Card"
          subtitle="Add a card to your saved payment methods."
          onClose={() =>
            setIsAddCardOpen(false)
          }
        >
          <form
            onSubmit={handleAddCard}
            className="space-y-5"
          >
            <FormField
              label="Card Number"
              icon={
                <CreditCard size={14} />
              }
            >
              <input
                type="text"
                placeholder="4532 •••• •••• 4242"
                value={cardNumber}
                onChange={e =>
                  setCardNumber(
                    e.target.value
                  )
                }
                maxLength={19}
                required
                className="form-input"
              />
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Expiry">
                <input
                  type="text"
                  placeholder="MM/YY"
                  value={cardExpiry}
                  onChange={e =>
                    setCardExpiry(
                      e.target.value
                    )
                  }
                  maxLength={5}
                  required
                  className="form-input"
                />
              </FormField>

              <FormField label="CVV">
                <input
                  type="password"
                  placeholder="123"
                  value={cardCvc}
                  onChange={e =>
                    setCardCvc(
                      e.target.value
                    )
                  }
                  maxLength={4}
                  required
                  className="form-input"
                />
              </FormField>
            </div>

            <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-100">
              <Lock
                size={13}
                className="text-gray-400"
              />

              <p className="text-[10px] text-gray-400">
                Only the last four digits are
                stored in your account.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() =>
                  setIsAddCardOpen(false)
                }
                className="px-4 py-2.5 text-[10px] uppercase tracking-[0.15em] text-gray-500 hover:text-black"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 text-[10px] uppercase tracking-[0.15em] bg-black text-white hover:bg-[#C44D2B] transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting && (
                  <Loader2
                    size={13}
                    className="animate-spin"
                  />
                )}

                Save Card
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ==================================================================== */}
      {/* RETURN MODAL                                                         */}
      {/* ==================================================================== */}

      {isReturnModalOpen && (
        <Modal
          title="Request Order Return"
          subtitle="Select an eligible delivered order and tell us why you are returning it."
          onClose={() =>
            setIsReturnModalOpen(false)
          }
        >
          <form
            onSubmit={handleCreateReturn}
            className="space-y-5"
          >
            <FormField label="Select Order">
              <select
                value={returnOrderNum}
                onChange={e =>
                  setReturnOrderNum(
                    e.target.value
                  )
                }
                className="form-input bg-white"
                required
              >
                <option value="">
                  Select a delivered order
                </option>

                {orders
                  .filter(
                    order =>
                      order.fulfillment_status ===
                      'Delivered'
                  )
                  .map(order => (
                    <option
                      key={order.id}
                      value={
                        order.order_number ||
                        ''
                      }
                    >
                      {order.order_number ||
                        order.id.slice(
                          0,
                          8
                        )}{' '}
                      —{' '}
                      {money(
                        order.total
                      )}{' '}
                      (
                      {formatDate(
                        order.created_at
                      )}
                      )
                    </option>
                  ))}
              </select>
            </FormField>

            <FormField label="Reason for Return">
              <select
                value={returnReason}
                onChange={e =>
                  setReturnReason(
                    e.target.value
                  )
                }
                className="form-input bg-white"
              >
                <option value="Wrong size">
                  Wrong size / fit
                </option>

                <option value="Defective item">
                  Defective or damaged
                </option>

                <option value="Not as pictured">
                  Not as pictured
                </option>

                <option value="Changed mind">
                  Changed mind
                </option>
              </select>
            </FormField>

            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-100">
              <Clock3
                size={14}
                className="text-amber-600"
              />

              <p className="text-[10px] text-amber-700">
                Returns are subject to our
                return policy.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() =>
                  setIsReturnModalOpen(
                    false
                  )
                }
                className="px-4 py-2.5 text-[10px] uppercase tracking-[0.15em] text-gray-500 hover:text-black"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 text-[10px] uppercase tracking-[0.15em] bg-black text-white hover:bg-[#C44D2B] transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting && (
                  <Loader2
                    size={13}
                    className="animate-spin"
                  />
                )}

                Submit Return
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ==================================================================== */}
      {/* STYLES                                                               */}
      {/* ==================================================================== */}

      <style>{`
        .form-input {
          width: 100%;
          padding: 12px 14px;
          border: 1px solid #e5e7eb;
          background: #fff;
          font-size: 16px;
          font-weight: 300;
          outline: none;
          transition: all 0.2s ease;
          font-family: ${FONT};
        }

        @media (min-width: 1024px) {
  .form-input {
    font-size: 13px;
  }
}

        .form-input:focus {
          border-color: #000;
        }

        .form-input::placeholder {
          color: #b0b0b0;
        }

        select.form-input {
          appearance: auto;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }

          to {
            opacity: 1;
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }

        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }

        ::-webkit-scrollbar-track {
          background: transparent;
        }

        ::-webkit-scrollbar-thumb {
          background: #d4d4d4;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: #999;
        }
      `}</style>
    </div>
  );
};

/* ========================================================================== */
/* LOGOUT ICON                                                                */
/* ========================================================================== */

const LogOutIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

/* ========================================================================== */
/* ACCOUNT STAT                                                               */
/* ========================================================================== */

const AccountStat: React.FC<{
  label: string;
  value: string;
  icon: React.ReactNode;
}> = ({
  label,
  value,
  icon,
}) => (
  <div className="bg-white border border-gray-200 p-4 md:p-5">
    <div className="flex items-center justify-between mb-5">
      <span className="text-gray-400">
        {icon}
      </span>

      <span className="text-[8px] uppercase tracking-[0.15em] text-gray-400">
        Account
      </span>
    </div>

    <p className="text-xl md:text-2xl font-light text-black">
      {value}
    </p>

    <p className="text-[9px] uppercase tracking-[0.15em] text-gray-400 mt-1.5">
      {label}
    </p>
  </div>
);

/* ========================================================================== */
/* ORDER PROGRESS                                                             */
/* ========================================================================== */

const OrderProgress: React.FC<{
  status: string;
}> = ({ status }) => {
  const steps = [
    {
      label: 'Ordered',
      active: true,
    },
    {
      label: 'Shipped',
      active:
        status === 'Shipped' ||
        status === 'Delivered',
    },
    {
      label: 'Delivered',
      active:
        status === 'Delivered',
    },
  ];

  return (
    <div className="flex items-center w-full">
      {steps.map(
        (step, index) => (
          <React.Fragment
            key={step.label}
          >
            <div className="flex flex-col items-center">
              <div
                className={`w-2 h-2 rounded-full ${
                  step.active
                    ? 'bg-black'
                    : 'bg-gray-200'
                }`}
              />

              <span
                className={`text-[7px] uppercase tracking-wide mt-1 ${
                  step.active
                    ? 'text-gray-700'
                    : 'text-gray-300'
                }`}
              >
                {step.label}
              </span>
            </div>

            {index <
              steps.length - 1 && (
              <div
                className={`flex-1 h-px mx-2 ${
                  steps[index + 1]
                    .active
                    ? 'bg-black'
                    : 'bg-gray-200'
                }`}
              />
            )}
          </React.Fragment>
        )
      )}
    </div>
  );
};

/* ========================================================================== */
/* ORDER STATUS BADGE                                                         */
/* ========================================================================== */

const OrderStatusBadge: React.FC<{
  status: string;
}> = ({ status }) => {
  const styles: Record<
    string,
    string
  > = {
    Delivered:
      'bg-emerald-50 text-emerald-700 border-emerald-100',

    Shipped:
      'bg-black text-white border-black',

    Processing:
      'bg-gray-50 text-gray-600 border-gray-200',

    Requested:
      'bg-amber-50 text-amber-700 border-amber-100',

    Cancelled:
      'bg-red-50 text-red-600 border-red-100',

    Pending:
      'bg-gray-50 text-gray-500 border-gray-100',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-1 text-[8px] uppercase tracking-[0.12em] border ${
        styles[status] ||
        'bg-gray-50 text-gray-600 border-gray-200'
      }`}
      style={{
        fontFamily: FONT,
      }}
    >
      {status}
    </span>
  );
};

/* ========================================================================== */
/* GENERIC STATUS PILL                                                        */
/* ========================================================================== */

const StatusPill: React.FC<{
  status: string;
}> = ({ status }) => {
  const styles: Record<
    string,
    string
  > = {
    Paid:
      'bg-emerald-50 text-emerald-700 border-emerald-100',

    Completed:
      'bg-emerald-50 text-emerald-700 border-emerald-100',

    Refunded:
      'bg-amber-50 text-amber-700 border-amber-100',

    Processing:
      'bg-gray-50 text-gray-600 border-gray-200',

    Requested:
      'bg-amber-50 text-amber-700 border-amber-100',

    Approved:
      'bg-emerald-50 text-emerald-700 border-emerald-100',

    Rejected:
      'bg-red-50 text-red-600 border-red-100',

    Failed:
      'bg-red-50 text-red-600 border-red-100',

    Pending:
      'bg-gray-50 text-gray-500 border-gray-100',

    Void:
      'bg-gray-50 text-gray-500 border-gray-100',
  };

  return (
    <span
      className={`inline-flex px-2 py-1 text-[8px] uppercase tracking-[0.12em] border ${
        styles[status] ||
        'bg-gray-50 text-gray-600 border-gray-200'
      }`}
    >
      {status}
    </span>
  );
};

/* ========================================================================== */
/* TABLE HELPERS                                                              */
/* ========================================================================== */

const TableHeader: React.FC<{
  children?: React.ReactNode;
  align?: 'left' | 'right';
}> = ({
  children,
  align = 'left',
}) => (
  <th
    className={`text-${align} text-[9px] font-light text-gray-400 uppercase tracking-[0.16em] py-4 px-5`}
  >
    {children}
  </th>
);

const TableCell: React.FC<{
  children?: React.ReactNode;
  align?: 'left' | 'right';
  strong?: boolean;
}> = ({
  children,
  align = 'left',
  strong = false,
}) => (
  <td
    className={`text-${align} py-4 px-5 text-xs ${
      strong
        ? 'text-gray-800 font-medium'
        : 'text-gray-500 font-light'
    }`}
  >
    {children}
  </td>
);

/* ========================================================================== */
/* FORM FIELD                                                                 */
/* ========================================================================== */

const FormField: React.FC<{
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}> = ({
  label,
  icon,
  children,
}) => (
  <div>
    <label className="flex items-center gap-1.5 text-[9px] text-gray-400 uppercase tracking-[0.18em] mb-2">
      {icon}
      {label}
    </label>

    {children}
  </div>
);

/* ========================================================================== */
/* EMPTY STATE                                                                */
/* ========================================================================== */

const EmptyState: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
}> = ({
  icon,
  title,
  description,
}) => (
  <div className="bg-white border border-gray-200 py-16 px-6 text-center">
    <div className="w-12 h-12 bg-gray-50 border border-gray-100 flex items-center justify-center mx-auto text-gray-400">
      {icon}
    </div>

    <h3 className="text-sm font-medium mt-5">
      {title}
    </h3>

    <p className="text-xs text-gray-400 font-light mt-2">
      {description}
    </p>
  </div>
);

/* ========================================================================== */
/* LOADING STATE                                                              */
/* ========================================================================== */

const LoadingState = () => (
  <div className="bg-white border border-gray-200 py-16 px-6 text-center">
    <Loader2
      size={22}
      className="animate-spin mx-auto text-gray-400"
    />

    <p className="text-xs text-gray-400 mt-4">
      Loading your account...
    </p>
  </div>
);

/* ========================================================================== */
/* MODAL                                                                      */
/* ========================================================================== */

const Modal: React.FC<{
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}> = ({
  title,
  subtitle,
  onClose,
  children,
}) => (
  <div className="fixed inset-x-0 top-0 h-[100dvh] bg-black/60 backdrop-blur-[2px] z-[80] flex items-center justify-center p-4">
    <div className="bg-white w-full max-w-lg shadow-2xl">
      <div className="px-6 py-5 md:px-7 border-b border-gray-100 flex items-start justify-between gap-5">
        <div>
          <p className="text-[9px] uppercase tracking-[0.2em] text-gray-400 mb-2">
            Notorious.Y2
          </p>

          <h3 className="text-lg font-light">
            {title}
          </h3>

          {subtitle && (
            <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center border border-gray-200 hover:bg-black hover:text-white hover:border-black transition-all flex-shrink-0"
        >
          <X size={15} />
        </button>
      </div>

      <div className="p-6 md:p-7">
        {children}
      </div>
    </div>
  </div>
);

const MyAccountWithToast: React.FC<MyAccountProps> = (props) => (
  <AdminToastProvider>
    <MyAccount {...props} />
  </AdminToastProvider>
);

export default MyAccountWithToast;