export type Metal = 'GOLD' | 'SILVER';
export type ProductCategory = 'JEWELLERY' | 'COIN' | 'BAR';
export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

export interface RateInfo {
  ratePerGram: number;
  source: string;
  effectiveAt: string;
}

export interface ProductCard {
  id: string;
  slug: string;
  sku: string;
  name: string;
  category: ProductCategory;
  metal: Metal;
  images: string[];
  variantCount: number;
  fromPrice: number | null;
  inStock: boolean;
  purities: string[];
}

export interface VariantDetail {
  id: string;
  sku: string;
  purityLabel: string;
  purityFraction: number;
  netWeightGrams: number;
  grossWeightGrams: number | null;
  stockQuantity: number;
  images: string[];
  priceBreakdown: {
    metalValue: number;
    makingCharge: number;
    stoneCharge: number;
    unitPrice: number;
    ratePerGram: number;
    rateSource: string;
    rateEffectiveAt: string;
  };
}

export interface ProductDetail {
  id: string;
  slug: string;
  sku: string;
  name: string;
  description: string;
  category: ProductCategory;
  metal: Metal;
  images: string[];
  variants: VariantDetail[];
}

export interface CartItem {
  id: string;
  variantId: string;
  productSlug: string;
  productName: string;
  image: string | null;
  purityLabel: string;
  netWeightGrams: number;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  stockQuantity: number;
  maxAvailable: number;
}

export interface CartResponse {
  items: CartItem[];
  subtotal: number;
}

export interface CheckoutSummary {
  lines: Array<{
    variantId: string;
    productName: string;
    purityLabel: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    stockQuantity: number;
  }>;
  subtotal: number;
  taxAmount: number;
  shippingAmount: number;
  total: number;
  currency: string;
  taxPercent: number;
}

export interface OrderAddress {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface OrderDetail {
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  currency: string;
  subtotalAmount: number;
  taxAmount: number;
  shippingAmount: number;
  totalAmount: number;
  addressSnapshot: OrderAddress;
  createdAt: string;
  items: Array<{
    productName: string;
    purityLabel: string;
    netWeightGrams: number;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  payment: { status: PaymentStatus; isSimulated: boolean; transactionRef: string } | null;
}

export interface OrderSummary {
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  currency: string;
  createdAt: string;
  itemCount: number;
}

export interface StoreSettings {
  storeName: string;
  currency: string;
  currencySymbol: string;
  taxPercent: number;
  shippingFlatFee: number;
  freeShippingThreshold: number;
  isDemoMode: boolean;
  rates: { GOLD: RateInfo; SILVER: RateInfo } | null;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'CUSTOMER' | 'ADMIN';
}

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export class ApiError extends Error {
  status: number;
  details?: unknown;
  payload?: unknown;
  constructor(status: number, message: string, details?: unknown, payload?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
    this.payload = payload;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  const headers = new Headers(options.headers);
  if (options.body) headers.set('Content-Type', 'application/json');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrf = readCookie('gss_csrf');
    if (csrf) headers.set('x-csrf-token', csrf);
  }

  const res = await fetch(`/api${path}`, { ...options, method, headers, credentials: 'include' });
  const contentType = res.headers.get('content-type') ?? '';
  const data = contentType.includes('application/json') ? await res.json() : null;

  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? 'Something went wrong. Please try again.', data?.details, data);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

/** Ensures the CSRF cookie exists before the first mutating request (e.g. on app load). */
export async function primeCsrfToken() {
  if (!readCookie('gss_csrf')) {
    await request('/csrf-token');
  }
}
