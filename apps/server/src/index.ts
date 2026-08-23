import { createApp } from './server.js';

export * from './server.js';

const PORT = Number(process.env.PORT) || 3001;
const HOST = '127.0.0.1';

if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  const app = createApp();
  app.listen(PORT, HOST, () => {
    console.log(`[Project Architect Server] Running locally at http://${HOST}:${PORT}`);
  });
}
