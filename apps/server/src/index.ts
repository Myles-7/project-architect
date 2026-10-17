import { createApp } from './server.js';

export * from './server.js';

const PORT = Number(process.env.PORT) || 3001;
const HOST = '127.0.0.1';

if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  const useMockAI = process.env.USE_MOCK_AI === 'true' || process.env.USE_MOCK_AI === '1';
  const app = createApp({ useMockAI });
  app.listen(PORT, HOST, () => {
    console.log(`[Project Architect Server] Running locally at http://${HOST}:${PORT}`);
    if (useMockAI) {
      console.log(`[Project Architect Server] Running with MockAIProvider (USE_MOCK_AI enabled).`);
    }
  });
}
