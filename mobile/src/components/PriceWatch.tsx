import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { OffersResponse } from '../lib/api';
import { useFavorites } from '../lib/favorites';
import { ils, useTheme } from '../lib/theme';

// כרטיס בדף המוצר: שמירה למועדפים, מחיר יעד להתראה, וסיכום היסטוריית המחירים.
export function PriceWatch({ data }: { data: OffersResponse }) {
  const t = useTheme();
  const { isFavorite, toggle, favorites, setTarget } = useFavorites();
  const p = data.product;
  const current = data.offers.find((o) => o.inStock)?.totalIls ?? null;
  const fav = favorites.find((f) => f.id === p.id);
  const [draft, setDraft] = useState(fav?.targetIls ? String(fav.targetIls) : '');
  const h = data.history;

  const saveTarget = () => {
    const n = Number(draft.replace(/[^\d.]/g, ''));
    setTarget(p.id, n > 0 ? n : undefined);
  };

  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.line }]}>
      <View style={styles.row}>
        <Pressable
          onPress={() => toggle({ id: p.id, name: p.name, image: p.image, savedTotalIls: current })}
          accessibilityRole="button" accessibilityState={{ selected: isFavorite(p.id) }}
          style={[styles.heart, { borderColor: isFavorite(p.id) ? t.brand : t.line, backgroundColor: isFavorite(p.id) ? t.brandSoft : t.card }]}>
          <Text style={{ color: t.brand, fontWeight: '700' }}>{isFavorite(p.id) ? '♥ במעקב' : '♡ מעקב מחיר'}</Text>
        </Pressable>
        {h && h.points.length > 1 && h.lowest && (
          <Text style={{ color: t.muted, fontSize: 13, flex: 1 }}>
            הכי זול ב-{h.days} יום: <Text style={{ color: t.good, fontWeight: '700' }}>{ils(h.lowest.p)}</Text> ({h.lowest.s})
          </Text>
        )}
        {h && h.points.length <= 1 && data.mode === 'live' && (
          <Text style={{ color: t.muted, fontSize: 12, flex: 1 }}>היסטוריית המחירים תתחיל להצטבר מהיום</Text>
        )}
      </View>

      {fav && (
        <View style={styles.row}>
          <Text style={{ color: t.ink }}>התראה כשהמחיר יורד מתחת ל-₪</Text>
          <TextInput
            value={draft} onChangeText={setDraft} onEndEditing={saveTarget} onSubmitEditing={saveTarget} onBlur={saveTarget}
            keyboardType="numeric" placeholder={current ? String(Math.round(current * 0.9)) : ''} placeholderTextColor={t.muted}
            style={[styles.input, { color: t.ink, borderColor: t.line, backgroundColor: t.bg }]} accessibilityLabel="מחיר יעד"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  heart: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, minWidth: 90, fontSize: 15 },
});
