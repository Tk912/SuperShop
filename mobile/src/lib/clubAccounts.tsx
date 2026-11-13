import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from './api';
import type { ClubBenefitItem } from './benefitExtractor';

// חשבונות מועדון שחוברו באפליקציה: ההטבות שנקראו מאתר המועדון, והעמודים שמהם נקראו (לסנכרון).
// הכול נשמר רק במכשיר. הסיסמה אף פעם לא עוברת דרך האפליקציה – ההתחברות היא באתר המועדון עצמו.
// sharedAt: מתי ההטבות שותפו לאחרונה במרכז ההטבות (חנות + הנחה בלבד, בלי שום פרט אישי).
// hub: מה קרה להטבה במרכז ההטבות – נכנסה (ok), או נדחתה: service = שירות/אטרקציה, unknown = לא זוהתה כמוצר, personal = נראתה אישית
export type HubOutcome = { ok: boolean; reason?: string; category?: string };
export type AccountItem = ClubBenefitItem & { hub?: HubOutcome };
export type ShareReport = { at: string; inHub: number; rejected: Record<string, number> } | { at: string; error: string };
export type ClubAccount = { connectedAt: string; syncedAt: string; sharedAt?: string; share?: ShareReport; pages: string[]; items: AccountItem[] };
const KEY = 'clubAccounts:v1';
const SHARE_KEY = 'hubShare:v1';

type Ctx = {
  accounts: Record<string, ClubAccount>;
  /** מוסיף/מעדכן הטבות מעמוד אחד. ייבוא חוזר של אותו עמוד מחליף את ההטבות שלו. */
  importPage: (clubId: string, page: string, items: ClubBenefitItem[]) => void;
  disconnect: (clubId: string) => void;
  /** הפרמטר לשרת: מועדון.חנות.אחוז[.מינימום] – רק הטבות בחנויות שבהשוואה עם אחוז ברור. */
  personalParam: string;
  /** שיתוף ההטבות שיובאו במרכז ההטבות לכל המשתמשים (ברירת מחדל: כן). */
  shareEnabled: boolean;
  setShareEnabled: (on: boolean) => void;
  reshare: (clubId: string) => void;
};
const C = createContext<Ctx | null>(null);

export function ClubAccountsProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<Record<string, ClubAccount>>({});

  const [shareEnabled, setShareState] = useState(true);
  const [shareReady, setShareReady] = useState(false); // לא משתפים לפני שידוע אם המשתמש כיבה את השיתוף
  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => { if (v) setAccounts(JSON.parse(v)); }).catch(() => {});
    AsyncStorage.getItem(SHARE_KEY).then((v) => { if (v === '0') setShareState(false); }).catch(() => {}).finally(() => setShareReady(true));
  }, []);
  const setShareEnabled = useCallback((on: boolean) => {
    setShareState(on);
    AsyncStorage.setItem(SHARE_KEY, on ? '1' : '0').catch(() => {});
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

  // שיתוף אוטומטי: כל מועדון שיובאו בו הטבות מאז השיתוף האחרון. השרת שומר רק הטבות על מוצרים פיזיים,
  // ורק כותרת/טקסט/הנחה/קישור (בלי פרמטרים). ניסיון אחד לכל ייבוא – כשל לא חוזר בלולאה.
  const tried = useRef(new Set<string>());
  useEffect(() => {
    if (!shareReady || !shareEnabled) return;
    for (const [clubId, acc] of Object.entries(accounts)) {
      const attempt = `${clubId}|${acc.syncedAt}`;
      if ((acc.sharedAt && acc.sharedAt >= acc.syncedAt) || tried.current.has(attempt) || !acc.items.length) continue;
      tried.current.add(attempt);
      const sent = acc.items;
      api.shareDeals(clubId, sent.map(({ title, text, link, image }) => ({ title, text, link, image })))
        .then((r) => {
          const byId = new Map(sent.map((i, n) => [i.id, r.outcomes?.[n]]));
          const at = new Date().toISOString();
          update((cur) => (cur[clubId] ? { ...cur, [clubId]: {
            ...cur[clubId], sharedAt: at,
            share: { at, inHub: r.added + r.updated, rejected: r.rejected },
            items: cur[clubId].items.map((i) => (byId.get(i.id) ? { ...i, hub: byId.get(i.id) } : i)),
          } } : cur));
        })
        .catch((e) => {
          const at = new Date().toISOString();
          update((cur) => (cur[clubId] ? { ...cur, [clubId]: { ...cur[clubId], share: { at, error: String(e?.message ?? e) } } } : cur));
        });
    }
  }, [accounts, shareEnabled, shareReady, update]);

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

  // שיתוף מחדש (למשל אחרי שגיאת רשת)
  const reshare = useCallback((clubId: string) => update((cur) => (cur[clubId]
    ? { ...cur, [clubId]: { ...cur[clubId], sharedAt: undefined, syncedAt: new Date().toISOString() } } : cur)), [update]);

  const value = useMemo(() => ({ accounts, importPage, disconnect, personalParam, shareEnabled, setShareEnabled, reshare }),
    [accounts, importPage, disconnect, personalParam, shareEnabled, setShareEnabled, reshare]);
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useClubAccounts() {
  const ctx = useContext(C);
  if (!ctx) throw new Error('useClubAccounts must be used inside ClubAccountsProvider');
  return ctx;
}
