import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ClubChips } from '../../components/ClubChips';
import { ErrorState } from '../../components/ErrorState';
import { ProductGrid } from '../../components/ProductGrid';
import { SearchBox } from '../../components/SearchBox';
import { useTheme } from '../../lib/theme';
import { useFavorites } from '../../lib/favorites';
import { useMeta } from '../../lib/useMeta';

export default function Home() {
  const t = useTheme();
  const { meta, error, retry } = useMeta();
  const { favorites } = useFavorites();

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}>
      <View style={styles.hero}>
        <Image source={require('../../../assets/icon.png')} style={styles.logo} accessibilityLabel="הלוגו של SuperShop" />
        <Text style={[styles.h1, { color: t.ink }]}>המחיר האמיתי, עד הדלת</Text>
        <Text style={[styles.sub, { color: t.muted }]}>
          משווים חנויות בישראל ובחו״ל כולל מועדונים, קופונים, משלוח, מע״מ ומכס
        </Text>
      </View>

      <SearchBox />

      <View style={styles.actions}>
        <Link href="/scan" asChild>
          <Pressable style={StyleSheet.flatten([styles.action, { backgroundColor: t.card, borderColor: t.line }])}>
            <Text style={styles.actionIcon}>📷</Text>
            <Text style={{ color: t.ink, fontWeight: '600' }}>סריקת ברקוד</Text>
          </Pressable>
        </Link>
        <Link href="/favorites" asChild>
          <Pressable style={StyleSheet.flatten([styles.action, { backgroundColor: t.card, borderColor: t.line }])}>
            <Text style={styles.actionIcon}>♡</Text>
            <Text style={{ color: t.ink, fontWeight: '600' }}>במעקב{favorites.length ? ` (${favorites.length})` : ''}</Text>
          </Pressable>
        </Link>
      </View>

      {error ? <ErrorState message={error} onRetry={retry} /> : !meta ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={t.brand} />
      ) : (
        <>
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={[styles.label, { color: t.muted }]}>המועדונים שלי</Text>
              <Link href="/clubs"><Text style={[styles.label, { color: t.brand }]}>חיבור וסנכרון הטבות ←</Text></Link>
            </View>
            <ClubChips clubs={meta.clubs} />
          </View>
          <View style={{ gap: 10 }}>
            <Text style={[styles.h2, { color: t.ink }]}>פופולרי עכשיו</Text>
            <ProductGrid items={meta.popular} />
          </View>
        </>
      )}
      <Text style={[styles.disclaimer, { color: t.muted }]}>
        {meta?.mode === 'live'
          ? 'מחירים חיים מ-Google Shopping. הנחות מועדונים וקופונים עוד לא מחוברות. חישוב המסים הוא הערכה בלבד.'
          : 'המחירים, ההנחות והקופונים הם נתוני דוגמה עד חיבור ספקי מידע חיים. חישוב המסים הוא הערכה בלבד.'}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 20, paddingBottom: 48 },
  hero: { alignItems: 'center', gap: 6, paddingTop: 8 },
  logo: { width: 72, height: 72, borderRadius: 18, marginBottom: 6 },
  h1: { fontSize: 28, fontWeight: '800', textAlign: 'center' },
  sub: { fontSize: 15, textAlign: 'center' },
  h2: { fontSize: 18, fontWeight: '700' },
  label: { fontSize: 13 },
  actions: { flexDirection: 'row', gap: 10 },
  action: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 14, paddingVertical: 12 },
  actionIcon: { fontSize: 18 },
  disclaimer: { fontSize: 12, textAlign: 'center' },
});
