import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ClubBenefitItem } from './benefitExtractor';

// חשבונות מועדון שחוברו באפליקציה: ההטבות שנקראו מאתר המועדון, והעמודים שמהם נקראו (לסנכרון).
// הכול נשמר רק במכשיר. הסיסמה אף פעם לא עוברת דרך האפליקציה – ההתחברות היא באתר המועדון עצמו.
export type ClubAccount = { connectedAt: string; syncedAt: string; pages: string[]; items: ClubBenefitItem[] };
const KEY = 'clubAccounts:v1';

type Ctx = {
  accounts: Record<string, ClubAccount>;
  /** מוסיף/מעדכן הטבות מעמוד אחד. ייבוא חוזר של אותו עמוד מחליף את ההטבות שלו. */
  importPage: (clubId: string, page: string, items: ClubBenefitItem[]) => void;
  disconnect: (clubId: string) => void;
  /** הפרמטר לשרת: מועדון.חנות.אחוז[.מינימום] – רק הטבות בחנויות שבהשוואה עם אחוז ברור. */
  personalParam: string;
};
const C = createContext<Ctx | null>(null);

export function ClubAccountsProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<Record<string, ClubAccount>>({});

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => { if (v) setAccounts(JSON.parse(v)); }).catch(() => {});
  }, []);

  const update = useCallback((fn: (cur: Record<string, ClubAccount>) => Record<string, ClubAccount>) => {
    setAccounts((cur) => {
      const next = fn(cur);
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const importPage = useCallback((clubId: string, page: string, items: ClubBenefitItem[]) => update((cur) => {
    const now = new Date().toISOString();
    const prev = cur[clubId];
    const kept = (prev?.items ?? []).filter((i) => i.page !== page);
    return { ...cur, [clubId]: {
      connectedAt: prev?.connectedAt ?? now, syncedAt: now,
      pages: [...new Set([...(prev?.pages ?? []), page])].slice(-20),
      items: [...kept, ...items].slice(0, 1000),
    } };
  }), [update]);

  const disconnect = useCallback((clubId: string) => update((cur) => {
    const { [clubId]: _gone, ...rest } = cur;
    return rest;
  }), [update]);

  const personalParam = useMemo(() => {
    const best = new Map<string, ClubBenefitItem & { clubId: string }>();
    for (const [clubId, acc] of Object.entries(accounts)) {
      for (const i of acc.items) {
        if (!i.storeId || !i.percent) continue;
        const k = `${clubId}.${i.storeId}`;
        if ((best.get(k)?.percent ?? 0) < i.percent) best.set(k, { ...i, clubId });
      }
    }
    return [...best.values()].map((i) => [i.clubId, i.storeId, i.percent, i.minSpend].filter((x) => x != null).join('.')).join(',');
  }, [accounts]);

  const value = useMemo(() => ({ accounts, importPage, disconnect, personalParam }), [accounts, importPage, disconnect, personalParam]);
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useClubAccounts() {
  const ctx = useContext(C);
  if (!ctx) throw new Error('useClubAccounts must be used inside ClubAccountsProvider');
  return ctx;
}
