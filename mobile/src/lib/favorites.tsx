import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from './api';
import { registerForPush, type PushResult } from './push';

// מועדפים + התראות מחיר. הרשימה נשמרת במכשיר; כשהתראות מופעלות היא מסונכרנת גם לשרת,
// שבודק מחירים ברקע ושולח push כשהמחיר יורד או מגיע ליעד.
// savedTotalIls = המחיר הסופי בזמן השמירה; targetIls = מחיר יעד שהמשתמש קבע (אופציונלי).
export type Favorite = {
  id: string; name: string; image: string; savedTotalIls: number | null; savedAt: number; targetIls?: number;
};
export type AlertsState = { status: 'off' } | { status: 'on'; token: string } | { status: 'unavailable'; message: string };

const KEY = 'favorites:v1';
const TOKEN_KEY = 'pushToken:v1';
type Ctx = {
  favorites: Favorite[];
  isFavorite: (id: string) => boolean;
  toggle: (f: Omit<Favorite, 'savedAt'>) => void;
  setTarget: (id: string, targetIls: number | undefined) => void;
  remove: (id: string) => void;
  alerts: AlertsState;
  enableAlerts: () => Promise<PushResult>;
};
const FavoritesContext = createContext<Ctx | null>(null);

const toWatch = (f: Favorite) => ({ productId: f.id, targetIls: f.targetIls ?? null, baselineIls: f.savedTotalIls });

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [alerts, setAlerts] = useState<AlertsState>({ status: 'off' });
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => { if (v) setFavorites(JSON.parse(v)); }).catch(() => {});
    AsyncStorage.getItem(TOKEN_KEY).then((t) => { if (t) { tokenRef.current = t; setAlerts({ status: 'on', token: t }); } }).catch(() => {});
  }, []);

  // סנכרון לשרת – רק כשהתראות פעילות. כשל רשת לא חוסם את השמירה במכשיר.
  const sync = useCallback((fn: (token: string) => Promise<unknown>) => {
    const t = tokenRef.current;
    if (t) fn(t).catch(() => {});
  }, []);

  const update = useCallback((fn: (cur: Favorite[]) => Favorite[]) => {
    setFavorites((cur) => {
      const next = fn(cur);
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const enableAlerts = useCallback(async () => {
    const r = await registerForPush();
    if (!r.ok) { setAlerts({ status: 'unavailable', message: r.message }); return r; }
    tokenRef.current = r.token;
    await AsyncStorage.setItem(TOKEN_KEY, r.token).catch(() => {});
    setAlerts({ status: 'on', token: r.token });
    await Promise.all(favorites.map((f) => api.putWatch(r.token, toWatch(f)).catch(() => {})));
    return r;
  }, [favorites]);

  const value = useMemo<Ctx>(() => ({
    favorites, alerts, enableAlerts,
    isFavorite: (id) => favorites.some((f) => f.id === id),
    toggle: (f) => {
      const exists = favorites.some((x) => x.id === f.id);
      const fav = { ...f, savedAt: Date.now() };
      update((cur) => (exists ? cur.filter((x) => x.id !== f.id) : [fav, ...cur]));
      sync((t) => (exists ? api.deleteWatch(t, f.id) : api.putWatch(t, toWatch(fav))));
    },
    setTarget: (id, targetIls) => {
      const f = favorites.find((x) => x.id === id);
      if (!f || f.targetIls === targetIls) return;
      update((cur) => cur.map((x) => (x.id === id ? { ...x, targetIls } : x)));
      sync((t) => api.putWatch(t, toWatch({ ...f, targetIls })));
    },
    remove: (id) => {
      update((cur) => cur.filter((x) => x.id !== id));
      sync((t) => api.deleteWatch(t, id));
    },
  }), [favorites, alerts, enableAlerts, update, sync]);

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used inside FavoritesProvider');
  return ctx;
}

/** מצב התראה עבור מועדף לפי המחיר הנוכחי. */
export function priceAlert(f: Favorite, currentIls: number | null) {
  if (currentIls == null) return { kind: 'unknown' as const };
  if (f.targetIls != null && currentIls <= f.targetIls) return { kind: 'target' as const, diff: f.targetIls - currentIls };
  if (f.savedTotalIls != null && currentIls < f.savedTotalIls) return { kind: 'drop' as const, diff: f.savedTotalIls - currentIls };
  if (f.savedTotalIls != null && currentIls > f.savedTotalIls) return { kind: 'rise' as const, diff: currentIls - f.savedTotalIls };
  return { kind: 'same' as const };
}
