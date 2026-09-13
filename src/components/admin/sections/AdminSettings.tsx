import React, { useEffect, useState } from 'react';
import {
  UserPlus,
  Trash2,
  Shield,
  Store,
  Mail,
  Bell,
  Globe,
  CreditCard,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Send,
  RefreshCw,
} from 'lucide-react';

import {
  PageTitle,
  SectionCard,
  StatusBadge,
  Table,
  AdminButton,
  AdminInput,
  AdminSelect,
  useAdminToast,
} from '../AdminUI';

import { getAdminUsers, inviteAdminUser } from '../../../data/admin';
import { getStoreSettings, updateStoreSettings } from '../../../data/storeSettings';
import { AdminAdminUser } from '../../../types/admin';

import { supabase } from '../../../lib/supabase';
import { useIsViewer } from '../../../hooks/useIsViewer';
export type SettingsTab =
  | 'general'
  | 'team'
  | 'store'
  | 'notifications'
  | 'payments';

interface AdminSettingsProps {
  initialTab?: SettingsTab;
  isActive?: boolean;
}

/* =========================================================
   Types
========================================================= */

type ActionState = 'idle' | 'loading' | 'success' | 'error';

type InviteForm = {
  name: string;
  email: string;
  role: string;
};

type StoreInfoSettings = {
  storeName: string;
  supportEmail: string;
  phoneNumber: string;
  timezone: string;
  currency: string;
  weightUnit: string;
};

type StoreAddressSettings = {
  line1: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

type StorefrontToggleSettings = {
  storeOpen: boolean;
  multiCurrency: boolean;
  emailNotifications: boolean;
};

type NotificationPrefs = {
  newOrders: boolean;
  lowStock: boolean;
  newCustomers: boolean;
  dailySummary: boolean;
  abandonedCart: boolean;
};

type PaymentToggleSettings = {
  cards: boolean;
  paypal: boolean;
  applePay: boolean;
  googlePay: boolean;
  eft: boolean;
  payoutSchedule?: string;
  bankAccount?: string;
};

const defaultStoreInfo: StoreInfoSettings = {
  storeName: 'Notorious.Y2',
  supportEmail: 'support@notorious.y2',
  phoneNumber: '+27 11 234 5678',
  timezone: 'Africa/Johannesburg',
  currency: 'ZAR',
  weightUnit: 'kg',
};

const defaultStoreAddress: StoreAddressSettings = {
  line1: '123 Main Street',
  city: 'Johannesburg',
  state: 'Gauteng',
  postalCode: '2000',
  country: 'South Africa',
};

const defaultStorefrontToggles: StorefrontToggleSettings = {
  storeOpen: true,
  multiCurrency: true,
  emailNotifications: true,
};

const defaultNotificationPrefs: NotificationPrefs = {
  newOrders: true,
  lowStock: true,
  newCustomers: false,
  dailySummary: true,
  abandonedCart: true,
};

const defaultPaymentToggles: PaymentToggleSettings = {
  cards: true,
  paypal: true,
  applePay: true,
  googlePay: false,
  eft: false,
  payoutSchedule: 'Weekly (Mondays)',
  bankAccount: '**** **** 1234',
};

/* =========================================================
   Page Titles
========================================================= */

const pageTitles: Record<SettingsTab, { title: string; subtitle: string }> = {
  general: {
    title: 'Settings',
    subtitle: 'Store details, address, and regional settings',
  },

  team: {
    title: 'Team Members',
    subtitle: 'Manage admin users and role permissions',
  },

  store: {
    title: 'Storefront',
    subtitle: 'Control store status and customer-facing options',
  },

  notifications: {
    title: 'Notifications',
    subtitle: 'Choose which alerts you want to receive',
  },

  payments: {
    title: 'Payments',
    subtitle: 'Configure payment methods and payouts',
  },
};

/* =========================================================
   Animation Helpers
========================================================= */

const modalPanelStyle = (
  visible: boolean
): React.CSSProperties => ({
  opacity: visible ? 1 : 0,
  transform: visible
    ? 'translateY(0) scale(1)'
    : 'translateY(12px) scale(0.98)',
  transition:
    'opacity 180ms ease, transform 180ms ease',
});

/* =========================================================
   Admin Settings
========================================================= */

const AdminSettings: React.FC<AdminSettingsProps> = ({
  initialTab = 'general',
  isActive = true,
}) => {
  const [tab, setTab] =
    useState<SettingsTab>(initialTab);

  const { showToast } = useAdminToast();
  const isViewer = useIsViewer();

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  /* =======================================================
     Team Members (loaded from Supabase)
  ======================================================= */

  const [teamMembers, setTeamMembers] =
    useState<AdminAdminUser[]>([]);

  const [teamLoading, setTeamLoading] =
    useState(true);

  const [teamError, setTeamError] =
    useState<string | null>(null);

    const [teamReloadKey, setTeamReloadKey] =
    useState(0);

  const [hasLoadedTeamOnce, setHasLoadedTeamOnce] =
    useState(false);

  useEffect(() => {
    if (!isActive) return;
    let cancelled = false;

        const loadTeam = async () => {
      if (!hasLoadedTeamOnce) {
        setTeamLoading(true);
      }
      setTeamError(null);

      try {
        const data = await getAdminUsers();

        if (cancelled) return;

        setTeamMembers(data);
        setHasLoadedTeamOnce(true);
      } catch (err) {
        if (cancelled) return;

        console.error(
          'Failed to load admin users:',
          err
        );

        setTeamError(
          err instanceof Error
            ? err.message
            : 'Failed to load team members.'
        );
      } finally {
        if (!cancelled) {
          setTeamLoading(false);
        }
      }
    };

    loadTeam();

    return () => {
      cancelled = true;
    };
  }, [teamReloadKey, isActive]);

  /* =======================================================
     Invite Member
  ======================================================= */

  const [showInviteModal, setShowInviteModal] =
    useState(false);

  const [inviteVisible, setInviteVisible] =
    useState(false);

  const [inviteForm, setInviteForm] =
    useState<InviteForm>({
      name: '',
      email: '',
      role: 'Admin',
    });

  const [inviteStatus, setInviteStatus] =
    useState<ActionState>('idle');


  /* =======================================================
     Team Member Removal
  ======================================================= */

  const [removingMemberId, setRemovingMemberId] =
    useState<string | null>(null);

  const [memberToRemove, setMemberToRemove] =
    useState<AdminAdminUser | null>(null);

  const [removeVisible, setRemoveVisible] =
    useState(false);

  /* =======================================================
     Store Settings
  ======================================================= */

  const [storeInfo, setStoreInfo] =
    useState<StoreInfoSettings>(defaultStoreInfo);

  const [storeAddress, setStoreAddress] =
    useState<StoreAddressSettings>(defaultStoreAddress);

  const [storefrontSettings, setStorefrontSettings] =
    useState<StorefrontToggleSettings>(defaultStorefrontToggles);

  /* =======================================================
     Notification Settings
  ======================================================= */

  const [notificationSettings, setNotificationSettings] =
    useState<NotificationPrefs>(defaultNotificationPrefs);

  /* =======================================================
     Payment Settings
  ======================================================= */

  const [paymentSettings, setPaymentSettings] =
    useState<PaymentToggleSettings>(defaultPaymentToggles);

    const [settingsLoading, setSettingsLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [hasLoadedSettingsOnce, setHasLoadedSettingsOnce] = useState(false);

  useEffect(() => {
    if (!isActive) return;

    let cancelled = false;

        const loadSettings = async () => {
      if (!hasLoadedSettingsOnce) {
        setSettingsLoading(true);
      }
      setSettingsError(null);

      try {
        const settings = await getStoreSettings();
        if (cancelled) return;

        setStoreInfo({
          ...defaultStoreInfo,
          ...(settings.store_info ?? {}),
        });

        setStoreAddress({
          ...defaultStoreAddress,
          ...(settings.store_address ?? {}),
        });

        setStorefrontSettings({
          ...defaultStorefrontToggles,
          ...(settings.storefront_toggles ?? {}),
        });

        setNotificationSettings({
          ...defaultNotificationPrefs,
          ...(settings.notification_prefs ?? {}),
        });

        setPaymentSettings({
          ...defaultPaymentToggles,
          ...(settings.payment_toggles ?? {}),
        });

        setHasLoadedSettingsOnce(true);
      } catch (err) {
        if (cancelled) return;

        console.error('Failed to load store settings:', err);
        setSettingsError(
          err instanceof Error
            ? err.message
            : 'Failed to load store settings.'
        );
      } finally {
        if (!cancelled) {
          setSettingsLoading(false);
        }
      }
    };

    loadSettings();

    return () => {
      cancelled = true;
    };
  }, [isActive]);

  const saveSettings = async <T,>(
    key:
      | 'store_info'
      | 'store_address'
      | 'storefront_toggles'
      | 'notification_prefs'
      | 'payment_toggles',
    value: T,
    successMessage: string
  ) => {
    if (isViewer) {
      showToast('error', "You don't have permission to make changes (Viewer role).");
      return;
    }
    if (savingKey) return;
    setSavingKey(key);
    setSettingsError(null);

    try {
      await updateStoreSettings(key, value as any);
      showToast('success', successMessage);
    } catch (err) {
      console.error(`Failed to save ${key}:`, err);

      const message =
        err instanceof Error
          ? err.message
          : `Failed to save ${key.replace(/_/g, ' ')}.`;

      setSettingsError(message);
      showToast('error', message);
    } finally {
      setSavingKey(null);
    }
  };

  /* =======================================================
     Invite Modal
  ======================================================= */

  const openInviteModal = () => {
    setInviteForm({
      name: '',
      email: '',
      role: 'Admin',
    });

    setInviteStatus('idle');
    setShowInviteModal(true);

    window.setTimeout(() => {
      setInviteVisible(true);
    }, 20);
  };

  const closeInviteModal = () => {
    if (inviteStatus === 'loading') {
      return;
    }

    setInviteVisible(false);

    window.setTimeout(() => {
      setShowInviteModal(false);
    }, 180);
  };

  const updateInviteField = (
    field: keyof InviteForm,
    value: string
  ) => {
    setInviteForm(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email.trim()
    );
  };

  const inviteFormValid =
    inviteForm.name.trim().length >= 2 &&
    isValidEmail(inviteForm.email) &&
    inviteForm.role.trim() !== '';

  const handleInviteMember = async () => {
    if (isViewer) {
      showToast('error', "You don't have permission to make changes (Viewer role).");
      return;
    }
    if (!inviteFormValid) {
      setInviteStatus('error');
      showToast('error', 'Please enter a valid name and email address.');
      return;
    }
    setInviteStatus('loading');
    try {
      await inviteAdminUser(inviteForm.name.trim(), inviteForm.email.trim(), inviteForm.role as any);
      setInviteStatus('success');
      showToast('success', `${inviteForm.email} now has admin access.`);
      setTeamReloadKey(current => current + 1);
      window.setTimeout(() => { closeInviteModal(); }, 900);
    } catch (err) {
      setInviteStatus('error');
      showToast('error', err instanceof Error ? err.message : 'Failed to invite team member.');
    }
  };

  /* =======================================================
     Remove Member
  ======================================================= */

  const openRemoveMember = (member: AdminAdminUser) => {
    setMemberToRemove(member);
    setRemoveVisible(false);

    setTimeout(() => {
      setRemoveVisible(true);
    }, 20);
  };

  const closeRemoveMember = () => {
    setRemoveVisible(false);

    setTimeout(() => {
      setMemberToRemove(null);
    }, 180);
  };

  const handleRemoveMember = async () => {
    if (isViewer) {
      showToast('error', "You don't have permission to make changes (Viewer role).");
      return;
    }

    if (!memberToRemove) return;
    const memberId = memberToRemove.id;
    setRemovingMemberId(memberId);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_admin: false, admin_role: null })
        .eq('id', memberId);
      if (error) throw error;
      setTeamMembers(prev => prev.filter(m => m.id !== memberId));
    showToast('success', `${memberToRemove.name} has been removed.`);
    closeRemoveMember();
  } catch (err) {
    showToast('error', err instanceof Error ? err.message : 'Failed to remove member.');
  } finally {
    setRemovingMemberId(null);
  }
};

  /* =======================================================
     Toggle Helper
  ======================================================= */

  const toggleNotification = (
    key: keyof NotificationPrefs
  ) => {
    setNotificationSettings(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const togglePayment = (
    key: keyof PaymentToggleSettings
  ) => {
    setPaymentSettings(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  /* =======================================================
     Render
  ======================================================= */

  return (
    <div className="relative">
      <PageTitle
        title={pageTitles[tab].title}
        subtitle={pageTitles[tab].subtitle}
      />

      {settingsError && (
        <div className="mb-6 border border-red-200 bg-red-50 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle size={16} className="text-red-500 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">
                Unable to load or save store settings
              </p>
              <p className="text-xs text-red-600 mt-1">
                {settingsError}
              </p>
            </div>
          </div>
        </div>
      )}

            {settingsLoading && !hasLoadedSettingsOnce && (
        <div className="mb-6 flex items-center gap-2 text-xs text-gray-500">
          <Loader2 size={14} className="animate-spin" />
          Loading store settings...
        </div>
      )}

      {/* =====================================================
          GENERAL TABS
      ===================================================== */}

      {tab !== 'team' && (
        <div className="flex items-center space-x-1 mb-6 bg-white rounded-lg border border-gray-200 p-1 w-fit overflow-x-auto">
          {(
            [
              'general',
              'store',
              'notifications',
              'payments',
            ] as const
          ).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm rounded-md transition-all capitalize whitespace-nowrap ${
                tab === t
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {/* =====================================================
          GENERAL
      ===================================================== */}

      {tab === 'general' && (
        <div className="space-y-6">
          <SectionCard title="Store Information">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <AdminInput
                label="Store Name"
                value={storeInfo.storeName}
                onChange={value =>
                  setStoreInfo(prev => ({ ...prev, storeName: value }))
                }
              />

              <AdminInput
                label="Support Email"
                value={storeInfo.supportEmail}
                onChange={value =>
                  setStoreInfo(prev => ({ ...prev, supportEmail: value }))
                }
              />

              <AdminInput
                label="Phone Number"
                value={storeInfo.phoneNumber}
                onChange={value =>
                  setStoreInfo(prev => ({ ...prev, phoneNumber: value }))
                }
              />

              <AdminSelect
                label="Timezone"
                value={storeInfo.timezone}
                onChange={value =>
                  setStoreInfo(prev => ({ ...prev, timezone: value }))
                }
                options={[
                  {
                    value: 'Africa/Johannesburg',
                    label:
                      'Africa/Johannesburg (SAST)',
                  },
                  {
                    value: 'UTC',
                    label: 'UTC',
                  },
                ]}
              />

              <AdminSelect
                label="Currency"
                value={storeInfo.currency}
                onChange={value =>
                  setStoreInfo(prev => ({ ...prev, currency: value }))
                }
                options={[
                  {
                    value: 'ZAR',
                    label: 'ZAR - South African Rand',
                  },
                  {
                    value: 'USD',
                    label: 'USD - US Dollar',
                  },
                  {
                    value: 'EUR',
                    label: 'EUR - Euro',
                  },
                  {
                    value: 'GBP',
                    label: 'GBP - British Pound',
                  },
                ]}
              />

              <AdminSelect
                label="Weight Unit"
                value={storeInfo.weightUnit}
                onChange={value =>
                  setStoreInfo(prev => ({ ...prev, weightUnit: value }))
                }
                options={[
                  {
                    value: 'kg',
                    label: 'Kilograms',
                  },
                  {
                    value: 'lb',
                    label: 'Pounds',
                  },
                ]}
              />
            </div>

            <div className="flex justify-end mt-4">
              <AdminButton
                onClick={() =>
                  saveSettings(
                    'store_info',
                    storeInfo,
                    'Store information saved.'
                  )
                }
                className={savingKey === 'store_info' ? 'opacity-50 cursor-not-allowed' : ''}
              >
                {savingKey === 'store_info' ? 'Saving...' : 'Save Changes'}
              </AdminButton>
            </div>
          </SectionCard>

          <SectionCard title="Store Address">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <AdminInput
                  label="Address Line 1"
                  value={storeAddress.line1}
                  onChange={value =>
                    setStoreAddress(prev => ({ ...prev, line1: value }))
                  }
                />
              </div>

              <AdminInput
                label="City"
                value={storeAddress.city}
                onChange={value =>
                  setStoreAddress(prev => ({ ...prev, city: value }))
                }
              />

              <AdminInput
                label="State / Province"
                value={storeAddress.state}
                onChange={value =>
                  setStoreAddress(prev => ({ ...prev, state: value }))
                }
              />

              <AdminInput
                label="Postal Code"
                value={storeAddress.postalCode}
                onChange={value =>
                  setStoreAddress(prev => ({ ...prev, postalCode: value }))
                }
              />

              <AdminSelect
                label="Country"
                value={storeAddress.country}
                onChange={value =>
                  setStoreAddress(prev => ({ ...prev, country: value }))
                }
                options={[
                  {
                    value: 'South Africa',
                    label: 'South Africa',
                  },
                  {
                    value: 'United States',
                    label: 'United States',
                  },
                  {
                    value: 'United Kingdom',
                    label: 'United Kingdom',
                  },
                ]}
              />
            </div>

            <div className="flex justify-end mt-4">
              <AdminButton
                onClick={() =>
                  saveSettings(
                    'store_address',
                    storeAddress,
                    'Store address saved.'
                  )
                }
                className={savingKey === 'store_address' ? 'opacity-50 cursor-not-allowed' : ''}
              >
                {savingKey === 'store_address' ? 'Saving...' : 'Save Address'}
              </AdminButton>
            </div>
          </SectionCard>
        </div>
      )}

      {/* =====================================================
          TEAM
      ===================================================== */}

      {tab === 'team' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-[0.16em]">
                Team access
              </p>

              <p className="text-sm text-gray-600 mt-1">
                Invite staff and manage administrative
                permissions.
              </p>
            </div>

            <AdminButton onClick={openInviteModal} disabled={isViewer}>
  <UserPlus size={14} className="inline mr-1" />
  Invite Member
</AdminButton>
          </div>

                    {teamLoading && !hasLoadedTeamOnce ? (
            <SectionCard title="Team Members">
              <div className="space-y-0">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-14 border-b border-gray-50 bg-gray-50/50 animate-pulse"
                  />
                ))}
              </div>
            </SectionCard>
          ) : teamError ? (
            <div className="border border-gray-200 bg-white p-8">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-red-50 flex items-center justify-center shrink-0">
                  <AlertCircle size={18} className="text-red-500" />
                </div>

                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    Failed to load team members
                  </p>

                  <p className="text-sm text-gray-500 mt-1">
                    {teamError}
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      setTeamReloadKey(current => current + 1)
                    }
                    className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-xs tracking-wide hover:bg-black transition-colors"
                  >
                    <RefreshCw size={13} />
                    Retry
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <SectionCard title="Team Members">
              {teamMembers.length === 0 ? (
                <div className="py-12 text-center">
                  <Shield size={22} className="mx-auto text-gray-300" />
                  <p className="text-sm text-gray-500 mt-3">
                    No admin users found.
                  </p>
                </div>
              ) : (
                <Table
                  headers={[
                    'Name',
                    'Email',
                    'Role',
                    'Last Active',
                    'Status',
                    '',
                  ]}
                >
                  {teamMembers.map(u => {
                    const isRemoving =
                      removingMemberId === u.id;

                    return (
                      <tr
                        key={u.id}
                        className={`border-b border-gray-50 hover:bg-gray-50 transition-all duration-300 ${
                          isRemoving
                            ? 'opacity-0 translate-x-4'
                            : 'opacity-100 translate-x-0'
                        }`}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-amber-600 flex items-center justify-center text-white text-xs font-medium">
                              {u.name.charAt(0)}
                            </div>

                            <span className="text-sm text-gray-800">
                              {u.name}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-sm text-gray-500">
                          {u.email}
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`text-sm font-medium ${
                              u.role === 'Owner'
                                ? 'text-amber-600'
                                : u.role === 'Admin'
                                ? 'text-gray-800'
                                : 'text-gray-600'
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-sm text-gray-500">
                          {u.lastActive}
                        </td>

                        <td className="py-3 px-4">
                          <StatusBadge status={u.status} />
                        </td>

                        <td className="py-3 px-4">
                          {u.role !== 'Owner' && (
                            <button
                              onClick={() =>
                                openRemoveMember(u)
                              }
                              disabled={isRemoving}
                              className="p-1.5 hover:bg-red-100 rounded text-red-500 transition-all hover:scale-105 active:scale-95"
                              title="Remove member"
                            >
                              {isRemoving ? (
                                <Loader2
                                  size={14}
                                  className="animate-spin"
                                />
                              ) : (
                                <Trash2 size={14} />
                              )}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </Table>
              )}
            </SectionCard>
          )}

          <SectionCard title="Role Permissions">
            <div className="space-y-3">
              {[
                {
                  role: 'Owner',
                  perms:
                    'Full access to all settings, billing, and team management',
                },
                {
                  role: 'Admin',
                  perms:
                    'Manage products, orders, customers, and view analytics',
                },
                {
                  role: 'Manager',
                  perms:
                    'Manage products, orders, and view analytics',
                },
                {
                  role: 'Support',
                  perms:
                    'View and manage orders, respond to customers',
                },
                {
                  role: 'Analyst',
                  perms:
                    'View analytics and reports only',
                },
                {
  role: 'Viewer',
  perms: 'View the dashboard only. Cannot create, edit, or delete anything.',
},
              ].map((r, i) => (
                <div
                  key={i}
                  className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <Shield
                    size={16}
                    className="text-gray-400 mt-0.5"
                  />

                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {r.role}
                    </p>

                    <p className="text-xs text-gray-500 mt-0.5">
                      {r.perms}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      {/* =====================================================
          STOREFRONT
      ===================================================== */}

      {tab === 'store' && (
        <div className="space-y-6">
          <SectionCard title="Storefront Settings">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Store
                    size={18}
                    className="text-gray-400"
                  />

                  <div>
                    <p className="text-sm text-gray-800">
                      Store Status
                    </p>

                    <p className="text-xs text-gray-500">
                      Open or close your store
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={storefrontSettings.storeOpen}
                    onChange={e =>
                      setStorefrontSettings(prev => ({
                        ...prev,
                        storeOpen: e.target.checked,
                      }))
                    }
                    className="sr-only peer"
                  />

                  <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-green-500 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5" />
                </label>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Globe
                    size={18}
                    className="text-gray-400"
                  />

                  <div>
                    <p className="text-sm text-gray-800">
                      Multi-Currency
                    </p>

                    <p className="text-xs text-gray-500">
                      Allow customers to browse in different
                      currencies
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={storefrontSettings.multiCurrency}
                    onChange={e =>
                      setStorefrontSettings(prev => ({
                        ...prev,
                        multiCurrency: e.target.checked,
                      }))
                    }
                    className="sr-only peer"
                  />

                  <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-green-500 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5" />
                </label>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Mail
                    size={18}
                    className="text-gray-400"
                  />

                  <div>
                    <p className="text-sm text-gray-800">
                      Email Notifications
                    </p>

                    <p className="text-xs text-gray-500">
                      Send order confirmations to customers
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={storefrontSettings.emailNotifications}
                    onChange={e =>
                      setStorefrontSettings(prev => ({
                        ...prev,
                        emailNotifications: e.target.checked,
                      }))
                    }
                    className="sr-only peer"
                  />

                  <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-green-500 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5" />
                </label>
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <AdminButton
                onClick={() =>
                  saveSettings(
                    'storefront_toggles',
                    storefrontSettings,
                    'Storefront settings saved.'
                  )
                }
                className={savingKey === 'storefront_toggles' ? 'opacity-50 cursor-not-allowed' : ''}
              >
                {savingKey === 'storefront_toggles'
                  ? 'Saving...'
                  : 'Save Storefront Settings'}
              </AdminButton>
            </div>
          </SectionCard>
        </div>
      )}

      {/* =====================================================
          NOTIFICATIONS
      ===================================================== */}

      {tab === 'notifications' && (
        <div className="space-y-6">
          <SectionCard title="Notification Preferences">
            <div className="space-y-4">
              {[
                {
                  key: 'newOrders' as const,
                  icon: <Bell size={18} />,
                  label: 'New Orders',
                  desc: 'Get notified when a new order is placed',
                },

                {
                  key: 'lowStock' as const,
                  icon: <Mail size={18} />,
                  label: 'Low Stock Alerts',
                  desc: 'Get notified when product stock is low',
                },

                {
                  key: 'newCustomers' as const,
                  icon: <Bell size={18} />,
                  label: 'New Customer Signups',
                  desc: 'Get notified when a new customer registers',
                },

                {
                  key: 'dailySummary' as const,
                  icon: <Mail size={18} />,
                  label: 'Daily Summary',
                  desc: 'Receive a daily summary of store activity',
                },

                {
                  key: 'abandonedCart' as const,
                  icon: <Bell size={18} />,
                  label: 'Abandoned Cart Recovery',
                  desc: 'Get alerts for carts abandoned 24+ hours',
                },
              ].map(n => (
                <div
                  key={n.key}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-gray-400">
                      {n.icon}
                    </span>

                    <div>
                      <p className="text-sm text-gray-800">
                        {n.label}
                      </p>

                      <p className="text-xs text-gray-500">
                        {n.desc}
                      </p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={
                        notificationSettings[n.key]
                      }
                      onChange={() =>
                        toggleNotification(n.key)
                      }
                      className="sr-only peer"
                    />

                    <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-green-500 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5" />
                  </label>
                </div>
              ))}
            </div>

            <div className="flex justify-end mt-4">
              <AdminButton
                onClick={() =>
                  saveSettings(
                    'notification_prefs',
                    notificationSettings,
                    'Notification preferences saved.'
                  )
                }
                className={savingKey === 'notification_prefs' ? 'opacity-50 cursor-not-allowed' : ''}
              >
                {savingKey === 'notification_prefs'
                  ? 'Saving...'
                  : 'Save Notification Preferences'}
              </AdminButton>
            </div>
          </SectionCard>
        </div>
      )}

      {/* =====================================================
          PAYMENTS
      ===================================================== */}

      {tab === 'payments' && (
        <div className="space-y-6">
          <SectionCard title="Payment Methods">
            <div className="space-y-4">
              {[
                {
                  key: 'cards' as const,
                  icon: <CreditCard size={18} />,
                  label: 'Credit / Debit Cards',
                  desc: 'Accept Visa, Mastercard, Amex',
                },

                {
                  key: 'paypal' as const,
                  icon: <CreditCard size={18} />,
                  label: 'PayPal',
                  desc: 'Accept PayPal payments',
                },

                {
                  key: 'applePay' as const,
                  icon: <CreditCard size={18} />,
                  label: 'Apple Pay',
                  desc: 'Accept Apple Pay',
                },

                {
                  key: 'googlePay' as const,
                  icon: <CreditCard size={18} />,
                  label: 'Google Pay',
                  desc: 'Accept Google Pay',
                },

                {
                  key: 'eft' as const,
                  icon: <CreditCard size={18} />,
                  label: 'Bank Transfer (EFT)',
                  desc: 'Accept direct bank transfers',
                },
              ].map(p => (
                <div
                  key={p.key}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-gray-400">
                      {p.icon}
                    </span>

                    <div>
                      <p className="text-sm text-gray-800">
                        {p.label}
                      </p>

                      <p className="text-xs text-gray-500">
                        {p.desc}
                      </p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={paymentSettings[p.key]}
                      onChange={() =>
                        togglePayment(p.key)
                      }
                      className="sr-only peer"
                    />

                    <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-green-500 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5" />
                  </label>
                </div>
              ))}
            </div>

            <div className="flex justify-end mt-4">
              <AdminButton
                onClick={() =>
                  saveSettings(
                    'payment_toggles',
                    paymentSettings,
                    'Payment settings saved.'
                  )
                }
                className={savingKey === 'payment_toggles' ? 'opacity-50 cursor-not-allowed' : ''}
              >
                {savingKey === 'payment_toggles'
                  ? 'Saving...'
                  : 'Save Payment Methods'}
              </AdminButton>
            </div>
          </SectionCard>

          <SectionCard title="Payout Settings">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <AdminInput
                label="Payout Schedule"
                value={paymentSettings.payoutSchedule || ''}
                onChange={value =>
                  setPaymentSettings(prev => ({ ...prev, payoutSchedule: value }))
                }
              />

              <AdminInput
                label="Bank Account"
                value={paymentSettings.bankAccount || ''}
                onChange={value =>
                  setPaymentSettings(prev => ({ ...prev, bankAccount: value }))
                }
              />
            </div>

            <div className="flex justify-end mt-4">
              <AdminButton
                onClick={() =>
                  saveSettings(
                    'payment_toggles',
                    paymentSettings,
                    'Payout settings saved.'
                  )
                }
                className={savingKey === 'payment_toggles' ? 'opacity-50 cursor-not-allowed' : ''}
              >
                {savingKey === 'payment_toggles'
                  ? 'Saving...'
                  : 'Save Payout Settings'}
              </AdminButton>
            </div>
          </SectionCard>
        </div>
      )}

      {/* =====================================================
          INVITE MEMBER MODAL
      ===================================================== */}

      {showInviteModal && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          style={{
            backgroundColor:
              'rgba(0, 0, 0, 0.48)',
          }}
        >
          <div
            className="absolute inset-0"
            onClick={() => {
              if (inviteStatus !== 'loading') {
                closeInviteModal();
              }
            }}
          />

          <div
            className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
            style={modalPanelStyle(inviteVisible)}
          >
            <div className="px-6 py-5 border-b border-gray-100">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-900 text-white flex items-center justify-center">
                    <UserPlus size={18} />
                  </div>

                  <div>
                    <h2 className="text-base font-medium text-gray-900">
                      Invite team member
                    </h2>

                    <p className="text-xs text-gray-500 mt-1">
                      Give someone access to your admin
                      dashboard.
                    </p>
                  </div>
                </div>

                <button
                  onClick={closeInviteModal}
                  className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={17} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <AdminInput
                label="Full Name"
                value={inviteForm.name}
                onChange={value =>
                  updateInviteField('name', value)
                }
                placeholder="e.g. Sarah Jones"
              />

              <AdminInput
                label="Email Address"
                value={inviteForm.email}
                onChange={value =>
                  updateInviteField('email', value)
                }
                placeholder="sarah@example.com"
                type="email"
              />

              <AdminSelect
                label="Role"
                value={inviteForm.role}
                onChange={value =>
                  updateInviteField('role', value)
                }
                options={[
                  {
                    value: 'Admin',
                    label: 'Admin',
                  },
                  {
                    value: 'Manager',
                    label: 'Manager',
                  },
                  {
                    value: 'Support',
                    label: 'Support',
                  },
                  {
                    value: 'Analyst',
                    label: 'Analyst',
                  },
                  { value: 'Viewer', label: 'Viewer' },
                ]}
              />

              <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
                <div className="flex items-start gap-3">
                  <Shield
                    size={15}
                    className="text-gray-400 mt-0.5"
                  />

                  <div>
                    <p className="text-xs font-medium text-gray-800">
                      {inviteForm.role} access
                    </p>

                    <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                      {inviteForm.role === 'Admin' &&
                        'Can manage products, orders, customers, and view analytics.'}

                      {inviteForm.role === 'Manager' &&
                        'Can manage products, orders, and view analytics.'}

                      {inviteForm.role === 'Support' &&
                        'Can view and manage orders and respond to customers.'}

                      {inviteForm.role === 'Analyst' &&
                        'Can view analytics and reports only.'}

                        {inviteForm.role === 'Viewer' &&
  'Can view the dashboard only. Cannot create, edit, or delete anything.'}
                    </p>
                  </div>
                </div>
              </div>

              {inviteStatus === 'success' && (
                <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
                  <CheckCircle2
                    size={18}
                    className="text-green-600"
                  />

                  <div>
                    <p className="text-xs font-medium text-green-800">
                      Invitation sent
                    </p>

                    <p className="text-[11px] text-green-700 mt-0.5">
                      {inviteForm.email} can now accept
                      the invitation.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
              <AdminButton
                variant="secondary"
                onClick={closeInviteModal}
              >
                Cancel
              </AdminButton>

              <AdminButton
                onClick={handleInviteMember}
                className={
                  !inviteFormValid ||
                  inviteStatus === 'loading' ||
                  inviteStatus === 'success'
                    ? 'opacity-50 cursor-not-allowed'
                    : ''
                }
              >
                {inviteStatus === 'loading' ? (
                  <>
                    <Loader2
                      size={14}
                      className="inline mr-1.5 animate-spin"
                    />
                    Sending...
                  </>
                ) : inviteStatus === 'success' ? (
                  <>
                    <CheckCircle2
                      size={14}
                      className="inline mr-1.5"
                    />
                    Sent
                  </>
                ) : (
                  <>
                    <Send
                      size={14}
                      className="inline mr-1.5"
                    />
                    Send Invitation
                  </>
                )}
              </AdminButton>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          REMOVE MEMBER CONFIRMATION
      ===================================================== */}

      {memberToRemove && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center p-4"
          style={{
            backgroundColor:
              'rgba(0, 0, 0, 0.48)',
          }}
        >
          <div
            className="absolute inset-0"
            onClick={closeRemoveMember}
          />

          <div
            className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden"
            style={modalPanelStyle(removeVisible)}
          >
            <div className="p-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center">
                  <Trash2 size={17} />
                </div>

                <div className="flex-1">
                  <h2 className="text-base font-medium text-gray-900">
                    Remove team member?
                  </h2>

                  <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                    You're about to remove{' '}
                    <strong className="text-gray-700">
                      {memberToRemove.name}
                    </strong>{' '}
                    from the admin team. They will no
                    longer have access to the dashboard.
                  </p>
                </div>

                <button
                  onClick={closeRemoveMember}
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="flex items-center justify-end gap-3 mt-6">
                <AdminButton
                  variant="secondary"
                  onClick={closeRemoveMember}
                >
                  Cancel
                </AdminButton>

                <AdminButton
                  variant="danger"
                  onClick={handleRemoveMember}
                  className={
                    removingMemberId
                      ? 'opacity-60 cursor-not-allowed'
                      : ''
                  }
                >
                  {removingMemberId ? (
                    <>
                      <Loader2
                        size={14}
                        className="inline mr-1.5 animate-spin"
                      />
                      Removing...
                    </>
                  ) : (
                    <>
                      <Trash2
                        size={14}
                        className="inline mr-1.5"
                      />
                      Remove Member
                    </>
                  )}
                </AdminButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSettings;