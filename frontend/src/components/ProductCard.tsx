import { Link } from 'react-router-dom';
import { ProductCard as ProductCardType } from '../api/client';
import { useSettings, formatCurrency } from '../context/SettingsContext';

export function ProductCard({ product }: { product: ProductCardType }) {
  const settings = useSettings();
  return (
    <Link to={`/products/${product.slug}`} className="card product-card" aria-label={`${product.name}, from ${product.fromPrice != null ? formatCurrency(product.fromPrice, settings.currencySymbol) : 'price unavailable'}`}>
      <div className="product-card-image">
        <img src={product.images[0] ?? '/products/placeholder.svg'} alt={product.name} loading="lazy" />
        <span className={`badge ${product.metal === 'GOLD' ? 'badge-gold' : 'badge-silver'}`}>{product.metal === 'GOLD' ? 'Gold' : 'Silver'}</span>
      </div>
      <div className="product-card-body">
        <h3>{product.name}</h3>
        <p className="product-card-meta">{product.category.charAt(0) + product.category.slice(1).toLowerCase()}</p>
        <p className="product-card-price">
          {product.fromPrice != null ? (
            <>From {formatCurrency(product.fromPrice, settings.currencySymbol)}</>
          ) : (
            'Price unavailable'
          )}
        </p>
        {!product.inStock && <span className="badge" style={{ background: '#f3d3d3', color: '#7a1f1f' }}>Out of stock</span>}
      </div>
    </Link>
  );
}
