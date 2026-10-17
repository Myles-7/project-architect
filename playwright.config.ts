import { defineConfig,devices } from '@playwright/test';
export default defineConfig({
  testDir:'tests/e2e',testMatch:'*.spec.ts',fullyParallel:false,workers:1,timeout:45000,
  expect:{timeout:12000},reporter:[['list'],['html',{open:'never'}]],
  use:{baseURL:'http://127.0.0.1:4178',trace:'retain-on-failure',screenshot:'only-on-failure'},
  projects:[{name:'chromium',use:{...devices['Desktop Chrome']}}],
  webServer:{command:'node tests/e2e/server.mjs',url:'http://127.0.0.1:4178/api/provider/health',reuseExistingServer:false,timeout:30000},
});
