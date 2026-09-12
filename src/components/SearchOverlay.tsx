import React, { useMemo, useState } from 'react';
import { X, Search } from 'lucide-react';
import { Product } from '../types/Product';
import ProductGrid from './ProductGrid';

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onAddToCart: (product: Product) => void;
  onProductClick: (product: Product) => void;
  formatPrice: (price: number) => string;
}

const SearchOverlay: React.FC<SearchOverlayProps> = ({
  isOpen, onClose, products, onAddToCart, onProductClick, formatPrice,
}) => {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return products.filter(p => p.name.toLowerCase().includes(q));
  }, [products, query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-x-0 top-0 h-[100dvh] bg-white z-[65] overflow-y-auto">
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <Search size={18} className="text-gray-400" />
        <input
          autoFocus
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search products..."
          className="flex-1 outline-none text-base"
        />
        <button onClick={onClose} aria-label="Close search">
          <X size={20} />
        </button>
      </div>

      {query.trim() === '' ? (
        <p className="text-center text-sm text-gray-400 mt-16">Start typing to search products.</p>
      ) : results.length === 0 ? (
        <p className="text-center text-sm text-gray-400 mt-16">No products match "{query}".</p>
      ) : (
        <ProductGrid
          products={results}
          onAddToCart={onAddToCart}
          onProductClick={onProductClick}
          formatPrice={formatPrice}
          onHover={() => {}}
        />
      )}
    </div>
  );
};

export default SearchOverlay;