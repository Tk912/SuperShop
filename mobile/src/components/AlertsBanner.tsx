import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFavorites } from '../lib/favorites';
import { useTheme } from '../lib/theme';

// הפעלת התראות push על ירידת מחיר.
export function AlertsBanner() {
  const t = useTheme();
  const { alerts, enableAlerts } = useFavorites();
  const [busy, setBusy] = useState(false);

  if (alerts.status === 'on') {
    return (
      <View style={[styles.box, { backgroundColor: t.goodSoft, borderColor: t.good }]}>
        <Text style={{ color: t.good, fontWeight: '700' }}>🔔 התראות פעילות</Text>
        <Text style={{ color: t.muted, fontSize: 13 }}>נשלח התראה כשהמחיר מגיע ליעד, או יורד ב-3% לפחות ממחיר השמירה.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.box, { backgroundColor: t.card, borderColor: t.line }]}>
      <Text style={{ color: t.ink, fontWeight: '700' }}>🔔 רוצים לדעת כשהמחיר יורד?</Text>
      <Text style={{ color: t.muted, fontSize: 13 }}>נבדוק את המחירים בשבילכם כמה פעמים ביום ונשלח התראה.</Text>
      {alerts.status === 'unavailable' && <Text style={{ color: t.warn, fontSize: 13 }}>{alerts.message}</Text>}
      <Pressable disabled={busy} onPress={async () => { setBusy(true); await enableAlerts(); setBusy(false); }}
        style={[styles.btn, { backgroundColor: t.brand, opacity: busy ? 0.7 : 1 }]} accessibilityRole="button">
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>הפעלת התראות</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 6, marginBottom: 6 },
  btn: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8, marginTop: 4, minWidth: 120, alignItems: 'center' },
});
