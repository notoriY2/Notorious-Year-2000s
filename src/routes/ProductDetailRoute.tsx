import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import ProductDetail from '../components/ProductDetail';
import { fetchProductById } from '../hooks/useProducts';
import type { Product, CartItem } from '../types/Product';
import type { Currency } from '../hooks/useCurrency';
import type { User } from '../hooks/useAuth';

interface ProductDetailRouteProps {
  products: Product[];
  onAddToCart: (product: Product, size?: string) => void;
  formatPrice: (price: number) => string;
  onToggleWishlist: (product: Product) => void;
  isInWishlist: (productId: string) => boolean;
  currencies: Currency[];
  selectedCurrency: Currency;
  onCurrencyChange: (currency: Currency) => void;
  user: User | null;
  onAuthClick: (message?: string) => void;
  onSignOut: () => void;
  wishlistItems: Product[];
  cartItems: CartItem[];
  isCartOpen: boolean;
  onOpenCart: () => void;
  onCloseCart: () => void;
  onUpdateCartQuantity: (uniqueId: string, quantity: number) => void;
  onRemoveCartItem: (uniqueId: string) => void;
  onOpenWishlist: () => void;
  cartItemsCount: number;
  onOpenAdminDashboard: () => void;
  onOpenMyAccount: () => void;
}

const ProductDetailRoute: React.FC<ProductDetailRouteProps> = (props) => {
  const { slugOrId } = useParams();
  const navigate = useNavigate();

  // The shared floor product list (props.products) is intentionally
  // trimmed (no images[]) for floor performance — see
  // PRODUCTS_SELECT_FLOOR in useProducts.ts. Product Detail needs the
  // full row (images, sizes), so it fetches it separately by id here.
  const floorMatch =
    props.products.find(p => p.slug === slugOrId || p.id === slugOrId) ?? null;
  const [fullProduct, setFullProduct] = useState<Product | null>(null);

  useEffect(() => {
    if (!floorMatch) return;
    let cancelled = false;
    fetchProductById(floorMatch.id).then(result => {
      if (!cancelled && result) setFullProduct(result);
    });
    return () => {
      cancelled = true;
    };
  }, [floorMatch?.id]);

  if (!floorMatch) {
    return <Navigate to="/" replace />;
  }

  // Show the trimmed version immediately (fast paint), swap in the
  // full row (real images/sizes) once it lands.
  const product = fullProduct ?? floorMatch;

  return (
    <ProductDetail
      {...props}
      product={product}
      allProducts={props.products}
      isOpen={true}
      onClose={() => navigate('/')}
      onProductClick={(p) => navigate(`/product/${p.slug ?? p.id}`)}
    />
  );
};

export default ProductDetailRoute;