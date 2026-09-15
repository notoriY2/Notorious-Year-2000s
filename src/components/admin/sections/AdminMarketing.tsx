import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Megaphone,
  Mail,
  Percent,
  TrendingUp,
  MousePointerClick,
  ShoppingBag,
  DollarSign,
  Send,
  RotateCcw,
  Clock3,
  ArrowUpRight,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

import {
  PageTitle,
  SectionCard,
  StatusBadge,
  Table,
  KPICard,
  AdminButton,
  AdminInput,
  AdminSelect,
  BarChart,
  useAdminToast,
} from '../AdminUI';

import {
  getAdminDiscounts,
  getAdminCampaigns,
  getAdminAbandonedCarts,
  createAdminDiscount,
  createAdminCampaign,
  sendCampaign,
  markAbandonedCartRecovered,
  getAbandonedCartRecoveryRate,
} from '../../../data/admin';

import {
  AdminDiscount,
  AdminCampaign,
  AdminAbandonedCart,
} from '../../../types/admin';

import { useIsViewer } from '../../../hooks/useIsViewer';
import { supabase } from '../../../lib/supabase';

const FONT = "'Helvetica Neue', Arial, sans-serif";
const ACCENT = '#C44D2B';

export type MarketingTab =
  | 'discounts'
  | 'campaigns'
  | 'abandoned';

interface AdminMarketingProps {
  initialTab?: MarketingTab;
  isActive?: boolean;
}

type DiscountForm = {
  code: string;
  type: 'Percentage' | 'Fixed' | 'Free Shipping';
  value: string;
  minOrder: string;
  startDate: string;
  endDate: string;
  usageLimit: string;
};

const AdminMarketing: React.FC<AdminMarketingProps> = ({
  initialTab = 'discounts',
  isActive = true,
}) => {
  const [tab, setTab] = useState<MarketingTab>(initialTab);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const [showCreate, setShowCreate] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] =
    useState<string | null>(null);

  const [recoverySent, setRecoverySent] = useState<string[]>([]);

  const [showNewCampaignModal, setShowNewCampaignModal] =
    useState(false);

  const [showRecoveryModal, setShowRecoveryModal] =
    useState(false);

  const [showDiscountModal, setShowDiscountModal] =
    useState(false);

  const [sendingCampaignId, setSendingCampaignId] =
    useState<string | null>(null);

  const { showToast } = useAdminToast();
  const isViewer = useIsViewer();

  const [discountForm, setDiscountForm] = useState<DiscountForm>({
    code: '',
    type: 'Percentage',
    value: '',
    minOrder: '',
    startDate: '',
    endDate: '',
    usageLimit: '',
  });

  const [discountSaving, setDiscountSaving] = useState(false);

  /* ─────────────────────────────────────────────
     Data loaded from Supabase
  ───────────────────────────────────────────── */

  const [discounts, setDiscounts] = useState<AdminDiscount[]>([]);
  const [campaigns, setCampaigns] = useState<AdminCampaign[]>([]);
  const [abandonedCarts, setAbandonedCarts] =
    useState<AdminAbandonedCart[]>([]);

  const [recoveryRate, setRecoveryRate] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  useEffect(() => {
    if (!isActive) return;

    let cancelled = false;

    const loadMarketingData = async () => {
      if (!hasLoadedOnce) {
        setIsLoading(true);
      }

      setError(null);

      try {
        const [
          discountData,
          campaignData,
          abandonedData,
          recoveryRateData,
        ] = await Promise.all([
          getAdminDiscounts(),
          getAdminCampaigns(),
          getAdminAbandonedCarts(),
          getAbandonedCartRecoveryRate(),
        ]);

        if (cancelled) {
          return;
        }

        setDiscounts(discountData);
        setCampaigns(campaignData);
        setAbandonedCarts(abandonedData);
        setRecoveryRate(recoveryRateData);
        setHasLoadedOnce(true);
      } catch (err) {
        if (cancelled) {
          return;
        }

        console.error('Failed to load marketing data:', err);

        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load marketing data.'
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadMarketingData();

    return () => {
      cancelled = true;
    };
  }, [reloadKey, isActive, hasLoadedOnce]);

  /* ─────────────────────────────────────────────
     Campaign analytics
  ───────────────────────────────────────────── */

  const campaignMetrics = useMemo(() => {
    const emailsSent = campaigns.reduce(
      (sum, campaign) => sum + campaign.emailsSent,
      0
    );

    const clicks = campaigns.reduce(
      (sum, campaign) => sum + campaign.clicks,
      0
    );

    const orders = campaigns.reduce(
      (sum, campaign) => sum + campaign.orders,
      0
    );

    const revenue = campaigns.reduce(
      (sum, campaign) => sum + campaign.revenue,
      0
    );

    const openRate =
      campaigns.length > 0
        ? campaigns.reduce(
            (sum, campaign) => sum + campaign.openRate,
            0
          ) / campaigns.length
        : 0;

    const clickRate =
      emailsSent > 0 ? (clicks / emailsSent) * 100 : 0;

    const orderRate =
      emailsSent > 0 ? (orders / emailsSent) * 100 : 0;

    const revenuePerEmail =
      emailsSent > 0 ? revenue / emailsSent : 0;

    return {
      emailsSent,
      clicks,
      orders,
      revenue,
      openRate,
      clickRate,
      orderRate,
      revenuePerEmail,
    };
  }, [campaigns]);

  const campaignChartData = campaigns.map(campaign => ({
    label: campaign.name.slice(0, 10),
    value: campaign.revenue,
  }));

  /* ─────────────────────────────────────────────
     Abandoned cart analytics
  ───────────────────────────────────────────── */

  const abandonedMetrics = useMemo(() => {
    const totalValue = abandonedCarts.reduce(
      (sum, cart) => sum + cart.cartValue,
      0
    );

    const averageValue =
      abandonedCarts.length > 0
        ? totalValue / abandonedCarts.length
        : 0;

    const estimatedRecovery =
      totalValue * (recoveryRate / 100);

    return {
      count: abandonedCarts.length,
      totalValue,
      averageValue,
      recoveryRate,
      estimatedRecovery,
    };
  }, [abandonedCarts, recoveryRate]);

  /* ─────────────────────────────────────────────
     Recovery email
  ───────────────────────────────────────────── */

  const handleRecoveryEmail = async (id: string) => {
    if (isViewer) {
      showToast(
        'error',
        "You don't have permission to make changes (Viewer role)."
      );
      return;
    }

    setRecoverySent(prev =>
      prev.includes(id) ? prev : [...prev, id]
    );

    try {
      await markAbandonedCartRecovered(id);

      const nextRate =
        await getAbandonedCartRecoveryRate();

      setRecoveryRate(nextRate);

      setReloadKey(k => k + 1);
    } catch {
      setRecoverySent(prev =>
        prev.filter(x => x !== id)
      );

      showToast(
        'error',
        'Failed to mark cart as recovered.'
      );
    }
  };

  const pendingCartCount = abandonedCarts.filter(
    cart => !recoverySent.includes(cart.id)
  ).length;

  /* ─────────────────────────────────────────────
     Create discount
  ───────────────────────────────────────────── */

  const handleCreateDiscount = async () => {
    if (isViewer) {
      showToast(
        'error',
        "You don't have permission to make changes (Viewer role)."
      );
      return;
    }

    if (discountSaving) return;

    if (!discountForm.code.trim()) {
      setError('Discount code is required.');
      return;
    }

    if (
      discountForm.type !== 'Free Shipping' &&
      !discountForm.value.trim()
    ) {
      setError('Discount value is required.');
      return;
    }

    setDiscountSaving(true);
    setError(null);

    try {
      await createAdminDiscount({
        code: discountForm.code.trim().toUpperCase(),
        type: discountForm.type,
        value:
          discountForm.type === 'Free Shipping'
            ? 0
            : Number(discountForm.value),
        minOrder:
          discountForm.minOrder === ''
            ? 0
            : Number(discountForm.minOrder),
        startsAt:
          discountForm.startDate || undefined,
        endsAt:
          discountForm.endDate || undefined,
        usageLimit:
          discountForm.usageLimit === ''
            ? undefined
            : Number(discountForm.usageLimit),
      });

      setDiscountForm({
        code: '',
        type: 'Percentage',
        value: '',
        minOrder: '',
        startDate: '',
        endDate: '',
        usageLimit: '',
      });

      setShowCreate(false);
      setReloadKey(current => current + 1);
    } catch (err) {
      console.error(
        'Failed to create discount:',
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : 'Failed to create discount.'
      );
    } finally {
      setDiscountSaving(false);
    }
  };

  /* ─────────────────────────────────────────────
     Create campaign
  ───────────────────────────────────────────── */

  const handleCreateCampaign = async (draft: {
    name: string;
    subject: string;
    audience: string;
    scheduledDate: string;
    body: string;
  }): Promise<void> => {
    if (isViewer) {
      showToast(
        'error',
        "You don't have permission to make changes (Viewer role)."
      );
      return;
    }

    await createAdminCampaign({
      name: draft.name.trim(),
      subject: draft.subject.trim(),
      audience: draft.audience,
      scheduledAt:
        draft.scheduledDate || undefined,
      bodyHtml: draft.body.trim(),
    });

    setShowNewCampaignModal(false);
    setSelectedCampaignId(null);
    setReloadKey(current => current + 1);
  };

  /* ─────────────────────────────────────────────
     Send campaign
  ───────────────────────────────────────────── */

  const handleSendCampaign = async (
    campaign: AdminCampaign
  ) => {
    if (isViewer) {
      showToast(
        'error',
        "You don't have permission to make changes (Viewer role)."
      );
      return;
    }

    setSendingCampaignId(campaign.id);

    try {
      const result = await sendCampaign(campaign.id);

      showToast(
        'success',
        `Sent to ${result.sent} of ${result.total} opted-in recipients.`
      );

      setReloadKey(k => k + 1);
    } catch (err) {
      showToast(
        'error',
        err instanceof Error
          ? err.message
          : 'Failed to send campaign.'
      );
    } finally {
      setSendingCampaignId(null);
    }
  };

  const selectedCampaign = campaigns.find(
    campaign => campaign.id === selectedCampaignId
  );

  const pageTitles: Record<
    MarketingTab,
    { title: string; subtitle: string }
  > = {
    discounts: {
      title: 'Discounts',
      subtitle: 'Manage discount codes and promotions',
    },
    campaigns: {
      title: 'Campaign Analytics',
      subtitle: 'Email campaign performance and revenue',
    },
    abandoned: {
      title: 'Abandoned Carts',
      subtitle:
        'Recover lost revenue from abandoned carts',
    },
  };

  /* ─────────────────────────────────────────────
     Loading state
  ───────────────────────────────────────────── */

  if (isLoading && !hasLoadedOnce) {
    return (
      <div style={{ fontFamily: FONT }}>
        <PageTitle
          title={pageTitles[tab].title}
          subtitle={pageTitles[tab].subtitle}
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-24 bg-gray-100 animate-pulse"
            />
          ))}
        </div>

        <SectionCard title="Loading">
          <div className="space-y-0">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-14 border-b border-gray-50 bg-gray-50/50 animate-pulse"
              />
            ))}
          </div>
        </SectionCard>
      </div>
    );
  }

  /* ─────────────────────────────────────────────
     Error state
  ───────────────────────────────────────────── */

  if (error) {
    return (
      <div style={{ fontFamily: FONT }}>
        <PageTitle
          title={pageTitles[tab].title}
          subtitle={pageTitles[tab].subtitle}
        />

        <div className="border border-gray-200 bg-white p-8">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-red-50 flex items-center justify-center shrink-0">
              <AlertCircle
                size={18}
                className="text-red-500"
              />
            </div>

            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">
                Failed to load marketing data
              </p>

              <p className="text-sm text-gray-500 mt-1">
                {error}
              </p>

              <button
                type="button"
                onClick={() =>
                  setReloadKey(current => current + 1)
                }
                className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-xs tracking-wide hover:bg-black transition-colors"
              >
                <RefreshCw size={13} />
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ─────────────────────────────────────────────
     Main render
  ───────────────────────────────────────────── */

  return (
    <div style={{ fontFamily: FONT }}>
      <PageTitle
        title={pageTitles[tab].title}
        subtitle={pageTitles[tab].subtitle}
      />

      {/* Modals */}

      {showNewCampaignModal && (
        <NewCampaignModal
          onClose={() =>
            setShowNewCampaignModal(false)
          }
          onCreate={handleCreateCampaign}
        />
      )}

      {showRecoveryModal && (
        <RecoveryEmailModal
          cartCount={pendingCartCount}
          onClose={() =>
            setShowRecoveryModal(false)
          }
          onSend={() => {
            abandonedCarts.forEach(cart =>
              handleRecoveryEmail(cart.id)
            );
          }}
        />
      )}

      {showDiscountModal && (
        <OfferDiscountModal
          cartCount={pendingCartCount}
          onClose={() =>
            setShowDiscountModal(false)
          }
        />
      )}

      {/* =========================================================
          DISCOUNTS
      ========================================================= */}

      {tab === 'discounts' && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <AdminButton
              onClick={() =>
                setShowCreate(!showCreate)
              }
              disabled={isViewer}
            >
              <Plus
                size={14}
                className="inline mr-1"
              />
              Create Discount
            </AdminButton>
          </div>

          {showCreate && (
            <SectionCard title="Create Discount Code">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <AdminInput
                  label="Code"
                  value={discountForm.code}
                  onChange={value =>
                    setDiscountForm(prev => ({
                      ...prev,
                      code: value,
                    }))
                  }
                  placeholder="SUMMER20"
                />

                <AdminSelect
                  label="Type"
                  value={discountForm.type}
                  onChange={value =>
                    setDiscountForm(prev => ({
                      ...prev,
                      type:
                        value as DiscountForm['type'],
                    }))
                  }
                  options={[
                    {
                      value: 'Percentage',
                      label: 'Percentage',
                    },
                    {
                      value: 'Fixed',
                      label: 'Fixed Amount',
                    },
                    {
                      value: 'Free Shipping',
                      label: 'Free Shipping',
                    },
                  ]}
                />

                <AdminInput
                  label="Value"
                  value={discountForm.value}
                  onChange={value =>
                    setDiscountForm(prev => ({
                      ...prev,
                      value,
                    }))
                  }
                  type="number"
                  placeholder="20"
                />

                <AdminInput
                  label="Min Order (R)"
                  value={discountForm.minOrder}
                  onChange={value =>
                    setDiscountForm(prev => ({
                      ...prev,
                      minOrder: value,
                    }))
                  }
                  type="number"
                  placeholder="0"
                />

                <AdminInput
                  label="Start Date"
                  value={discountForm.startDate}
                  onChange={value =>
                    setDiscountForm(prev => ({
                      ...prev,
                      startDate: value,
                    }))
                  }
                  type="date"
                />

                <AdminInput
                  label="End Date"
                  value={discountForm.endDate}
                  onChange={value =>
                    setDiscountForm(prev => ({
                      ...prev,
                      endDate: value,
                    }))
                  }
                  type="date"
                />

                <AdminInput
                  label="Usage Limit"
                  value={discountForm.usageLimit}
                  onChange={value =>
                    setDiscountForm(prev => ({
                      ...prev,
                      usageLimit: value,
                    }))
                  }
                  type="number"
                  placeholder="100"
                />
              </div>

              <div className="flex justify-end gap-3">
                <AdminButton
                  variant="secondary"
                  onClick={() =>
                    setShowCreate(false)
                  }
                  aria-disabled={discountSaving}
                  className={
                    discountSaving
                      ? 'opacity-50 cursor-not-allowed'
                      : ''
                  }
                >
                  Cancel
                </AdminButton>

                <AdminButton
                  onClick={handleCreateDiscount}
                  aria-disabled={discountSaving}
                  className={
                    discountSaving
                      ? 'opacity-50 cursor-not-allowed'
                      : ''
                  }
                >
                  {discountSaving
                    ? 'Creating...'
                    : 'Create'}
                </AdminButton>
              </div>
            </SectionCard>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard
              label="Active Discounts"
              value={String(
                discounts.filter(
                  d => d.status === 'Active'
                ).length
              )}
              icon={<Percent size={16} />}
            />

            <KPICard
              label="Total Redemptions"
              value={String(
                discounts.reduce(
                  (sum, d) => sum + d.used,
                  0
                )
              )}
              icon={<ShoppingBag size={16} />}
            />

            <KPICard
              label="Scheduled"
              value={String(
                discounts.filter(
                  d => d.status === 'Scheduled'
                ).length
              )}
              icon={<Clock3 size={16} />}
            />

            <KPICard
              label="Expired"
              value={String(
                discounts.filter(
                  d => d.status === 'Expired'
                ).length
              )}
              icon={<RotateCcw size={16} />}
            />
          </div>

          <SectionCard title="Discount Codes">
            {discounts.length === 0 ? (
              <div className="py-16 text-center">
                <Percent
                  size={22}
                  className="mx-auto text-gray-300"
                />

                <p className="text-sm text-gray-500 mt-3">
                  No discount codes yet.
                </p>
              </div>
            ) : (
              <Table
                headers={[
                  'Code',
                  'Type',
                  'Value',
                  'Used / Limit',
                  'Status',
                  'Min Order',
                ]}
              >
                {discounts.map(d => (
                  <tr
                    key={d.id}
                    className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-3 px-4 text-sm font-medium text-gray-800">
                      {d.code}
                    </td>

                    <td className="py-3 px-4 text-sm text-gray-600">
                      {d.type === 'Free Shipping'
                        ? 'Free Ship'
                        : d.type}
                    </td>

                    <td className="py-3 px-4 text-sm text-gray-600">
                      {d.type === 'Percentage'
                        ? `${d.value}%`
                        : `R${d.value}`}
                    </td>

                    <td className="py-3 px-4 text-sm text-gray-600">
                      {d.used} /{' '}
                      {d.usageLimit ?? '∞'}
                    </td>

                    <td className="py-3 px-4">
                      <StatusBadge
                        status={d.status}
                      />
                    </td>

                    <td className="py-3 px-4 text-sm text-gray-600">
                      R{d.minOrder}
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </SectionCard>
        </div>
      )}

      {/* =========================================================
          CAMPAIGN ANALYTICS
      ========================================================= */}

      {tab === 'campaigns' && (
        <div className="space-y-6">
          {/* KPI row */}

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <KPICard
              label="Emails Sent"
              value={campaignMetrics.emailsSent.toLocaleString()}
              icon={<Mail size={16} />}
            />

            <KPICard
              label="Open Rate"
              value={`${campaignMetrics.openRate.toFixed(1)}%`}
              icon={<TrendingUp size={16} />}
            />

            <KPICard
              label="Orders Generated"
              value={campaignMetrics.orders.toLocaleString()}
              icon={<ShoppingBag size={16} />}
            />

            <KPICard
              label="Campaign Revenue"
              value={`R${campaignMetrics.revenue.toLocaleString()}`}
              icon={<DollarSign size={16} />}
            />
          </div>

          {/* Performance metrics */}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard
              label="Click Rate"
              value={`${campaignMetrics.clickRate.toFixed(2)}%`}
              change={`${campaignMetrics.clicks.toLocaleString()} clicks`}
              icon={<MousePointerClick size={16} />}
            />

            <KPICard
              label="Order Conversion"
              value={`${campaignMetrics.orderRate.toFixed(2)}%`}
              change={`${campaignMetrics.orders} orders`}
              icon={<ShoppingBag size={16} />}
            />

            <KPICard
              label="Revenue / Email"
              value={`R${campaignMetrics.revenuePerEmail.toFixed(2)}`}
              icon={<DollarSign size={16} />}
            />

            <KPICard
              label="Active Campaigns"
              value={String(
                campaigns.filter(
                  campaign =>
                    campaign.status === 'Active'
                ).length
              )}
              icon={<Megaphone size={16} />}
            />
          </div>

          {/* Revenue chart + campaign summary */}

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <SectionCard
              title="Campaign Revenue"
              className="xl:col-span-2"
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-[0.18em]">
                    Revenue by campaign
                  </p>

                  <p className="mt-2 text-2xl font-[100]">
                    R
                    {campaignMetrics.revenue.toLocaleString()}
                  </p>
                </div>

                <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.15em] text-gray-400">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: ACCENT,
                    }}
                  />
                  Revenue
                </div>
              </div>

              {campaignChartData.length > 0 ? (
                <BarChart
                  data={campaignChartData}
                  height={260}
                  color={ACCENT}
                />
              ) : (
                <div className="py-16 text-center">
                  <p className="text-sm text-gray-500">
                    No campaigns yet.
                  </p>
                </div>
              )}
            </SectionCard>

            <SectionCard title="Performance Summary">
              <div className="space-y-5">
                {[
                  {
                    label: 'Open rate',
                    value: `${campaignMetrics.openRate.toFixed(1)}%`,
                    icon: <Mail size={14} />,
                  },
                  {
                    label: 'Click rate',
                    value: `${campaignMetrics.clickRate.toFixed(2)}%`,
                    icon: (
                      <MousePointerClick
                        size={14}
                      />
                    ),
                  },
                  {
                    label: 'Conversion',
                    value: `${campaignMetrics.orderRate.toFixed(2)}%`,
                    icon: (
                      <ShoppingBag size={14} />
                    ),
                  },
                  {
                    label: 'Revenue / email',
                    value: `R${campaignMetrics.revenuePerEmail.toFixed(2)}`,
                    icon: (
                      <DollarSign size={14} />
                    ),
                  },
                ].map(metric => (
                  <div
                    key={metric.label}
                    className="flex items-center justify-between border-b border-gray-100 pb-4 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-gray-400">
                        {metric.icon}
                      </div>

                      <span className="text-xs text-gray-500 font-light">
                        {metric.label}
                      </span>
                    </div>

                    <span className="text-sm font-light text-black">
                      {metric.value}
                    </span>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>

          {/* Campaign list */}

          <SectionCard
            title="Campaign Performance"
            action={
              <AdminButton
                size="sm"
                variant="secondary"
                onClick={() =>
                  setShowNewCampaignModal(true)
                }
                disabled={isViewer}
              >
                <Plus
                  size={12}
                  className="inline mr-1"
                />
                New Campaign
              </AdminButton>
            }
          >
            {campaigns.length === 0 ? (
              <div className="py-16 text-center">
                <Megaphone
                  size={22}
                  className="mx-auto text-gray-300"
                />

                <p className="text-sm text-gray-500 mt-3">
                  No campaigns yet.
                </p>
              </div>
            ) : (
              <Table
                headers={[
                  'Campaign',
                  'Status',
                  'Emails',
                  'Open Rate',
                  'Clicks',
                  'Orders',
                  'Revenue',
                  'Action',
                ]}
              >
                {campaigns.map(campaign => {
                  const ctr =
                    campaign.emailsSent > 0
                      ? (campaign.clicks /
                          campaign.emailsSent) *
                        100
                      : 0;

                  const isSending =
                    sendingCampaignId ===
                    campaign.id;

                  return (
                    <tr
                      key={campaign.id}
                      onClick={() =>
                        setSelectedCampaignId(
                          campaign.id
                        )
                      }
                      className="border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <td className="py-4 px-4">
                        <div>
                          <p className="text-sm text-gray-800">
                            {campaign.name}
                          </p>

                          <p className="text-[10px] text-gray-400 mt-1">
                            Click for campaign analytics
                          </p>
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <StatusBadge
                          status={campaign.status}
                        />
                      </td>

                      <td className="py-4 px-4 text-sm text-gray-600">
                        {campaign.emailsSent.toLocaleString()}
                      </td>

                      <td className="py-4 px-4 text-sm text-gray-600">
                        {campaign.openRate}%
                      </td>

                      <td className="py-4 px-4">
                        <div>
                          <p className="text-sm text-gray-600">
                            {campaign.clicks.toLocaleString()}
                          </p>

                          <p className="text-[9px] text-gray-400 mt-1">
                            {ctr.toFixed(2)}% CTR
                          </p>
                        </div>
                      </td>

                      <td className="py-4 px-4 text-sm text-gray-600">
                        {campaign.orders}
                      </td>

                      <td className="py-4 px-4 text-sm font-light text-gray-900">
                        R
                        {campaign.revenue.toLocaleString()}
                      </td>

                      {/* Campaign action */}

                      <td
                        className="py-4 px-4"
                        onClick={e =>
                          e.stopPropagation()
                        }
                      >
                        <AdminButton
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            handleSendCampaign(
                              campaign
                            )
                          }
                          disabled={
                            isSending || isViewer
                          }
                        >
                          {isSending
                            ? 'Sending...'
                            : campaign.status ===
                              'Draft'
                            ? 'Send Now'
                            : 'Resend'}
                        </AdminButton>
                      </td>
                    </tr>
                  );
                })}
              </Table>
            )}
          </SectionCard>

          {/* Campaign detail */}

          {selectedCampaign && (
            <SectionCard title="Selected Campaign">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <KPICard
                  label="Campaign"
                  value={selectedCampaign.name}
                  icon={<Megaphone size={16} />}
                />

                <KPICard
                  label="Open Rate"
                  value={`${selectedCampaign.openRate}%`}
                  icon={<Mail size={16} />}
                />

                <KPICard
                  label="Orders"
                  value={String(
                    selectedCampaign.orders
                  )}
                  icon={<ShoppingBag size={16} />}
                />

                <KPICard
                  label="Revenue"
                  value={`R${selectedCampaign.revenue.toLocaleString()}`}
                  icon={<DollarSign size={16} />}
                />
              </div>

              <div className="mt-5 flex justify-end">
                <AdminButton
                  variant="secondary"
                  onClick={() =>
                    setSelectedCampaignId(null)
                  }
                >
                  Close
                </AdminButton>
              </div>
            </SectionCard>
          )}
        </div>
      )}

      {/* =========================================================
          ABANDONED CARTS
      ========================================================= */}

      {tab === 'abandoned' && (
        <div className="space-y-6">
          {/* KPIs */}

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <KPICard
              label="Abandoned Carts"
              value={String(
                abandonedMetrics.count
              )}
              icon={<ShoppingBag size={16} />}
            />

            <KPICard
              label="Potential Revenue"
              value={`R${abandonedMetrics.totalValue.toLocaleString()}`}
              icon={<DollarSign size={16} />}
            />

            <KPICard
              label="Average Cart"
              value={`R${Math.round(
                abandonedMetrics.averageValue
              ).toLocaleString()}`}
              icon={<ShoppingBag size={16} />}
            />

            <KPICard
              label="Recovery Rate"
              value={`${abandonedMetrics.recoveryRate}%`}
              change={`Estimated recovery R${Math.round(
                abandonedMetrics.estimatedRecovery
              ).toLocaleString()}`}
              icon={<RotateCcw size={16} />}
            />
          </div>

          {/* Recovery overview */}

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <SectionCard
              title="Recovery Opportunity"
              className="xl:col-span-2"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                <div>
                  <p className="text-[9px] uppercase tracking-[0.2em] text-gray-400">
                    Revenue currently sitting in
                    abandoned carts
                  </p>

                  <p className="mt-3 text-4xl font-[100] text-black">
                    R
                    {abandonedMetrics.totalValue.toLocaleString()}
                  </p>

                  <p className="mt-2 text-xs text-gray-400 font-light">
                    {abandonedMetrics.count}{' '}
                    abandoned
                    {abandonedMetrics.count === 1
                      ? ' cart'
                      : ' carts'}
                  </p>
                </div>

                <div className="w-full sm:w-56">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] uppercase tracking-[0.15em] text-gray-400">
                      Recovery rate
                    </span>

                    <span className="text-sm font-light">
                      {abandonedMetrics.recoveryRate}%
                    </span>
                  </div>

                  <div className="h-2 bg-gray-100 overflow-hidden">
                    <div
                      className="h-full"
                      style={{
                        width: `${abandonedMetrics.recoveryRate}%`,
                        backgroundColor: ACCENT,
                      }}
                    />
                  </div>

                  <p className="text-[9px] text-gray-400 mt-2">
                    Estimated recovery:{' '}
                    <span className="text-gray-700">
                      R
                      {Math.round(
                        abandonedMetrics.estimatedRecovery
                      ).toLocaleString()}
                    </span>
                  </p>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Recovery Actions">
              <div className="space-y-3">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    setShowRecoveryModal(true)
                  }
                  className="flex items-center gap-3 p-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <Mail
                    size={14}
                    className="text-gray-400"
                  />

                  <div className="flex-1">
                    <p className="text-xs text-gray-800">
                      Recovery Email
                    </p>

                    <p className="text-[9px] text-gray-400 mt-1">
                      Remind customers about their cart
                    </p>
                  </div>

                  <ArrowUpRight
                    size={13}
                    className="text-gray-400"
                  />
                </div>

                <div
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    setShowDiscountModal(true)
                  }
                  className="flex items-center gap-3 p-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <Percent
                    size={14}
                    className="text-gray-400"
                  />

                  <div className="flex-1">
                    <p className="text-xs text-gray-800">
                      Offer Discount
                    </p>

                    <p className="text-[9px] text-gray-400 mt-1">
                      Incentivize selected customers
                    </p>
                  </div>

                  <ArrowUpRight
                    size={13}
                    className="text-gray-400"
                  />
                </div>
              </div>
            </SectionCard>
          </div>

          {/* Cart table */}

          <SectionCard title="Abandoned Carts">
            {abandonedCarts.length === 0 ? (
              <div className="py-16 text-center">
                <ShoppingBag
                  size={22}
                  className="mx-auto text-gray-300"
                />

                <p className="text-sm text-gray-500 mt-3">
                  No abandoned carts right now.
                </p>
              </div>
            ) : (
              <Table
                headers={[
                  'Customer Email',
                  'Cart Value',
                  'Abandoned',
                  'Recovery',
                  'Action',
                ]}
              >
                {abandonedCarts.map(cart => {
                  const wasSent =
                    recoverySent.includes(
                      cart.id
                    );

                  return (
                    <tr
                      key={cart.id}
                      className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gray-100 flex items-center justify-center">
                            <Mail
                              size={13}
                              className="text-gray-400"
                            />
                          </div>

                          <div>
                            <p className="text-sm text-gray-700">
                              {cart.customerEmail}
                            </p>

                            <p className="text-[9px] text-gray-400 mt-1">
                              Customer
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <p className="text-sm font-light text-gray-900">
                          R
                          {cart.cartValue.toLocaleString()}
                        </p>
                      </td>

                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <Clock3
                            size={12}
                            className="text-gray-400"
                          />

                          <span className="text-sm text-gray-500">
                            {cart.abandonedTime}
                          </span>
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <StatusBadge
                          status={
                            wasSent
                              ? 'Completed'
                              : 'Pending'
                          }
                        />
                      </td>

                      <td className="py-4 px-4">
                        {wasSent ? (
                          <span className="text-[9px] uppercase tracking-[0.15em] text-gray-400">
                            Email Sent
                          </span>
                        ) : (
                          <AdminButton
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              handleRecoveryEmail(
                                cart.id
                              )
                            }
                          >
                            <Send
                              size={11}
                              className="inline mr-1"
                            />
                            Recover Cart
                          </AdminButton>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </Table>
            )}
          </SectionCard>
        </div>
      )}
    </div>
  );
};

/* ── Shared modal chrome: fades/scales in on mount ─────────── */

const useModalEntrance = () => {
  const [visible, setVisible] =
    useState(false);

  useEffect(() => {
    const t = setTimeout(
      () => setVisible(true),
      10
    );

    return () => clearTimeout(t);
  }, []);

  return visible;
};

/* ── New Campaign ───────────────────────────────────────── */

const NewCampaignModal: React.FC<{
  onClose: () => void;
  onCreate: (draft: {
    name: string;
    subject: string;
    audience: string;
    scheduledDate: string;
    body: string;
  }) => Promise<void>;
}> = ({ onClose, onCreate }) => {
  const visible = useModalEntrance();

  const [name, setName] = useState('');
  const [subject, setSubject] =
    useState('');
  const [audience, setAudience] =
    useState('All Customers');
  const [scheduledDate, setScheduledDate] =
    useState('');

  const [body, setBody] = useState('');

  const [saving, setSaving] =
    useState(false);

  const canCreate =
    name.trim() !== '' &&
    subject.trim() !== '' &&
    body.trim() !== '';

  const handleSubmit = async () => {
    if (!canCreate || saving) return;

    setSaving(true);

    try {
      await onCreate({
        name,
        subject,
        audience,
        scheduledDate,
        body,
      });
    } catch (err) {
      console.error(
        'Failed to create campaign:',
        err
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[70] flex items-center justify-center p-4">
      <div
        className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto transition-all duration-200 ease-out"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible
            ? 'scale(1)'
            : 'scale(0.96)',
        }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-light text-gray-900">
            New Campaign
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <AdminInput
            label="Campaign Name"
            value={name}
            onChange={setName}
            placeholder="Summer Sale Announcement"
          />

          <AdminInput
            label="Subject Line"
            value={subject}
            onChange={setSubject}
            placeholder="Don't miss out — 20% off everything"
          />

          <AdminSelect
            label="Audience"
            value={audience}
            onChange={setAudience}
            options={[
              {
                value: 'All Customers',
                label: 'All Customers',
              },
              {
                value: 'VIP Customers',
                label: 'VIP Customers',
              },
              {
                value: 'Newsletter Subscribers',
                label: 'Newsletter Subscribers',
              },
              {
                value: 'Abandoned Cart',
                label: 'Abandoned Cart Shoppers',
              },
            ]}
          />

          <AdminInput
            label="Send Date"
            value={scheduledDate}
            onChange={setScheduledDate}
            type="date"
          />

          {/* Email body */}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 tracking-wide">
              Email Content (HTML)
            </label>

            <textarea
              value={body}
              onChange={e =>
                setBody(e.target.value)
              }
              rows={6}
              placeholder="<p>Hey — here's what's new at Notorious.Y2...</p>"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 transition-colors resize-none font-mono"
            />

            <p className="text-[11px] text-gray-400 mt-1">
              Links (href="https://...") are
              automatically click-tracked. An
              open-tracking pixel is added
              automatically.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-gray-200 sticky bottom-0 bg-white">
          <AdminButton
            variant="secondary"
            onClick={onClose}
            aria-disabled={saving}
            className={
              saving
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }
          >
            Cancel
          </AdminButton>

          <AdminButton
            onClick={handleSubmit}
            aria-disabled={
              !canCreate || saving
            }
            className={
              !canCreate || saving
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }
          >
            {saving ? (
              <Loader2
                size={14}
                className="inline mr-1 animate-spin"
              />
            ) : (
              <Plus
                size={14}
                className="inline mr-1"
              />
            )}

            {saving
              ? 'Creating...'
              : 'Create Campaign'}
          </AdminButton>
        </div>
      </div>
    </div>
  );
};

/* ── Recovery Email ─────────────────────────────────────── */

const RecoveryEmailModal: React.FC<{
  cartCount: number;
  onClose: () => void;
  onSend: () => void;
}> = ({
  cartCount,
  onClose,
  onSend,
}) => {
  const visible = useModalEntrance();
  const { showToast } =
    useAdminToast();

  const [isGenerating, setIsGenerating] =
    useState(false);

  const [subject, setSubject] =
    useState(
      'You left something behind...'
    );

  const [body, setBody] = useState(
    "Hey! We noticed you left some items in your cart. They're still waiting for you — come finish checking out before they sell out."
  );

  const [status, setStatus] =
    useState<
      'idle' | 'sending' | 'sent'
    >('idle');

  const handleSend = () => {
    if (cartCount === 0) return;

    setStatus('sending');

    setTimeout(() => {
      onSend();
      setStatus('sent');

      setTimeout(onClose, 900);
    }, 700);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[70] flex items-center justify-center p-4">
      <div
        className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto transition-all duration-200 ease-out"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible
            ? 'scale(1)'
            : 'scale(0.96)',
        }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-light text-gray-900">
            Recovery Email
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs text-gray-500">
            This will be sent to{' '}
            <strong className="text-gray-700">
              {cartCount}
            </strong>{' '}
            customer
            {cartCount === 1
              ? ''
              : 's'} with a pending
            abandoned cart.
          </p>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={isGenerating}
              onClick={async () => {
                setIsGenerating(true);

                try {
                  const {
                    data,
                    error,
                  } =
                    await supabase.functions.invoke(
                      'generate-recovery-email',
                      {
                        body: {
                          cartCount,
                          averageValue: 0,
                        },
                      }
                    );

                  if (error) {
                    const detail =
                      await (
                        error as any
                      ).context?.json?.()
                        .catch(
                          () => null
                        );

                    const errorMessage =
                      detail?.error ??
                      error.message;

                    console.error(
                      'Recovery email error:',
                      errorMessage
                    );

                    showToast(
                      'error',
                      errorMessage
                    );

                    return;
                  }

                  setSubject(
                    data.subject
                  );

                  setBody(data.body);
                } catch (err) {
                  console.error(
                    'Failed to generate recovery email:',
                    err
                  );
                } finally {
                  setIsGenerating(
                    false
                  );
                }
              }}
              className="text-xs text-[#C44D2B] hover:underline disabled:opacity-50"
            >
              {isGenerating
                ? 'Generating…'
                : '✨ Generate copy'}
            </button>
          </div>

          <AdminInput
            label="Subject"
            value={subject}
            onChange={setSubject}
          />

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 tracking-wide">
              Message
            </label>

            <textarea
              value={body}
              onChange={e =>
                setBody(e.target.value)
              }
              rows={5}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 transition-colors resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-gray-200 sticky bottom-0 bg-white">
          <AdminButton
            variant="secondary"
            onClick={() => {
              if (status === 'idle') {
                onClose();
              }
            }}
            aria-disabled={
              status !== 'idle'
            }
            className={
              status !== 'idle'
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }
          >
            Cancel
          </AdminButton>

          <AdminButton
            onClick={() => {
              if (
                status === 'idle' &&
                cartCount > 0
              ) {
                handleSend();
              }
            }}
            aria-disabled={
              status !== 'idle' ||
              cartCount === 0
            }
            className={
              status !== 'idle' ||
              cartCount === 0
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }
          >
            {status === 'sending' && (
              <Loader2
                size={14}
                className="inline mr-1 animate-spin"
              />
            )}

            {status === 'sent' && (
              <CheckCircle2
                size={14}
                className="inline mr-1"
              />
            )}

            {status === 'idle' && (
              <Send
                size={14}
                className="inline mr-1"
              />
            )}

            {status === 'sending'
              ? 'Sending...'
              : status === 'sent'
              ? 'Sent!'
              : `Send to ${cartCount}`}
          </AdminButton>
        </div>
      </div>
    </div>
  );
};

/* ── Offer Discount ─────────────────────────────────────── */

const OfferDiscountModal: React.FC<{
  cartCount: number;
  onClose: () => void;
}> = ({
  cartCount,
  onClose,
}) => {
  const visible = useModalEntrance();

  const [discountType, setDiscountType] =
    useState('Percentage');

  const [value, setValue] =
    useState('10');

  const [expiryDays, setExpiryDays] =
    useState('3');

  const [status, setStatus] =
    useState<
      'idle' | 'sending' | 'sent'
    >('idle');

  const handleSend = () => {
    if (cartCount === 0) return;

    setStatus('sending');

    setTimeout(() => {
      setStatus('sent');

      setTimeout(onClose, 900);
    }, 700);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[70] flex items-center justify-center p-4">
      <div
        className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto transition-all duration-200 ease-out"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible
            ? 'scale(1)'
            : 'scale(0.96)',
        }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-light text-gray-900">
            Offer Discount
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs text-gray-500">
            Send an incentive to{' '}
            <strong className="text-gray-700">
              {cartCount}
            </strong>{' '}
            customer
            {cartCount === 1
              ? ''
              : 's'} with a pending
            abandoned cart.
          </p>

          <AdminSelect
            label="Discount Type"
            value={discountType}
            onChange={setDiscountType}
            options={[
              {
                value: 'Percentage',
                label: 'Percentage',
              },
              {
                value: 'Fixed',
                label: 'Fixed Amount',
              },
              {
                value: 'Free Shipping',
                label: 'Free Shipping',
              },
            ]}
          />

          {discountType !==
            'Free Shipping' && (
            <AdminInput
              label={
                discountType ===
                'Percentage'
                  ? 'Value (%)'
                  : 'Value (R)'
              }
              value={value}
              onChange={setValue}
              type="number"
            />
          )}

          <AdminInput
            label="Expires In (days)"
            value={expiryDays}
            onChange={setExpiryDays}
            type="number"
          />
        </div>

        <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-gray-200 sticky bottom-0 bg-white">
          <AdminButton
            variant="secondary"
            onClick={() => {
              if (status === 'idle') {
                onClose();
              }
            }}
            aria-disabled={
              status !== 'idle'
            }
            className={
              status !== 'idle'
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }
          >
            Cancel
          </AdminButton>

          <AdminButton
            onClick={() => {
              if (
                status === 'idle' &&
                cartCount > 0
              ) {
                handleSend();
              }
            }}
            aria-disabled={
              status !== 'idle' ||
              cartCount === 0
            }
            className={
              status !== 'idle' ||
              cartCount === 0
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }
          >
            {status === 'sending' && (
              <Loader2
                size={14}
                className="inline mr-1 animate-spin"
              />
            )}

            {status === 'sent' && (
              <CheckCircle2
                size={14}
                className="inline mr-1"
              />
            )}

            {status === 'idle' && (
              <Percent
                size={14}
                className="inline mr-1"
              />
            )}

            {status === 'sending'
              ? 'Sending...'
              : status === 'sent'
              ? 'Sent!'
              : `Send to ${cartCount}`}
          </AdminButton>
        </div>
      </div>
    </div>
  );
};

export default AdminMarketing;