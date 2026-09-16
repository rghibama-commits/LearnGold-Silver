import { useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { SettingsProvider } from './context/SettingsContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { ProtectedRoute } from './components/ProtectedRoute';
import { primeCsrfToken } from './api/client';

import HomePage from './pages/HomePage';
import CataloguePage from './pages/CataloguePage';
import ProductDetailsPage from './pages/ProductDetailsPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import OrderConfirmationPage from './pages/OrderConfirmationPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import OrderHistoryPage from './pages/OrderHistoryPage';
import OrderDetailsPage from './pages/OrderDetailsPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminProductsPage from './pages/admin/AdminProductsPage';
import AdminRatesPage from './pages/admin/AdminRatesPage';
import AdminOrdersPage from './pages/admin/AdminOrdersPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  useEffect(() => {
    primeCsrfToken();
  }, []);

  return (
    <BrowserRouter>
      <SettingsProvider>
        <AuthProvider>
          <CartProvider>
            <div className="app-shell">
              <Navbar />
              <main className="app-main container">
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/catalogue" element={<CataloguePage />} />
                  <Route path="/products/:slug" element={<ProductDetailsPage />} />
                  <Route path="/cart" element={<CartPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />

                  <Route element={<ProtectedRoute />}>
                    <Route path="/checkout" element={<CheckoutPage />} />
                    <Route path="/order-confirmation/:orderNumber" element={<OrderConfirmationPage />} />
                    <Route path="/orders" element={<OrderHistoryPage />} />
                    <Route path="/orders/:orderNumber" element={<OrderDetailsPage />} />
                  </Route>

                  <Route element={<ProtectedRoute adminOnly />}>
                    <Route path="/admin" element={<AdminDashboardPage />} />
                    <Route path="/admin/products" element={<AdminProductsPage />} />
                    <Route path="/admin/rates" element={<AdminRatesPage />} />
                    <Route path="/admin/orders" element={<AdminOrdersPage />} />
                  </Route>

                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </main>
              <Footer />
            </div>
          </CartProvider>
        </AuthProvider>
      </SettingsProvider>
    </BrowserRouter>
  );
}
