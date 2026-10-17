import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/Li Cheng Xin/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');

const ARTIFACTS_DIR = path.resolve('.playwright-cli/challenger-artifacts/undo-test');
if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

async function testUndo() {
  console.log('Testing 10-Second Cascade Undo Flow with Expansion...');

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const projCard = page.locator('div[role="button"]:has(span:has-text("想做"))').first();
  await projCard.click();
  await page.waitForSelector('button[aria-label="构思与澄清对话"]', { timeout: 8000 });

  await page.locator('button[aria-label="构思与澄清对话"]').first().click();
  await page.waitForTimeout(1500);

  // Switch to list view
  const listViewBtn = page.locator('button[title="切换为全量问题列表视图"]').first();
  if (await listViewBtn.isVisible()) {
    await listViewBtn.click();
    await page.waitForTimeout(600);
  }

  // Look for card by question text or expand button
  const expandBtn = page.locator('button:has-text("展开回答与详情")').first();
  if (await expandBtn.isVisible()) {
    console.log('  Found collapsed question card! Clicking 展开回答与详情...');
    await expandBtn.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '01-expanded-question-card.png') });

    // Click first option
    const opt = page.locator('[role="radio"]').first();
    if (await opt.isVisible()) {
      await opt.click();
      await page.waitForTimeout(300);
    }

    // Click "确认并继续"
    const confirmBtn = page.locator('button:has-text("确认并继续")').first();
    if (await confirmBtn.isVisible()) {
      console.log('  Clicking "确认并继续"...');
      await confirmBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, '02-undo-banner-visible.png') });

      // Check undo toast banner
      const undoBanner = page.locator('[role="status"]:has-text("已确立决策")').first();
      const undoBtn = page.locator('button:has-text("撤回 (Ctrl+Z)")').first();

      console.log(`  Undo banner visible: ${await undoBanner.isVisible()}`);
      console.log(`  Undo button visible: ${await undoBtn.isVisible()}`);

      if (await undoBtn.isVisible()) {
        await undoBtn.click();
        await page.waitForTimeout(1500);
        await page.screenshot({ path: path.join(ARTIFACTS_DIR, '03-after-undo-retracted.png') });
        console.log('  SUCCESS: Undo button clicked, question successfully retracted!');
      }
    }
  } else {
    // Check if "采纳推荐" button is visible directly
    const adoptBtn = page.locator('button:has-text("采纳推荐")').first();
    if (await adoptBtn.isVisible()) {
      console.log('  Found adopt recommendation button! Clicking...');
      await adoptBtn.click();
      await page.waitForTimeout(400);
      const confirmBtn = page.locator('button:has-text("确认并继续")').first();
      if (await confirmBtn.isVisible()) {
        await confirmBtn.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: path.join(ARTIFACTS_DIR, '02-undo-banner-visible.png') });
      }
    } else {
      console.warn('  Neither expand nor adopt button found.');
    }
  }

  await browser.close();
}

testUndo().catch(console.error);
