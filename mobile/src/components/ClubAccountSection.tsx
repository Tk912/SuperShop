import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ClubInfo } from '../lib/api';
import { useClubAccounts } from '../lib/clubAccounts';
import { RLM, useTheme } from '../lib/theme';

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 1 ? 'עכשיו' : m < 60 ? `לפני ${m} דק׳` : m < 1440 ? `לפני ${Math.round(m / 60)} שע׳` : `לפני ${Math.round(m / 1440)} ימים`;
};

// החשבון שלי במועדון: התחברות (באתר המועדון בתוך האפליקציה), ההטבות שיובאו, חיפוש, סנכרון וניתוק.
export function ClubAccountSection({ club }: { club: ClubInfo }) {
  const t = useTheme();
  const { accounts, disconnect, shareEnabled, reshare } = useClubAccounts();
  const [filter, setFilter] = useState<'all' | 'in' | 'out'>('all');
  const acc = accounts[club.id];
  const [q, setQ] = useState('');
  const [showAll, setShowAll] = useState(false);
  const canConnect = !!(club.connect?.loginUrl || club.connect?.benefitsUrl);

  if (!acc) {
    return (
      <View style={[styles.box, { backgroundColor: t.bg }]}>
        <Text style={{ color: t.ink, fontWeight: '700' }}>🔑 כל ההטבות והמבצעים מהחשבון שלכם</Text>
        <Text style={{ color: t.muted, fontSize: 13 }}>
          מתחברים פעם אחת לאתר המועדון בתוך האפליקציה, וכל ההטבות שלכם (למשל 20% בפוקס) יופיעו במרכז ההטבות.
        </Text>
        {canConnect ? (
          <Pressable onPress={() => router.push({ pathname: '/club-connect/[id]', params: { id: club.id } })} style={[styles.primary, { backgroundColor: t.brand }]}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>התחברות לחשבון ב{club.name}</Text>
          </Pressable>
        ) : <Text style={{ color: t.muted, fontSize: 12 }}>חיבור החשבון למועדון הזה יתווסף בקרוב.</Text>}
      </View>
    );
  }

  const term = q.trim().toLowerCase();
  const items = acc.items.filter((i) => (!term || `${i.title} ${i.text}`.toLowerCase().includes(term))
    && (filter === 'all' || (filter === 'in' ? i.hub?.ok : i.hub && !i.hub.ok)));
  const share = acc.share;
  const outCount = acc.items.filter((i) => i.hub && !i.hub.ok).length;
  const shown = showAll || term ? items : items.slice(0, 8);
  const matched = acc.items.filter((i) => i.storeId && i.percent).length;
  return (
    <View style={[styles.box, { backgroundColor: t.bg }]}>
      <View style={styles.row}>
        <Text style={{ color: t.ink, fontWeight: '700', flex: 1 }}>🔑 ההטבות שלי ב{club.name} ({acc.items.length})</Text>
        <Text style={{ color: t.muted, fontSize: 12 }}>סונכרן {ago(acc.syncedAt)}</Text>
      </View>
      {!shareEnabled ? (
        <Text style={{ color: t.muted, fontSize: 13 }}>השיתוף במרכז ההטבות כבוי (בתחתית המסך)</Text>
      ) : !share ? (
        <Text style={{ color: t.muted, fontSize: 13 }}>⏳ שולח את ההטבות למרכז ההטבות…</Text>
      ) : 'error' in share ? (
        <Pressable onPress={() => reshare(club.id)}>
          <Text style={{ color: t.warn, fontSize: 13 }}>⚠️ ההטבות לא נשלחו למרכז ({share.error}). לחצו לניסיון חוזר</Text>
        </Pressable>
      ) : (
        <View style={{ gap: 2 }}>
          <Text style={{ color: share.inHub ? t.good : t.warn, fontSize: 13, fontWeight: '700' }}>
            🏷️ {share.inHub ? `${share.inHub} הטבות על מוצרים מופיעות במרכז ההטבות` : 'אף הטבה מהעמוד לא זוהתה כהטבה על מוצר'}
          </Text>
          {outCount > 0 && (
            <Text style={{ color: t.muted, fontSize: 12 }}>
              {outCount} לא נכנסו: {[share.rejected.service ? `${share.rejected.service} שירותים/אטרקציות` : null,
                share.rejected.unknown ? `${share.rejected.unknown} לא זוהו כמוצר` : null,
                share.rejected.personal ? `${share.rejected.personal} נראו כמידע אישי` : null,
                share.rejected.empty ? `${share.rejected.empty} ריקות` : null].filter(Boolean).join(' · ')}
            </Text>
          )}
        </View>
      )}
      {outCount > 0 && (
        <View style={[styles.row, { flexWrap: 'wrap' }]}>
          {([['all', 'הכול'], ['in', 'במרכז ההטבות'], ['out', 'לא נכנסו']] as const).map(([k, label]) => (
            <Pressable key={k} onPress={() => setFilter(k)} style={[styles.btn, { borderColor: filter === k ? t.brand : t.line, backgroundColor: filter === k ? t.brand : 'transparent' }]}>
              <Text style={{ color: filter === k ? '#fff' : t.ink, fontSize: 12 }}>{label}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {matched > 0 && <Text style={{ color: t.good, fontSize: 13 }}>✓ {matched} הטבות בחנויות שבהשוואה נכנסות אוטומטית למחיר</Text>}
      {acc.items.length > 5 && (
        <TextInput value={q} onChangeText={setQ} placeholder="חיפוש הטבה (למשל פוקס, מסעדות…)" placeholderTextColor={t.muted}
          style={[styles.input, { color: t.ink, borderColor: t.line, backgroundColor: t.card }]} accessibilityLabel="חיפוש הטבה" />
      )}
      {shown.map((i) => (
        <Pressable key={i.id} onPress={() => i.link && Linking.openURL(i.link)} style={[styles.item, { borderColor: t.line, backgroundColor: t.card }]}>
          <Text style={{ color: t.ink, fontWeight: '700' }} numberOfLines={1}>{RLM}{i.title}</Text>
          <Text style={{ color: t.muted, fontSize: 13 }} numberOfLines={3}>{RLM}{i.text}</Text>
          {i.storeId && i.percent ? <Text style={{ color: t.good, fontSize: 12 }}>✓ נכנס למחיר: {i.percent}%{i.minSpend ? ` בקנייה מעל ₪${i.minSpend}` : ''}</Text> : null}
          {i.hub ? <Text style={{ color: i.hub.ok ? t.good : t.muted, fontSize: 11 }}>{i.hub.ok ? '🏷️ במרכז ההטבות' : i.hub.reason === 'service' ? 'לא במרכז: שירות/אטרקציה' : i.hub.reason === 'unknown' ? 'לא במרכז: לא זוהה כמוצר' : 'לא במרכז'}</Text> : null}
        </Pressable>
      ))}
      {!items.length && <Text style={{ color: t.muted, fontSize: 13 }}>{term ? 'לא נמצאו הטבות בחיפוש.' : 'עוד לא יובאו הטבות. התחברו ועברו לעמוד ההטבות.'}</Text>}
      {!showAll && !term && items.length > 8 && (
        <Pressable onPress={() => setShowAll(true)}><Text style={{ color: t.brand }}>הצגת כל {items.length} ההטבות</Text></Pressable>
      )}
      <View style={[styles.row, { flexWrap: 'wrap' }]}>
        <Pressable onPress={() => router.push({ pathname: '/club-connect/[id]', params: { id: club.id, sync: '1' } })} style={[styles.btn, { borderColor: t.line }]}>
          <Text style={{ color: t.ink }}>↻ סנכרון</Text>
        </Pressable>
        <Pressable onPress={() => router.push({ pathname: '/club-connect/[id]', params: { id: club.id } })} style={[styles.btn, { borderColor: t.line }]}>
          <Text style={{ color: t.ink }}>➕ ייבוא מעמוד נוסף</Text>
        </Pressable>
        <Pressable onPress={() => disconnect(club.id)} style={[styles.btn, { borderColor: t.line }]}>
          <Text style={{ color: t.warn }}>ניתוק</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: 10, padding: 10, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  primary: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, fontSize: 14 },
  item: { borderWidth: 1, borderRadius: 10, padding: 8, gap: 2 },
  btn: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
});
