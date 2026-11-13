import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useTheme } from '../../lib/theme';

const icon = (emoji: string) => function TabIcon({ focused }: { focused: boolean }) {
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.55 }}>{emoji}</Text>;
};

// לשוניות: מרכז ההטבות (ראשי), השוואת מחירים, והמועדונים שלי
export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs screenOptions={{
      headerStyle: { backgroundColor: t.card }, headerTintColor: t.ink, headerTitleStyle: { fontWeight: '700' },
      tabBarActiveTintColor: t.brand, tabBarInactiveTintColor: t.muted,
      tabBarStyle: { backgroundColor: t.card, borderTopColor: t.line }, sceneStyle: { backgroundColor: t.bg },
    }}>
      <Tabs.Screen name="index" options={{ title: 'הטבות', headerTitle: 'SuperShop · מרכז ההטבות', tabBarIcon: icon('🏷️') }} />
      <Tabs.Screen name="compare" options={{ title: 'השוואת מחירים', headerTitle: 'השוואת מחירים', tabBarIcon: icon('🔎') }} />
      <Tabs.Screen name="clubs" options={{ title: 'המועדונים שלי', headerTitle: 'המועדונים שלי', tabBarIcon: icon('🔑') }} />
    </Tabs>
  );
}
