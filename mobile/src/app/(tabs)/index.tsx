import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { ErrorState } from '../../components/ErrorState';
import { api, type HubItem, type HubResponse } from '../../lib/api';
import { useClubAccounts } from '../../lib/clubAccounts';
import { useClubs } from '../../lib/clubs';
import { RLM, useTheme, type Theme } from '../../lib/theme';
import { useMeta } from '../../lib/useMeta';

// מרכז ההטבות: כל ההטבות על מוצרים (אופנה, נעליים, חשמל, בית...) מכל המועדונים, במקום אחד.
type Region = 'all' | 'il' | 'intl';
const REGIONS: { id: Region; label: string }[] = [{ id: 'all', label: 'הכול' }, { id: 'il', label: '🇮🇱 בארץ' }, { id: 'intl', label: '🌍 אתרים בחו״ל' }];

export default function Hub() {
  const t = useTheme();
  const { myClubs } = useClubs();
  const { accounts } = useClubAccounts();
  const { meta } = useMeta();
  const mine = useMemo(() => [...new Set([...myClubs, ...Object.keys(accounts)])], [myClubs, accounts]);

  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [region, setRegion] = useState<Region>('all');
  const [category, setCategory] = useState<string | null>(null);
  const [onlyMine, setOnlyMine] = useState(false);
  const [data, setData] = useState<HubResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [more, setMore] = useState(false);

  // חיפוש: מחכים שהמשתמש יפסיק להקליד
  useEffect(() => {
    const h = setTimeout(() => setTerm(q), 350);
    return () => clearTimeout(h);
  }, [q]);

  const query = useMemo(() => ({
    clubs: onlyMine ? mine : undefined, category: category ?? undefined, region: region === 'all' ? undefined : region, q: term,
  }), [onlyMine, mine, category, region, term]);

  const req = useRef(0);
  const load = useCallback(async () => {
    const id = ++req.current;
    try {
      const r = await api.hub(query);
      if (id === req.current) { setData(r); setError(null); }
    } catch (e) {
      if (id === req.current) setError(String((e as Error).message ?? e));
    }
  }, [query]);

  // טעינה מחדש בכל שינוי מסנן (תשובה ישנה שמגיעה מאוחר לא דורסת חדשה)
  useEffect(() => {
    const id = ++req.current;
    api.hub(query)
      .then((r) => { if (id === req.current) { setData(r); setError(null); } })
      .catch((e) => { if (id === req.current) setError(String(e.message ?? e)); });
  }, [query]);

  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
  const loadMore = async () => {
    if (!data || more || data.items.length >= data.total) return;
    setMore(true);
    try {
      const r = await api.hub({ ...query, offset: data.items.length });
      setData((cur) => (cur ? { ...cur, items: [...cur.items, ...r.items.filter((i) => !cur.items.some((c) => c.id === i.id))] } : r));
    } catch { /* ננסה שוב בגלילה הבאה */ } finally { setMore(false); }
  };

  const header = (
    <View style={{ gap: 12, paddingBottom: 4 }}>
      <View style={{ gap: 2 }}>
        <Text style={[styles.h1, { color: t.ink }]}>כל ההטבות שלך, במקום אחד</Text>
        <Text style={{ color: t.muted }}>מבצעים והנחות על מוצרים מכל המועדונים: בהצדעה, פיס, קרנות השוטרים ועוד</Text>
      </View>
      <TextInput value={q} onChangeText={setQ} placeholder="חיפוש רשת או מוצר (למשל פוקס, נעליים)" placeholderTextColor={t.muted}
        style={[styles.search, { color: t.ink, borderColor: t.line, backgroundColor: t.card }]} accessibilityLabel="חיפוש הטבה" returnKeyType="search" />
      <View style={styles.row}>
        {REGIONS.map((r) => (
          <Chip key={r.id} t={t} on={region === r.id} onPress={() => setRegion(r.id)}
            label={`${r.label}${r.id !== 'all' && data ? ` (${data.regions[r.id]})` : ''}`} />
        ))}
      </View>
      {!!data?.categories.length && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          <Chip t={t} on={!category} onPress={() => setCategory(null)} label="כל הקטגוריות" />
          {data.categories.map((c) => (
            <Chip key={c.id} t={t} on={category === c.id} onPress={() => setCategory(category === c.id ? null : c.id)} label={`${c.name} (${c.count})`} />
          ))}
        </ScrollView>
      )}
      {mine.length > 0 && (
        <View style={[styles.invite, { backgroundColor: t.card, borderColor: t.line, gap: 8 }]}>
          <Text style={{ color: t.ink, fontWeight: '700' }}>🔑 המועדונים שלי</Text>
          {mine.map((id) => {
            const name = meta?.clubs.find((c) => c.id === id)?.name ?? id;
            const acc = accounts[id];
            const share = acc?.share;
            const status = !acc
              ? 'עוד לא יובאו הטבות – התחברו לחשבון ←'
              : !share ? `יובאו ${acc.items.length} הטבות · שולח למרכז…`
                : 'error' in share ? 'השליחה למרכז נכשלה – לפרטים ←'
                  : `${share.inHub} הטבות על מוצרים במרכז (מתוך ${acc.items.length} שיובאו)`;
            return (
              <Pressable key={id} onPress={() => (acc ? router.push('/clubs') : router.push({ pathname: '/club-connect/[id]', params: { id } }))}
                style={[styles.row, { justifyContent: 'space-between' }]}>
                <Text style={{ color: t.ink, flexShrink: 1 }} numberOfLines={1}>{name}</Text>
                <Text style={{ color: !acc || (share && 'error' in share) ? t.brand : t.muted, fontSize: 12, flexShrink: 1 }} numberOfLines={2}>{status}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
      {mine.length > 0 ? (
        <View style={[styles.row, { justifyContent: 'space-between' }]}>
          <Text style={{ color: t.ink }}>רק מהמועדונים שלי ({mine.length})</Text>
          <Switch value={onlyMine} onValueChange={setOnlyMine} trackColor={{ true: t.brand }} accessibilityLabel="רק מהמועדונים שלי" />
        </View>
      ) : (
        <Pressable onPress={() => router.push('/clubs')} style={[styles.invite, { backgroundColor: t.brandSoft, borderColor: t.brand }]}>
          <Text style={{ color: t.ink, fontWeight: '700' }}>🔑 חברים במועדון הטבות?</Text>
          <Text style={{ color: t.muted, fontSize: 13 }}>התחברו פעם אחת לחשבון, וכל ההטבות שלכם יופיעו כאן. ההטבות על מוצרים נכנסות למרכז לטובת כל המשתמשים.</Text>
          <Text style={{ color: t.brand, fontWeight: '700' }}>חיבור מועדון ←</Text>
        </Pressable>
      )}
      {data && <Text style={{ color: t.muted, fontSize: 12 }}>{data.total} הטבות</Text>}
    </View>
  );

  if (error && !data) return <ErrorState message={error} onRetry={load} />;
  return (
    <FlatList
      data={data?.items ?? []}
      keyExtractor={(i) => i.id}
      renderItem={({ item }) => <DealCard item={item} t={t} />}
      ListHeaderComponent={header}
      ListEmptyComponent={!data ? <ActivityIndicator style={{ marginTop: 40 }} color={t.brand} /> : <Empty t={t} filtered={!!(term || category || region !== 'all' || onlyMine)} />}
      ListFooterComponent={more ? <ActivityIndicator color={t.brand} style={{ margin: 16 }} /> : undefined}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={t.brand} />}
      contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled"
    />
  );
}

function Chip({ t, on, label, onPress }: { t: Theme; on: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }}
      style={[styles.chip, { borderColor: on ? t.brand : t.line, backgroundColor: on ? t.brand : t.card }]}>
      <Text style={{ color: on ? '#fff' : t.ink, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

const ago = (iso?: string) => {
  if (!iso) return null;
  const d = Math.round((Date.now() - new Date(iso).getTime()) / 864e5);
  return d < 1 ? 'עודכן היום' : d === 1 ? 'עודכן אתמול' : `עודכן לפני ${d} ימים`;
};

function DealCard({ item: i, t }: { item: HubItem; t: Theme }) {
  const meta = [
    i.clubName ?? (i.kind === 'coupon' ? 'קופון פתוח לכולם' : null),
    i.minSpend ? `בקנייה מעל ₪${i.minSpend}` : null,
    i.kind === 'shared' ? ago(i.lastSeen) : null,
    i.seenBy && i.seenBy > 1 ? `${i.seenBy} חברים ראו` : null,
  ].filter(Boolean).join(' · ');
  return (
    <Pressable onPress={() => i.link && Linking.openURL(i.link)} disabled={!i.link}
      style={[styles.card, { backgroundColor: t.card, borderColor: t.line }]} accessibilityRole={i.link ? 'link' : undefined}>
      <View style={[styles.badge, { backgroundColor: i.region === 'intl' ? t.intlSoft : t.brandSoft }]}>
        {i.image ? <Image source={{ uri: i.image }} style={styles.thumb} contentFit="contain" /> : null}
        <Text style={{ color: i.region === 'intl' ? t.intl : t.brand, fontWeight: '900', fontSize: i.discount.length > 5 ? 15 : 20 }}>{i.discount}</Text>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ color: t.ink, fontWeight: '800', fontSize: 16 }} numberOfLines={1}>{RLM}{i.store}{i.region === 'intl' ? ' 🌍' : ''}</Text>
        <Text style={{ color: t.ink, fontSize: 14 }} numberOfLines={3}>{RLM}{i.text || i.title}</Text>
        {i.code ? <Text style={{ color: t.good, fontWeight: '700' }}>קוד: {i.code}</Text> : null}
        {meta ? <Text style={{ color: t.muted, fontSize: 12 }} numberOfLines={1}>{meta}</Text> : null}
        {i.status === 'sample' ? <Text style={{ color: t.warn, fontSize: 11 }}>נתון לדוגמה</Text> : null}
      </View>
    </Pressable>
  );
}

function Empty({ t, filtered }: { t: Theme; filtered: boolean }) {
  return (
    <View style={{ alignItems: 'center', gap: 8, paddingVertical: 32 }}>
      <Text style={{ fontSize: 36 }}>🛍️</Text>
      <Text style={{ color: t.ink, fontWeight: '700', textAlign: 'center' }}>{filtered ? 'לא נמצאו הטבות לבחירה הזו' : 'עוד אין כאן הטבות'}</Text>
      <Text style={{ color: t.muted, textAlign: 'center' }}>
        {filtered ? 'נסו קטגוריה אחרת או נקו את החיפוש.' : 'המרכז מתמלא מהמועדונים שחברים מחברים לאפליקציה. חברו את המועדון שלכם – וההטבות על מוצרים יופיעו כאן לכולם.'}
      </Text>
      {!filtered && (
        <Pressable onPress={() => router.push('/clubs')} style={[styles.cta, { backgroundColor: t.brand }]}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>חיבור מועדון</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 24, fontWeight: '800' },
  search: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'nowrap' },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  invite: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 4 },
  card: { flexDirection: 'row', gap: 12, borderWidth: 1, borderRadius: 14, padding: 12, alignItems: 'center' },
  badge: { width: 76, minHeight: 76, borderRadius: 12, alignItems: 'center', justifyContent: 'center', padding: 4, gap: 2 },
  thumb: { width: 44, height: 28 },
  cta: { borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10, marginTop: 4 },
});
