import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

// מועדפים + התראות מחיר, נשמרים במכשיר.
// savedTotalIls = המחיר הסופי בזמן השמירה; targetIls = מחיר יעד שהמשתמש קבע (אופציונלי).
export type Favorite = {
  id: string; name: string; image: string; savedTotalIls: number | null; savedAt: number; targetIls?: number;
};

const KEY = 'favorites:v1';
type Ctx = {
  favorites: Favorite[];
  isFavorite: (id: string) => boolean;
  toggle: (f: Omit<Favorite, 'savedAt'>) => void;
  setTarget: (id: string, targetIls: number | undefined) => void;
  remove: (id: string) => void;
};
const FavoritesContext = createContext<Ctx | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<Favorite[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => { if (v) setFavorites(JSON.parse(v)); }).catch(() => {});
  }, []);

  const update = useCallback((fn: (cur: Favorite[]) => Favorite[]) => {
    setFavorites((cur) => {
      const next = fn(cur);
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo<Ctx>(() => ({
    favorites,
    isFavorite: (id) => favorites.some((f) => f.id === id),
    toggle: (f) => update((cur) => (cur.some((x) => x.id === f.id) ? cur.filter((x) => x.id !== f.id) : [{ ...f, savedAt: Date.now() }, ...cur])),
    setTarget: (id, targetIls) => update((cur) => cur.map((x) => (x.id === id ? { ...x, targetIls } : x))),
    remove: (id) => update((cur) => cur.filter((x) => x.id !== id)),
  }), [favorites, update]);

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
