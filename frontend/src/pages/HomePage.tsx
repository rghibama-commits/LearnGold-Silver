import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ProductCard as ProductCardType } from '../api/client';
import { ProductCard } from '../components/ProductCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';

export default function HomePage() {
  const [products, setProducts] = useState<ProductCardType[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ items: ProductCardType[] }>('/products?sort=newest&pageSize=8')
      .then((res) => setProducts(res.items))
      .catch(() => setError('Could not load featured products right now.'));
  }, []);

  return (
    <div>
      <section className="hero">
        <h1>Timeless Gold &amp; Silver, Honestly Priced</h1>
        <p>
          Browse handcrafted jewellery, investment coins and bullion bars. Every price is calculated live from net
          metal weight, purity and transparent making charges — no hidden markups.
        </p>
        <Link to="/catalogue" className="btn btn-primary">
          Shop the full catalogue
        </Link>
      </section>

      <section>
        <h2>Shop by category</h2>
        <div className="category-grid">
          <Link to="/catalogue?metal=GOLD" className="card category-tile">
            Gold Jewellery, Coins &amp; Bars
          </Link>
          <Link to="/catalogue?metal=SILVER" className="card category-tile">
            Silver Jewellery, Coins &amp; Bars
          </Link>
          <Link to="/catalogue?category=JEWELLERY" className="card category-tile">
            Jewellery
          </Link>
          <Link to="/catalogue?category=COIN" className="card category-tile">
            Coins
          </Link>
          <Link to="/catalogue?category=BAR" className="card category-tile">
            Bullion Bars
          </Link>
        </div>
      </section>

      <section>
        <h2>Featured products</h2>
        {error && <div className="alert alert-error">{error}</div>}
        {!products && !error && <LoadingSpinner label="Loading featured products…" />}
        {products && products.length === 0 && <EmptyState title="No products yet" message="Check back soon." />}
        {products && products.length > 0 && (
          <div className="product-grid">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
