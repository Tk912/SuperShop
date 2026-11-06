import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { imageUrl, type ProductSummary } from '../lib/api';
import { money, useTheme } from '../lib/theme';

export function ProductGrid({ items }: { items: ProductSummary[] }) {
  const t = useTheme();
  return (
    <View style={styles.grid}>
      {items.map((p) => (
        <Link key={p.id} href={{ pathname: '/product/[id]', params: { id: p.id } }} asChild>
          <Pressable style={StyleSheet.flatten([styles.tile, { backgroundColor: t.card, borderColor: t.line }])}>
            <Image source={{ uri: imageUrl(p.image) }} style={[styles.img, { backgroundColor: t.bg }]} contentFit="contain" />
            <Text style={[styles.name, { color: t.ink }]} numberOfLines={2}>{p.name}</Text>
            {p.fromPrice != null && (
              <Text style={{ color: t.muted, fontSize: 12, textAlign: 'center' }} numberOfLines={1}>
                החל מ-<Text style={{ color: t.good, fontWeight: '700' }}>{money(p.fromPrice, p.fromCurrency ?? 'ILS')}</Text>
                {p.fromStore ? ` · ${p.fromStore}` : ''}
              </Text>
            )}
          </Pressable>
        </Link>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { width: '47%', flexGrow: 1, maxWidth: 220, borderWidth: 1, borderRadius: 14, padding: 10, alignItems: 'center', gap: 8 },
  img: { width: '100%', aspectRatio: 1, borderRadius: 10 },
  name: { fontSize: 14, textAlign: 'center', minHeight: 38 },
});
