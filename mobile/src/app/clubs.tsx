import { router } from 'expo-router';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { ErrorState } from '../components/ErrorState';
import { useClubs } from '../lib/clubs';
import { useTheme } from '../lib/theme';
import { useMeta } from '../lib/useMeta';

export default function Clubs() {
  const t = useTheme();
  const { meta, error, retry } = useMeta();
  const { myClubs, toggle } = useClubs();
  if (error) return <ErrorState message={error} onRetry={retry} />;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
      <Text style={{ color: t.muted, marginBottom: 6 }}>סמנו את המועדונים שאתם חברים בהם, וההנחות שלהם ייכנסו לחישוב המחיר.</Text>
      {meta?.clubs.map((c) => (
        <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: t.card, borderRadius: 12, padding: 14,
          borderWidth: 1, borderColor: t.line }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.ink, fontWeight: '700', fontSize: 16 }}>{c.name}</Text>
            <Text style={{ color: t.muted, fontSize: 13 }}>{c.description}</Text>
            {c.eligibility ? <Text style={{ color: t.muted, fontSize: 12, marginTop: 2 }}>זכאות: {c.eligibility}</Text> : null}
          </View>
          <Switch value={myClubs.includes(c.id)} onValueChange={() => toggle(c.id)} trackColor={{ true: t.brand }} />
        </View>
      ))}
      <Pressable onPress={() => router.back()} style={{ backgroundColor: t.brand, borderRadius: 999, padding: 12, alignItems: 'center', marginTop: 8 }}>
        <Text style={{ color: '#fff', fontWeight: '700' }}>שמירה</Text>
      </Pressable>
    </ScrollView>
  );
}
