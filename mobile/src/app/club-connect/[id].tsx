import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef, useState, type ComponentType, type Ref } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView as RNWebView, type WebViewMessageEvent, type WebViewProps } from 'react-native-webview';
import { api, type ClubInfo } from '../../lib/api';
import { enrich, EXTRACT_BENEFITS_JS, PING_JS, type ExtractDiag, type ExtractMessage } from '../../lib/benefitExtractor';
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
  // באנדרואיד החדש האפליקציה מצוירת עד קצה המסך – בלי זה הכפתורים נופלים מתחת לכפתורי הניווט של הטלפון
  const insets = useSafeAreaInsets();
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

  // הייבוא בשלבים, עם משוב על המסך בכל שלב:
  //  1. ping – בודקים שיש תקשורת עם העמוד (אם לא: קוד P1)
  //  2. קריאת ההטבות, עם הודעות התקדמות (גלילה, זיהוי)
  //  3. מגבלת זמן של 30 שניות (קוד T1), ופרטי אבחון כשלא נמצא כלום
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const pinged = useRef(false);
  const stage = useRef('');
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => clearTimers, []);

  const STAGES: Record<string, string> = {
    started: '⏳ מתחיל לקרוא את העמוד…',
    scrolling: '⏳ גולל את העמוד כדי לטעון את כל ההטבות…',
    scanning: '⏳ מזהה את ההטבות בעמוד…',
  };
  const diagText = (d?: ExtractDiag, ms?: number) => (d
    ? `פרטים לאבחון: שלב ${d.stage} · רכיבים ${d.elements} · מסגרות ${d.frames} (מאותו אתר ${d.sameOriginFrames}) · טקסטים עם הנחה ${d.textHits} · כרטיסים ${d.cards}${d.hiddenPassword ? ` · שדות סיסמה מוסתרים ${d.hiddenPassword}` : ''}${ms != null ? ` · ${(ms / 1000).toFixed(1)} שנ׳` : ''}`
    : '');

  const fail = (text: string) => { clearTimers(); setBusy(false); syncing.current = false; setStatus({ kind: 'warn', text }); };

  const extract = () => {
    clearTimers();
    setBusy(true);
    pinged.current = false;
    stage.current = 'ping';
    setStatus({ kind: 'info', text: '⏳ מתחבר לעמוד…' });
    web.current?.injectJavaScript(PING_JS);
    timers.current.push(setTimeout(() => {
      if (!pinged.current) fail('האפליקציה לא מצליחה לתקשר עם העמוד (קוד P1). נסו לרענן את העמוד או לצאת ולהיכנס שוב למסך הזה.');
    }, 5000));
    timers.current.push(setTimeout(() => {
      fail(`הקריאה לקחה יותר מדי זמן (קוד T1, שלב: ${stage.current}). נסו שוב, או עברו לעמוד עם פחות הטבות (למשל קטגוריה אחת).`);
    }, 30000));
  };

  const onMessage = (e: WebViewMessageEvent) => {
    let r: ExtractMessage;
    try { r = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (r.type === 'ping') {
      if (pinged.current) return;
      pinged.current = true;
      stage.current = 'started';
      setStatus({ kind: 'info', text: STAGES.started });
      web.current?.injectJavaScript(EXTRACT_BENEFITS_JS);
      return;
    }
    if (r.type === 'progress') {
      stage.current = r.stage;
      if (STAGES[r.stage]) setStatus({ kind: 'info', text: STAGES[r.stage] });
      return;
    }
    if (r.type !== 'benefits') return;
    clearTimers();
    setBusy(false);
    if (r.needsLogin) {
      setStatus({ kind: 'warn', text: syncing.current ? 'ההתחברות לאתר המועדון פגה. התחברו שוב, ואז “ייבוא”.' : 'נראה שעדיין לא התחברתם. התחברו באתר, עברו לעמוד ההטבות ולחצו “ייבוא”.' });
      syncing.current = false;
      return;
    }
    if (r.error) { fail(`לא הצלחנו לקרוא את העמוד (קוד E1: ${r.error}). ${diagText(r.diag, r.ms)}`); return; }
    const items = r.items.map((b) => enrich(b, r.url, meta?.stores ?? []));
    if (items.length) importPage(id, r.url, items);
    found.current += items.length;
    const matched = items.filter((i) => i.storeId && i.percent).length;
    if (syncing.current && queue.current.length) {
      web.current?.injectJavaScript(`location.href = ${JSON.stringify(queue.current.shift())}; true;`);
      setStatus({ kind: 'info', text: `מסנכרן… נמצאו עד עכשיו ${found.current} הטבות` });
      return;
    }
    syncing.current = false;
    setStatus(items.length
      ? { kind: 'ok', text: `✓ יובאו ${items.length} הטבות מהעמוד${matched ? ` (${matched} מהן בחנויות שבהשוואה ייכנסו למחיר)` : ''}. אפשר לעבור לעמוד נוסף ולייבא גם אותו, או ללחוץ “סיום”.` }
      : { kind: 'warn', text: `לא נמצאו הטבות בעמוד הזה. ודאו שאתם בעמוד שמציג את רשימת ההטבות, ונסו שוב. אם הבעיה חוזרת, צלמו את ההודעה הזו ושלחו לנו.\n${diagText(r.diag, r.ms)}` });
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
      <View style={[styles.bar, { backgroundColor: t.card, borderColor: t.line, paddingBottom: 12 + insets.bottom }]}>
        <Pressable onPress={extract} disabled={busy} style={[styles.primary, { backgroundColor: t.brand, opacity: busy ? 0.7 : 1 }]}>
          {busy
            ? <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><ActivityIndicator color="#fff" /><Text style={{ color: '#fff', fontWeight: '700' }}>קורא הטבות…</Text></View>
            : <Text style={{ color: '#fff', fontWeight: '700' }}>ייבוא ההטבות מהעמוד הזה</Text>}
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
