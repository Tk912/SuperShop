import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text } from 'react-native';
import { ErrorState } from '../components/ErrorState';
import { ProductGrid } from '../components/ProductGrid';
import { SearchBox } from '../components/SearchBox';
import { api, type SearchResponse } from '../lib/api';
import { useTheme } from '../lib/theme';

export default function Search() {
  const t = useTheme();
  const { q = '' } = useLocalSearchParams<{ q: string }>();
  // התוצאה נשמרת יחד עם השאילתה שלה, כך שמעבר לשאילתה חדשה מציג טעינה בלי איפוס סינכרוני
  const [res, setRes] = useState<{ q: string; data?: SearchResponse; error?: string } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    api.search(q).then((data) => live && setRes({ q, data })).catch((e) => live && setRes({ q, error: String(e.message ?? e) }));
    return () => { live = false; };
  }, [q, attempt]);

  const current = res?.q === q ? res : null;
  const items = current?.data?.results ?? null;
  const providerErrors = current?.data?.errors ?? [];
  const error = current?.error ?? null;
  const load = () => { setRes(null); setAttempt((a) => a + 1); };

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 16 }}>
      <SearchBox initial={q} />
      {error ? <ErrorState message={error} onRetry={load} />
        : !items ? <ActivityIndicator color={t.brand} />
        : items.length ? (
          <>
            <Text style={{ color: t.ink, fontSize: 17, fontWeight: '700' }}>{items.length} תוצאות עבור “{q}”</Text>
            {providerErrors.length > 0 && <Text style={{ color: t.warn }}>החיפוש החי נכשל חלקית – מוצגות תוצאות מהמאגר בלבד.</Text>}
            <ProductGrid items={items} />
          </>
        ) : <Text style={{ color: t.muted, textAlign: 'center', marginTop: 24 }}>לא נמצאו תוצאות עבור “{q}”. נסו ניסוח אחר, בעברית או באנגלית.</Text>}
    </ScrollView>
  );
}
