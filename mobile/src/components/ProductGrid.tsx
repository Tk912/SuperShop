import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { imageUrl, type ProductSummary } from '../lib/api';
import { useTheme } from '../lib/theme';

export function ProductGrid({ items }: { items: ProductSummary[] }) {
  const t = useTheme();
  return (
    <View style={styles.grid}>
      {items.map((p) => (
        <Link key={p.id} href={{ pathname: '/product/[id]', params: { id: p.id } }} asChild>
          <Pressable style={StyleSheet.flatten([styles.tile, { backgroundColor: t.card, borderColor: t.line }])}>
            <Image source={{ uri: imageUrl(p.image) }} style={styles.img} contentFit="cover" />
            <Text style={[styles.name, { color: t.ink }]} numberOfLines={2}>{p.name}</Text>
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
