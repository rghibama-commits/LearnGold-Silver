import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, ApiError, OrderDetail } from '../api/client';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useSettings, formatCurrency } from '../context/SettingsContext';

const CANCELLABLE = new Set(['PENDING', 'CONFIRMED', 'PROCESSING']);

export default function OrderDetailsPage() {
  const { orderNumber } = useParams();
  const settings = useSettings();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  function load() {
    api
      .get<{ order: OrderDetail }>(`/orders/${orderNumber}`)
      .then((res) => setOrder(res.order))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load this order.'));
  }

  useEffect(load, [orderNumber]);

  async function handleCancel() {
    if (!confirm('Cancel this order? This cannot be undone.')) return;
    setCancelling(true);
    try {
      await api.post(`/orders/${orderNumber}/cancel`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not cancel this order.');
    } finally {
      setCancelling(false);
    }
  }

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!order) return <LoadingSpinner label="Loading order…" />;

  const address = order.addressSnapshot;

  return (
    <div className="two-col">
      <div>
        <h1>Order {order.orderNumber}</h1>
        <p>
          Status: <strong>{order.status}</strong> · Payment: <strong>{order.paymentStatus}</strong>
          {order.payment?.isSimulated && ' (simulated)'}
        </p>
        <p>Placed on {new Date(order.createdAt).toLocaleString()}</p>

        <h2>Items</h2>
        {order.items.map((item, i) => (
          <div className="summary-row" key={i}>
            <span>
              {item.productName} ({item.purityLabel}, {item.netWeightGrams}g) × {item.quantity}
            </span>
            <span>{formatCurrency(item.lineTotal, settings.currencySymbol)}</span>
          </div>
        ))}

        <h2>Delivery address</h2>
        <p>
          {address.fullName}
          <br />
          {address.line1}
          {address.line2 && (
            <>
              <br />
              {address.line2}
            </>
          )}
          <br />
          {address.city}, {address.state} {address.postalCode}
          <br />
          {address.country}
          <br />
          Phone: {address.phone}
        </p>

        {CANCELLABLE.has(order.status) && (
          <button className="btn btn-danger" onClick={handleCancel} disabled={cancelling}>
            {cancelling ? 'Cancelling…' : 'Cancel order'}
          </button>
        )}
      </div>

      <div className="card summary-card">
        <h2>Payment summary</h2>
        <div className="summary-row">
          <span>Subtotal</span>
          <span>{formatCurrency(order.subtotalAmount, settings.currencySymbol)}</span>
        </div>
        <div className="summary-row">
          <span>Tax</span>
          <span>{formatCurrency(order.taxAmount, settings.currencySymbol)}</span>
        </div>
        <div className="summary-row">
          <span>Shipping</span>
          <span>{formatCurrency(order.shippingAmount, settings.currencySymbol)}</span>
        </div>
        <div className="summary-row total">
          <span>Total</span>
          <span>{formatCurrency(order.totalAmount, settings.currencySymbol)}</span>
        </div>
      </div>
    </div>
  );
}
