import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useSettings } from '../context/SettingsContext';

export function Navbar() {
  const { user, logout } = useAuth();
  const { itemCount } = useCart();
  const settings = useSettings();

  return (
    <header className="navbar">
      {settings.isDemoMode && <div className="demo-banner">Demo checkout — no real payment is collected</div>}
      <nav className="container navbar-inner" aria-label="Main navigation">
        <Link to="/" className="navbar-brand">
          {settings.storeName}
        </Link>
        <div className="navbar-links">
          <NavLink to="/catalogue" className={({ isActive }) => (isActive ? 'active' : '')}>
            Catalogue
          </NavLink>
          <NavLink to="/catalogue?metal=GOLD" end>
            Gold
          </NavLink>
          <NavLink to="/catalogue?metal=SILVER" end>
            Silver
          </NavLink>
          {user && (
            <NavLink to="/orders" className={({ isActive }) => (isActive ? 'active' : '')}>
              My Orders
            </NavLink>
          )}
          {user?.role === 'ADMIN' && (
            <NavLink to="/admin" className={({ isActive }) => (isActive ? 'active' : '')}>
              Admin
            </NavLink>
          )}
          <Link to="/cart" className="navbar-cart" aria-label={`Cart, ${itemCount} item${itemCount === 1 ? '' : 's'}`}>
            Cart{itemCount > 0 ? ` (${itemCount})` : ''}
          </Link>
          {user ? (
            <button className="btn btn-outline btn-sm" onClick={() => logout()}>
              Sign out
            </button>
          ) : (
            <NavLink to="/login" className={({ isActive }) => (isActive ? 'active' : '')}>
              Sign in
            </NavLink>
          )}
        </div>
      </nav>
    </header>
  );
}
