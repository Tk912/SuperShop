import { Image } from 'expo-image';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { ErrorState } from '../../components/ErrorState';
import { OfferCard } from '../../components/OfferCard';
import { PriceWatch } from '../../components/PriceWatch';
import { api, imageUrl, type OffersResponse } from '../../lib/api';
import { useClubs } from '../../lib/clubs';
import { catName, ils, RLM, useTheme } from '../../lib/theme';

type Filter = 'all' | 'local' | 'intl';
const FILTERS: [Filter, string][] = [['all', 'הכל'], ['local', 'ישראל'], ['intl', 'חו״ל']];

export default function Product() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { myClubs, ready } = useClubs();
  const [data, setData] = useState<OffersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  const [attempt, setAttempt] = useState(0);
  const fetchOffers = useCallback(
    () => api.offers(id, myClubs).then((d) => { setData(d); setError(null); }).catch((e) => setError(String(e.message ?? e))),
    [id, myClubs],
  );

  // חישוב מחדש כשהמועדונים משתנים
  useEffect(() => { if (ready) fetchOffers(); }, [fetchOffers, ready, attempt]);

  const offers = useMemo(() => (data?.offers ?? []).filter((o) => filter === 'all' || o.storeType === filter), [data, filter]);

  if (error) return <ErrorState message={error} onRetry={() => { setError(null); setAttempt((x) => x + 1); }} />;
  if (!data) return <ActivityIndicator style={{ marginTop: 40 }} color={t.brand} />;

  const best = data.offers[0];
  const bestLocal = data.offers.find((o) => o.storeType === 'local');
  const bestIntl = data.offers.find((o) => o.storeType === 'intl');

  const header = (
    <View style={{ gap: 14, marginBottom: 12 }}>
      <View style={styles.head}>
        <Image source={{ uri: imageUrl(data.product.image) }} style={styles.img} contentFit="cover" />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[styles.title, { color: t.ink }]}>{data.product.name}</Text>
          <Text style={{ color: t.muted, fontSize: 13 }}>
            {RLM}{data.product.brand} · {catName(data.product.category)} · {data.product.weightEstimated ? 'משקל משוער' : 'משקל'} ~{data.product.weightKg} ק״ג · {data.offers.length} הצעות
          </Text>
        </View>
      </View>

      {best && (
        <View style={[styles.best, { backgroundColor: t.goodSoft, borderColor: t.good }]}>
          <Text style={{ color: t.ink }}>הכי משתלם עד הבית: <Text style={{ fontWeight: '700' }}>{best.storeName}</Text></Text>
          <Text style={[styles.bestAmt, { color: t.good }]}>{ils(best.totalIls)}</Text>
          {bestLocal && bestIntl && (
            <Text style={{ color: t.muted, fontSize: 13 }}>
              בארץ {ils(bestLocal.totalIls)} · מחו״ל {ils(bestIntl.totalIls)} · {bestIntl.totalIls < bestLocal.totalIls ? 'חו״ל' : 'בארץ'} זול
              ב-{ils(Math.abs(bestLocal.totalIls - bestIntl.totalIls))}
            </Text>
          )}
        </View>
      )}

      <PriceWatch key={data.product.id} data={data} />

      <Link href="/clubs" asChild>
        <Pressable style={StyleSheet.flatten([styles.clubsBtn, { borderColor: t.line, backgroundColor: t.card }])}>
          <Text style={{ color: t.ink, flex: 1 }}>
            🎖️ {myClubs.length ? `${myClubs.length} מועדונים מחוברים` : 'חברים במועדון הטבות? חברו אותו'}
            {data.deals ? '' : ' · הטבות מאומתות יחושבו כאן במחיר'}
          </Text>
          <Text style={{ color: t.brand }}>{myClubs.length ? 'ניהול' : 'חיבור'}</Text>
        </Pressable>
      </Link>

      {data.errors.length > 0 && <Text style={{ color: t.warn }}>חלק מהספקים לא הגיבו: {data.errors.map((e) => e.provider).join(', ')}</Text>}

      <View style={styles.tabs}>
        {FILTERS.map(([k, label]) => (
          <Pressable key={k} onPress={() => setFilter(k)} accessibilityRole="tab" accessibilityState={{ selected: filter === k }}
            style={[styles.tab, { borderColor: t.line, backgroundColor: filter === k ? t.ink : t.card }]}>
            <Text style={{ color: filter === k ? t.bg : t.ink }}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title: data.product.brand }} />
      <FlatList
        data={offers}
        keyExtractor={(o, i) => `${o.storeId}-${i}`}
        renderItem={({ item }) => <OfferCard o={item} isBest={item === best} deals={data.deals} />}
        ListHeaderComponent={header}
        ListEmptyComponent={<Text style={{ color: t.muted, textAlign: 'center' }}>
          {data.offers.length ? 'אין הצעות בסינון זה.' : 'לא נמצאו חנויות שמוכרות את המוצר כרגע.'}</Text>}
        ListFooterComponent={<Text style={{ color: t.muted, fontSize: 12, textAlign: 'center', marginTop: 8 }}>
          שער דולר ₪{data.fx.rates.USD.toFixed(3)} ({data.fx.source === 'live' ? 'עדכני' : 'קבוע'}) ·{' '}
          {data.mode === 'live' ? 'מחירים מ-Google Shopping, ייתכנו שינויים באתר החנות' : 'נתוני דוגמה'} · המסים הם הערכה
        </Text>}
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await fetchOffers(); setRefreshing(false); }} />}
      />
    </>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  img: { width: 88, height: 88, borderRadius: 14 },
  title: { fontSize: 20, fontWeight: '800' },
  best: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 4 },
  bestAmt: { fontSize: 30, fontWeight: '800' },
  clubsBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 12 },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 6 },
});
