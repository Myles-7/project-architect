import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/Li Cheng Xin/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');

const SCREENSHOT_DIR = path.resolve('.playwright-cli/audit-screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runAudit() {
  console.log('Starting full visual audit...');
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();

  const consoleLogs = [];
  page.on('console', (msg) => {
    consoleLogs.push({ type: msg.type(), text: msg.text() });
  });

  console.log('1. Home Default...');
  await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-home-default.png'), fullPage: true });

  console.log('2. Home Freeform...');
  const freeformBtn = page.getByRole('button', { name: /自由长文本输入/ });
  if (await freeformBtn.isVisible()) {
    await freeformBtn.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-home-freeform.png'), fullPage: true });
    await page.getByRole('button', { name: /四项意图引导/ }).click();
    await page.waitForTimeout(300);
  }

  console.log('3. Home Templates...');
  const templatesBtn = page.getByRole('button', { name: /典型场景与灵感模板/ });
  if (await templatesBtn.isVisible()) {
    await templatesBtn.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-home-templates.png'), fullPage: true });
  }

  console.log('4. Modal Provider Health...');
  const healthBtn = page.locator('button[title*="查看本地 AI 引擎状态"]');
  if (await healthBtn.isVisible()) {
    await healthBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-modal-provider-health.png') });
    await page.getByRole('button', { name: '关闭' }).click();
    await page.waitForTimeout(400);
  }

  console.log('5. Modal Directory Browser...');
  const brownfieldBtn = page.getByRole('button', { name: /从已有代码逆向建项/ });
  if (await brownfieldBtn.isVisible()) {
    await brownfieldBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-modal-directory-browser.png') });
    await page.locator('button[aria-label="关闭窗口"]').click();
    await page.waitForTimeout(400);
  }

  console.log('6. Open Project Workspace...');
  const projectItem = page.locator('div[role="button"]').first();
  await projectItem.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-workspace-overview.png') });

  // Tab navigation helper using exact aria-label
  async function visitTab(ariaLabel, filename) {
    const btn = page.locator(`button[aria-label="${ariaLabel}"]`).first();
    if (await btn.isVisible()) {
      await btn.click();
      await page.waitForTimeout(1200);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, filename) });
      console.log(`  Captured ${filename} (${ariaLabel})`);
      return true;
    } else {
      console.warn(`  Tab "${ariaLabel}" not found!`);
      return false;
    }
  }

  console.log('7. Tab: 构思与澄清对话...');
  await visitTab('构思与澄清对话', '07-tab-discovery-chat.png');

  console.log('8. Tab: 决策因果有向图...');
  await visitTab('决策因果有向图', '08-tab-decision-dag.png');

  console.log('9. Tab: 架构拓扑与时序...');
  await visitTab('架构拓扑与时序', '09-tab-architecture-diagrams.png');

  console.log('10. Tab: 规格蓝图文档...');
  await visitTab('规格蓝图文档', '10-tab-documents-view.png');

  console.log('11. Tab: 输入材料与附件...');
  await visitTab('输入材料与附件', '11-tab-files-materials.png');

  // Test Upload Material Modal inside Files tab
  const uploadBtn = page.locator('button').filter({ hasText: /上传材料|添加材料|上传文件/i }).first();
  if (await uploadBtn.isVisible()) {
    await uploadBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '11b-modal-upload-material.png') });
    const closeUpload = page.locator('button[aria-label="关闭窗口"], button:has-text("取消")').first();
    if (await closeUpload.isVisible()) await closeUpload.click();
    await page.waitForTimeout(400);
  }

  console.log('12. Tab: 准备度审阅...');
  await visitTab('准备度审阅', '12-tab-readiness-review.png');

  console.log('13. Tab: 演进时间线...');
  await visitTab('演进时间线', '13-tab-timeline-view.png');

  console.log('14. Tab: 工作台设置...');
  await visitTab('工作台设置', '14-tab-settings-diagnostics.png');

  // Test Overview Item Edit Modal
  console.log('15. Testing Overview Item Edit Modal...');
  const editItemBtn = page.locator('button[title*="编辑"], button[title*="修改"], button[aria-label*="编辑"]').first();
  if (await editItemBtn.isVisible()) {
    await editItemBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '15-modal-edit-overview-item.png') });
    const cancelBtn = page.locator('button[aria-label="关闭窗口"], button:has-text("取消")').first();
    if (await cancelBtn.isVisible()) await cancelBtn.click();
    await page.waitForTimeout(400);
  }

  // 18. Responsive Mobile Viewport (375x812)
  console.log('18. Mobile Viewport (375x812)...');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '18-mobile-workspace.png') });

  // 19. Responsive Tablet Viewport (768x1024)
  console.log('19. Tablet Viewport (768x1024)...');
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '19-tablet-workspace.png') });

  // 20. Dark Mode Workspace
  console.log('20. Dark Mode Workspace (1440x900)...');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(400);
  const themeBtn = page.getByRole('button', { name: /切换界面主题/i }).first();
  if (await themeBtn.isVisible()) {
    await themeBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '20-dark-workspace.png') });
  }

  // 21. Dark Mode Home
  console.log('21. Dark Mode Home...');
  const logoHomeBtn = page.locator('header a, header button').filter({ hasText: /Project Architect/i }).first();
  if (await logoHomeBtn.isVisible()) {
    await logoHomeBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '21-dark-home.png'), fullPage: true });
  }

  // Save console logs
  fs.writeFileSync(
    path.join(SCREENSHOT_DIR, 'audit-console-logs.json'),
    JSON.stringify(consoleLogs, null, 2),
    'utf-8'
  );

  console.log('FULL AUDIT FINISHED SUCCESSFULLY! All screenshots generated.');
  await browser.close();
}

runAudit().catch((err) => {
  console.error('Audit script failed:', err);
  process.exit(1);
});
