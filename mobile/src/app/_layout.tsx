import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { ClubsProvider } from '../lib/clubs';
import { useTheme } from '../lib/theme';

export default function RootLayout() {
  const t = useTheme();
  // בנייטיב RTL נכפה דרך expo-localization (forcesRTL ב-app.json). בווב – דרך מאפיין dir.
  useEffect(() => {
    if (Platform.OS === 'web') { document.documentElement.dir = 'rtl'; document.documentElement.lang = 'he'; }
  }, []);

  return (
    <ClubsProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{
        headerStyle: { backgroundColor: t.card }, headerTintColor: t.ink, headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: t.bg }, headerBackButtonDisplayMode: 'minimal',
      }}>
        <Stack.Screen name="index" options={{ title: 'משווה' }} />
        <Stack.Screen name="search" options={{ title: 'תוצאות חיפוש' }} />
        <Stack.Screen name="product/[id]" options={{ title: 'השוואת מחירים' }} />
        <Stack.Screen name="clubs" options={{ title: 'המועדונים שלי', presentation: 'modal' }} />
      </Stack>
    </ClubsProvider>
  );
}
