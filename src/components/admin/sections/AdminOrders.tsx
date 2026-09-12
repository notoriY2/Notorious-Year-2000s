import React, { useEffect, useState } from 'react';
import {
  X,
  Truck,
  CheckCircle,
  DollarSign,
  Ban,
  Printer,
  Search,
  RefreshCw,
  Package,
  User,
  MapPin,
  CreditCard,
} from 'lucide-react';

import {
  PageTitle,
  SectionCard,
  StatusBadge,
  Table,
  AdminButton,
  useAdminToast,
} from '../AdminUI';

import { getAdminOrders, refreshCarrierShipment, updateOrderStatus } from '../../../data/admin';
import { AdminOrder } from '../../../types/admin';

const AdminOrders: React.FC<{ isActive?: boolean }> = ({ isActive = true }) => {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('All');
  const [selectedOrder, setSelectedOrder] =
    useState<AdminOrder | null>(null);

  const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const filters = [
    'All',
    'Pending',
    'Paid',
    'Processing',
    'Shipped',
    'Delivered',
    'Cancelled',
    'Refunded',
  ];

  // ============================================================
  // LOAD ORDERS
  // ============================================================

    const loadOrders = async () => {
    try {
      if (!hasLoadedOnce) {
        setLoading(true);
      }
      setError(null);

      const data = await getAdminOrders(100);

      setOrders(data);
      setHasLoadedOnce(true);
    } catch (err) {
      console.error('Failed to load admin orders:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load orders.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isActive) return;
    loadOrders();
  }, [isActive]);

  // ============================================================
  // FILTER ORDERS
  // ============================================================

  const filtered = orders.filter((order: AdminOrder) => {
    const query = search.trim().toLowerCase();

    const matchesSearch =
      query === '' ||
      order.orderNumber.toLowerCase().includes(query) ||
      order.customerName.toLowerCase().includes(query) ||
      order.customerEmail.toLowerCase().includes(query);

    const matchesFilter =
      filter === 'All' ||
      order.paymentStatus === filter ||
      order.fulfillmentStatus === filter;

    return matchesSearch && matchesFilter;
  });

  return (
    <div>
      <PageTitle
        title="Orders"
        subtitle="Manage and fulfill customer orders"
      />

      {/* ========================================================
          ORDER DETAIL MODAL
      ======================================================== */}

      {selectedOrder && (
        <OrderDetail
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdated={loadOrders}
        />
      )}

      {/* ========================================================
          SEARCH + FILTERS
      ======================================================== */}

      <div className="space-y-3 mb-6">
        {/* Search */}
        <div className="relative w-full max-w-md">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />

          <input
            type="text"
            placeholder="Search orders..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="
              w-full
              pl-10
              pr-4
              py-2.5
              text-sm
              border
              border-gray-200
              rounded-lg
              bg-white
              focus:outline-none
              focus:border-gray-400
              focus:ring-1
              focus:ring-gray-200
              transition-colors
            "
          />
        </div>

        {/* Filters */}
        <div
          className="
            flex
            items-center
            space-x-1
            bg-white
            rounded-lg
            border
            border-gray-200
            p-1
            w-fit
            max-w-full
            overflow-x-auto
          "
        >
          {filters.map((f: string) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`
                px-4
                py-2
                text-sm
                rounded-md
                transition-colors
                whitespace-nowrap
                ${
                  filter === f
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }
              `}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* ========================================================
          ERROR
      ======================================================== */}

      {error && (
        <div className="mb-6 p-4 rounded-lg border border-red-200 bg-red-50">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-red-800">
                Unable to load orders
              </p>

              <p className="text-sm text-red-600 mt-1">
                {error}
              </p>
            </div>

            <button
              type="button"
              onClick={loadOrders}
              className="
                flex
                items-center
                gap-2
                px-3
                py-2
                text-sm
                rounded-md
                bg-white
                border
                border-red-200
                text-red-700
                hover:bg-red-100
                transition-colors
              "
            >
              <RefreshCw size={14} />
              Retry
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          ORDERS TABLE
      ======================================================== */}

      <SectionCard
        title={`Orders (${filtered.length})`}
      >
                {loading && !hasLoadedOnce ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <RefreshCw
                size={16}
                className="animate-spin"
              />
              Loading orders...
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <Package
                size={20}
                className="text-gray-400"
              />
            </div>

            <h3 className="text-sm font-medium text-gray-800">
              No orders found
            </h3>

            <p className="text-sm text-gray-500 mt-1">
              {search
                ? 'Try adjusting your search or filters.'
                : 'There are currently no orders to display.'}
            </p>
          </div>
        ) : (
          <Table
            headers={[
              'Order',
              'Customer',
              'Date',
              'Total',
              'Payment',
              'Status',
              'Actions',
            ]}
          >
            {filtered
              .slice(0, 30)
              .map((order: AdminOrder) => (
                <tr
                  key={order.id}
                  className="
                    border-b
                    border-gray-50
                    hover:bg-gray-50
                    transition-colors
                    cursor-pointer
                  "
                  onClick={() =>
                    setSelectedOrder(order)
                  }
                >
                  {/* Order */}
                  <td className="py-3 px-4">
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {order.orderNumber}
                      </p>

                      <p className="text-xs text-gray-400 mt-0.5">
                        {order.items.length}{' '}
                        {order.items.length === 1
                          ? 'item'
                          : 'items'}
                      </p>
                    </div>
                  </td>

                  {/* Customer */}
                  <td className="py-3 px-4">
                    <div>
                      <p className="text-sm text-gray-700">
                        {order.customerName}
                      </p>

                      <p className="text-xs text-gray-400 mt-0.5">
                        {order.customerEmail}
                      </p>
                    </div>
                  </td>

                  {/* Date */}
                  <td className="py-3 px-4 text-sm text-gray-500">
                    {new Date(
                      order.date
                    ).toLocaleDateString('en-ZA', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>

                  {/* Total */}
                  <td className="py-3 px-4 text-sm font-medium text-gray-800">
                    R
                    {order.total.toLocaleString(
                      'en-ZA'
                    )}
                  </td>

                  {/* Payment */}
                  <td className="py-3 px-4">
                    <StatusBadge
                      status={order.paymentStatus}
                    />
                  </td>

                  {/* Fulfillment */}
                  <td className="py-3 px-4">
                    <StatusBadge
                      status={
                        order.fulfillmentStatus
                      }
                    />
                  </td>

                  {/* Actions */}
                  <td
                    className="py-3 px-4"
                    onClick={e =>
                      e.stopPropagation()
                    }
                  >
                    <AdminButton
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setSelectedOrder(order)
                      }
                    >
                      View
                    </AdminButton>
                  </td>
                </tr>
              ))}
          </Table>
        )}

        {!loading &&
          filtered.length > 30 && (
            <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
              Showing the first 30 of{' '}
              {filtered.length} matching orders.
            </div>
          )}
      </SectionCard>
    </div>
  );
};

// ============================================================
// ORDER DETAIL
// ============================================================

const OrderDetail: React.FC<{
  order: AdminOrder;
  onClose: () => void;
  onUpdated?: () => Promise<void> | void;
}> = ({
  order,
  onClose,
  onUpdated,
}) => {
  const [fulfillment, setFulfillment] =
    useState<AdminOrder['fulfillmentStatus']>(
      order.fulfillmentStatus
    );

  const [tracking, setTracking] =
    useState<string>(
      order.trackingNumber || ''
    );

  const [actionsVisible, setActionsVisible] =
    useState(false);
  const [savingStatus, setSavingStatus] =
    useState(false);
  const [savingTracking, setSavingTracking] =
    useState(false);
  const [actionError, setActionError] =
    useState<string | null>(null);
  const [trackingSaved, setTrackingSaved] =
    useState(false);
    const { showToast } = useAdminToast();

    const [refunding, setRefunding] = useState(false);

const handleRefund = async () => {
  if (refunding) return;
  setRefunding(true);
  const saved = await persistOrderUpdate({ paymentStatus: 'Refunded' });
  if (saved) showToast('success', 'Order marked as refunded.');
  setRefunding(false);
};
  // Trigger stagger-in animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setActionsVisible(true);
    }, 50);

    return () => clearTimeout(timer);
  }, []);

  // Keep the local display state aligned if a different order is opened.
  useEffect(() => {
    setFulfillment(order.fulfillmentStatus);
    setTracking(order.trackingNumber || '');
    setActionError(null);
    setTrackingSaved(false);
  }, [order.id, order.fulfillmentStatus, order.trackingNumber]);

  const persistOrderUpdate = async (updates: {
    fulfillmentStatus?: AdminOrder['fulfillmentStatus'];
    paymentStatus?: AdminOrder['paymentStatus'];
    trackingNumber?: string;
  }) => {
    setActionError(null);

    try {
      await updateOrderStatus(order.id, updates);
      await onUpdated?.();
      return true;
    } catch (err) {
      console.error('Failed to update order:', err);
      setActionError(
        err instanceof Error
          ? err.message
          : 'Failed to update the order.'
      );
      return false;
    }
  };

  const updateStatus = async (
    status: AdminOrder['fulfillmentStatus']
  ) => {
    if (savingStatus) return;

    setSavingStatus(true);
    setTrackingSaved(false);

    const saved = await persistOrderUpdate({
      fulfillmentStatus: status,
      ...(tracking.trim()
        ? { trackingNumber: tracking.trim() }
        : {}),
    });

    if (saved) {
      setFulfillment(status);
    }

    setSavingStatus(false);
  };

  const saveTracking = async () => {
    if (savingTracking) return;

    setSavingTracking(true);
    setTrackingSaved(false);

    const saved = await persistOrderUpdate({
      trackingNumber: tracking.trim() || undefined,
    });

    if (saved) {
      setTrackingSaved(true);
    }

    setSavingTracking(false);
  };

  const adminActions: {
    key: string;
    label: string;
    icon: React.ReactNode;
    variant: 'secondary' | 'danger';
    onClick: () => void;
  }[] = [
    {
      key: 'processing',
      label: savingStatus
        ? 'Updating...'
        : 'Mark Processing',
      icon: (
        <CheckCircle
          size={14}
          className="inline mr-1"
        />
      ),
      variant: 'secondary',
      onClick: () =>
        updateStatus('Processing'),
    },

    {
      key: 'shipped',
      label: savingStatus
        ? 'Updating...'
        : 'Mark Shipped',
      icon: (
        <Truck
          size={14}
          className="inline mr-1"
        />
      ),
      variant: 'secondary',
      onClick: () =>
        updateStatus('Shipped'),
    },

    {
      key: 'delivered',
      label: savingStatus
        ? 'Updating...'
        : 'Mark Delivered',
      icon: (
        <CheckCircle
          size={14}
          className="inline mr-1"
        />
      ),
      variant: 'secondary',
      onClick: () =>
        updateStatus('Delivered'),
    },

    {
  key: 'refund',
  label: refunding ? 'Refunding...' : 'Refund',
  icon: <DollarSign size={14} className="inline mr-1" />,
  variant: 'danger',
  onClick: handleRefund,
},

    {
      key: 'cancel',
      label: savingStatus
        ? 'Updating...'
        : 'Cancel Order',
      icon: (
        <Ban
          size={14}
          className="inline mr-1"
        />
      ),
      variant: 'danger',
      onClick: () =>
        updateStatus('Cancelled'),
    },

    {
      key: 'print',
      label: 'Print Invoice',
      icon: (
        <Printer
          size={14}
          className="inline mr-1"
        />
      ),
      variant: 'secondary',
      onClick: () => showToast('success', 'Sending invoice to printer...'),
    },
  ];

  return (
    <div
      className="
        fixed
        inset-0
        bg-black/50
        z-[70]
        flex
        items-center
        justify-center
        p-4
      "
      onClick={onClose}
    >
      <div
        className="
          bg-white
          rounded-xl
          w-full
          max-w-2xl
          max-h-[90vh]
          overflow-y-auto
          shadow-2xl
        "
        onClick={e =>
          e.stopPropagation()
        }
      >
        {/* ====================================================
            HEADER
        ==================================================== */}

        <div
          className="
            flex
            items-center
            justify-between
            px-6
            py-4
            border-b
            border-gray-200
            sticky
            top-0
            bg-white
            z-10
          "
        >
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-medium text-gray-900">
                Order {order.orderNumber}
              </h2>
            </div>

            <p className="text-xs text-gray-500 mt-1">
              {new Date(
                order.date
              ).toLocaleString('en-ZA', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="
              p-2
              hover:bg-gray-100
              rounded-lg
              transition-colors
            "
            aria-label="Close order details"
          >
            <X size={20} />
          </button>
        </div>

        {/* ====================================================
            CONTENT
        ==================================================== */}

        <div className="p-6 space-y-6">
          {/* Status */}
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge
              status={order.paymentStatus}
            />

            <StatusBadge
              status={fulfillment}
            />
          </div>

          {actionError && (
            <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">
              {actionError}
            </div>
          )}

          {/* ==================================================
              CUSTOMER
          ================================================== */}

          <div>
            <div className="flex items-center gap-2 mb-2">
              <User
                size={15}
                className="text-gray-400"
              />

              <h3 className="text-sm font-medium text-gray-700">
                Customer
              </h3>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 space-y-1">
              <p className="text-sm text-gray-800">
                {order.customerName}
              </p>

              <p className="text-sm text-gray-500">
                {order.customerEmail}
              </p>

              <p className="text-sm text-gray-500">
                {order.shippingAddress?.phone ||
                  'No phone number'}
              </p>
            </div>
          </div>

          {/* ==================================================
              SHIPPING ADDRESS
          ================================================== */}

          <div>
            <div className="flex items-center gap-2 mb-2">
              <MapPin
                size={15}
                className="text-gray-400"
              />

              <h3 className="text-sm font-medium text-gray-700">
                Shipping Address
              </h3>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600 space-y-0.5">
              {order.shippingAddress ? (
                <>
                  <p>
                    {order.shippingAddress.line1 ||
                      'Address not provided'}
                  </p>

                  <p>
                    {order.shippingAddress.city}
                    {order.shippingAddress.city &&
                    order.shippingAddress.state
                      ? ', '
                      : ''}
                    {order.shippingAddress.state}{' '}
                    {order.shippingAddress.zip}
                  </p>

                  <p>
                    {order.shippingAddress.country}
                  </p>
                </>
              ) : (
                <p>
                  Shipping address not
                  available.
                </p>
              )}
            </div>
          </div>

          {/* ==================================================
              ITEMS
          ================================================== */}

          <div>
            <div className="flex items-center gap-2 mb-2">
              <Package
                size={15}
                className="text-gray-400"
              />

              <h3 className="text-sm font-medium text-gray-700">
                Items
              </h3>
            </div>

            <div className="space-y-2">
              {order.items.map(
                (item, index) => (
                  <div
                    key={`${item.productId}-${item.size}-${index}`}
                    className="
                      flex
                      items-center
                      justify-between
                      gap-4
                      p-3
                      bg-gray-50
                      rounded-lg
                    "
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-gray-800 truncate">
                        {item.name}
                      </p>

                      <p className="text-xs text-gray-500 mt-0.5">
                        {item.size || 'One Size'}{' '}
                        × {item.quantity}
                      </p>
                    </div>

                    <p className="text-sm font-medium text-gray-700 whitespace-nowrap">
                      R
                      {(
                        item.price *
                        item.quantity
                      ).toLocaleString(
                        'en-ZA'
                      )}
                    </p>
                  </div>
                )
              )}
            </div>
          </div>

          {/* ==================================================
              TOTALS
          ================================================== */}

          <div className="border-t border-gray-100 pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">
                Subtotal
              </span>

              <span className="text-gray-700">
                R
                {order.subtotal.toLocaleString(
                  'en-ZA'
                )}
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-gray-500">
                Shipping
              </span>

              <span className="text-gray-700">
                R
                {order.shipping.toLocaleString(
                  'en-ZA'
                )}
              </span>
            </div>

            <div className="flex justify-between text-base font-medium pt-2 border-t border-gray-100">
              <span className="text-gray-800">
                Total
              </span>

              <span className="text-gray-900">
                R
                {order.total.toLocaleString(
                  'en-ZA'
                )}
              </span>
            </div>
          </div>

          {/* ==================================================
              TRACKING
          ================================================== */}

          <div>
            <div className="flex items-center gap-2 mb-2">
              <Truck
                size={15}
                className="text-gray-400"
              />

              <label className="text-xs font-medium text-gray-500 tracking-wide">
                Tracking Number
              </label>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={tracking}
                onChange={e => {
                  setTracking(e.target.value);
                  setTrackingSaved(false);
                  setActionError(null);
                }}
                placeholder="Add tracking number..."
                className="
                  w-full
                  px-3
                  py-2.5
                  text-sm
                  border
                  border-gray-200
                  rounded-lg
                  bg-white
                  focus:outline-none
                  focus:border-gray-400
                  focus:ring-1
                  focus:ring-gray-200
                  transition-colors
                "
              />

              <AdminButton
                size="sm"
                variant="secondary"
                onClick={saveTracking}
              >
                {savingTracking
                  ? 'Saving...'
                  : 'Save'}
              </AdminButton>

              <AdminButton
  size="sm"
  variant="secondary"
  onClick={async () => {
    try {
      await refreshCarrierShipment(order.id);
      showToast('success', 'Carrier status refreshed.');
    } catch (err) {
      showToast('error', 'Failed to refresh carrier status.');
    }
  }}
>
  Refresh Carrier Status
</AdminButton>
            </div>

            {trackingSaved && (
              <p className="text-xs text-green-600 mt-1.5">
                Tracking number saved.
              </p>
            )}
          </div>

          {/* ==================================================
              ADMIN ACTIONS
          ================================================== */}

          <div>
            <div className="flex items-center gap-2 mb-3">
              <CreditCard
                size={15}
                className="text-gray-400"
              />

              <h3 className="text-sm font-medium text-gray-700">
                Admin Actions
              </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {adminActions.map(
                (action, index) => (
                  <div
                    key={action.key}
                    className="
                      transition-all
                      duration-300
                      ease-out
                      transform
                      hover:scale-[1.02]
                      active:scale-[0.98]
                    "
                    style={{
                      opacity:
                        actionsVisible
                          ? 1
                          : 0,

                      transform:
                        actionsVisible
                          ? 'translateY(0)'
                          : 'translateY(6px)',

                      transitionDelay:
                        `${index * 40}ms`,
                    }}
                  >
                    <AdminButton
                      size="sm"
                      variant={
                        action.variant
                      }
                      onClick={
                        action.onClick
                      }
                    >
                      {action.icon}
                      {action.label}
                    </AdminButton>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminOrders;