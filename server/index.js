import { createApp } from './app.js';
import { refreshRates } from './pricing/fx.js';

const port = Number(process.env.PORT ?? 3000);
refreshRates().catch(() => {});
createApp().listen(port, () => console.log(`🛒 http://localhost:${port}`));
