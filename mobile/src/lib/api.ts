import Constants from 'expo-constants';
import { Platform } from 'react-native';

// כתובת השרת: EXPO_PUBLIC_API_URL אם הוגדר; אחרת אותו מחשב שמריץ את Metro, בפורט 3000.
function resolveBaseUrl(): string {
  const env = process.env.EXPO_PUBLIC_API_URL;
  if (env) return env.replace(/\/$/, '');
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `${window.location.protocol}//${window.location.hostname}:3000`;
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host) return `http://${host}:3000`;
  return Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
}

export const API_URL = resolveBaseUrl();
export const imageUrl = (path: string) => (path.startsWith('http') ? path : `${API_URL}${path}`);

export type ProductSummary = { id: string; name: string; brand: string; category: string; weightKg: number; image: string;
  weightEstimated?: boolean; live?: boolean; fromPrice?: number; fromCurrency?: string; fromStore?: string; rating?: number; reviews?: number };
export type DataMode = 'live' | 'demo';
export type Club = { id: string; name: string; description: string };
export type Taxes = { valueUsd?: number; dutyIls: number; vatIls: number; feeIls: number; totalIls: number; exempt: boolean };
export type Route = { kind: 'direct' | 'forwarder'; name: string; days: string; note?: string; chargeableKg?: number;
  shippingIls: number; taxes: Taxes; totalIls: number };
export type Discount = { kind: 'club' | 'coupon'; name?: string; clubId?: string; code?: string; label: string;
  amountIls: number; verified?: boolean; expires?: string; note?: string };
export type Offer = {
  storeId: string; storeName: string; storeType: 'local' | 'intl'; domain: string; url: string; source: string;
  currency: string; price: number; priceIls: number; shipsDirectToIL: boolean;
  discounts: { applied: Discount[]; totalIls: number; availableClubs: Discount[]; availableCoupons: Discount[] };
  routes: Route[]; best: Route; totalIls: number; missedClubs: Discount[]; inStock: boolean; details: string[];
};
export type ProviderError = { provider: string; error: string };
export type OffersResponse = { product: ProductSummary; offers: Offer[]; errors: ProviderError[]; mode: DataMode;
  fx: { rates: Record<string, number>; source: string } };
export type SearchResponse = { results: ProductSummary[]; mode: DataMode; errors: ProviderError[] };
export type Meta = { clubs: Club[]; popular: ProductSummary[]; mode: DataMode };

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { signal });
  if (!res.ok) throw new Error(`שגיאת שרת (${res.status})`);
  return res.json() as Promise<T>;
}

export const api = {
  meta: () => get<Meta>('/api/meta'),
  suggest: (q: string, signal?: AbortSignal) =>
    get<{ suggestions: ProductSummary[] }>(`/api/suggest?q=${encodeURIComponent(q)}`, signal).then((r) => r.suggestions),
  search: (q: string) => get<SearchResponse>(`/api/search?q=${encodeURIComponent(q)}`),
  offers: (id: string, clubs: string[]) =>
    get<OffersResponse>(`/api/products/${encodeURIComponent(id)}/offers?clubs=${clubs.join(',')}`),
};
