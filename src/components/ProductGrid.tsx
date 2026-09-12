// src/components/ProductGrid.tsx
import React from 'react';
import { Product } from '../types/Product';
import { optimizeImage } from '../lib/imageOptimizer';

interface ProductGridProps {
  products: Product[];
  onAddToCart: (product: Product) => void;
  onProductClick: (product: Product) => void;
  formatPrice: (price: number) => string;
  onHover: (product: Product | null) => void;
}

const ProductGrid: React.FC<ProductGridProps> = ({
  products,
  onProductClick,
  onHover
}) => {
  return (
    <div className="w-full py-8 bg-white">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-0">
        {products.map((product) => {
          // images[0] is always the main/floor image (duplicated from
          // product.image), so supporting images start at index 1.
          const supportingImages = product.images?.slice(1) ?? [];

          // NORMAL: first supporting image. Fall back to the main image
          // only if the product has no supporting images uploaded.
          const normalImage =
            supportingImages[0] ||
            product.images?.[0] ||
            product.image;

          // HOVER: second supporting image. Fall back to the normal
          // image if there isn't a second supporting image, so hover
          // never shows the main/floor image outside the floor.
          const hoverImage =
            supportingImages[1] || normalImage;

          return (
            <div
              key={product.id}
              className="group cursor-pointer relative border-r border-b border-gray-200"
              onClick={() => onProductClick(product)}
              onMouseEnter={() => onHover(product)}
              onMouseLeave={() => onHover(null)}
            >
              <div
                className="relative bg-white overflow-hidden p-2 sm:p-4 md:p-8"
                style={{ aspectRatio: '1/1.6' }}
              >
                {/* NORMAL: first supporting image */}
                <img
                  src={optimizeImage(normalImage, 500)}
                  alt={product.name}
                  width="500"
                  height="800"
                  loading="lazy"
                  decoding="async"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = '/placeholder-product.svg';
                  }}
                  className="absolute inset-0 w-full h-full object-cover p-2 sm:p-4 md:p-8 opacity-100 group-hover:opacity-0 transition-opacity duration-300"
                />

                {/* HOVER: second supporting image */}
                <img
                  src={optimizeImage(hoverImage, 500)}
                  alt={`${product.name} - Alternate`}
                  width="500"
                  height="800"
                  loading="lazy"
                  decoding="async"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = '/placeholder-product.svg';
                  }}
                  className="absolute inset-0 w-full h-full object-cover p-2 sm:p-4 md:p-8 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProductGrid;