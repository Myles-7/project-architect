import { createServer } from 'node:net';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

export async function checkPorts(ports = [3001, 5174]) {
  for (const port of ports) {
    const server = createServer();
    await new Promise((resolve, reject) => {
      server.once('error', () => reject(new Error(`Port ${port} is unavailable. Close its existing service or use separate terminals with different ports. No process was stopped.`)));
      server.listen(port, '127.0.0.1', resolve);
    });
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

export async function waitForServices(timeoutMs = 30_000, serverPort = 3001, webPort = 5174) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const health = await fetch(`http://127.0.0.1:${serverPort}/api/health`, { signal: AbortSignal.timeout(1500) });
      const page = await fetch(`http://127.0.0.1:${webPort}`, { signal: AbortSignal.timeout(1500) });
      if (health.ok && (await health.json()).status === 'ok' && page.ok && (await page.text()).includes('id="root"')) return;
    } catch { /* Wait for both services to finish starting. */ }
    await delay(400);
  }
  throw new Error('Services did not become ready within 30 seconds. Check startup logs; startup has not been confirmed.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv[2] === 'preflight') await checkPorts();
    else if (process.argv[2] === 'ready') await waitForServices();
    else throw new Error('Use preflight or ready.');
    console.log('Local service check passed.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
