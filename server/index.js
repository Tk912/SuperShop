import { createApp } from './app.js';
import { refreshRates } from './pricing/fx.js';
import { startAlertScheduler } from './alerts.js';

const port = Number(process.env.PORT ?? 3000);
refreshRates().catch(() => {});
startAlertScheduler();
createApp().listen(port, () => console.log(`🛒 http://localhost:${port}`));
