import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { api, imageUrl, type ProductSummary } from '../lib/api';
import { catName, RLM, useTheme } from '../lib/theme';

// תיבת חיפוש עם השלמה אוטומטית ותמונות קטלוג.
export function SearchBox({ initial = '', autoFocus = false }: { initial?: string; autoFocus?: boolean }) {
  const t = useTheme();
  const [q, setQ] = useState(initial);
  const [items, setItems] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!q.trim()) return;
    const timer = setTimeout(() => {
      ctrl.current?.abort();
      const c = new AbortController();
      ctrl.current = c;
      setLoading(true);
      api.suggest(q, c.signal)
        .then((r) => { if (!c.signal.aborted) setItems(r); })
        .catch(() => {})
        .finally(() => { if (!c.signal.aborted) setLoading(false); });
    }, 150);
    return () => clearTimeout(timer);
  }, [q]);

  const pick = (p: ProductSummary) => {
    Keyboard.dismiss(); setOpen(false); setQ(p.name);
    router.push({ pathname: '/product/[id]', params: { id: p.id } });
  };
  const submit = () => {
    if (!q.trim()) return;
    Keyboard.dismiss(); setOpen(false);
    router.push({ pathname: '/search', params: { q: q.trim() } });
  };

  return (
    <View style={styles.wrap}>
      <View style={[styles.box, { backgroundColor: t.card, borderColor: open ? t.brand : t.line }]}>
        <Text style={styles.icon}>🔍</Text>
        <TextInput
          value={q}
          onChangeText={(v) => { setQ(v); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onSubmitEditing={submit}
          placeholder="מה מחפשים? אוזניות סוני, אייפון…"
          placeholderTextColor={t.muted}
          returnKeyType="search"
          autoFocus={autoFocus}
          autoCorrect={false}
          style={[styles.input, { color: t.ink }]}
          accessibilityLabel="חיפוש מוצר"
        />
        {loading ? <ActivityIndicator color={t.brand} /> : q ? (
          <Pressable onPress={() => { setQ(''); setItems([]); }} hitSlop={10} accessibilityLabel="ניקוי">
            <Text style={{ color: t.muted, fontSize: 18 }}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      {open && q.trim() !== '' && (
        <View style={[styles.list, { backgroundColor: t.card, borderColor: t.line }]}>
          {items.map((p) => (
            <Pressable key={p.id} onPress={() => pick(p)}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: t.brandSoft }]}>
              <Image source={{ uri: imageUrl(p.image) }} style={[styles.thumb, { backgroundColor: t.bg }]} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: t.ink }]} numberOfLines={1}>{p.name}</Text>
                <Text style={{ color: t.muted, fontSize: 13 }}>{RLM}{p.brand} · {catName(p.category)}</Text>
              </View>
            </Pressable>
          ))}
          <Pressable onPress={submit} style={({ pressed }) => [styles.row, styles.searchAll, { borderTopColor: t.line },
            pressed && { backgroundColor: t.brandSoft }]} accessibilityRole="search">
            <Text style={{ fontSize: 18 }}>🛒</Text>
            <Text style={{ color: t.brand, fontWeight: '700', flex: 1 }} numberOfLines={1}>חיפוש “{q.trim()}” בכל החנויות</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { zIndex: 10 },
  box: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 2, borderRadius: 999, paddingHorizontal: 14, height: 50 },
  icon: { fontSize: 16 },
  input: { flex: 1, fontSize: 16, height: '100%', ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}) },
  list: { position: 'absolute', top: 56, start: 0, end: 0, borderWidth: 1, borderRadius: 14, padding: 6,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, borderRadius: 10 },
  thumb: { width: 48, height: 48, borderRadius: 8 },
  name: { fontWeight: '600', fontSize: 15 },
  searchAll: { borderTopWidth: StyleSheet.hairlineWidth, borderRadius: 0, paddingVertical: 12 },
});
