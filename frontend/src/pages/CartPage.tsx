import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useCart } from '../context/CartContext';
import { useSettings, formatCurrency } from '../context/SettingsContext';
import { EmptyState } from '../components/EmptyState';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ApiError } from '../api/client';

export default function CartPage() {
  const { cart, loading, updateItem, removeItem } = useCart();
  const settings = useSettings();
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (loading) return <LoadingSpinner label="Loading your cart…" />;

  if (cart.items.length === 0) {
    return (
      <EmptyState
        title="Your cart is empty"
        message="Browse our catalogue to find gold and silver jewellery, coins and bars."
        action={
          <Link to="/catalogue" className="btn btn-primary">
            Shop the catalogue
          </Link>
        }
      />
    );
  }

  async function handleQtyChange(itemId: string, qty: number) {
    setBusyItemId(itemId);
    setError(null);
    try {
      await updateItem(itemId, qty);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update quantity.');
    } finally {
      setBusyItemId(null);
    }
  }

  return (
    <div className="two-col">
      <div>
        <h1>Your cart</h1>
        {error && <div className="alert alert-error">{error}</div>}
        {cart.items.map((item) => (
          <div className="cart-line" key={item.id}>
            <img src={item.image ?? '/products/placeholder.svg'} alt={item.productName} />
            <div>
              <Link to={`/products/${item.productSlug}`}>
                <strong>{item.productName}</strong>
              </Link>
              <p style={{ margin: '0.2rem 0', color: '#777' }}>
                {item.purityLabel} · {item.netWeightGrams}g · {formatCurrency(item.unitPrice, settings.currencySymbol)} each
              </p>
              <div className="qty-control">
                <button disabled={busyItemId === item.id} onClick={() => handleQtyChange(item.id, item.quantity - 1)} aria-label={`Decrease quantity of ${item.productName}`}>
                  −
                </button>
                <span aria-live="polite">{item.quantity}</span>
                <button disabled={busyItemId === item.id || item.quantity >= item.maxAvailable} onClick={() => handleQtyChange(item.id, item.quantity + 1)} aria-label={`Increase quantity of ${item.productName}`}>
                  +
                </button>
                <button className="btn btn-outline btn-sm" onClick={() => removeItem(item.id)}>
                  Remove
                </button>
              </div>
              {item.quantity >= item.maxAvailable && <p className="rate-note">Maximum available stock reached.</p>}
            </div>
            <div style={{ fontWeight: 700 }}>{formatCurrency(item.lineTotal, settings.currencySymbol)}</div>
          </div>
        ))}
      </div>

      <div className="card summary-card">
        <h2>Order summary</h2>
        <div className="summary-row">
          <span>Subtotal</span>
          <span>{formatCurrency(cart.subtotal, settings.currencySymbol)}</span>
        </div>
        <p className="rate-note">Tax and shipping are calculated at checkout.</p>
        <Link to="/checkout" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
          Proceed to checkout
        </Link>
      </div>
    </div>
  );
}
