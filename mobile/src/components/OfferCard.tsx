import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { api, type Discount, type Offer, type Route } from '../lib/api';
import { ils, money, useTheme, type Theme } from '../lib/theme';

/** "דמי המשלוח: 28 ₪" כבר כולל עלות; משלוח לא ידוע לא מוצג כחינם. */
function shippingText(r: Route) {
  if (r.shippingUnknown) return `${r.name}: עלות לא ידועה`;
  if (/₪|חינם|free/i.test(r.name)) return r.name;
  return `${r.name}: ${r.shippingIls ? ils(r.shippingIls) : 'חינם'}`;
}

function Badge({ label, fg, bg }: { label: string; fg: string; bg: string }) {
  return <View style={[styles.badge, { backgroundColor: bg }]}><Text style={{ color: fg, fontSize: 11, fontWeight: '700' }}>{label}</Text></View>;
}

/** "אומת ב-12.11 · מקור · לא עבד?" – שקיפות לגבי ההנחה, ודיווח שמגיע לדף הניהול. */
function DealTrust({ d, t }: { d: Discount; t: Theme }) {
  const [reported, setReported] = useState(false);
  const date = d.verifiedAt ? d.verifiedAt.split('-').reverse().slice(0, 2).join('.') : null;
  return (
    <View style={styles.discRow}>
      {date && <Text style={{ color: t.muted, fontSize: 12 }}>אומת {date}</Text>}
      {d.source && (
        <Pressable onPress={() => Linking.openURL(d.source!)} hitSlop={6}>
          <Text style={{ color: t.brand, fontSize: 12 }}>מקור</Text>
        </Pressable>
      )}
      <Pressable disabled={reported} hitSlop={6}
        onPress={() => api.reportDeal(d.id).then(() => setReported(true)).catch(() => setReported(true))}>
        <Text style={{ color: reported ? t.muted : t.warn, fontSize: 12 }}>{reported ? 'תודה, נבדוק' : 'לא עבד?'}</Text>
      </Pressable>
    </View>
  );
}

function CouponCode({ code, t }: { code: string; t: Theme }) {
  const [copied, setCopied] = useState(false);
  return (
    <Pressable onPress={async () => { await Clipboard.setStringAsync(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      style={[styles.code, { borderColor: t.muted, backgroundColor: t.bg }]} accessibilityLabel={`העתקת קופון ${code}`}>
      <Text style={{ color: t.ink, fontFamily: 'monospace', fontSize: 13 }}>{code}</Text>
      <Text style={{ color: t.brand, fontSize: 12 }}>{copied ? 'הועתק ✓' : 'העתק'}</Text>
    </Pressable>
  );
}

export function OfferCard({ o, isBest, deals = true }: { o: Offer; isBest: boolean; deals?: boolean }) {
  const t = useTheme();
  const [expanded, setExpanded] = useState(false);
  const b = o.best;
  const otherCoupons = o.discounts.availableCoupons.filter((c) => !o.discounts.applied.some((a) => a.code === c.code));
  const taxLine = o.storeType === 'local' ? 'כולל מע״מ'
    : b.taxes.exempt ? `פטור ממסים (ערך $${b.taxes.valueUsd})`
    : `מסים ${ils(b.taxes.totalIls)}` + (b.taxes.dutyIls ? ` (מכס ${ils(b.taxes.dutyIls)})` : '');

  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: isBest ? t.good : t.line, borderWidth: isBest ? 2 : 1,
      opacity: o.inStock ? 1 : 0.6 }]}>
      {/* שורה עליונה: חנות + מחיר סופי */}
      <View style={styles.top}>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={styles.storeRow}>
            <Text style={[styles.store, { color: t.ink }]}>{o.storeName}</Text>
            {o.storeType === 'local' ? <Badge label="ישראל" fg={t.brand} bg={t.brandSoft} /> : <Badge label='חו״ל' fg={t.intl} bg={t.intlSoft} />}
            {o.storeType === 'intl' && !o.shipsDirectToIL && <Badge label="אין משלוח לארץ" fg={t.warn} bg={t.warnSoft} />}
            {!o.inStock && <Badge label="אזל מהמלאי" fg={t.muted} bg={t.bg} />}
          </View>
          <Text style={{ color: t.muted, fontSize: 13 }}>
            {money(o.price, o.currency)}{o.currency !== 'ILS' ? `  ≈ ${ils(o.priceIls)}` : ''}
          </Text>
        </View>
        <View style={styles.totalBox}>
          <Text style={[styles.total, { color: isBest ? t.good : t.ink }]}>{ils(o.totalIls)}</Text>
          <Text style={{ color: t.muted, fontSize: 12 }}>סה״כ עד הבית</Text>
        </View>
      </View>

      {/* הנחות */}
      <View style={{ gap: 6, marginTop: 10 }}>
        {deals && o.discounts.applied.length === 0 && <Text style={{ color: t.muted, fontSize: 13 }}>אין הנחה זמינה עבורך</Text>}
        {o.discounts.applied.map((d, i) => (
          <View key={i} style={styles.discRow}>
            <Text style={{ color: t.good, fontSize: 14 }}>
              ✓ {d.kind === 'club' ? `${d.name}: ${d.label}` : `קופון ${d.label}`} (−{ils(d.amountIls)})
            </Text>
            {d.kind === 'coupon' && d.code && <CouponCode code={d.code} t={t} />}
            {d.status === 'sample' && <Badge label="לדוגמה" fg={t.warn} bg={t.warnSoft} />}
            {d.status === 'pending' && <Badge label="לא מאומת" fg={t.warn} bg={t.warnSoft} />}
            {d.status === 'verified' && <DealTrust d={d} t={t} />}
            {d.status === 'account' && <Badge label="מהחשבון שלך" fg={t.good} bg={t.goodSoft} />}
          </View>
        ))}
        <Text style={{ color: t.muted, fontSize: 13 }}>
          🚚 {shippingText(b)}{b.days && b.days !== '?' ? ` · ${b.days} ימים` : ''} · {taxLine}
        </Text>
      </View>

      {o.missedClubs.length > 0 && (
        <View style={[styles.hint, { backgroundColor: t.warnSoft }]}>
          <Text style={{ color: t.warn, fontSize: 13 }}>
            💡 {o.missedClubs.map((m) => `חברי ${m.name} חוסכים כאן ${ils(m.amountIls)}`).join(' · ')}
          </Text>
        </View>
      )}
      {otherCoupons.length > 0 && (
        <View style={[styles.discRow, { marginTop: 8 }]}>
          <Text style={{ color: t.muted, fontSize: 13 }}>קופונים נוספים:</Text>
          {otherCoupons.map((c) => <CouponCode key={c.code} code={c.code!} t={t} />)}
        </View>
      )}

      {/* פעולות */}
      <View style={[styles.actions, { borderTopColor: t.line }]}>
        <Pressable onPress={() => setExpanded((x) => !x)} hitSlop={8}>
          <Text style={{ color: t.brand, fontSize: 14 }}>{expanded ? '▲' : '▼'} אפשרויות משלוח ({o.routes.length})</Text>
        </Pressable>
        <Pressable onPress={() => Linking.openURL(o.url)} style={[styles.go, { backgroundColor: t.brand }]}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>לאתר ←</Text>
        </Pressable>
      </View>

      {expanded && (
        <View style={{ marginTop: 8, gap: 8 }}>
          {o.routes.map((r, i) => (
            <View key={i} style={[styles.route, { borderColor: i === 0 ? t.good : t.line, backgroundColor: i === 0 ? t.goodSoft : 'transparent' }]}>
              <View style={styles.routeHead}>
                <Text style={{ color: t.ink, fontWeight: '700', flex: 1 }}>{r.name}</Text>
                <Text style={{ color: i === 0 ? t.good : t.ink, fontWeight: '800' }}>{ils(r.totalIls)}</Text>
              </View>
              <Text style={{ color: t.muted, fontSize: 12 }}>
                משלוח {r.shippingUnknown ? 'לא ידוע' : r.shippingIls ? ils(r.shippingIls) : 'חינם'} · מע״מ {ils(r.taxes.vatIls)} · מכס {ils(r.taxes.dutyIls)} · עמלות {ils(r.taxes.feeIls)}{r.days && r.days !== '?' ? ` · ${r.days} ימים` : ''}
              </Text>
              {r.note && <Text style={{ color: t.muted, fontSize: 12 }}>{r.note}{r.chargeableKg ? ` · משקל מחויב ${r.chargeableKg} ק״ג` : ''}</Text>}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, padding: 14, marginBottom: 10 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  storeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  store: { fontSize: 17, fontWeight: '700' },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  totalBox: { alignItems: 'flex-end' },
  total: { fontSize: 22, fontWeight: '800' },
  discRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  code: { flexDirection: 'row', gap: 6, alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  hint: { marginTop: 10, borderRadius: 8, padding: 8 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1 },
  go: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  route: { borderWidth: 1, borderRadius: 10, padding: 10, gap: 3 },
  routeHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
