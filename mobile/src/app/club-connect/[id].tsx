import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ComponentType, type Ref } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView as RNWebView, type WebViewMessageEvent, type WebViewProps } from 'react-native-webview';
import { api, type ClubInfo } from '../../lib/api';
import { enrich, EXTRACT_BENEFITS_JS, type ExtractResult } from '../../lib/benefitExtractor';
import { useClubAccounts } from '../../lib/clubAccounts';
import { useTheme } from '../../lib/theme';
import { useMeta } from '../../lib/useMeta';

// הטיפוסים של הספרייה מגדירים WebView<P = undefined>, כך שהמאפיינים יוצאים never – עוטפים בטיפוס הנכון
type WebViewHandle = { injectJavaScript: (script: string) => void };
const WebView = RNWebView as unknown as ComponentType<WebViewProps & { ref?: Ref<WebViewHandle> }>;

// חיבור חשבון מועדון: אתר המועדון נפתח בתוך האפליקציה, המשתמש מתחבר בעצמו (פעם אחת – ההתחברות נשמרת
// בטלפון), עובר לעמוד ההטבות ולוחץ "ייבוא". במצב סנכרון (sync=1) האפליקציה עוברת לבד על העמודים שיובאו.
export default function ClubConnect() {
  const t = useTheme();
  const { id, sync } = useLocalSearchParams<{ id: string; sync?: string }>();
  const { meta } = useMeta();
  const { accounts, importPage } = useClubAccounts();
  const [club, setClub] = useState<ClubInfo | null>(null);
  const [status, setStatus] = useState<{ kind: 'info' | 'ok' | 'warn'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const web = useRef<WebViewHandle>(null);
  // במצב סנכרון: העמוד הראשון נטען, והשאר בתור (נקבע פעם אחת בפתיחת המסך)
  const [syncPages] = useState<string[]>(() => (sync === '1' ? [...(accounts[id]?.pages ?? [])] : []));
  const queue = useRef<string[]>(syncPages.slice(1));
  const syncing = useRef(syncPages.length > 0);
  const found = useRef(0);

  useEffect(() => {
    api.clubs().then((r) => setClub(r.clubs.find((c) => c.id === id) ?? null)).catch(() => {});
  }, [id]);

  const startUrl = syncPages[0] ?? club?.connect?.benefitsUrl ?? club?.connect?.loginUrl ?? null;

  const extract = () => { setBusy(true); web.current?.injectJavaScript(EXTRACT_BENEFITS_JS); };

  const onMessage = (e: WebViewMessageEvent) => {
    let r: ExtractResult;
    try { r = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (r.type !== 'benefits') return;
    setBusy(false);
    if (r.needsLogin) {
      setStatus({ kind: 'warn', text: syncing.current ? 'ההתחברות לאתר המועדון פגה. התחברו שוב, ואז “ייבוא”.' : 'נראה שעדיין לא התחברתם. התחברו באתר, עברו לעמוד ההטבות ולחצו “ייבוא”.' });
      syncing.current = false;
      return;
    }
    if (r.error) { setStatus({ kind: 'warn', text: 'לא הצלחנו לקרוא את העמוד. נסו לעבור לעמוד ההטבות עצמו.' }); return; }
    const items = r.items.map((b) => enrich(b, r.url, meta?.stores ?? []));
    importPage(id, r.url, items);
    found.current += items.length;
    const matched = items.filter((i) => i.storeId && i.percent).length;
    if (syncing.current && queue.current.length) {
      web.current?.injectJavaScript(`location.href = ${JSON.stringify(queue.current.shift())}; true;`);
      setStatus({ kind: 'info', text: `מסנכרן… נמצאו עד עכשיו ${found.current} הטבות` });
      return;
    }
    syncing.current = false;
    setStatus(items.length
      ? { kind: 'ok', text: `יובאו ${items.length} הטבות מהעמוד${matched ? ` (${matched} מהן בחנויות שבהשוואה ייכנסו למחיר)` : ''}. אפשר לעבור לעמוד נוסף ולייבא גם אותו.` }
      : { kind: 'warn', text: 'לא נמצאו הטבות בעמוד הזה. עברו לעמוד שמציג את רשימת ההטבות ונסו שוב.' });
  };

  if (Platform.OS === 'web') {
    return <View style={{ padding: 24 }}><Text style={{ color: t.ink }}>חיבור חשבון מועדון זמין באפליקציה בטלפון.</Text></View>;
  }
  if (!club) return <ActivityIndicator style={{ marginTop: 40 }} color={t.brand} />;
  if (!startUrl) {
    return (
      <View style={{ padding: 24, gap: 8 }}>
        <Text style={{ color: t.ink, fontWeight: '700' }}>עוד אין כתובת כניסה ל{club.name}</Text>
        <Text style={{ color: t.muted }}>מנהל המערכת יכול להוסיף אותה בדף הניהול, בלי עדכון לאפליקציה.</Text>
      </View>
    );
  }

  const tone = status?.kind === 'ok' ? { fg: t.good, bg: t.goodSoft } : status?.kind === 'warn' ? { fg: t.warn, bg: t.warnSoft } : { fg: t.ink, bg: t.bg };
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ title: club.name }} />
      <View style={[styles.banner, { backgroundColor: t.card, borderColor: t.line }]}>
        <Text style={{ color: t.ink, fontSize: 13 }}>
          🔒 אתם באתר של {club.name}. התחברו כרגיל – הסיסמה נשארת באתר המועדון, והאפליקציה לא שומרת אותה.
          {'\n'}אחרי ההתחברות עברו לעמוד ההטבות ולחצו “ייבוא ההטבות מהעמוד הזה”.
        </Text>
      </View>
      <WebView
        ref={web}
        source={{ uri: startUrl }}
        onMessage={onMessage}
        onLoadEnd={() => { if (syncing.current) extract(); }}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        domStorageEnabled
        javaScriptEnabled
        setSupportMultipleWindows={false}
        startInLoadingState
        style={{ flex: 1 }}
      />
      {status && <View style={[styles.status, { backgroundColor: tone.bg }]}><Text style={{ color: tone.fg, fontSize: 13 }}>{status.text}</Text></View>}
      <View style={[styles.bar, { backgroundColor: t.card, borderColor: t.line }]}>
        <Pressable onPress={extract} disabled={busy} style={[styles.primary, { backgroundColor: t.brand, opacity: busy ? 0.7 : 1 }]}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>ייבוא ההטבות מהעמוד הזה</Text>}
        </Pressable>
        <Pressable onPress={() => router.back()} style={[styles.secondary, { borderColor: t.line }]}>
          <Text style={{ color: t.ink }}>סיום</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { padding: 10, borderBottomWidth: 1 },
  status: { paddingHorizontal: 12, paddingVertical: 8 },
  bar: { flexDirection: 'row', gap: 10, padding: 12, borderTopWidth: 1 },
  primary: { flex: 1, borderRadius: 999, paddingVertical: 12, alignItems: 'center' },
  secondary: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 18, justifyContent: 'center' },
});
