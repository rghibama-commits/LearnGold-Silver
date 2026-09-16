import { Link } from 'react-router-dom';

export default function AdminDashboardPage() {
  return (
    <div>
      <h1>Administrator dashboard</h1>
      <p>Manage products, metal rates and customer orders.</p>
      <div className="category-grid">
        <Link to="/admin/products" className="card category-tile">
          Products &amp; Stock
        </Link>
        <Link to="/admin/rates" className="card category-tile">
          Metal Rates
        </Link>
        <Link to="/admin/orders" className="card category-tile">
          Orders
        </Link>
      </div>
    </div>
  );
}
