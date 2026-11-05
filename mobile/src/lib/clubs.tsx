import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

// המועדונים שהמשתמש חבר בהם – נשמרים במכשיר.
const KEY = 'myClubs';
type Ctx = { myClubs: string[]; toggle: (id: string) => void; ready: boolean };
const ClubsContext = createContext<Ctx>({ myClubs: [], toggle: () => {}, ready: false });

export function ClubsProvider({ children }: { children: ReactNode }) {
  const [myClubs, setMyClubs] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => { if (v) setMyClubs(JSON.parse(v)); })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const toggle = useCallback((id: string) => {
    setMyClubs((cur) => {
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  return <ClubsContext.Provider value={{ myClubs, toggle, ready }}>{children}</ClubsContext.Provider>;
}

export const useClubs = () => useContext(ClubsContext);
