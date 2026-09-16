import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, StoreSettings } from '../api/client';

const DEFAULT_SETTINGS: StoreSettings = {
  storeName: 'GoldSilverShop',
  currency: 'INR',
  currencySymbol: '\u20b9',
  taxPercent: 3,
  shippingFlatFee: 150,
  freeShippingThreshold: 50000,
  isDemoMode: true,
  rates: null,
};

const SettingsContext = createContext<StoreSettings>(DEFAULT_SETTINGS);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    api
      .get<StoreSettings>('/settings')
      .then(setSettings)
      .catch(() => setSettings(DEFAULT_SETTINGS));
  }, []);

  return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  return useContext(SettingsContext);
}

export function formatCurrency(amount: number, symbol = '\u20b9'): string {
  return `${symbol}${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
