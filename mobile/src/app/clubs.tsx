import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { ErrorState } from '../components/ErrorState';
import { api, type ClubBenefit, type ClubInfo } from '../lib/api';
import { useClubs } from '../lib/clubs';
import { RLM, useTheme, type Theme } from '../lib/theme';

// חיבור למועדונים: מסמנים חברות (נשמר רק במכשיר), והאפליקציה מסנכרנת מהשרת את ההטבות המאומתות של המועדון.
// אין התחברות לחשבון במועדון: למועדונים אין ממשק לאפליקציות חיצוניות, ואנחנו לא שומרים ת"ז או סיסמאות.
const CACHE = 'clubBenefits:v1';
type Synced = { syncedAt: string; benefits: ClubBenefit[] };

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 1 ? 'עכשיו' : m < 60 ? `לפני ${m} דק׳` : m < 1440 ? `לפני ${Math.round(m / 60)} שע׳` : `לפני ${Math.round(m / 1440)} ימים`;
};
const dmy = (d: string | null) => (d ? d.split('-').reverse().slice(0, 2).join('.') : '');

export default function Clubs() {
  const t = useTheme();
  const { myClubs, toggle } = useClubs();
  const [clubs, setClubs] = useState<ClubInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [synced, setSynced] = useState<Record<string, Synced>>({});
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});

  const load = useCallback(() => {
    api.clubs().then((r) => { setClubs(r.clubs); setError(null); }).catch((e) => setError(String(e.message ?? e)));
  }, []);

  const store = useCallback((id: string, r: Synced) => setSynced((cur) => {
    const next = { ...cur, [id]: r };
    AsyncStorage.setItem(CACHE, JSON.stringify(next)).catch(() => {});
    return next;
  }), []);

  // סנכרון יזום (לחיצה / חיבור מועדון) – עם מחוון טעינה
  const sync = useCallback(async (id: string) => {
    setSyncing((s) => ({ ...s, [id]: true }));
    try {
      const r = await api.clubBenefits(id);
      store(id, { syncedAt: r.syncedAt, benefits: r.benefits });
    } catch { /* נשארים עם הסנכרון האחרון */ } finally {
      setSyncing((s) => ({ ...s, [id]: false }));
    }
  }, [store]);

  useEffect(() => {
    load();
    AsyncStorage.getItem(CACHE).then((v) => { if (v) setSynced(JSON.parse(v)); }).catch(() => {});
  }, [load]);

  // בכל פתיחה: סנכרון של המועדונים המחוברים
  const connectedKey = myClubs.join(',');
  useEffect(() => {
    let live = true;
    for (const id of connectedKey.split(',').filter(Boolean)) {
      api.clubBenefits(id).then((r) => { if (live) store(id, { syncedAt: r.syncedAt, benefits: r.benefits }); }).catch(() => {});
    }
    return () => { live = false; };
  }, [connectedKey, store]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!clubs) return <ActivityIndicator style={{ marginTop: 40 }} color={t.brand} />;

  const sorted = [...clubs].sort((a, b) => Number(b.primary) - Number(a.primary));
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
      <Text style={{ color: t.muted }}>
        חברים במועדון? חברו אותו, וההטבות המאומתות שלו יסונכרנו ויחושבו אוטומטית במחיר עד הבית.
      </Text>
      {sorted.map((c) => (
        <ClubCard key={c.id} club={c} t={t} connected={myClubs.includes(c.id)} onToggle={() => {
          const connecting = !myClubs.includes(c.id);
          toggle(c.id);
          if (connecting) sync(c.id);
        }} synced={synced[c.id]} syncing={!!syncing[c.id]} onSync={() => sync(c.id)} />
      ))}
      <Text style={{ color: t.muted, fontSize: 12, textAlign: 'center' }}>
        החברות במועדון נשמרת רק במכשיר שלכם. לא נדרשים ולא נשמרים מספר תעודת זהות או סיסמה.
      </Text>
    </ScrollView>
  );
}

function ClubCard({ club: c, t, connected, onToggle, synced, syncing, onSync }: {
  club: ClubInfo; t: Theme; connected: boolean; onToggle: () => void; synced?: Synced; syncing: boolean; onSync: () => void;
}) {
  const [suggesting, setSuggesting] = useState(false);
  const site = c.sources.find((s) => s.access === 'login') ?? c.sources[0];
  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: connected ? t.brand : t.line }]}>
      <View style={styles.row}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: t.ink, fontWeight: '800', fontSize: 17 }}>{c.name}</Text>
          <Text style={{ color: t.muted, fontSize: 13 }}>{c.description}</Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Switch value={connected} onValueChange={onToggle} trackColor={{ true: t.brand }} accessibilityLabel={`חיבור ${c.name}`} />
          <Text style={{ color: connected ? t.brand : t.muted, fontSize: 11 }}>{connected ? 'מחובר' : 'לא מחובר'}</Text>
        </View>
      </View>
      {c.eligibility ? <Text style={{ color: t.muted, fontSize: 12 }}>זכאות: {c.eligibility}</Text> : null}
      {c.payment ? <Text style={{ color: t.muted, fontSize: 12 }}>💳 {c.payment}</Text> : null}

      {connected && (
        <View style={[styles.sync, { backgroundColor: t.bg }]}>
          <View style={styles.row}>
            <Text style={{ color: t.ink, fontWeight: '700', flex: 1 }}>
              {synced ? `${synced.benefits.length} הטבות פעילות` : 'מסנכרן הטבות…'}
            </Text>
            {syncing ? <ActivityIndicator color={t.brand} /> : (
              <Pressable onPress={onSync} hitSlop={8} accessibilityLabel="סנכרון הטבות">
                <Text style={{ color: t.brand, fontSize: 13 }}>↻ {synced ? `סונכרן ${ago(synced.syncedAt)}` : 'סנכרון'}</Text>
              </Pressable>
            )}
          </View>
          {synced?.benefits.map((b) => (
            <View key={b.id} style={styles.benefit}>
              <Text style={{ color: t.good, fontWeight: '700' }}>✓ {RLM}{b.label} ב-{b.storeName}</Text>
              <Text style={{ color: t.muted, fontSize: 12 }}>
                {[b.minSpend ? `בקנייה מעל ₪${b.minSpend}` : null, b.expires ? `בתוקף עד ${dmy(b.expires)}` : null,
                  b.verifiedAt ? `אומת ${dmy(b.verifiedAt)}` : null, b.stackableWithCoupon ? 'משתלב עם קופון' : null].filter(Boolean).join(' · ')}
              </Text>
            </View>
          ))}
          {synced && !synced.benefits.length && (
            <Text style={{ color: t.muted, fontSize: 13 }}>עוד אין הטבות מאומתות של המועדון בחנויות שבהשוואה. מצאתם אחת? שלחו לנו ↓</Text>
          )}
        </View>
      )}

      <View style={[styles.row, { flexWrap: 'wrap' }]}>
        {site && (
          <Pressable onPress={() => Linking.openURL(site.url)} style={[styles.btn, { borderColor: t.line }]}>
            <Text style={{ color: t.ink }}>🔗 לאתר המועדון</Text>
          </Pressable>
        )}
        <Pressable onPress={() => setSuggesting((x) => !x)} style={[styles.btn, { borderColor: t.line }]}>
          <Text style={{ color: t.ink }}>➕ מצאתי הטבה</Text>
        </Pressable>
      </View>
      {suggesting && <SuggestForm clubId={c.id} t={t} onDone={() => setSuggesting(false)} />}
    </View>
  );
}

function SuggestForm({ clubId, t, onDone }: { clubId: string; t: Theme; onDone: () => void }) {
  const [store, setStore] = useState('');
  const [discount, setDiscount] = useState('');
  const [link, setLink] = useState('');
  const [state, setState] = useState<{ kind: 'idle' | 'sending' | 'sent' } | { kind: 'error'; message: string }>({ kind: 'idle' });

  if (state.kind === 'sent') {
    return <Text style={{ color: t.good }}>תודה! ההטבה נשלחה לבדיקה, ותופיע אחרי שנאמת אותה מול המועדון.</Text>;
  }
  const input = [styles.input, { color: t.ink, borderColor: t.line, backgroundColor: t.bg }];
  const submit = async () => {
    setState({ kind: 'sending' });
    try {
      await api.suggestBenefit(clubId, { store, discount, link: link.trim() || undefined });
      setState({ kind: 'sent' });
      setTimeout(onDone, 2500);
    } catch (e) { setState({ kind: 'error', message: String((e as Error).message ?? e) }); }
  };
  return (
    <View style={{ gap: 8 }}>
      <TextInput value={store} onChangeText={setStore} placeholder="חנות (למשל KSP)" placeholderTextColor={t.muted} style={input} accessibilityLabel="חנות" />
      <TextInput value={discount} onChangeText={setDiscount} placeholder="ההטבה (למשל 5% על מוצרי חשמל)" placeholderTextColor={t.muted} style={input} accessibilityLabel="ההטבה" />
      <TextInput value={link} onChangeText={setLink} placeholder="קישור להטבה (לא חובה)" placeholderTextColor={t.muted} style={input}
        autoCapitalize="none" keyboardType="url" accessibilityLabel="קישור להטבה" />
      {state.kind === 'error' && <Text style={{ color: t.warn, fontSize: 13 }}>{state.message}</Text>}
      <Pressable disabled={!store.trim() || !discount.trim() || state.kind === 'sending'} onPress={submit}
        style={[styles.send, { backgroundColor: t.brand, opacity: !store.trim() || !discount.trim() ? 0.5 : 1 }]}>
        {state.kind === 'sending' ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>שליחה לבדיקה</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sync: { borderRadius: 10, padding: 10, gap: 8 },
  benefit: { gap: 1 },
  btn: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 15 },
  send: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8, minWidth: 120, alignItems: 'center' },
});
