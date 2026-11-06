import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

// הרשמה להתראות push. מחזיר push token של Expo, או סיבה מובנת למה אי אפשר.
export type PushResult =
  | { ok: true; token: string }
  | { ok: false; reason: 'web' | 'simulator' | 'denied' | 'no-project' | 'error'; message: string };

if (Platform.OS !== 'web') {
  // התראה שמגיעה כשהאפליקציה פתוחה – מוצגת כרגיל
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

export async function registerForPush(): Promise<PushResult> {
  if (Platform.OS === 'web') return { ok: false, reason: 'web', message: 'התראות זמינות באפליקציה בטלפון, לא בדפדפן.' };
  if (!Device.isDevice) return { ok: false, reason: 'simulator', message: 'התראות push עובדות רק במכשיר אמיתי.' };

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('price-alerts', {
      name: 'התראות מחיר', importance: AndroidImportance.HIGH, lightColor: '#4338CA',
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
  if (status !== 'granted') return { ok: false, reason: 'denied', message: 'ההרשאה להתראות נדחתה. אפשר לאשר אותה בהגדרות המכשיר.' };

  // מזהה הפרויקט ב-EAS נדרש כדי לקבל push token. נוצר עם `eas init`.
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return { ok: false, reason: 'no-project', message: 'האפליקציה עוד לא מחוברת לפרויקט EAS, ולכן אי אפשר לשלוח אליה התראות.' };

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return { ok: true, token: data };
  } catch (e) {
    return { ok: false, reason: 'error', message: `ההרשמה להתראות נכשלה: ${String((e as Error).message ?? e)}` };
  }
}
