import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  Plus,
  Trash2,
  Pencil,
  Eye,
  Move,
  RotateCw,
  Maximize2,
  Layers,
  Smartphone,
  Monitor,
  Save,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  Upload,
  RefreshCw,
  AlertCircle,
  Package,
  Loader2,
  Check,
  Instagram,
  Music2,
  Facebook,
  Youtube,
} from 'lucide-react';

import {
  PageTitle,
  SectionCard,
  StatusBadge,
  AdminButton,
  AdminInput,
  AdminSelect,
  useAdminToast,
} from '../AdminUI';

import HeroSection from '../../HeroSection';
import AnnouncementBar from '../../AnnouncementBar';
import { FLOOR_LAYOUT } from '../../../data/floorLayout';

import { useProducts } from '../../../hooks/useProducts';
import type { Product } from '../../../types/Product';
import { supabase } from '../../../lib/supabase';
import { updateProductFloorPosition } from '../../../data/admin';
import { useConfirm } from '../ConfirmDialog';
import { useIsViewer } from '../../../hooks/useIsViewer';

import {
  getAdminBanners,
  createAdminBanner,
  updateAdminBanner,
  deleteAdminBanner,
  uploadBannerImage,
  createStagedBannerProduct,
  updateStagedBannerProduct,
  deleteStagedBannerProduct,
  promoteStagedBannerProduct,
  AdminBanner,
  AdminStagedProduct,
  StagedProductInput,
  BannerPosition,
  BannerStatus,
} from '../../../data/banners';

import { getCategorySizes, CategorySizesMap, uploadProductImage } from '../../../data/admin';

import {
  getStoreSettings,
  updateStoreSettings,
  type AnnouncementBarSettings,
  type HeroSectionSettings,
  type FeaturedProductsSettings,
  type FooterSettings,
} from '../../../data/storeSettings';

const ACCENT = '#C44D2B';

export type ContentTab =
  | 'homepage'
  | 'floor'
  | 'media';

interface AdminContentProps {
  initialTab?: ContentTab;
  isActive?: boolean;
}

interface EditableFloorProduct extends Product {
  selected?: boolean;
}

/* ── Shared modal chrome: fades/scales in on mount ─────────── */
const useModalEntrance = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(
      () => setVisible(true),
      10
    );

    return () => clearTimeout(t);
  }, []);

  return visible;
};

const AdminContent: React.FC<AdminContentProps> = ({
  initialTab = 'homepage',
  isActive = true,
}) => {
  const [tab, setTab] =
    useState<ContentTab>(initialTab);

  React.useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const {
    products,
    isLoading,
    error,
    refetch,
  } = useProducts();

  return (
    <div>
      <PageTitle
        title={
          tab === 'homepage'
            ? 'Homepage'
            : tab === 'floor'
              ? 'Product Floor'
              : 'Media Library'
        }
        subtitle={
          tab === 'homepage'
            ? 'Manage the storefront homepage and customer-facing content'
            : tab === 'floor'
              ? 'Control product placement, scale, rotation, and layering'
              : 'Manage product and storefront media'
        }
      />

      {isLoading ? (
        <SectionCard title="Loading products">
          <div className="space-y-0">
            {Array.from({
              length: 4,
            }).map((_, index) => (
              <div
                key={index}
                className="h-14 border-b border-gray-50 bg-gray-50/50 animate-pulse"
              />
            ))}
          </div>
        </SectionCard>
      ) : error ? (
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
                Failed to load products
              </p>

              <p className="text-sm text-gray-500 mt-1">
                {error}
              </p>

              <button
                type="button"
                onClick={() => refetch()}
                className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-xs tracking-wide hover:bg-black transition-colors"
              >
                <RefreshCw size={13} />
                Retry
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {tab === 'homepage' && (
            <HomepageManager
              products={products}
              isActive={
                isActive &&
                tab === 'homepage'
              }
            />
          )}

          {tab === 'floor' && (
            <ProductFloorManager
              products={products}
              updateProductFloorPosition={updateProductFloorPosition}
            />
          )}

          {tab === 'media' && (
            <MediaLibraryManager
              products={products}
            />
          )}
        </>
      )}
    </div>
  );
};

/* ============================================================
   HOMEPAGE
============================================================ */

interface BannerFormValues {
  title: string;
  image: string;
  position: BannerPosition;
  status: BannerStatus;
}

/* ── Generic Product Picker (Featured Products / Hero) ─────── */

const ProductPickerModal: React.FC<{
  title: string;
  products: Product[];
  selectedIds: string[];
  onClose: () => void;
  onSave: (ids: string[]) => void;
}> = ({
  title,
  products,
  selectedIds,
  onClose,
  onSave,
}) => {
  const visible = useModalEntrance();

  const [localSelected, setLocalSelected] =
    useState<string[]>(selectedIds);

  const toggleProduct = (id: string) => {
    setLocalSelected(prev =>
      prev.includes(id)
        ? prev.filter(p => p !== id)
        : [...prev, id]
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[70] flex items-center justify-center p-4">
      <div
        className="bg-white rounded-lg w-full max-w-2xl max-h-[85vh] overflow-y-auto transition-all duration-200 ease-out"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'scale(1)' : 'scale(0.96)',
        }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-lg font-light text-gray-900">
              {title}
            </h2>

            <p className="text-xs text-gray-400 mt-1">
              {localSelected.length} selected
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {products.length === 0 ? (
            <p className="text-sm text-gray-500">
              No products available.
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {products.map(product => {
                const isSelected =
                  localSelected.includes(product.id);

                return (
                  <button
                    type="button"
                    key={product.id}
                    onClick={() =>
                      toggleProduct(product.id)
                    }
                    className={`relative text-left border rounded-lg overflow-hidden transition-colors ${
                      isSelected
                        ? 'border-[#C44D2B]'
                        : 'border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    <div className="aspect-[3/4] bg-gray-100">
                      <img
                        src={
                          product.images?.[0] ||
                          product.image
                        }
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {isSelected && (
                      <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#C44D2B] flex items-center justify-center">
                        <Check size={10} className="text-white" />
                      </div>
                    )}

                    <div className="p-1.5">
  <p className="text-[10px] text-gray-700 truncate">
    {product.name}
  </p>
  {product.showOnFloor === false && (
    <p className="text-[8px] uppercase tracking-wide mt-0.5" style={{ color: '#C44D2B' }}>
      Off floor
    </p>
  )}
</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-gray-200 sticky bottom-0 bg-white">
          <AdminButton variant="secondary" onClick={onClose}>
            Cancel
          </AdminButton>

          <AdminButton onClick={() => onSave(localSelected)}>
            <Save size={14} className="inline mr-1" />
            Save Selection
          </AdminButton>
        </div>
      </div>
    </div>
  );
};
/* ============================================================
   HOMEPAGE
============================================================ */

const HomepageManager: React.FC<{
  products: Product[];
  isActive?: boolean;
}> = ({ products, isActive = true }) => {

  /* ==========================================================
     STORE SETTINGS — FORM STATE

     Loaded from getStoreSettings() on mount, held locally as
     editable form state, persisted via updateStoreSettings()
     on Save.
  ========================================================== */

  const [announcementForm, setAnnouncementForm] =
    useState<AnnouncementBarSettings>({
      enabled: true,
      text: '',
      bg: '#000000',
      color: '#FFFFFF',
    });

    const [heroForm, setHeroForm] =
    useState<HeroSectionSettings>({
      enabled: true,
      eyebrow: '',
      headline: '',
      description: '',
      button_text: '',
      product_ids: [],
      image: '',
    });

  const [featuredForm, setFeaturedForm] =
    useState<FeaturedProductsSettings>({
      enabled: true,
      product_ids: [],
    });

  const [footerForm, setFooterForm] =
    useState<FooterSettings>({
      email: '',
      phone: '',
      copyright: '',
      social: {
        instagram: '',
        tiktok: '',
        facebook: '',
        youtube: '',
      },
    });

  const [settingsLoading, setSettingsLoading] =
    useState(true);

  const [settingsError, setSettingsError] =
    useState<string | null>(null);

    const [settingsReloadKey, setSettingsReloadKey] =
    useState(0);

  const [hasLoadedSettingsOnce, setHasLoadedSettingsOnce] =
    useState(false);

  const [savingKey, setSavingKey] =
    useState<string | null>(null);

      const { showToast } = useAdminToast();
const { confirm, ConfirmDialogElement } = useConfirm();   // ADD THIS
const isViewer = useIsViewer();

  /* ==========================================================
     LOAD STORE SETTINGS
  ========================================================== */

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

        setAnnouncementForm(settings.announcement_bar);

        setHeroForm({
          ...settings.hero_section,
          product_ids: settings.hero_section.product_ids ?? [],
        });

        setFeaturedForm({
          ...settings.featured_products,
          product_ids:
            settings.featured_products.product_ids ?? [],
        });

        setFooterForm({
          ...settings.footer_settings,
          social: { ...settings.footer_settings.social },
        });

        setHasLoadedSettingsOnce(true);
      } catch (err) {
        if (cancelled) return;

        console.error(
          'Failed to load store settings:',
          err
        );

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
  }, [isActive, settingsReloadKey]);

  /* ==========================================================
     SAVE HANDLERS
  ========================================================== */

  const handleSaveAnnouncement = async () => {
    if (isViewer) {
    showToast('error', "You don't have permission to make changes (Viewer role).");
    return;
  }
    if (savingKey) return;

    setSavingKey('announcement_bar');

    try {
      await updateStoreSettings(
        'announcement_bar',
        announcementForm
      );

      showToast('success', 'Announcement bar saved.');
    } catch (err) {
      console.error(
        'Failed to save announcement bar:',
        err
      );

      showToast(
        'error',
        err instanceof Error
          ? err.message
          : 'Failed to save announcement bar.'
      );
    } finally {
      setSavingKey(null);
    }
  };

  const handleSaveHero = async () => {
    if (isViewer) {
    showToast('error', "You don't have permission to make changes (Viewer role).");
    return;
  }
    if (savingKey) return;

    setSavingKey('hero_section');

    try {
      await updateStoreSettings('hero_section', heroForm);

      showToast('success', 'Hero section saved.');
    } catch (err) {
      console.error('Failed to save hero section:', err);

      showToast(
        'error',
        err instanceof Error
          ? err.message
          : 'Failed to save hero section.'
      );
    } finally {
      setSavingKey(null);
    }
  };

  const handleSaveFeatured = async () => {
    if (isViewer) {
    showToast('error', "You don't have permission to make changes (Viewer role).");
    return;
  }
    if (savingKey) return;

    setSavingKey('featured_products');

    try {
      await updateStoreSettings(
        'featured_products',
        featuredForm
      );

      showToast('success', 'Featured products saved.');
    } catch (err) {
      console.error(
        'Failed to save featured products:',
        err
      );

      showToast(
        'error',
        err instanceof Error
          ? err.message
          : 'Failed to save featured products.'
      );
    } finally {
      setSavingKey(null);
    }
  };

  const handleSaveFooter = async () => {
    if (isViewer) {
    showToast('error', "You don't have permission to make changes (Viewer role).");
    return;
  }
    if (savingKey) return;

    setSavingKey('footer_settings');

    try {
      await updateStoreSettings(
        'footer_settings',
        footerForm
      );

      showToast('success', 'Store footer saved.');
    } catch (err) {
      console.error('Failed to save footer:', err);

      showToast(
        'error',
        err instanceof Error
          ? err.message
          : 'Failed to save footer.'
      );
    } finally {
      setSavingKey(null);
    }
  };

  /* ==========================================================
     PRODUCT PICKERS (Featured / Hero)
  ========================================================== */

  const [showFeaturedPicker, setShowFeaturedPicker] =
    useState(false);

  const [showHeroPicker, setShowHeroPicker] =
    useState(false);

  const featuredSelectedProducts = products.filter(
    product =>
      featuredForm.product_ids.includes(product.id)
  );

    const [isUploadingHeroImage, setIsUploadingHeroImage] =
    useState(false);

  const [heroImageUploadError, setHeroImageUploadError] =
    useState<string | null>(null);

  const heroFileInputRef =
    useRef<HTMLInputElement>(null);

  const handleHeroFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';

    if (!file) {
      return;
    }

    setIsUploadingHeroImage(true);
    setHeroImageUploadError(null);

    try {
      const url = await uploadBannerImage(file);
      setHeroForm(prev => ({ ...prev, image: url }));
    } catch (err) {
      console.error('Failed to upload hero image:', err);

      setHeroImageUploadError(
        err instanceof Error
          ? err.message
          : 'Failed to upload image.'
      );
    } finally {
      setIsUploadingHeroImage(false);
    }
  };

  /* ==========================================================
     BANNERS — loaded from Supabase via data/banners.ts
  ========================================================== */

  const [
    banners,
    setBanners,
  ] = useState<AdminBanner[]>([]);

  const [
    bannersLoading,
    setBannersLoading,
  ] = useState(true);

  const [
    bannersError,
    setBannersError,
  ] = useState<string | null>(null);

  const [
    bannersReloadKey,
    setBannersReloadKey,
  ] = useState(0);

  const [
    bannerModal,
    setBannerModal,
  ] = useState<{
    mode: 'create' | 'edit';
    banner: AdminBanner | null;
  } | null>(null);

  const [
    previewBanner,
    setPreviewBanner,
  ] = useState<AdminBanner | null>(
    null
  );

  const [
    isSavingBanner,
    setIsSavingBanner,
  ] = useState(false);

  const [
    bannerSaveError,
    setBannerSaveError,
  ] = useState<string | null>(null);

  const [
    removingBannerIds,
    setRemovingBannerIds,
  ] = useState<Set<string>>(
    new Set()
  );

  const loadBanners = useCallback(
    async () => {
      setBannersLoading(true);
      setBannersError(null);

      try {
        const data =
          await getAdminBanners();

        setBanners(data);
      } catch (err) {
        console.error(
          'Failed to load banners:',
          err
        );

        setBannersError(
          err instanceof Error
            ? err.message
            : 'Failed to load banners.'
        );
      } finally {
        setBannersLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    // Don't fetch while this Content tab isn't active — matches the
    // isActive-gating pattern every other admin section uses.
    if (!isActive) return;

    loadBanners();
  }, [
    isActive,
    loadBanners,
    bannersReloadKey,
  ]);

  const handleSaveBanner = async (values: BannerFormValues) => {
    if (isViewer) {
    showToast('error', "You don't have permission to make changes (Viewer role).");
    return;
  }
  if (!bannerModal) {
    return;
  }

  setIsSavingBanner(true);
  setBannerSaveError(null);

  try {
    if (bannerModal.mode === 'create') {
      const created = await createAdminBanner({
        title: values.title,
        image: values.image,
        position: values.position,
        status: values.status,
      });

      setBanners(prev => [created, ...prev]);

      // Stay open, switched into edit mode, so staged products can be
      // added immediately without closing and reopening the modal.
      setBannerModal({ mode: 'edit', banner: created });
    } else if (bannerModal.banner) {
      const updated: AdminBanner = {
        ...bannerModal.banner,
        title: values.title,
        image: values.image,
        position: values.position,
        status: values.status,
      };

      await updateAdminBanner(updated);

      setBanners(prev => prev.map(b => (b.id === updated.id ? updated : b)));

      setBannerModal(null);
    }
  } catch (err) {
    console.error('Failed to save banner:', err);
    setBannerSaveError(err instanceof Error ? err.message : 'Failed to save banner.');
  } finally {
    setIsSavingBanner(false);
  }
};

    const handleDeleteBanner =
    async (
      id: string,
      title: string
    ) => {
      if (isViewer) {
    showToast('error', "You don't have permission to make changes (Viewer role).");
    return;
  }
      const ok = await confirm(
        'Delete banner?',
        `Delete "${title}"? This cannot be undone.`,
        'Delete'
      );

      if (!ok) {
        return;
      }

      setRemovingBannerIds(
        (prev) =>
          new Set(prev).add(id)
      );

      try {
        await deleteAdminBanner(
          id
        );

        setTimeout(() => {
          setBanners((prev) =>
            prev.filter(
              (b) => b.id !== id
            )
          );

          setRemovingBannerIds(
            (prev) => {
              const next =
                new Set(prev);

              next.delete(id);

              return next;
            }
          );
        }, 250);
      } catch (err) {
        console.error(
          'Failed to delete banner:',
          err
        );

        setRemovingBannerIds(
          (prev) => {
            const next =
              new Set(prev);

            next.delete(id);

            return next;
          }
        );

        showToast(
          'error',
          err instanceof Error
            ? err.message
            : 'Failed to delete banner.'
        );
      }
    };

  return (
    <div className="space-y-6 relative">

      {/* Store settings modals */}
      {ConfirmDialogElement}

      {showFeaturedPicker && (
        <ProductPickerModal
          title="Select Featured Products"
          products={products}
          selectedIds={featuredForm.product_ids}
          onClose={() => setShowFeaturedPicker(false)}
          onSave={(ids) => {
            setFeaturedForm(prev => ({
              ...prev,
              product_ids: ids,
            }));
            setShowFeaturedPicker(false);
          }}
        />
      )}

      {showHeroPicker && (
        <ProductPickerModal
          title="Select Hero Linked Products"
          products={products}
          selectedIds={heroForm.product_ids}
          onClose={() => setShowHeroPicker(false)}
          onSave={(ids) => {
            setHeroForm(prev => ({
              ...prev,
              product_ids: ids,
            }));
            setShowHeroPicker(false);
          }}
        />
      )}

      {/* Banner modals */}

      {bannerModal && (
  <BannerFormModal
    mode={bannerModal.mode}
    banner={bannerModal.banner}
    onClose={() => {
      if (!isSavingBanner) {
        setBannerModal(null);
        setBannerSaveError(null);
      }
    }}
    onSave={handleSaveBanner}
    isSaving={isSavingBanner}
    saveError={bannerSaveError}
    onBannerMutated={loadBanners}
  />
)}

      {previewBanner && (
  <BannerPreviewModal
    banner={previewBanner}
    onClose={() => setPreviewBanner(null)}
  />
)}

      {/* Settings load error / loading indicator */}

      {settingsError && (
        <div className="border border-red-200 bg-red-50 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle size={16} className="text-red-500 mt-0.5" />

            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">
                Unable to load homepage settings
              </p>

              <p className="text-xs text-red-600 mt-1">
                {settingsError}
              </p>

              <button
                type="button"
                onClick={() =>
                  setSettingsReloadKey(k => k + 1)
                }
                className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-white text-xs tracking-wide hover:bg-black transition-colors"
              >
                <RefreshCw size={12} />
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

            {settingsLoading && !settingsError && !hasLoadedSettingsOnce && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Loader2 size={14} className="animate-spin" />
          Loading homepage settings...
        </div>
      )}

      {/* Storefront Preview */}

      <SectionCard
        title="Storefront Preview"
        action={
          <AdminButton
            size="sm"
            variant="secondary"
            onClick={() =>
              window.open(
                '/',
                '_blank',
                'noopener,noreferrer'
              )
            }
          >
            <Eye
              size={12}
              className="inline mr-1"
            />

            Open Store
          </AdminButton>
        }
      >
        <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden pointer-events-none">
          <AnnouncementBar override={announcementForm} />
          <HeroSection override={heroForm} products={products} />
        </div>
      </SectionCard>

      {/* Announcement + Hero */}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        <SectionCard
          title="Announcement Bar"
          action={
            <label className="flex items-center space-x-2 text-xs text-gray-500">
              <input
                type="checkbox"
                checked={announcementForm.enabled}
                onChange={(e) =>
                  setAnnouncementForm(prev => ({
                    ...prev,
                    enabled: e.target.checked,
                  }))
                }
                className="w-4 h-4"
                style={{
                  accentColor: ACCENT,
                }}
              />

              <span>
                Visible
              </span>
            </label>
          }
        >
          <div className="space-y-4">

            <AdminInput
              label="Announcement Text"
              value={announcementForm.text}
              onChange={(value) =>
                setAnnouncementForm(prev => ({
                  ...prev,
                  text: value,
                }))
              }
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              <AdminInput
                label="Background Color"
                value={announcementForm.bg}
                onChange={(value) =>
                  setAnnouncementForm(prev => ({
                    ...prev,
                    bg: value,
                  }))
                }
              />

              <AdminInput
                label="Text Color"
                value={announcementForm.color}
                onChange={(value) =>
                  setAnnouncementForm(prev => ({
                    ...prev,
                    color: value,
                  }))
                }
              />

            </div>

            <div className="flex justify-end">
              <AdminButton
                size="sm"
                onClick={handleSaveAnnouncement}
                className={
                  savingKey === 'announcement_bar'
                    ? 'opacity-50 cursor-not-allowed'
                    : ''
                }
              >
                <Save
                  size={12}
                  className="inline mr-1"
                />

                {savingKey === 'announcement_bar'
                  ? 'Saving...'
                  : 'Save Announcement'}
              </AdminButton>
            </div>

          </div>
        </SectionCard>

        <SectionCard
          title="Hero Section"
          action={
            <label className="flex items-center space-x-2 text-xs text-gray-500">
              <input
                type="checkbox"
                checked={heroForm.enabled}
                onChange={(e) =>
                  setHeroForm(prev => ({
                    ...prev,
                    enabled: e.target.checked,
                  }))
                }
                className="w-4 h-4"
                style={{
                  accentColor: ACCENT,
                }}
              />

              <span>
                Visible
              </span>
            </label>
          }
        >
          <div className="space-y-4">

            <AdminInput
              label="Eyebrow"
              value={heroForm.eyebrow}
              onChange={(value) =>
                setHeroForm(prev => ({
                  ...prev,
                  eyebrow: value,
                }))
              }
            />

            <AdminInput
              label="Headline"
              value={heroForm.headline}
              onChange={(value) =>
                setHeroForm(prev => ({
                  ...prev,
                  headline: value,
                }))
              }
            />

            <AdminInput
              label="Description"
              value={heroForm.description}
              onChange={(value) =>
                setHeroForm(prev => ({
                  ...prev,
                  description: value,
                }))
              }
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              <AdminInput
                label="Button Text"
                value={heroForm.button_text}
                onChange={(value) =>
                  setHeroForm(prev => ({
                    ...prev,
                    button_text: value,
                  }))
                }
              />

            </div>

                        {/* Hero Image */}

            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-2 mt-3">
                Hero Image
              </p>

              <p className="text-[11px] text-gray-400 mb-3">
  Optional. When set, this image is always shown beside the text. Leave empty and link products below to have the hero automatically rotate through their images instead — or leave both empty for a text-only hero.
</p>

              {heroForm.image ? (
                <div className="relative w-full h-40 group">
                  <img
                    src={heroForm.image}
                    alt=""
                    className="w-full h-full object-cover rounded-lg border border-gray-200"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setHeroForm(prev => ({ ...prev, image: '' }))
                    }
                    className="absolute top-2 right-2 w-6 h-6 bg-black text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-500"
                    title="Remove image"
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => heroFileInputRef.current?.click()}
                  disabled={isUploadingHeroImage}
                  className="w-full h-40 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploadingHeroImage ? (
                    <Loader2 size={20} className="mb-1 animate-spin" />
                  ) : (
                    <Upload size={20} className="mb-1" />
                  )}

                  <span className="text-xs">
                    {isUploadingHeroImage
                      ? 'Uploading...'
                      : 'Click to upload an image'}
                  </span>
                </button>
              )}

              {heroImageUploadError && (
                <p className="text-xs text-red-600 mt-2">
                  {heroImageUploadError}
                </p>
              )}

              <input
                ref={heroFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleHeroFileChange}
                className="hidden"
              />
            </div>

            {/* Hero linked products */}

            <div className="pt-2 border-t border-gray-100">

              <div className="flex items-center justify-between mb-2 mt-3">
                <p className="text-xs text-gray-500">
                  Linked Products
                </p>

                <span className="text-xs text-gray-400">
                  {heroForm.product_ids.length} selected
                </span>
              </div>

              <p className="text-[11px] text-gray-400 mb-3">
                Products shown when a customer clicks the hero button.
              </p>

              <AdminButton
                size="sm"
                variant="secondary"
                onClick={() => setShowHeroPicker(true)}
              >
                Select Products
              </AdminButton>

            </div>

            <div className="flex justify-end">
              <AdminButton
                size="sm"
                onClick={handleSaveHero}
                className={
                  savingKey === 'hero_section'
                    ? 'opacity-50 cursor-not-allowed'
                    : ''
                }
              >
                <Save
                  size={12}
                  className="inline mr-1"
                />

                {savingKey === 'hero_section'
                  ? 'Saving...'
                  : 'Save Hero'}
              </AdminButton>
            </div>

          </div>
        </SectionCard>

      </div>

      {/* Featured Products */}

      <SectionCard
        title="Featured Products"
        action={
          <label className="flex items-center space-x-2 text-xs text-gray-500">
            <input
              type="checkbox"
              checked={featuredForm.enabled}
              onChange={(e) =>
                setFeaturedForm(prev => ({
                  ...prev,
                  enabled: e.target.checked,
                }))
              }
              className="w-4 h-4"
              style={{
                accentColor: ACCENT,
              }}
            />

            <span>
              Visible
            </span>
          </label>
        }
      >
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-gray-500">
            {featuredSelectedProducts.length} product
            {featuredSelectedProducts.length === 1 ? '' : 's'} selected
          </p>

          <AdminButton
            size="sm"
            variant="secondary"
            onClick={() => setShowFeaturedPicker(true)}
          >
            Select Products
          </AdminButton>
        </div>

        {featuredSelectedProducts.length === 0 ? (
          <div className="py-12 text-center">

            <Package
              size={22}
              className="mx-auto text-gray-300"
            />

            <p className="text-sm text-gray-500 mt-3">
              No products selected yet.
            </p>

          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

            {featuredSelectedProducts.map((product) => (
                <div
                  key={product.id}
                  className="bg-white rounded-lg border border-gray-200 overflow-hidden"
                >

                  <div className="aspect-[3/4] bg-gray-100 overflow-hidden">
                    <img
                      src={
                        product
                          .images?.[0] ||
                        product.image
                      }
                      alt={
                        product.name
                      }
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="p-3">

                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                      {
                        product.category
                      }
                    </p>

                    <p className="text-sm font-medium text-gray-800 mt-1">
                      {
                        product.name
                      }
                    </p>

                    <p className="text-xs text-gray-500 mt-1">
                      R
                      {
                        product.price
                      }
                    </p>

                    <button
                      type="button"
                      onClick={() =>
                        setFeaturedForm(prev => ({
                          ...prev,
                          product_ids: prev.product_ids.filter(
                            id => id !== product.id
                          ),
                        }))
                      }
                      className="mt-3 text-xs text-gray-500 hover:text-black transition-colors"
                    >
                      Remove
                    </button>

                  </div>
                </div>
              ))}

          </div>
        )}

        <div className="flex justify-end mt-4">
          <AdminButton
            size="sm"
            onClick={handleSaveFeatured}
            className={
              savingKey === 'featured_products'
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }
          >
            <Save
              size={12}
              className="inline mr-1"
            />

            {savingKey === 'featured_products'
              ? 'Saving...'
              : 'Save Featured Products'}
          </AdminButton>
        </div>
      </SectionCard>

      {/* Banners */}

      <SectionCard
        title="Homepage Banners"
        action={
          <AdminButton
  size="sm"
  onClick={() =>
    setBannerModal({ mode: 'create', banner: null })
  }
  disabled={isViewer}
>
  <Plus size={12} className="inline mr-1" />
  Add Banner
</AdminButton>
        }
      >

        {bannersLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

            {Array.from({
              length: 3,
            }).map((_, index) => (
              <div
                key={index}
                className="h-64 bg-gray-50 border border-gray-100 animate-pulse rounded-lg"
              />
            ))}

          </div>
        ) : bannersError ? (
          <div className="border border-gray-200 bg-white p-6">

            <div className="flex items-start gap-4">

              <div className="w-10 h-10 bg-red-50 flex items-center justify-center shrink-0">
                <AlertCircle
                  size={18}
                  className="text-red-500"
                />
              </div>

              <div className="flex-1">

                <p className="text-sm font-medium text-gray-900">
                  Failed to load banners
                </p>

                <p className="text-sm text-gray-500 mt-1">
                  {
                    bannersError
                  }
                </p>

                <button
                  type="button"
                  onClick={() =>
                    setBannersReloadKey(
                      (current) =>
                        current + 1
                    )
                  }
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-xs tracking-wide hover:bg-black transition-colors"
                >
                  <RefreshCw size={13} />
                  Retry
                </button>

              </div>
            </div>
          </div>
        ) : banners.length === 0 ? (
          <div className="py-12 text-center">

            <Package
              size={22}
              className="mx-auto text-gray-300"
            />

            <p className="text-sm text-gray-500 mt-3">
              No banners yet.
            </p>

          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

            {banners.map((banner) => {
              const isRemoving =
                removingBannerIds.has(
                  banner.id
                );

              return (
                <div
                  key={banner.id}
                  className={`bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-all duration-250 ${
                    isRemoving
                      ? 'opacity-0 scale-95'
                      : 'opacity-100 scale-100'
                  }`}
                >

                  <div className="relative h-32 bg-gray-100">

                    <img
                      src={banner.image}
                      alt={banner.title}
                      className="w-full h-full object-cover"
                    />

                    <div className="absolute top-2 right-2">
                      <StatusBadge
                        status={
                          banner.status
                        }
                      />
                    </div>

                  </div>

                  <div className="p-4">

                    <h3 className="text-sm font-medium text-gray-800 mb-1">
                      {
                        banner.title
                      }
                    </h3>

                    <p className="text-xs text-gray-500 mb-2">
                      Position:{' '}
                      {
                        banner.position
                      }
                    </p>

                    <p className="text-xs text-gray-500 mb-2">
  {banner.stagedProducts.length} staged product
  {banner.stagedProducts.length === 1 ? '' : 's'}
</p>

                    <div className="flex items-center justify-between text-xs text-gray-500 mb-3">

                      <span>
                        {
                          banner.impressions.toLocaleString()
                        }{' '}
                        impressions
                      </span>

                      <span>
                        {
                          banner.clicks
                        }{' '}
                        clicks
                      </span>

                    </div>

                    <div className="flex items-center space-x-2">

                      <button
                        type="button"
                        onClick={() =>
                          setBannerModal({
                            mode: 'edit',
                            banner,
                          })
                        }
                        className="p-1.5 hover:bg-gray-100 rounded text-gray-600 transition-all duration-150 hover:scale-110 active:scale-95"
                        title="Edit banner"
                      >
                        <Pencil size={14} />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setPreviewBanner(
                            banner
                          )
                        }
                        className="p-1.5 hover:bg-gray-100 rounded text-gray-600 transition-all duration-150 hover:scale-110 active:scale-95"
                        title="Preview banner"
                      >
                        <Eye size={14} />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleDeleteBanner(
                            banner.id,
                            banner.title
                          )
                        }
                        disabled={
                          isRemoving
                        }
                        className="p-1.5 hover:bg-red-100 rounded text-red-500 transition-all duration-150 hover:scale-110 active:scale-95 disabled:opacity-50"
                        title="Delete banner"
                      >
                        {isRemoving ? (
                          <Loader2
                            size={14}
                            className="animate-spin"
                          />
                        ) : (
                          <Trash2
                            size={14}
                          />
                        )}
                      </button>

                    </div>

                  </div>
                </div>
              );
            })}

          </div>
        )}

      </SectionCard>

      {/* Footer */}

      <SectionCard title="Store Footer">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          <div className="space-y-4">

            <AdminInput
              label="Footer Email"
              value={footerForm.email}
              onChange={(value) =>
                setFooterForm(prev => ({
                  ...prev,
                  email: value,
                }))
              }
            />

            <AdminInput
              label="Footer Phone"
              value={footerForm.phone}
              onChange={(value) =>
                setFooterForm(prev => ({
                  ...prev,
                  phone: value,
                }))
              }
            />

            <AdminInput
              label="Copyright"
              value={footerForm.copyright}
              onChange={(value) =>
                setFooterForm(prev => ({
                  ...prev,
                  copyright: value,
                }))
              }
            />

          </div>

          <div>

            <label className="block text-xs font-medium text-gray-500 mb-2 tracking-wide">
              Social Links
            </label>

            <div className="space-y-2">

              {(
                [
                  {
                    key: 'instagram' as const,
                    name: 'Instagram',
                    icon: <Instagram size={13} />,
                  },
                  {
                    key: 'tiktok' as const,
                    name: 'TikTok',
                    icon: <Music2 size={13} />,
                  },
                  {
                    key: 'facebook' as const,
                    name: 'Facebook',
                    icon: <Facebook size={13} />,
                  },
                  {
                    key: 'youtube' as const,
                    name: 'YouTube',
                    icon: <Youtube size={13} />,
                  },
                ]
              ).map(
                (social) => (
                  <div
                    key={
                      social.name
                    }
                    className="flex items-center space-x-3 border border-gray-200 px-3 py-2 rounded-lg"
                  >

                    <span className="text-gray-400 shrink-0">
                      {
                        social.icon
                      }
                    </span>

                    <span className="text-sm text-gray-700 w-20 shrink-0">
                      {
                        social.name
                      }
                    </span>

                    <input
                      type="text"
                      value={footerForm.social[social.key]}
                      onChange={(e) =>
                        setFooterForm(prev => ({
                          ...prev,
                          social: {
                            ...prev.social,
                            [social.key]: e.target.value,
                          },
                        }))
                      }
                      className="flex-1 min-w-0 text-xs text-gray-600 border-none outline-none bg-transparent"
                    />

                  </div>
                )
              )}

            </div>
          </div>

        </div>

        <div className="flex justify-end mt-4">

          <AdminButton
            size="sm"
            onClick={handleSaveFooter}
            className={
              savingKey === 'footer_settings'
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }
          >

            <Save
              size={12}
              className="inline mr-1"
            />

            {savingKey === 'footer_settings'
              ? 'Saving...'
              : 'Save Footer'}

          </AdminButton>

        </div>

      </SectionCard>

    </div>
  );
};

/* ── Add/Edit Banner ────────────────────────────────────── */

const BannerFormModal: React.FC<{
  mode: 'create' | 'edit';
  banner: AdminBanner | null;
  onClose: () => void;
  onSave: (values: BannerFormValues) => void;
  isSaving: boolean;
  saveError: string | null;
  onBannerMutated: () => void;
}> = ({ mode, banner, onClose, onSave, isSaving, saveError, onBannerMutated }) => {
  const visible = useModalEntrance();
  const { showToast } = useAdminToast();
  const { confirm, ConfirmDialogElement } = useConfirm();
  const isViewer = useIsViewer();

  const [title, setTitle] = useState(banner?.title || '');
  const [position, setPosition] = useState<BannerPosition>(banner?.position || 'Top');
  const [status, setStatus] = useState<BannerStatus>(banner?.status || 'Active');
  const [image, setImage] = useState(banner?.image || '');

  const [stagedProducts, setStagedProducts] = useState<AdminStagedProduct[]>(
    banner?.stagedProducts ?? []
  );
  const [stagedModal, setStagedModal] = useState<{ product: AdminStagedProduct | null } | null>(null);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const url = await uploadBannerImage(file);
      setImage(url);
    } catch (err) {
      console.error('Failed to upload banner image:', err);
      setUploadError(err instanceof Error ? err.message : 'Failed to upload image.');
    } finally {
      setIsUploading(false);
    }
  };

  const canSave = title.trim() !== '' && image !== '' && !isUploading && !isSaving;

  const handleSubmit = () => {
    if (isViewer) {
    showToast('error', "You don't have permission to make changes (Viewer role).");
    return;
  }
    if (!canSave) return;
    onSave({ title: title.trim(), image, position, status });
  };

  const handlePromote = async (product: AdminStagedProduct) => {
    if (isViewer) {
    showToast('error', "You don't have permission to make changes (Viewer role).");
    return;
  }
    setPromotingId(product.id);

    try {
      await promoteStagedBannerProduct(product.id);
      setStagedProducts(prev => prev.filter(p => p.id !== product.id));
      showToast('success', `"${product.name}" promoted to the storefront floor.`);
      onBannerMutated();
    } catch (err) {
      console.error('Failed to promote staged product:', err);
      showToast('error', err instanceof Error ? err.message : 'Failed to promote product.');
    } finally {
      setPromotingId(null);
    }
  };

  const handleDeleteStaged = async (product: AdminStagedProduct) => {
    if (isViewer) {
    showToast('error', "You don't have permission to make changes (Viewer role).");
    return;
  }
  const ok = await confirm(
    'Delete staged product?',
    `Delete staged product "${product.name}"? This cannot be undone.`,
    'Delete'
  );

  if (!ok) {
    return;
  }

    setDeletingId(product.id);

    try {
      await deleteStagedBannerProduct(product.id);
      setStagedProducts(prev => prev.filter(p => p.id !== product.id));
      showToast('success', 'Staged product deleted.');
      onBannerMutated();
    } catch (err) {
      console.error('Failed to delete staged product:', err);
      showToast('error', err instanceof Error ? err.message : 'Failed to delete staged product.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[70] flex items-center justify-center p-4">
      <div
        className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto transition-all duration-200 ease-out"
        style={{ opacity: visible ? 1 : 0, transform: visible ? 'scale(1)' : 'scale(0.96)' }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-light text-gray-900">
            {mode === 'create' ? 'Add Banner' : 'Edit Banner'}
          </h2>

          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {saveError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
              {saveError}
            </div>
          )}

          <div>
            <p className="text-xs text-gray-500 mb-2">Banner Image</p>

            {image ? (
              <div className="relative w-full h-32 group">
                <img src={image} alt="" className="w-full h-full object-cover rounded-lg border border-gray-200" />
                <button
                  type="button"
                  onClick={() => setImage('')}
                  className="absolute top-2 right-2 w-6 h-6 bg-black text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-500"
                  title="Remove image"
                >
                  <X size={13} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <Loader2 size={20} className="mb-1 animate-spin" />
                ) : (
                  <Upload size={20} className="mb-1" />
                )}
                <span className="text-xs">{isUploading ? 'Uploading...' : 'Click to upload an image'}</span>
              </button>
            )}

            {uploadError && <p className="text-xs text-red-600 mt-2">{uploadError}</p>}

            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          </div>

          <AdminInput label="Title" value={title} onChange={setTitle} placeholder="Summer Collection" />

          <div className="grid grid-cols-2 gap-4">
            <AdminSelect
              label="Position"
              value={position}
              onChange={value => setPosition(value as BannerPosition)}
              options={[
                { value: 'Top', label: 'Top' },
                { value: 'Middle', label: 'Middle' },
                { value: 'Bottom', label: 'Bottom' },
              ]}
            />

            <AdminSelect
              label="Status"
              value={status}
              onChange={value => setStatus(value as BannerStatus)}
              options={[
                { value: 'Active', label: 'Active' },
                { value: 'Scheduled', label: 'Scheduled' },
              ]}
            />
          </div>

          {/* Staged Products */}
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <p className="text-sm font-medium text-gray-700">Staged Products</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Test new or unusual products here before they earn a spot on the storefront
                  floor. Created here, they're only visible inside this banner's collection.
                </p>
              </div>

              {banner && (
                <AdminButton
                  size="sm"
                  variant="secondary"
                  onClick={() => setStagedModal({ product: null })}
                >
                  <Plus size={12} className="inline mr-1" />
                  Add Product
                </AdminButton>
              )}
            </div>

            {!banner ? (
              <div className="p-4 bg-gray-50 border border-gray-100 rounded-lg text-xs text-gray-500">
                Save this banner first, then come back here to start adding staged products.
              </div>
            ) : stagedProducts.length === 0 ? (
              <div className="p-6 text-center border border-gray-100 rounded-lg">
                <Package size={20} className="mx-auto text-gray-300" />
                <p className="text-sm text-gray-500 mt-2">No staged products yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {stagedProducts.map(product => (
                  <div
                    key={product.id}
                    className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg"
                  >
                    <img
                      src={product.images?.[0] || product.image}
                      alt={product.name}
                      className="w-10 h-12 object-cover rounded shrink-0"
                    />

                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 truncate">{product.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        R{product.price} · {product.stock} in stock
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setStagedModal({ product })}
                      className="p-1.5 hover:bg-gray-100 rounded text-gray-600 transition-colors shrink-0"
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePromote(product)}
                      disabled={promotingId === product.id}
                      className="px-2.5 py-1.5 text-[10px] uppercase tracking-wide bg-black text-white rounded hover:bg-gray-800 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
                      title="Promote to the storefront floor"
                    >
                      {promotingId === product.id ? 'Promoting...' : 'Promote to Floor'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteStaged(product)}
                      disabled={deletingId === product.id}
                      className="p-1.5 hover:bg-red-100 rounded text-red-500 transition-colors disabled:opacity-50 shrink-0"
                      title="Delete"
                    >
                      {deletingId === product.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-gray-200 sticky bottom-0 bg-white">
          <AdminButton
            variant="secondary"
            onClick={onClose}
            className={isSaving ? 'opacity-50 cursor-not-allowed' : ''}
          >
            Cancel
          </AdminButton>

          <AdminButton onClick={handleSubmit} className={!canSave ? 'opacity-50 cursor-not-allowed' : ''}>
            {isSaving ? (
              <Loader2 size={14} className="inline mr-1 animate-spin" />
            ) : (
              <Save size={14} className="inline mr-1" />
            )}
            {isSaving ? 'Saving...' : mode === 'create' ? 'Add Banner' : 'Save Changes'}
          </AdminButton>
        </div>
      </div>

      {stagedModal && banner && (
        <StagedProductFormModal
          bannerId={banner.id}
          product={stagedModal.product}
          position={stagedModal.product ? 0 : stagedProducts.length}
          onClose={() => setStagedModal(null)}
          onSaved={(saved, isNew) => {
            setStagedProducts(prev =>
              isNew ? [...prev, saved] : prev.map(p => (p.id === saved.id ? saved : p))
            );
            setStagedModal(null);
            showToast('success', isNew ? 'Staged product added.' : 'Staged product updated.');
            onBannerMutated();
          }}
        />
      )}
      {ConfirmDialogElement}
    </div>
  );
};

const StagedProductFormModal: React.FC<{
  bannerId: string;
  product: AdminStagedProduct | null;
  position: number;
  onClose: () => void;
  onSaved: (product: AdminStagedProduct, isNew: boolean) => void;
}> = ({ bannerId, product, position, onClose, onSaved }) => {
  const visible = useModalEntrance();
  const isEdit = Boolean(product);
  const isViewer = useIsViewer();

  const [categorySizes, setCategorySizes] = useState<CategorySizesMap>({
    top: [],
    bottom: [],
    accessory: [],
  });

  useEffect(() => {
    let cancelled = false;
    getCategorySizes().then(sizes => {
      if (!cancelled) setCategorySizes(sizes);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const [name, setName] = useState(product?.name ?? '');
  const [price, setPrice] = useState(String(product?.price ?? ''));
  const [category, setCategory] = useState<'top' | 'bottom' | 'accessory'>(
    product?.category ?? 'top'
  );
  const [description, setDescription] = useState(product?.description ?? '');
  const [features, setFeatures] = useState((product?.features ?? []).join('\n'));
  const [images, setImages] = useState<string[]>(product?.images?.length ? [...product.images] : []);

  const [sizeStocks, setSizeStocks] = useState<Record<string, number>>(
    () => Object.fromEntries(
      (categorySizes[product?.category ?? 'top'] ?? []).map(size => [
        size,
        product?.sizeStocks?.[size] ?? 0,
      ])
    )
  );

  useEffect(() => {
    setSizeStocks(prev => {
      const next: Record<string, number> = {};
      for (const size of categorySizes[category] ?? []) {
        next[size] = prev[size] ?? product?.sizeStocks?.[size] ?? 0;
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, categorySizes]);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      for (const file of Array.from(files).slice(0, Math.max(0, 6 - images.length))) {
        const url = await uploadProductImage(file, true, processedUrl => {
  setImages(prev => prev.map(img => (img === url ? processedUrl : img)));
});
setImages(prev => [...prev, url]);
      }
    } catch (err) {
      console.error('Failed to upload staged product image:', err);
      setUploadError(err instanceof Error ? err.message : 'Failed to upload image.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const canSave =
    name.trim() !== '' && Number(price) > 0 && images.length > 0 && !isUploading && !isSaving;

  const handleSubmit = async () => {
    if (isViewer) {
    setSaveError("You don't have permission to make changes (Viewer role).");
    return;
  }
    if (!canSave) return;

    setIsSaving(true);
    setSaveError(null);

    const input: StagedProductInput = {
      name: name.trim(),
      price: Number(price) || 0,
      image: images[0],
      images,
      category,
      description: description.trim(),
      features: features.split('\n').map(f => f.trim()).filter(Boolean),
      sizeStocks,
    };

    try {
      const saved = isEdit
        ? await updateStagedBannerProduct(product!.id, input)
        : await createStagedBannerProduct(bannerId, input, position);

      onSaved(saved, !isEdit);
    } catch (err) {
      console.error('Failed to save staged product:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to save staged product.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-[80] flex items-center justify-center p-4">
      <div
        className="bg-white rounded-lg w-full max-w-xl max-h-[90vh] overflow-y-auto transition-all duration-200 ease-out"
        style={{ opacity: visible ? 1 : 0, transform: visible ? 'scale(1)' : 'scale(0.96)' }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-lg font-light text-gray-900">
              {isEdit ? 'Edit Staged Product' : 'Add Staged Product'}
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Testing product for this banner only — won't appear on the storefront floor or in
              the product catalog until promoted.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {saveError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
              {saveError}
            </div>
          )}

          <div>
            <p className="text-xs text-gray-500 mb-2">Product Images</p>

            <div className="flex flex-wrap gap-3">
              {images.map((image, index) => (
                <div key={`${image}-${index}`} className="relative w-16 h-20 group">
                  <img src={image} alt="" className="w-full h-full object-cover border border-gray-200" />
                  <button
                    type="button"
                    onClick={() => setImages(prev => prev.filter((_, i) => i !== index))}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-black text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                  >
                    <X size={12} />
                  </button>
                  {index === 0 && (
                    <span className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[8px] text-center py-0.5">
                      MAIN
                    </span>
                  )}
                </div>
              ))}

              {images.length < 6 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-16 h-20 border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
                >
                  <Plus size={18} />
                </button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {isUploading && <p className="text-xs text-blue-600 mt-2">Uploading images...</p>}
            {uploadError && <p className="text-xs text-red-500 mt-2">{uploadError}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AdminInput label="Product Name" value={name} onChange={setName} />
            <AdminInput label="Price (R)" value={price} onChange={setPrice} type="number" />
            <AdminSelect
              label="Category"
              value={category}
              onChange={value => {
                if (value === 'top' || value === 'bottom' || value === 'accessory') {
                  setCategory(value);
                }
              }}
              options={[
                { value: 'top', label: 'Top' },
                { value: 'bottom', label: 'Bottom' },
                { value: 'accessory', label: 'Accessory' },
              ]}
            />
          </div>

          <div>
            <p className="text-xs font-medium text-gray-700 mb-2">Stock by Size</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(categorySizes[category] ?? []).map(size => (
                <div key={size} className="space-y-1">
                  <label className="block text-[11px] font-medium text-gray-600 uppercase tracking-wide">
                    Size {size}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={sizeStocks[size] ?? 0}
                    onChange={e =>
                      setSizeStocks(prev => ({
                        ...prev,
                        [size]: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className="w-full px-3 py-2 text-sm border border-gray-200 focus:outline-none focus:border-gray-400 transition-colors bg-white"
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 tracking-wide">
              Description
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 focus:outline-none focus:border-gray-400 transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 tracking-wide">
              Features
            </label>
            <textarea
              value={features}
              onChange={e => setFeatures(e.target.value)}
              rows={4}
              placeholder="One feature per line"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 focus:outline-none focus:border-gray-400 transition-colors resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 sticky bottom-0 bg-white">
          <AdminButton
            variant="secondary"
            onClick={onClose}
            className={isSaving ? 'opacity-50 cursor-not-allowed' : ''}
          >
            Cancel
          </AdminButton>

          <AdminButton onClick={handleSubmit} className={!canSave ? 'opacity-50 cursor-not-allowed' : ''}>
            {isSaving ? (
              <Loader2 size={14} className="inline mr-1 animate-spin" />
            ) : (
              <Save size={14} className="inline mr-1" />
            )}
            {isSaving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Staged Product'}
          </AdminButton>
        </div>
      </div>
    </div>
  );
};
/* ── Preview Banner ─────────────────────────────────────── */

const BannerPreviewModal: React.FC<{
  banner: AdminBanner;
  onClose: () => void;
}> = ({ banner, onClose }) => {
  const visible = useModalEntrance();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-[70] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg w-full max-w-xl overflow-hidden transition-all duration-200 ease-out"
        style={{ opacity: visible ? 1 : 0, transform: visible ? 'scale(1)' : 'scale(0.96)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="relative">
          <img src={banner.image} alt={banner.title} className="w-full max-h-[60vh] object-cover" />
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 bg-black bg-opacity-60 text-white rounded-full flex items-center justify-center hover:bg-opacity-80 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-base font-medium text-gray-900">{banner.title}</h3>
            <StatusBadge status={banner.status} />
          </div>

          <p className="text-xs text-gray-500">Position: {banner.position}</p>

          <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
            <span>{banner.impressions.toLocaleString()} impressions</span>
            <span>{banner.clicks} clicks</span>
          </div>

          {banner.stagedProducts.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-2">
                Staged Products ({banner.stagedProducts.length})
              </p>

              <div className="flex gap-2 overflow-x-auto pb-1">
                {banner.stagedProducts.map(product => (
                  <img
                    key={product.id}
                    src={product.images?.[0] || product.image}
                    alt={product.name}
                    className="w-12 h-16 object-cover rounded shrink-0"
                    title={product.name}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ============================================================
    PRODUCT FLOOR MANAGER
============================================================ */

interface ProductFloorManagerProps {
  products: Product[];
  updateProductFloorPosition: (data: {
    id: string;
    position: { top: string; left: string };
    mobilePosition?: { top: string; left: string };
    rotation: number;
    scale: number;
    zIndex: number;
    showOnFloor?: boolean;
  }) => Promise<any>;
}

export const ProductFloorManager: React.FC<ProductFloorManagerProps> = ({
  products,
  updateProductFloorPosition,
}) => {

const previewContainerRef = useRef<HTMLDivElement>(null);
const dragStateRef = useRef<{
  id: string; startX: number; startY: number;
  startTop: number; startLeft: number;
  startRotation: number; startScale: number;
} | null>(null);

const parseUnit = (value: string): number => parseFloat(value.replace(/[^\d.-]/g, '')) || 0;

const handleDragStart = (e: React.MouseEvent, product: EditableFloorProduct) => {
  if (isViewer) return;
  e.stopPropagation();
  setSelectedId(product.id);

  const container = previewContainerRef.current;
  if (!container) return;
  const rect = container.getBoundingClientRect();

  const currentPosition =
    previewMode === 'desktop' ? product.position : product.mobilePosition || product.position;

  dragStateRef.current = {
    id: product.id,
    startX: e.clientX,
    startY: e.clientY,
    startTop: parseUnit(currentPosition.top),
    startLeft: parseUnit(currentPosition.left),
    startRotation: product.rotation,
    startScale: product.scale,
  };

  const handleMouseMove = (moveEvent: MouseEvent) => {
    const drag = dragStateRef.current;
    if (!drag) return;

    if (moveEvent.altKey) {
      const nextRotation = Math.round(drag.startRotation + (moveEvent.clientX - drag.startX) * 0.5);
      setFloorProducts(prev => prev.map(p => (p.id === drag.id ? { ...p, rotation: nextRotation } : p)));
      return;
    }

    if (moveEvent.shiftKey) {
      const nextScale = Math.max(0.3, Math.min(2, drag.startScale - (moveEvent.clientY - drag.startY) * 0.005));
      setFloorProducts(prev => prev.map(p => (p.id === drag.id ? { ...p, scale: nextScale } : p)));
      return;
    }

    const deltaXPercent = ((moveEvent.clientX - drag.startX) / rect.width) * 100;
    const deltaYPercent = ((moveEvent.clientY - drag.startY) / rect.height) * 100;
    const nextLeft = `${(drag.startLeft + deltaXPercent).toFixed(2)}%`;
    const nextTop = `${(drag.startTop + deltaYPercent).toFixed(2)}%`;

    setFloorProducts(prev =>
      prev.map(p => {
        if (p.id !== drag.id) return p;
        return previewMode === 'desktop'
          ? { ...p, position: { top: nextTop, left: nextLeft } }
          : { ...p, mobilePosition: { top: nextTop, left: nextLeft } };
      })
    );
  };

  const handleMouseUp = () => {
    dragStateRef.current = null;
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  };

  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);
};

  const { showToast } = useAdminToast(); // ADD THIS (import from '../AdminUI')
  const isViewer = useIsViewer();
      // Off-floor products (showOnFloor: false) are deliberately excluded
  // here — they're staged for a banner/hero, not meant to be
  // positioned or managed on the visible floor. They still show up in
  // "Add Product" below since they're not in this list yet; picking
  // one there and saving is what brings it onto the floor.
  const [floorProducts, setFloorProducts] = useState<EditableFloorProduct[]>(
    products
      .filter((product) => product.showOnFloor !== false)
      .map((product) => ({
        ...product,
        selected: false,
      }))
  );

  const [selectedId, setSelectedId] = useState(products[0]?.id || '');
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [showAddProductModal, setShowAddProductModal] = useState(false);

  // Save state management
  const [isSavingFloor, setIsSavingFloor] = useState(false);
  const [floorSaveError, setFloorSaveError] = useState<string | null>(null);
  const [floorSaveSuccess, setFloorSaveSuccess] = useState(false);

    useEffect(() => {
    setFloorProducts(
      products
        .filter((product) => product.showOnFloor !== false)
        .map((product) => ({
          ...product,
          selected: false,
        }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products]);

  const selectedProduct = floorProducts.find(
    (product) => product.id === selectedId
  );

  const handleRandomizePositions = () => {
  if (isViewer) {
    showToast('error', "You don't have permission to make changes (Viewer role).");
    return;
  }
  setFloorProducts(prev => {
    const slots = prev.map((_, i) => FLOOR_LAYOUT[i % FLOOR_LAYOUT.length]);
    for (let i = slots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [slots[i], slots[j]] = [slots[j], slots[i]];
    }
    return prev.map((product, i) => ({
      ...product,
      position: { ...slots[i].position },
      mobilePosition: { ...slots[i].mobilePosition },
      rotation: slots[i].rotation,
      scale: slots[i].scale,
      zIndex: slots[i].zIndex,
    }));
  });
  setFloorSaveSuccess(false);
  setFloorSaveError(null);
};

  // Save Handlers
    const handleSaveFloor = async () => {
      if (isViewer) {
    showToast('error', "You don't have permission to make changes (Viewer role).");
    return;
  }
      setIsSavingFloor(true);
      setFloorSaveError(null);
      setFloorSaveSuccess(false);
      try {
        await Promise.all(
          floorProducts.map((product) =>
            updateProductFloorPosition({
              id: product.id,
              position: product.position,
              mobilePosition: product.mobilePosition,
              rotation: product.rotation,
              scale: product.scale,
              zIndex: product.zIndex,
              showOnFloor: true,
            })
          )
        );
        setFloorSaveSuccess(true);
        window.setTimeout(() => setFloorSaveSuccess(false), 3000);
      } catch (err) {
        setFloorSaveError(
          err instanceof Error ? err.message : 'Failed to save floor layout.'
        );
      } finally {
        setIsSavingFloor(false);
      }
    };

    const handleSaveSelectedPosition = async () => {
      if (isViewer) {
    showToast('error', "You don't have permission to make changes (Viewer role).");
    return;
  }
  if (!selectedProduct) return;
  setIsSavingFloor(true);
  setFloorSaveError(null);
  setFloorSaveSuccess(false);
  try {
    await updateProductFloorPosition({
      id: selectedProduct.id,
      position: selectedProduct.position,
      mobilePosition: selectedProduct.mobilePosition,
      rotation: selectedProduct.rotation,
      scale: selectedProduct.scale,
      zIndex: selectedProduct.zIndex,
      showOnFloor: true,
    });
    setFloorSaveSuccess(true);
    window.setTimeout(() => setFloorSaveSuccess(false), 3000);
  } catch (err) {
    setFloorSaveError(
      err instanceof Error ? err.message : 'Failed to save position.'
    );
  } finally {
    setIsSavingFloor(false);
  }
};

  const moveProduct = (direction: 'up' | 'down' | 'left' | 'right') => {
    if (!selectedProduct) return;

    setFloorProducts((prev) =>
      prev.map((product) => {
        if (product.id !== selectedId) return product;

        const currentPosition =
          previewMode === 'desktop'
            ? product.position
            : product.mobilePosition || product.position;

        const topValue = parseFloat(currentPosition.top.replace(/[^\d.-]/g, ''));
        const leftValue = parseFloat(currentPosition.left.replace(/[^\d.-]/g, ''));

        let nextTop = topValue;
        let nextLeft = leftValue;

        if (direction === 'up') nextTop -= 2;
        if (direction === 'down') nextTop += 2;
        if (direction === 'left') nextLeft -= 2;
        if (direction === 'right') nextLeft += 2;

        const nextPosition = {
          top: `${nextTop}vh`,
          left: `${nextLeft}%`,
        };

        return {
          ...product,
          ...(previewMode === 'desktop'
            ? { position: nextPosition }
            : { mobilePosition: nextPosition }),
        };
      })
    );
  };

  const updateSelectedProduct = (
    field: 'scale' | 'rotation' | 'zIndex',
    value: number
  ) => {
    setFloorProducts((prev) =>
      prev.map((product) =>
        product.id === selectedId ? { ...product, [field]: value } : product
      )
    );
  };

    const removeSelectedProduct = () => {
      if (isViewer) {
    showToast('error', "You don't have permission to make changes (Viewer role).");
    return;
  }
    const productToRemove = selectedProduct;

    setFloorProducts((prev) => prev.filter((product) => product.id !== selectedId));
    const remaining = floorProducts.filter((product) => product.id !== selectedId);
    setSelectedId(remaining[0]?.id || '');

    if (productToRemove) {
      void updateProductFloorPosition({
        id: productToRemove.id,
        position: productToRemove.position,
        mobilePosition: productToRemove.mobilePosition,
        rotation: productToRemove.rotation,
        scale: productToRemove.scale,
        zIndex: productToRemove.zIndex,
        showOnFloor: false,
      }).catch((err) => {
        console.error('Failed to take product off the floor:', err);
      });
    }
  };

  const availableProducts = products.filter(
    (product) => !floorProducts.some((existing) => existing.id === product.id)
  );

  const handlePickProduct = (product: Product) => {
    if (isViewer) {
    showToast('error', "You don't have permission to make changes (Viewer role).");
    return;
  }
    setFloorProducts((prev) => [
      ...prev,
      {
        ...product,
        position: { top: '25vh', left: '50%' },
        mobilePosition: { top: '25vh', left: '38%' },
        rotation: 0,
        scale: 1,
        zIndex: 1,
        selected: false,
      },
    ]);
    setSelectedId(product.id);
    setShowAddProductModal(false);
  };

  return (
    <div className="space-y-6">
      {showAddProductModal && (
        <AddProductToFloorModal
          availableProducts={availableProducts}
          onPick={handlePickProduct}
          onClose={() => setShowAddProductModal(false)}
        />
      )}

      {/* Feedback Alerts */}
      {floorSaveError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg">
          {floorSaveError}
        </div>
      )}
      {floorSaveSuccess && (
        <div className="p-3 bg-green-50 border border-green-200 text-green-700 text-xs rounded-lg">
          Floor layout saved successfully!
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-gray-700">Product Floor</p>
          <p className="text-xs text-gray-500 mt-1">
            {floorProducts.length} products currently placed.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <AdminButton
            size="sm"
            variant="secondary"
            onClick={() => setShowAddProductModal(true)}
          >
            <Plus size={12} className="inline mr-1" />
            Add Product
          </AdminButton>

          <AdminButton
            size="sm"
            onClick={handleSaveFloor}
            disabled={isSavingFloor}
          >
            {isSavingFloor ? (
              <Loader2 size={12} className="inline mr-1 animate-spin" />
            ) : (
              <Save size={12} className="inline mr-1" />
            )}
            {isSavingFloor ? 'Saving...' : 'Save Floor'}
          </AdminButton>
        </div>
      </div>

      {/* Floor Preview */}
      <SectionCard
        title="Floor Preview"
        action={
          <div className="flex items-center gap-2">
      <AdminButton size="sm" variant="secondary" onClick={handleRandomizePositions}>
        <RefreshCw size={12} className="inline mr-1" />
        Randomize
      </AdminButton>
            <button
              type="button"
              onClick={() => setPreviewMode('desktop')}
              className={`px-3 py-1.5 text-xs rounded transition-colors ${
                previewMode === 'desktop'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <Monitor size={11} className="inline mr-1" />
              Desktop
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode('mobile')}
              className={`px-3 py-1.5 text-xs rounded transition-colors ${
                previewMode === 'mobile'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <Smartphone size={11} className="inline mr-1" />
              Mobile
            </button>
          </div>
        }
      >
        <div
        ref={previewContainerRef}
          className={`relative overflow-hidden bg-white border border-gray-200 mx-auto ${
            previewMode === 'desktop'
              ? 'w-full h-[520px]'
              : 'w-full max-w-[390px] h-[620px]'
          }`}
        >
          <div className="absolute inset-0 pointer-events-none opacity-40">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#f3f3f3_1px,transparent_1px),linear-gradient(to_bottom,#f3f3f3_1px,transparent_1px)] bg-[size:40px_40px]" />
          </div>

          {floorProducts.slice(0, 18).map((product) => {
            const position =
              previewMode === 'desktop'
                ? product.position
                : product.mobilePosition || product.position;

            const isSelected = product.id === selectedId;

            return (
              <button
                type="button"
                key={product.id}
                onMouseDown={(e) => handleDragStart(e, product)}
                onClick={() => setSelectedId(product.id)}
                className={`absolute overflow-hidden transition-all duration-200 ${
                  isSelected
                    ? 'ring-2 ring-[#C44D2B] ring-offset-2'
                    : 'hover:ring-1 hover:ring-gray-400'
                }`}
                style={{
                  top: position.top,
                  left: position.left,
                  transform: `translate(-50%, -50%) rotate(${product.rotation}deg) scale(${product.scale})`,
                  zIndex: isSelected ? 100 : product.zIndex,
                  width: previewMode === 'desktop' ? '90px' : '72px',
                  height: previewMode === 'desktop' ? '120px' : '96px',
                }}
              >
                <img
                  src={product.images?.[0] || product.image}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
                {product.soldOut && (
                  <span className="absolute inset-x-0 bottom-0 bg-black/70 text-white text-[7px] uppercase tracking-wide py-1">
                    Sold Out
                  </span>
                )}
              </button>
            );
          })}

          <div className="absolute left-3 bottom-3 bg-white border border-gray-200 rounded px-3 py-2">
            <p className="text-[9px] text-gray-400 uppercase tracking-wide">Preview</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {previewMode === 'desktop' ? 'Desktop Floor' : 'Mobile Floor'}
            </p>
          </div>
        </div>
      </SectionCard>

      {/* Product controls */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Product list */}
        <SectionCard title="Floor Products" className="xl:col-span-1">
          <div className="space-y-1 max-h-[520px] overflow-y-auto pr-1">
            {floorProducts.map((product, index) => (
              <button
                type="button"
                key={product.id}
                onClick={() => setSelectedId(product.id)}
                className={`w-full flex items-center space-x-3 p-2 border text-left transition-colors rounded ${
                  selectedId === product.id
                    ? 'border-[#C44D2B] bg-gray-50'
                    : 'border-transparent hover:border-gray-200'
                }`}
              >
                <img
                  src={product.images?.[0] || product.image}
                  alt={product.name}
                  className="w-9 h-11 object-cover"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-800 truncate">{product.name}</p>
                  <p className="text-[9px] text-gray-400 mt-1">
                    #{index + 1} · Layer {product.zIndex}
                  </p>
                </div>
                {selectedId === product.id && (
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-[#C44D2B]"
                  />
                )}
              </button>
            ))}
          </div>
        </SectionCard>

        {/* Position controls */}
        <SectionCard
          title="Position & Transform"
          className="xl:col-span-2"
          action={
            selectedProduct && (
              <StatusBadge
                status={selectedProduct.soldOut ? 'Sold Out' : 'Active'}
              />
            )
          }
        >
          {!selectedProduct ? (
            <p className="text-sm text-gray-500">Select a product to edit it.</p>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center space-x-4 pb-4 border-b border-gray-200">
                <img
                  src={selectedProduct.images?.[0] || selectedProduct.image}
                  alt={selectedProduct.name}
                  className="w-16 h-20 object-cover rounded"
                />
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {selectedProduct.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Product #{selectedProduct.id}
                  </p>
                </div>
              </div>

              {/* Move */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-3 tracking-wide">
                  Move Product
                </p>
                <div className="grid grid-cols-3 gap-2 max-w-[160px]">
                  <div />
                  <button
                    type="button"
                    onClick={() => moveProduct('up')}
                    className="h-8 border border-gray-200 rounded hover:border-gray-400 flex items-center justify-center"
                    aria-label="Move product up"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <div />
                  <button
                    type="button"
                    onClick={() => moveProduct('left')}
                    className="h-8 border border-gray-200 rounded hover:border-gray-400 flex items-center justify-center"
                    aria-label="Move product left"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveProduct('down')}
                    className="h-8 border border-gray-200 rounded hover:border-gray-400 flex items-center justify-center"
                    aria-label="Move product down"
                  >
                    <ChevronDown size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveProduct('right')}
                    className="h-8 border border-gray-200 rounded hover:border-gray-400 flex items-center justify-center"
                    aria-label="Move product right"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              {/* Transform */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <AdminInput
                  label="Scale"
                  value={String(selectedProduct.scale)}
                  onChange={(value) =>
                    updateSelectedProduct('scale', Number(value) || 1)
                  }
                />
                <AdminInput
                  label="Rotation"
                  value={String(selectedProduct.rotation)}
                  onChange={(value) =>
                    updateSelectedProduct('rotation', Number(value) || 0)
                  }
                />
                <AdminInput
                  label="Z-index"
                  value={String(selectedProduct.zIndex)}
                  onChange={(value) =>
                    updateSelectedProduct('zIndex', Number(value) || 1)
                  }
                />
              </div>

              {/* Desktop / mobile position */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <Monitor size={13} className="text-gray-400" />
                    <span className="text-xs font-medium text-gray-600">
                      Desktop Position
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <AdminInput
                      label="Top"
                      value={selectedProduct.position.top}
                      onChange={(value) =>
                        setFloorProducts((prev) =>
                          prev.map((product) =>
                            product.id === selectedId
                              ? {
                                  ...product,
                                  position: { ...product.position, top: value },
                                }
                              : product
                          )
                        )
                      }
                    />
                    <AdminInput
                      label="Left"
                      value={selectedProduct.position.left}
                      onChange={(value) =>
                        setFloorProducts((prev) =>
                          prev.map((product) =>
                            product.id === selectedId
                              ? {
                                  ...product,
                                  position: { ...product.position, left: value },
                                }
                              : product
                          )
                        )
                      }
                    />
                  </div>
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <Smartphone size={13} className="text-gray-400" />
                    <span className="text-xs font-medium text-gray-600">
                      Mobile Position
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <AdminInput
                      label="Top"
                      value={
                        selectedProduct.mobilePosition?.top ||
                        selectedProduct.position.top
                      }
                      onChange={(value) =>
                        setFloorProducts((prev) =>
                          prev.map((product) =>
                            product.id === selectedId
                              ? {
                                  ...product,
                                  mobilePosition: {
                                    top: value,
                                    left:
                                      product.mobilePosition?.left ||
                                      product.position.left,
                                  },
                                }
                              : product
                          )
                        )
                      }
                    />
                    <AdminInput
                      label="Left"
                      value={
                        selectedProduct.mobilePosition?.left ||
                        selectedProduct.position.left
                      }
                      onChange={(value) =>
                        setFloorProducts((prev) =>
                          prev.map((product) =>
                            product.id === selectedId
                              ? {
                                  ...product,
                                  mobilePosition: {
                                    top:
                                      product.mobilePosition?.top ||
                                      product.position.top,
                                    left: value,
                                  },
                                }
                              : product
                          )
                        )
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <div className="hidden md:flex items-center space-x-3 text-xs text-gray-400">
                  <span className="flex items-center"><Move size={12} className="mr-1" />Move</span>
                  <span className="flex items-center"><RotateCw size={12} className="mr-1" />Rotate</span>
                  <span className="flex items-center"><Maximize2 size={12} className="mr-1" />Scale</span>
                  <span className="flex items-center"><Layers size={12} className="mr-1" />Layer</span>
                </div>

                <div className="flex items-center space-x-2 ml-auto">
                  <AdminButton
                    size="sm"
                    variant="danger"
                    onClick={removeSelectedProduct}
                  >
                    <Trash2 size={12} className="inline mr-1" />
                    Remove
                  </AdminButton>

                  <AdminButton
                    size="sm"
                    onClick={handleSaveSelectedPosition}
                    disabled={isSavingFloor}
                  >
                    {isSavingFloor ? (
                      <Loader2 size={12} className="inline mr-1 animate-spin" />
                    ) : (
                      <Save size={12} className="inline mr-1" />
                    )}
                    {isSavingFloor ? 'Saving...' : 'Save Position'}
                  </AdminButton>
                </div>
              </div>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
};

/* ── Add Product to Floor ───────────────────────────────── */

const AddProductToFloorModal: React.FC<{
  availableProducts: Product[];
  onPick: (
    product: Product
  ) => void;
  onClose: () => void;
}> = ({
  availableProducts,
  onPick,
  onClose,
}) => {
  const visible =
    useModalEntrance();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[70] flex items-center justify-center p-4">

      <div
        className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] overflow-y-auto transition-all duration-200 ease-out"
        style={{
          opacity: visible
            ? 1
            : 0,

          transform:
            visible
              ? 'scale(1)'
              : 'scale(0.96)',
        }}
      >

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">

          <h2 className="text-lg font-light text-gray-900">
            Add Product to Floor
          </h2>

          <button
            type="button"
            onClick={
              onClose
            }
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>

        </div>

        <div className="p-6">

          {availableProducts.length ===
          0 ? (
            <p className="text-sm text-gray-500">
              All products are already placed on the floor.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">

              {availableProducts.map(
                (
                  product
                ) => (
                  <button
                    type="button"
                    key={
                      product.id
                    }
                    onClick={() =>
                      onPick(
                        product
                      )
                    }
                    className="text-left border border-gray-200 rounded-lg overflow-hidden hover:border-gray-400 hover:shadow-sm transition-all duration-150 hover:scale-[1.02]"
                  >

                    <div className="aspect-[3/4] bg-gray-100">

                      <img
                        src={
                          product
                            .images?.[0] ||
                          product.image
                        }
                        alt={
                          product.name
                        }
                        className="w-full h-full object-cover"
                      />

                    </div>

                    <div className="p-2">

                      <p className="text-xs text-gray-800 truncate">
                        {
                          product.name
                        }
                      </p>

                      <p className="text-[10px] text-gray-400 mt-0.5">
                        R
                        {
                          product.price
                        }
                      </p>

                    </div>

                  </button>
                )
              )}

            </div>
          )}

        </div>

      </div>
    </div>
  );
};

// ============================================================
// MEDIA LIBRARY MANAGER
// ============================================================

const MediaLibraryManager: React.FC<{
  products: Product[];
}> = ({
  products,
}) => {
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [
    viewingImage,
    setViewingImage,
  ] = useState<string | null>(
    null
  );

  const fileInputRef =
    useRef<HTMLInputElement>(
      null
    );

  // Load existing images from Supabase storage on mount
  useEffect(() => {
    let cancelled = false;

    const loadLibrary = async () => {
      const { data, error } = await supabase.storage
        .from('product-images')
        .list('', { sortBy: { column: 'created_at', order: 'desc' } });

      if (error) {
        console.error('Failed to load media library:', error);
        return;
      }

      if (cancelled) return;

      const urls = (data ?? [])
        .filter(item => item.name && !item.name.endsWith('/'))
        .map(
          item =>
            supabase.storage.from('product-images').getPublicUrl(item.name).data
              .publicUrl
        );

      setUploadedImages(urls);
    };

    void loadLibrary();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleUploadClick =
    () => {
      if (isUploading) return;
      fileInputRef.current?.click();
    };

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      for (const file of Array.from(files)) {
        const url = await uploadProductImage(file, true, processedUrl => {
  setUploadedImages(prev => prev.map(img => (img === url ? processedUrl : img)));
});
setUploadedImages(prev => [url, ...prev]);
      }
    } catch (err) {
      console.error('Failed to upload image:', err);
      setUploadError(
        err instanceof Error ? err.message : 'Failed to upload image.'
      );
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const libraryImages = [
    ...uploadedImages,

    ...products.flatMap(
      (
        product: Product
      ) =>
        product.images?.slice(
          0,
          2
        ) || []
    ),
  ];

  return (
    <div className="space-y-6">

      {viewingImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-80 z-[70] flex items-center justify-center p-4"
          onClick={() =>
            setViewingImage(
              null
            )
          }
        >

          <div
            className="relative max-w-3xl max-h-[85vh]"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <img
              src={
                viewingImage
              }
              alt=""
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
            />

            <button
              type="button"
              onClick={() =>
                setViewingImage(
                  null
                )
              }
              className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg hover:bg-gray-100 transition-colors"
            >
              <X size={16} />
            </button>

          </div>

        </div>
      )}

      <div className="flex flex-col items-end gap-1">

        <div className="flex items-center gap-3">

          {isUploading && (
            <p className="text-xs text-blue-600">Uploading images...</p>
          )}

          <AdminButton
            size="sm"
            onClick={
              handleUploadClick
            }
            disabled={isUploading}
          >
            <Plus
              size={12}
              className="inline mr-1"
            />

            Upload Images
          </AdminButton>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={
              handleFileChange
            }
            className="hidden"
          />

        </div>

        {uploadError && (
          <p className="text-xs text-red-500">{uploadError}</p>
        )}

      </div>

      <SectionCard title="Product Image Library">

        {libraryImages.length ===
        0 ? (
          <div className="py-12 text-center">

            <Package
              size={22}
              className="mx-auto text-gray-300"
            />

            <p className="text-sm text-gray-500 mt-3">
              No images available yet.
            </p>

          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">

            {libraryImages.map(
              (
                image,
                index
              ) => (
                <div
                  key={`${image}-${index}`}
                  className="aspect-[3/4] bg-gray-100 rounded-lg overflow-hidden group relative"
                >

                  <img
                    src={image}
                    alt=""
                    className="w-full h-full object-cover"
                  />

                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">

                    <button
                      type="button"
                      onClick={() =>
                        setViewingImage(
                          image
                        )
                      }
                      className="p-2 bg-white rounded-lg hover:scale-110 active:scale-95 transition-transform duration-150"
                      aria-label="View image"
                    >
                      <Eye
                        size={14}
                        className="text-gray-700"
                      />
                    </button>

                  </div>

                </div>
              )
            )}

          </div>
        )}

      </SectionCard>

    </div>
  );
};

export default AdminContent;