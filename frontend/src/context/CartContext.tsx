import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, CartResponse } from '../api/client';

interface CartContextValue {
  cart: CartResponse;
  loading: boolean;
  refresh: () => Promise<void>;
  addItem: (variantId: string, quantity: number) => Promise<void>;
  updateItem: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clear: () => Promise<void>;
  itemCount: number;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

const EMPTY: CartResponse = { items: [], subtotal: 0 };

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartResponse>(EMPTY);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const res = await api.get<CartResponse>('/cart');
    setCart(res);
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const addItem = useCallback(async (variantId: string, quantity: number) => {
    const res = await api.post<CartResponse>('/cart/items', { variantId, quantity });
    setCart(res);
  }, []);

  const updateItem = useCallback(async (itemId: string, quantity: number) => {
    const res = await api.patch<CartResponse>(`/cart/items/${itemId}`, { quantity });
    setCart(res);
  }, []);

  const removeItem = useCallback(async (itemId: string) => {
    const res = await api.delete<CartResponse>(`/cart/items/${itemId}`);
    setCart(res);
  }, []);

  const clear = useCallback(async () => {
    const res = await api.delete<CartResponse>('/cart');
    setCart(res);
  }, []);

  const itemCount = cart.items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider value={{ cart, loading, refresh, addItem, updateItem, removeItem, clear, itemCount }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
