import { useEffect, useState } from 'react';
import { api, ApiError } from '../../api/client';
import { LoadingSpinner } from '../../components/LoadingSpinner';

interface AdminOrder {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalAmount: string;
  currency: string;
  createdAt: string;
  user: { name: string; email: string };
}

const NEXT_STATUS: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  function load() {
    api
      .get<{ orders: AdminOrder[] }>(`/admin/orders${statusFilter ? `?status=${statusFilter}` : ''}`)
      .then((res) => setOrders(res.orders))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load orders.'));
  }

  useEffect(load, [statusFilter]);

  async function updateStatus(id: string, status: string) {
    setBusyId(id);
    setError(null);
    try {
      await api.put(`/admin/orders/${id}/status`, { status });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update order status.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h1>Orders</h1>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="field" style={{ maxWidth: 240 }}>
        <label htmlFor="statusFilter">Filter by status</label>
        <select id="statusFilter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All</option>
          {Object.keys(NEXT_STATUS).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {!orders && <LoadingSpinner label="Loading orders…" />}
      {orders && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Order #</th>
              <th>Customer</th>
              <th>Total</th>
              <th>Status</th>
              <th>Payment</th>
              <th>Update</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>{o.orderNumber}</td>
                <td>
                  {o.user.name}
                  <br />
                  <span className="rate-note">{o.user.email}</span>
                </td>
                <td>
                  {o.currency} {Number(o.totalAmount).toFixed(2)}
                </td>
                <td>{o.status}</td>
                <td>{o.paymentStatus}</td>
                <td>
                  {NEXT_STATUS[o.status]?.length ? (
                    <select
                      disabled={busyId === o.id}
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) updateStatus(o.id, e.target.value);
                      }}
                      aria-label={`Update status for order ${o.orderNumber}`}
                    >
                      <option value="" disabled>
                        Change status…
                      </option>
                      {NEXT_STATUS[o.status].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
