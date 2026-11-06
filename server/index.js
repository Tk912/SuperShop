import { createApp } from './app.js';
import { refreshRates } from './pricing/fx.js';
import { startAlertScheduler } from './alerts.js';
import { initStorage } from './storage.js';

const port = Number(process.env.PORT ?? 3000);
const kind = await initStorage(); // במצב Firestore: טוען את כל הנתונים לפני שמתחילים לקבל בקשות
refreshRates().catch(() => {});
startAlertScheduler();
createApp().listen(port, () => console.log(`🛒 http://localhost:${port} (storage: ${kind})`));
