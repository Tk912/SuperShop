import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { ClubAccountsProvider } from '../lib/clubAccounts';
import { ClubsProvider } from '../lib/clubs';
import { FavoritesProvider } from '../lib/favorites';
import { useTheme } from '../lib/theme';

export default function RootLayout() {
  const t = useTheme();
  // בנייטיב RTL נכפה דרך expo-localization (forcesRTL ב-app.json). בווב – דרך מאפיין dir.
  useEffect(() => {
    if (Platform.OS === 'web') { document.documentElement.dir = 'rtl'; document.documentElement.lang = 'he'; }
  }, []);

  // לחיצה על התראת מחיר → דף המוצר (גם כשהאפליקציה נפתחת מההתראה)
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const open = (r: Notifications.NotificationResponse | null) => {
      const id = r?.notification.request.content.data?.productId;
      if (typeof id === 'string') router.push({ pathname: '/product/[id]', params: { id } });
    };
    open(Notifications.getLastNotificationResponse());
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);

  return (
    <ClubsProvider>
      <FavoritesProvider>
      <ClubAccountsProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{
        headerStyle: { backgroundColor: t.card }, headerTintColor: t.ink, headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: t.bg }, headerBackButtonDisplayMode: 'minimal',
      }}>
        <Stack.Screen name="index" options={{ title: 'SuperShop' }} />
        <Stack.Screen name="search" options={{ title: 'תוצאות חיפוש' }} />
        <Stack.Screen name="product/[id]" options={{ title: 'השוואת מחירים' }} />
        <Stack.Screen name="clubs" options={{ title: 'חיבור למועדונים' }} />
        <Stack.Screen name="club-connect/[id]" options={{ title: 'חיבור לחשבון המועדון' }} />
        <Stack.Screen name="favorites" options={{ title: 'במעקב מחיר' }} />
        <Stack.Screen name="scan" options={{ title: 'סריקת ברקוד', presentation: 'fullScreenModal' }} />
      </Stack>
      </ClubAccountsProvider>
      </FavoritesProvider>
    </ClubsProvider>
  );
}
