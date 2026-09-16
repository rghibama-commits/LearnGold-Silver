import { useEffect, useState } from 'react';
import { api, ApiError } from '../../api/client';
import { LoadingSpinner } from '../../components/LoadingSpinner';

interface AdminVariant {
  id: string;
  sku: string;
  purityLabel: string;
  netWeightGrams: string;
  stockQuantity: number;
  isActive: boolean;
}

interface AdminProduct {
  id: string;
  sku: string;
  slug: string;
  name: string;
  category: string;
  metal: string;
  isActive: boolean;
  variants: AdminVariant[];
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<AdminProduct[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  function load() {
    api
      .get<{ products: AdminProduct[] }>('/admin/products')
      .then((res) => setProducts(res.products))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load products.'));
  }

  useEffect(load, []);

  async function updateStock(variantId: string, stockQuantity: number) {
    setSavingId(variantId);
    setError(null);
    try {
      await api.put(`/admin/variants/${variantId}/stock`, { stockQuantity });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update stock.');
    } finally {
      setSavingId(null);
    }
  }

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!products) return <LoadingSpinner label="Loading products…" />;

  return (
    <div>
      <h1>Products &amp; stock</h1>
      <p className="rate-note">
        Use the seed script or a future admin form to add new products. Stock quantities can be updated below.
      </p>
      {products.map((p) => (
        <div key={p.id} className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
          <h3>
            {p.name} <span className="rate-note">({p.sku})</span>
          </h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Variant SKU</th>
                <th>Purity</th>
                <th>Net weight (g)</th>
                <th>Stock</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {p.variants.map((v) => (
                <VariantRow key={v.id} variant={v} onSave={updateStock} saving={savingId === v.id} />
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function VariantRow({ variant, onSave, saving }: { variant: AdminVariant; onSave: (id: string, qty: number) => void; saving: boolean }) {
  const [qty, setQty] = useState(variant.stockQuantity);
  return (
    <tr>
      <td>{variant.sku}</td>
      <td>{variant.purityLabel}</td>
      <td>{variant.netWeightGrams}</td>
      <td>
        <input
          type="number"
          min={0}
          value={qty}
          style={{ width: 90 }}
          aria-label={`Stock for ${variant.sku}`}
          onChange={(e) => setQty(Number(e.target.value))}
        />
      </td>
      <td>
        <button className="btn btn-outline btn-sm" disabled={saving || qty === variant.stockQuantity} onClick={() => onSave(variant.id, qty)}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </td>
    </tr>
  );
}
