import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ProductDetail, ApiError } from '../api/client';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useCart } from '../context/CartContext';
import { useSettings, formatCurrency } from '../context/SettingsContext';

export default function ProductDetailsPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const settings = useSettings();

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [addStatus, setAddStatus] = useState<'idle' | 'adding' | 'added' | 'error'>('idle');
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    setProduct(null);
    setError(null);
    api
      .get<ProductDetail>(`/products/${slug}`)
      .then((res) => {
        setProduct(res);
        setSelectedVariantId(res.variants.find((v) => v.stockQuantity > 0)?.id ?? res.variants[0]?.id ?? null);
      })
      .catch(() => setError('Product not found.'));
  }, [slug]);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!product) return <LoadingSpinner label="Loading product…" />;

  const variant = product.variants.find((v) => v.id === selectedVariantId) ?? product.variants[0];

  async function handleAddToCart() {
    if (!variant) return;
    setAddStatus('adding');
    setAddError(null);
    try {
      await addItem(variant.id, quantity);
      setAddStatus('added');
    } catch (err) {
      setAddStatus('error');
      setAddError(err instanceof ApiError ? err.message : 'Could not add to cart.');
    }
  }

  return (
    <div className="two-col">
      <div className="product-images">
        <img src={variant?.images[0] ?? product.images[0] ?? '/products/placeholder.svg'} alt={product.name} />
      </div>

      <div>
        <span className={`badge ${product.metal === 'GOLD' ? 'badge-gold' : 'badge-silver'}`}>{product.metal === 'GOLD' ? 'Gold' : 'Silver'}</span>
        <h1>{product.name}</h1>
        <p>{product.description}</p>
        <p style={{ color: '#777' }}>SKU: {variant?.sku ?? product.sku}</p>

        <fieldset style={{ border: 'none', padding: 0 }}>
          <legend style={{ fontWeight: 700, marginBottom: '0.4rem' }}>Choose purity / weight</legend>
          <div className="variant-picker" role="radiogroup" aria-label="Purity and weight options">
            {product.variants.map((v) => (
              <button
                key={v.id}
                type="button"
                role="radio"
                aria-checked={v.id === selectedVariantId}
                className={`variant-chip ${v.id === selectedVariantId ? 'selected' : ''}`}
                disabled={v.stockQuantity === 0}
                onClick={() => {
                  setSelectedVariantId(v.id);
                  setQuantity(1);
                  setAddStatus('idle');
                }}
              >
                {v.purityLabel} · {v.netWeightGrams}g{v.stockQuantity === 0 ? ' (Out of stock)' : ''}
              </button>
            ))}
          </div>
        </fieldset>

        {variant && (
          <>
            <p>
              Net metal weight: <strong>{variant.netWeightGrams} g</strong> ({variant.purityLabel})
              {variant.grossWeightGrams && <> · Gross weight: {variant.grossWeightGrams} g</>}
            </p>
            <p>Stock: {variant.stockQuantity > 0 ? `${variant.stockQuantity} available` : 'Out of stock'}</p>

            <div className="price-breakdown">
              <table>
                <tbody>
                  <tr>
                    <td>Metal value ({variant.netWeightGrams}g × {formatCurrency(variant.priceBreakdown.ratePerGram, settings.currencySymbol)}/g × {variant.purityLabel})</td>
                    <td>{formatCurrency(variant.priceBreakdown.metalValue, settings.currencySymbol)}</td>
                  </tr>
                  <tr>
                    <td>Making charges</td>
                    <td>{formatCurrency(variant.priceBreakdown.makingCharge, settings.currencySymbol)}</td>
                  </tr>
                  {variant.priceBreakdown.stoneCharge > 0 && (
                    <tr>
                      <td>Stone charges</td>
                      <td>{formatCurrency(variant.priceBreakdown.stoneCharge, settings.currencySymbol)}</td>
                    </tr>
                  )}
                  <tr className="total-row">
                    <td>Unit price</td>
                    <td>{formatCurrency(variant.priceBreakdown.unitPrice, settings.currencySymbol)}</td>
                  </tr>
                </tbody>
              </table>
              <p className="rate-note">
                Rate: {formatCurrency(variant.priceBreakdown.ratePerGram, settings.currencySymbol)}/g — {variant.priceBreakdown.rateSource}. Last
                updated {new Date(variant.priceBreakdown.rateEffectiveAt).toLocaleString()}. Tax and shipping are calculated at checkout.
              </p>
            </div>

            <div className="qty-control" style={{ marginBottom: '1rem' }}>
              <label htmlFor="qty" style={{ marginBottom: 0 }}>
                Quantity
              </label>
              <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">
                −
              </button>
              <input id="qty" type="number" min={1} max={variant.stockQuantity} value={quantity} style={{ width: 60, textAlign: 'center' }} onChange={(e) => setQuantity(Math.max(1, Math.min(variant.stockQuantity, Number(e.target.value) || 1)))} />
              <button type="button" onClick={() => setQuantity((q) => Math.min(variant.stockQuantity, q + 1))} aria-label="Increase quantity">
                +
              </button>
            </div>

            {addError && <div className="alert alert-error">{addError}</div>}
            {addStatus === 'added' && <div className="alert alert-success">Added to cart.</div>}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-primary" disabled={variant.stockQuantity === 0 || addStatus === 'adding'} onClick={handleAddToCart}>
                {addStatus === 'adding' ? 'Adding…' : 'Add to cart'}
              </button>
              <button className="btn btn-outline" disabled={variant.stockQuantity === 0} onClick={async () => { await handleAddToCart(); navigate('/cart'); }}>
                Buy now
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
