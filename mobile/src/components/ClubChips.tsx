import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import type { Club } from '../lib/api';
import { useClubs } from '../lib/clubs';
import { useTheme } from '../lib/theme';

export function ClubChips({ clubs }: { clubs: Club[] }) {
  const t = useTheme();
  const { myClubs, toggle } = useClubs();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {clubs.map((c) => {
        const on = myClubs.includes(c.id);
        return (
          <Pressable key={c.id} onPress={() => toggle(c.id)} accessibilityRole="switch" accessibilityState={{ checked: on }}
            style={[styles.chip, { borderColor: on ? t.brand : t.line, backgroundColor: on ? t.brand : t.card }]}>
            <Text style={{ color: on ? '#fff' : t.ink, fontSize: 14 }}>{on ? '✓ ' : ''}{c.name}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 4 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
});
