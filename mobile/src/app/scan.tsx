import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router } from 'expo-router';
import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../lib/theme';

// סריקת ברקוד של מוצר (EAN/UPC) → חיפוש המוצר בכל החנויות.
export default function Scan() {
  const t = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const handled = useRef(false);

  const onScanned = ({ data }: BarcodeScanningResult) => {
    if (handled.current || !/^\d{8,14}$/.test(data)) return; // רק ברקודים מסחריים
    handled.current = true;
    router.replace({ pathname: '/search', params: { q: data } });
  };

  if (!permission) return <View style={{ flex: 1, backgroundColor: '#000' }} />;

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 44 }}>📷</Text>
        <Text style={{ color: t.ink, fontSize: 18, fontWeight: '700' }}>סריקת ברקוד</Text>
        <Text style={{ color: t.muted, textAlign: 'center' }}>
          כדי לסרוק ברקוד של מוצר בחנות ולהשוות מחיר, צריך הרשאה למצלמה. התמונה לא נשמרת ולא נשלחת.
        </Text>
        {permission.canAskAgain ? (
          <Pressable onPress={requestPermission} style={[styles.btn, { backgroundColor: t.brand }]}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>אישור גישה למצלמה</Text>
          </Pressable>
        ) : (
          <Text style={{ color: t.warn, textAlign: 'center' }}>הגישה למצלמה חסומה. אפשר לאשר אותה בהגדרות המכשיר.</Text>
        )}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
        onBarcodeScanned={onScanned}
      />
      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.frame} />
        <Text style={styles.hint}>מכוונים את הברקוד של המוצר למסגרת</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, padding: 32, alignItems: 'center', justifyContent: 'center', gap: 12 },
  btn: { borderRadius: 999, paddingHorizontal: 20, paddingVertical: 10, marginTop: 8 },
  overlay: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, alignItems: 'center', justifyContent: 'center', gap: 16 },
  frame: { width: '75%', aspectRatio: 1.8, borderWidth: 3, borderColor: '#fff', borderRadius: 16 },
  hint: { color: '#fff', fontSize: 16, fontWeight: '600', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
});
