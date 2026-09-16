import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, OrderSummary } from '../api/client';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { useSettings, formatCurrency } from '../context/SettingsContext';

export default function OrderHistoryPage() {
  const settings = useSettings();
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ orders: OrderSummary[] }>('/orders')
      .then((res) => setOrders(res.orders))
      .catch(() => setError('Could not load your orders.'));
  }, []);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!orders) return <LoadingSpinner label="Loading your orders…" />;
  if (orders.length === 0) {
    return (
      <EmptyState
        title="You have no orders yet"
        message="Once you place an order, it will appear here."
        action={
          <Link to="/catalogue" className="btn btn-primary">
            Start shopping
          </Link>
        }
      />
    );
  }

  return (
    <div>
      <h1>My orders</h1>
      <table className="data-table">
        <thead>
          <tr>
            <th>Order #</th>
            <th>Date</th>
            <th>Items</th>
            <th>Total</th>
            <th>Status</th>
            <th>Payment</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.orderNumber}>
              <td>{o.orderNumber}</td>
              <td>{new Date(o.createdAt).toLocaleDateString()}</td>
              <td>{o.itemCount}</td>
              <td>{formatCurrency(o.totalAmount, settings.currencySymbol)}</td>
              <td>{o.status}</td>
              <td>{o.paymentStatus}</td>
              <td>
                <Link to={`/orders/${o.orderNumber}`}>View</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
