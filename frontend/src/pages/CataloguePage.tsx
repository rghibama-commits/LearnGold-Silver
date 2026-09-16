import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, ProductCard as ProductCardType } from '../api/client';
import { ProductCard } from '../components/ProductCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';

interface ListResponse {
  items: ProductCardType[];
  total: number;
  page: number;
  pageSize: number;
}

export default function CataloguePage() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const search = params.get('search') ?? '';
  const metal = params.get('metal') ?? '';
  const category = params.get('category') ?? '';
  const purity = params.get('purity') ?? '';
  const minPrice = params.get('minPrice') ?? '';
  const maxPrice = params.get('maxPrice') ?? '';
  const inStockOnly = params.get('inStockOnly') === 'true';
  const sort = params.get('sort') ?? 'newest';
  const page = Number(params.get('page') ?? '1');

  useEffect(() => {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams();
    if (search) qs.set('search', search);
    if (metal) qs.set('metal', metal);
    if (category) qs.set('category', category);
    if (purity) qs.set('purity', purity);
    if (minPrice) qs.set('minPrice', minPrice);
    if (maxPrice) qs.set('maxPrice', maxPrice);
    if (inStockOnly) qs.set('inStockOnly', 'true');
    if (sort) qs.set('sort', sort);
    qs.set('page', String(page));
    qs.set('pageSize', '12');

    api
      .get<ListResponse>(`/products?${qs.toString()}`)
      .then(setData)
      .catch(() => setError('Could not load products. Please try again.'))
      .finally(() => setLoading(false));
  }, [search, metal, category, purity, minPrice, maxPrice, inStockOnly, sort, page]);

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    setParams(next);
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div>
      <div className="page-header">
        <h1>Catalogue</h1>
      </div>

      <form className="filters-bar" role="search" onSubmit={(e) => e.preventDefault()}>
        <div className="field">
          <label htmlFor="search">Search</label>
          <input id="search" type="search" defaultValue={search} onBlur={(e) => updateParam('search', e.target.value)} placeholder="Ring, coin, bar…" />
        </div>
        <div className="field">
          <label htmlFor="metal">Metal</label>
          <select id="metal" value={metal} onChange={(e) => updateParam('metal', e.target.value)}>
            <option value="">All</option>
            <option value="GOLD">Gold</option>
            <option value="SILVER">Silver</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="category">Category</label>
          <select id="category" value={category} onChange={(e) => updateParam('category', e.target.value)}>
            <option value="">All</option>
            <option value="JEWELLERY">Jewellery</option>
            <option value="COIN">Coins</option>
            <option value="BAR">Bars</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="minPrice">Min price</label>
          <input id="minPrice" type="number" min={0} defaultValue={minPrice} onBlur={(e) => updateParam('minPrice', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="maxPrice">Max price</label>
          <input id="maxPrice" type="number" min={0} defaultValue={maxPrice} onBlur={(e) => updateParam('maxPrice', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="sort">Sort by</label>
          <select id="sort" value={sort} onChange={(e) => updateParam('sort', e.target.value)}>
            <option value="newest">Newest</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="name_asc">Name: A-Z</option>
          </select>
        </div>
        <div className="field" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input id="inStockOnly" type="checkbox" style={{ width: 'auto' }} checked={inStockOnly} onChange={(e) => updateParam('inStockOnly', e.target.checked ? 'true' : '')} />
          <label htmlFor="inStockOnly" style={{ marginBottom: 0 }}>
            In stock only
          </label>
        </div>
      </form>

      {loading && <LoadingSpinner label="Loading products…" />}
      {error && <div className="alert alert-error">{error}</div>}
      {!loading && data && data.items.length === 0 && (
        <EmptyState title="No products match your filters" message="Try adjusting search, metal or price range." />
      )}
      {!loading && data && data.items.length > 0 && (
        <>
          <div className="product-grid">
            {data.items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          {totalPages > 1 && (
            <nav aria-label="Pagination" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1.5rem' }}>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button key={p} className={`btn btn-sm ${p === page ? 'btn-secondary' : 'btn-outline'}`} onClick={() => updateParam('page', String(p))} aria-current={p === page ? 'page' : undefined}>
                  {p}
                </button>
              ))}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
