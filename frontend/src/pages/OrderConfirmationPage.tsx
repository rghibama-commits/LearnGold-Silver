import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, OrderDetail } from '../api/client';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useSettings, formatCurrency } from '../context/SettingsContext';

export default function OrderConfirmationPage() {
  const { orderNumber } = useParams();
  const settings = useSettings();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ order: OrderDetail }>(`/orders/${orderNumber}`)
      .then((res) => setOrder(res.order))
      .catch(() => setError('Could not load your order confirmation.'));
  }, [orderNumber]);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!order) return <LoadingSpinner label="Loading order confirmation…" />;

  return (
    <div className="order-confirmation">
      <h1>Thank you for your order!</h1>
      <p>Your order reference is</p>
      <p className="ref">{order.orderNumber}</p>
      <p className="alert alert-warning" style={{ display: 'inline-block' }}>
        Demo checkout — no real payment is collected.
      </p>
      <div className="card" style={{ maxWidth: 480, margin: '1.5rem auto', padding: '1.25rem', textAlign: 'left' }}>
        <h2>Order summary</h2>
        {order.items.map((item, i) => (
          <div className="summary-row" key={i}>
            <span>
              {item.productName} ({item.purityLabel}) × {item.quantity}
            </span>
            <span>{formatCurrency(item.lineTotal, settings.currencySymbol)}</span>
          </div>
        ))}
        <div className="summary-row total">
          <span>Total paid</span>
          <span>{formatCurrency(order.totalAmount, settings.currencySymbol)}</span>
        </div>
        <p className="rate-note">Payment status: {order.paymentStatus} ({order.payment?.isSimulated ? 'simulated transaction' : 'real payment'})</p>
      </div>
      <Link to="/orders" className="btn btn-primary">
        View my orders
      </Link>
    </div>
  );
}
