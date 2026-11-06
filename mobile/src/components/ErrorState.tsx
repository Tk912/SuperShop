import { Pressable, Text, View } from 'react-native';
import { API_URL } from '../lib/api';
import { useTheme } from '../lib/theme';

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const t = useTheme();
  return (
    <View style={{ padding: 24, alignItems: 'center', gap: 10 }}>
      <Text style={{ color: t.ink, fontSize: 17, fontWeight: '700' }}>אין חיבור לשרת</Text>
      <Text style={{ color: t.muted, textAlign: 'center' }}>{message}{'\n'}{API_URL}</Text>
      <Pressable onPress={onRetry} style={{ backgroundColor: t.brand, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 8 }}>
        <Text style={{ color: '#fff', fontWeight: '700' }}>נסו שוב</Text>
      </Pressable>
    </View>
  );
}
