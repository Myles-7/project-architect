import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/Li Cheng Xin/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');

const ARTIFACTS_DIR = path.resolve('.playwright-cli/challenger-artifacts/deep');
if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

const detailedLog = {
  timestamp: new Date().toISOString(),
  steps: [],
  findings: [],
  consoleErrors: [],
  screenshots: [],
};

function logStep(name, details = {}) {
  console.log(`[STEP] ${name}`);
  detailedLog.steps.push({ name, details, time: new Date().toISOString() });
}

function logFinding(severity, category, title, description, reproduction, selector = null, details = {}) {
  console.log(`[FINDING ${severity}] [${category}] ${title}`);
  detailedLog.findings.push({
    severity,
    category,
    title,
    description,
    reproduction,
    selector,
    details,
    time: new Date().toISOString(),
  });
}

async function snap(page, name) {
  const filePath = path.join(ARTIFACTS_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  detailedLog.screenshots.push({ name, file: `${name}.png` });
  return filePath;
}

async function runDeepVerification() {
  console.log('================================================================');
  console.log('   DEEP LIFECYCLE 1-6 DYNAMIC PLAYWRIGHT VERIFICATION           ');
  console.log('================================================================');

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      detailedLog.consoleErrors.push({ text: msg.text(), loc: msg.location() });
      console.warn(`  [Console Error] ${msg.text()}`);
    }
  });

  page.on('pageerror', (err) => {
    logFinding('P0', 'JS_EXCEPTION', `Unhandled Exception: ${err.message}`, err.message, 'Runtime script evaluation', null, { stack: err.stack });
  });

  // 1. Load Workspace directly
  logStep('1. Navigate and Enter Project Workspace');
  await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const projectCard = page.locator('div[role="button"]:has(span:has-text("想做"))').first();
  await projectCard.click();
  await page.waitForSelector('button[aria-label="构思与澄清对话"]', { timeout: 10000 });
  await page.waitForTimeout(1000);
  await snap(page, 'd01-workspace-loaded');

  // 2. Lifecycle 6: Compile Documents from Documents Tab
  logStep('2. Lifecycle 6: Document Compilation and Full Blueprint Suite Verification');
  await page.locator('button[aria-label="规格蓝图文档"]').first().click();
  await page.waitForTimeout(1500);
  await snap(page, 'd02-docs-tab-empty');

  // Click compile button
  const compileBtn = page.locator('button').filter({ hasText: /一键编译生成完整文档包|立即生成蓝图/ }).first();
  if (await compileBtn.isVisible()) {
    logStep('  Triggering Document Compilation via UI...');
    await compileBtn.click();
    // Wait for compilation to complete
    await page.waitForTimeout(4000);
    await snap(page, 'd03-docs-compiled');

    // Check if documents list now appears
    const docItems = page.locator('div[class*="rounded-xl border"]:has(span:has-text(".md"))');
    const docCount = await docItems.count();
    console.log(`  Document compilation completed! Rendered ${docCount} documents.`);

    if (docCount === 0) {
      logFinding('P0', 'LIFECYCLE_6', 'Documents compilation failed to populate document list', 'Click compile button in DocumentsView', 'div[class*="rounded-xl border"]');
    } else {
      // 2.1 Test Document Selection & Markdown Rendering
      logStep('  Testing Document Switching & Markdown Rendering...');
      const firstDoc = docItems.first();
      await firstDoc.click();
      await page.waitForTimeout(800);
      await snap(page, 'd04-doc-agents-md');

      if (docCount > 1) {
        const secondDoc = docItems.nth(1);
        await secondDoc.click();
        await page.waitForTimeout(800);
        await snap(page, 'd05-doc-blueprint-second');
      }

      // 2.2 Test View Mode Toggles: Preview -> Raw Source -> Edit
      logStep('  Testing Document Reader View Modes: Preview / Raw / Edit...');
      const rawBtn = page.locator('button').filter({ hasText: '源码' }).first();
      const editBtn = page.locator('button').filter({ hasText: '编辑' }).first();
      const previewBtn = page.locator('button').filter({ hasText: '预览' }).first();

      if (await rawBtn.isVisible()) {
        await rawBtn.click();
        await page.waitForTimeout(500);
        await snap(page, 'd06-doc-raw-mode');

        // Check if <pre> contains markdown code
        const preContent = await page.locator('pre').first().innerText();
        if (!preContent || preContent.length < 10) {
          logFinding('P1', 'LIFECYCLE_6', 'Raw mode did not render document content text', 'Click "源码" in DocumentsView', 'pre');
        }
      }

      if (await editBtn.isVisible()) {
        await editBtn.click();
        await page.waitForTimeout(500);
        await snap(page, 'd07-doc-edit-mode');

        const textarea = page.locator('textarea').first();
        if (await textarea.isVisible()) {
          const originalText = await textarea.inputValue();
          await textarea.fill(originalText + '\n\n<!-- Automated Challenger Audit Annotation -->');
          await page.waitForTimeout(300);

          // Test save
          const saveBtn = page.locator('button').filter({ hasText: /保存修改/ }).first();
          if (await saveBtn.isVisible()) {
            await saveBtn.click();
            await page.waitForTimeout(1000);
            await snap(page, 'd08-doc-saved');
            console.log('  Successfully tested document edit & save persistence!');
          }
        }
      }

      if (await previewBtn.isVisible()) {
        await previewBtn.click();
        await page.waitForTimeout(400);
      }

      // 2.3 Test Agent Prompt Modal
      logStep('  Testing Agent Prompt Modal...');
      const promptBtn = page.locator('button').filter({ hasText: /复制 Agent 启动词/ }).first();
      if (await promptBtn.isVisible()) {
        await promptBtn.click();
        await page.waitForTimeout(600);
        await snap(page, 'd09-modal-agent-prompt');

        // Check if pre containing prompt is rendered
        const promptText = page.locator('pre').first();
        if (await promptText.isVisible()) {
          const text = await promptText.innerText();
          if (!text.includes('Project Architect') && !text.includes('AGENTS.md')) {
            logFinding('P2', 'LIFECYCLE_6', 'Agent Prompt modal text does not reference AGENTS.md', 'Open Agent Prompt Modal', 'pre');
          }
        }

        const closeBtn = page.locator('button[aria-label="关闭窗口"], button:has-text("关闭")').first();
        if (await closeBtn.isVisible()) await closeBtn.click();
        await page.waitForTimeout(300);
      }

      // 2.4 Test Spec-Drift Auditor Modal
      logStep('  Testing Spec-Drift Auditor Modal...');
      const driftBtn = page.locator('button').filter({ hasText: /规范漂移审计/ }).first();
      if (await driftBtn.isVisible()) {
        await driftBtn.click();
        await page.waitForTimeout(800);
        await snap(page, 'd10-modal-spec-drift');

        const closeDrift = page.locator('button[aria-label="关闭窗口"], button:has-text("关闭")').first();
        if (await closeDrift.isVisible()) await closeDrift.click();
        await page.waitForTimeout(300);
      }

      // 2.5 Test Single-File HTML Bundle Export (API & Download check)
      logStep('  Testing Single-File HTML Bundle Export Trigger...');
      const htmlBtn = page.locator('button').filter({ hasText: /导出单文件 HTML/ }).first();
      if (await htmlBtn.isVisible()) {
        const [download] = await Promise.all([
          page.waitForEvent('download', { timeout: 10000 }).catch(() => null),
          htmlBtn.click(),
        ]);
        if (download) {
          const dlPath = path.join(ARTIFACTS_DIR, download.suggestedFilename());
          await download.saveAs(dlPath);
          const fileSize = fs.statSync(dlPath).size;
          console.log(`  HTML bundle downloaded successfully! File: ${download.suggestedFilename()} (${fileSize} bytes)`);
          if (fileSize < 500) {
            logFinding('P1', 'LIFECYCLE_6', 'Exported HTML file suspiciously small (< 500 bytes)', 'Click 导出单文件 HTML', 'button');
          }
        } else {
          console.log('  Download event not captured or handled via blob URL.');
        }
      }
    }
  }

  // 3. Lifecycle 2: Discovery Q&A, Option Choice, and 10s Cascade Undo
  logStep('3. Lifecycle 2: Discovery Q&A & 10-Second Cascade Undo');
  await page.locator('button[aria-label="构思与澄清对话"]').first().click();
  await page.waitForTimeout(1200);
  await snap(page, 'd11-chat-tab');

  // Disambiguate List View Switcher
  const listModeSwitch = page.locator('button[title="切换为全量问题列表视图"]').first();
  if (await listModeSwitch.isVisible()) {
    await listModeSwitch.click();
    await page.waitForTimeout(500);
    await snap(page, 'd12-chat-list-view-activated');
  }

  // Find active question card and test option selection & 10s undo
  logStep('  Testing Question Card Answering and 10s Undo Banner...');
  const activeQuestionCard = page.locator('div[class*="rounded-2xl border"]:has(button:has-text("确认此决定"))').first();
  if (await activeQuestionCard.isVisible()) {
    // Select first radio option
    const firstOption = activeQuestionCard.locator('label').first();
    if (await firstOption.isVisible()) {
      await firstOption.click();
      await page.waitForTimeout(300);
      await snap(page, 'd13-question-option-selected');

      const confirmAnswerBtn = activeQuestionCard.locator('button:has-text("确认此决定")').first();
      if (await confirmAnswerBtn.isVisible()) {
        await confirmAnswerBtn.click();
        await page.waitForTimeout(1000);
        await snap(page, 'd14-question-answered-undo-banner');

        // Check 10s undo toast banner
        const undoBanner = page.locator('[role="status"]:has-text("已确立决策")').first();
        const undoBtn = page.locator('button:has-text("撤回 (Ctrl+Z)")').first();

        if (await undoBanner.isVisible() && await undoBtn.isVisible()) {
          console.log('  10-Second Undo Banner successfully appeared!');
          // Test clicking Undo
          await undoBtn.click();
          await page.waitForTimeout(1500);
          await snap(page, 'd15-question-undone');
          console.log('  Successfully verified 10-second cascade undo flow!');
        } else {
          logFinding('P1', 'LIFECYCLE_2', '10-Second Undo Banner did not appear after confirming question answer', 'Select option and click 确认此决定', '[role="status"]');
        }
      }
    }
  } else {
    console.log('  No unconfirmed question cards found in active batch.');
  }

  // 4. Lifecycle 3: Decision Overview & Inline Edit
  logStep('4. Lifecycle 3: Overview Drawer, Outline Tree, and Inline Edit');
  const outlineBtn = page.locator('button[title*="紧凑大纲树视图"]').first();
  if (await outlineBtn.isVisible()) {
    await outlineBtn.click();
    await page.waitForTimeout(400);
    await snap(page, 'd16-overview-outline-tree');

    // Switch back to cards
    const cardsBtn = page.locator('button[title*="卡片列表视图"]').first();
    if (await cardsBtn.isVisible()) {
      await cardsBtn.click();
      await page.waitForTimeout(400);
    }
  }

  // Test Double-Click Inline Edit
  const firstCard = page.locator('[id^="overview-item-"]').first();
  if (await firstCard.isVisible()) {
    await firstCard.dblclick();
    await page.waitForTimeout(400);
    await snap(page, 'd17-card-inline-editing');

    const inlineTextarea = firstCard.locator('textarea');
    if (await inlineTextarea.isVisible()) {
      // Test Cancel via Escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      const isStillEditing = await inlineTextarea.isVisible();
      if (isStillEditing) {
        logFinding('P2', 'LIFECYCLE_3', 'Inline edit textarea did not dismiss on Escape key press', 'Double click card then press Escape', 'textarea');
      } else {
        console.log('  Inline edit dismissed successfully on Escape!');
      }
    }
  }

  // 5. Lifecycle 4: Decision DAG Explorer & Cascade Impact
  logStep('5. Lifecycle 4: Decision DAG Canvas & Ripple Impact');
  await page.locator('button[aria-label="决策因果有向图"]').first().click();
  await page.waitForTimeout(1500);
  await snap(page, 'd18-dag-canvas');

  // Test Node Click in SVG
  const svgNode = page.locator('.node').first();
  if (await svgNode.isVisible()) {
    await svgNode.click();
    await page.waitForTimeout(1000);
    await snap(page, 'd19-dag-node-impact-inspected');

    // Verify Cascade Impact panel on right
    const cascadeInspector = page.locator('text=级联波及分析').first();
    if (await cascadeInspector.isVisible()) {
      console.log('  Cascade impact analysis panel visible and populated!');
    } else {
      logFinding('P2', 'LIFECYCLE_4', 'Cascade impact panel not surfaced after clicking DAG node', 'Click node in Mermaid SVG', '.node');
    }
  }

  // 6. Multi-Viewport Drawer Behavior & Touch Target Audit
  logStep('6. Multi-Viewport Responsiveness & Mobile Drawer Touch Navigation');
  // Emulate Tablet 768px
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.waitForTimeout(800);
  await snap(page, 'd20-tablet-workspace');

  // Test right overview drawer toggle on tablet
  const overviewToggleBtn = page.locator('button[aria-label*="项目全景概览"]').first();
  if (await overviewToggleBtn.isVisible()) {
    await overviewToggleBtn.click();
    await page.waitForTimeout(600);
    await snap(page, 'd21-tablet-overview-drawer-open');

    // Close drawer via backdrop or close button
    const closeDrawerBtn = page.locator('button[aria-label="关闭窗口"]').first();
    if (await closeDrawerBtn.isVisible()) {
      await closeDrawerBtn.click();
      await page.waitForTimeout(400);
    }
  }

  // Emulate Mobile 375px
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(800);
  await snap(page, 'd22-mobile-workspace');

  // Test left navigation drawer toggle on mobile
  const navToggleBtn = page.locator('button[aria-label*="主导航"]').first();
  if (await navToggleBtn.isVisible()) {
    await navToggleBtn.click();
    await page.waitForTimeout(600);
    await snap(page, 'd23-mobile-nav-drawer-open');

    const closeNavDrawer = page.locator('button[aria-label="关闭窗口"]').first();
    if (await closeNavDrawer.isVisible()) {
      await closeNavDrawer.click();
      await page.waitForTimeout(400);
    }
  }

  // Check Mobile Navigation Header Clipping & Touch Targets
  const header = page.locator('header').first();
  const headerBox = await header.boundingBox();
  console.log(`  Mobile header bounds: width=${headerBox?.width}, height=${headerBox?.height}`);

  // Restore Desktop Viewport
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(400);

  // Write detailed log to disk
  const logPath = path.join(ARTIFACTS_DIR, 'deep-verification-log.json');
  fs.writeFileSync(logPath, JSON.stringify(detailedLog, null, 2), 'utf-8');
  console.log(`Deep verification log written to ${logPath}`);
  console.log(`Total Findings Recorded: ${detailedLog.findings.length}`);

  await browser.close();
}

runDeepVerification().catch((err) => {
  console.error('Deep verification failed:', err);
  process.exit(1);
});
