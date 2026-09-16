import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError, CheckoutSummary, OrderAddress } from '../api/client';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useSettings, formatCurrency } from '../context/SettingsContext';
import { useCart } from '../context/CartContext';

const emptyAddress: OrderAddress = { fullName: '', phone: '', line1: '', line2: '', city: '', state: '', postalCode: '', country: 'India' };

export default function CheckoutPage() {
  const navigate = useNavigate();
  const settings = useSettings();
  const { refresh: refreshCart } = useCart();

  const [summary, setSummary] = useState<CheckoutSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [priceChanged, setPriceChanged] = useState(false);
  const [address, setAddress] = useState<OrderAddress>(emptyAddress);
  const [submitting, setSubmitting] = useState(false);
  const idempotencyKey = useRef(crypto.randomUUID());

  function loadSummary() {
    setLoading(true);
    setError(null);
    api
      .get<CheckoutSummary>('/orders/checkout/summary')
      .then(setSummary)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load your order summary.'))
      .finally(() => setLoading(false));
  }

  useEffect(loadSummary, []);

  function updateAddress<K extends keyof OrderAddress>(key: K, value: OrderAddress[K]) {
    setAddress((a) => ({ ...a, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!summary) return;
    setSubmitting(true);
    setError(null);
    setPriceChanged(false);
    try {
      const res = await api.post<{ order: { orderNumber: string }; duplicate: boolean }>('/orders', {
        address,
        acceptedTotal: summary.total,
        idempotencyKey: idempotencyKey.current,
      });
      await refreshCart();
      navigate(`/order-confirmation/${res.order.orderNumber}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && (err.payload as { summary?: CheckoutSummary })?.summary) {
        setSummary((err.payload as { summary: CheckoutSummary }).summary);
        setPriceChanged(true);
        setError('Prices changed since you loaded checkout. Please review the updated total and confirm again.');
      } else {
        setError(err instanceof ApiError ? err.message : 'Could not place your order. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingSpinner label="Loading checkout…" />;
  if (error && !summary) return <div className="alert alert-error">{error}</div>;
  if (!summary) return null;

  return (
    <div className="two-col">
      <div>
        <h1>Checkout</h1>
        <p className="alert alert-warning">Demo checkout — no real payment is collected.</p>
        {error && <div className={`alert ${priceChanged ? 'alert-warning' : 'alert-error'}`}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <h2>Delivery address</h2>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="fullName">Full name</label>
              <input id="fullName" required value={address.fullName} onChange={(e) => updateAddress('fullName', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="phone">Phone number</label>
              <input id="phone" required value={address.phone} onChange={(e) => updateAddress('phone', e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="line1">Address line 1</label>
            <input id="line1" required value={address.line1} onChange={(e) => updateAddress('line1', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="line2">Address line 2 (optional)</label>
            <input id="line2" value={address.line2} onChange={(e) => updateAddress('line2', e.target.value)} />
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="city">City</label>
              <input id="city" required value={address.city} onChange={(e) => updateAddress('city', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="state">State</label>
              <input id="state" required value={address.state} onChange={(e) => updateAddress('state', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="postalCode">Postal code</label>
              <input id="postalCode" required value={address.postalCode} onChange={(e) => updateAddress('postalCode', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="country">Country</label>
              <input id="country" required value={address.country} onChange={(e) => updateAddress('country', e.target.value)} />
            </div>
          </div>

          <button className="btn btn-primary" type="submit" disabled={submitting} style={{ width: '100%', marginTop: '1rem' }}>
            {submitting ? 'Placing order…' : priceChanged ? 'Accept new total & place order' : 'Place order (simulated payment)'}
          </button>
        </form>
      </div>

      <div className="card summary-card">
        <h2>Order summary</h2>
        {summary.lines.map((line) => (
          <div className="summary-row" key={line.variantId}>
            <span>
              {line.productName} ({line.purityLabel}) × {line.quantity}
            </span>
            <span>{formatCurrency(line.lineTotal, settings.currencySymbol)}</span>
          </div>
        ))}
        <div className="summary-row">
          <span>Subtotal</span>
          <span>{formatCurrency(summary.subtotal, settings.currencySymbol)}</span>
        </div>
        <div className="summary-row">
          <span>Tax ({summary.taxPercent}%)</span>
          <span>{formatCurrency(summary.taxAmount, settings.currencySymbol)}</span>
        </div>
        <div className="summary-row">
          <span>Shipping</span>
          <span>{summary.shippingAmount === 0 ? 'Free' : formatCurrency(summary.shippingAmount, settings.currencySymbol)}</span>
        </div>
        <div className="summary-row total">
          <span>Total</span>
          <span>{formatCurrency(summary.total, settings.currencySymbol)}</span>
        </div>
      </div>
    </div>
  );
}
