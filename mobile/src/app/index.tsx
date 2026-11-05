import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ClubChips } from '../components/ClubChips';
import { ErrorState } from '../components/ErrorState';
import { ProductGrid } from '../components/ProductGrid';
import { SearchBox } from '../components/SearchBox';
import { useTheme } from '../lib/theme';
import { useMeta } from '../lib/useMeta';

export default function Home() {
  const t = useTheme();
  const { meta, error, retry } = useMeta();

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}>
      <View style={styles.hero}>
        <Text style={[styles.h1, { color: t.ink }]}>המחיר האמיתי, עד הדלת</Text>
        <Text style={[styles.sub, { color: t.muted }]}>
          משווים חנויות בישראל ובחו״ל כולל מועדונים, קופונים, משלוח, מע״מ ומכס
        </Text>
      </View>

      <SearchBox />

      {error ? <ErrorState message={error} onRetry={retry} /> : !meta ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={t.brand} />
      ) : (
        <>
          <View style={{ gap: 6 }}>
            <Text style={[styles.label, { color: t.muted }]}>המועדונים שלי</Text>
            <ClubChips clubs={meta.clubs} />
          </View>
          <View style={{ gap: 10 }}>
            <Text style={[styles.h2, { color: t.ink }]}>פופולרי עכשיו</Text>
            <ProductGrid items={meta.popular} />
          </View>
        </>
      )}
      <Text style={[styles.disclaimer, { color: t.muted }]}>
        המחירים, ההנחות והקופונים הם נתוני דוגמה עד חיבור ספקי מידע חיים. חישוב המסים הוא הערכה בלבד.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 20, paddingBottom: 48 },
  hero: { alignItems: 'center', gap: 6, paddingTop: 8 },
  h1: { fontSize: 28, fontWeight: '800', textAlign: 'center' },
  sub: { fontSize: 15, textAlign: 'center' },
  h2: { fontSize: 18, fontWeight: '700' },
  label: { fontSize: 13 },
  disclaimer: { fontSize: 12, textAlign: 'center' },
});
