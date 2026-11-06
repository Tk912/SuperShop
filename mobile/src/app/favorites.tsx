import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { api, imageUrl } from '../lib/api';
import { priceAlert, useFavorites, type Favorite } from '../lib/favorites';
import { ils, useTheme } from '../lib/theme';

// המועדפים: בודק מחיר עדכני לכל מוצר ומסמן ירידות מחיר והגעה למחיר היעד.
export default function Favorites() {
  const t = useTheme();
  const { favorites, remove } = useFavorites();
  const [prices, setPrices] = useState<Record<string, number | null>>({});
  const [refreshing, setRefreshing] = useState(false);

  // בודקים לפי רשימת המזהים בלבד – שינוי מחיר יעד לא אמור לגרום לבדיקה מחדש
  const ids = favorites.map((f) => f.id).join(',');
  const fetchPrices = useCallback(() => Promise.all(ids.split(',').filter(Boolean).map(async (id) => {
    try {
      const r = await api.offers(id, []);
      return [id, r.offers.find((o) => o.inStock)?.totalIls ?? null] as const;
    } catch { return [id, null] as const; }
  })).then((entries) => Object.fromEntries(entries) as Record<string, number | null>), [ids]);

  useEffect(() => {
    let live = true;
    fetchPrices().then((p) => { if (live) setPrices(p); });
    return () => { live = false; };
  }, [fetchPrices]);
  const check = () => fetchPrices().then(setPrices);

  if (!favorites.length) {
    return (
      <View style={{ padding: 32, alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 40 }}>♡</Text>
        <Text style={{ color: t.ink, fontSize: 17, fontWeight: '700' }}>עדיין אין מוצרים במעקב</Text>
        <Text style={{ color: t.muted, textAlign: 'center' }}>בדף של מוצר לוחצים “מעקב מחיר”, ואפשר גם לקבוע מחיר יעד.</Text>
      </View>
    );
  }

  const renderItem = ({ item: f }: { item: Favorite }) => {
    const cur = prices[f.id];
    const a = priceAlert(f, cur ?? null);
    const tone = a.kind === 'target' || a.kind === 'drop' ? { fg: t.good, bg: t.goodSoft } : a.kind === 'rise' ? { fg: t.warn, bg: t.warnSoft } : null;
    return (
      <Link href={{ pathname: '/product/[id]', params: { id: f.id } }} asChild>
        <Pressable style={StyleSheet.flatten([styles.item, { backgroundColor: t.card, borderColor: a.kind === 'target' ? t.good : t.line }])}>
          <Image source={{ uri: imageUrl(f.image) }} style={styles.img} contentFit="cover" />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ color: t.ink, fontWeight: '700' }} numberOfLines={2}>{f.name}</Text>
            <Text style={{ color: t.muted, fontSize: 13 }}>
              עכשיו: <Text style={{ color: t.ink, fontWeight: '700' }}>{cur === undefined ? '…' : cur == null ? 'לא זמין' : ils(cur)}</Text>
              {f.savedTotalIls != null ? ` · כשנשמר: ${ils(f.savedTotalIls)}` : ''}
              {f.targetIls != null ? ` · יעד: ${ils(f.targetIls)}` : ''}
            </Text>
            {tone && (
              <View style={[styles.alert, { backgroundColor: tone.bg }]}>
                <Text style={{ color: tone.fg, fontWeight: '700', fontSize: 13 }}>
                  {a.kind === 'target' ? '🎯 הגיע למחיר היעד!' : a.kind === 'drop' ? `▼ ירד ב-${ils(a.diff!)}` : `▲ עלה ב-${ils(a.diff!)}`}
                </Text>
              </View>
            )}
          </View>
          <Pressable onPress={() => remove(f.id)} hitSlop={10} accessibilityLabel={`הסרת ${f.name} מהמעקב`}>
            <Text style={{ color: t.muted, fontSize: 18 }}>✕</Text>
          </Pressable>
        </Pressable>
      </Link>
    );
  };

  return (
    <FlatList
      data={favorites}
      keyExtractor={(f) => f.id}
      renderItem={renderItem}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      ListFooterComponent={<Text style={{ color: t.muted, fontSize: 12, textAlign: 'center', marginTop: 8 }}>
        המחירים נבדקים כשפותחים את המסך. משיכה למטה מרעננת.</Text>}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await check(); setRefreshing(false); }} />}
    />
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', gap: 12, alignItems: 'center', borderWidth: 1, borderRadius: 14, padding: 10 },
  img: { width: 64, height: 64, borderRadius: 10 },
  alert: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 },
});
