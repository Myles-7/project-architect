import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/Li Cheng Xin/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');

const ARTIFACTS_DIR = path.resolve('.playwright-cli/challenger-artifacts');
if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

// Global recording collections
const report = {
  timestamp: new Date().toISOString(),
  phases: [],
  issues: [],
  consoleLogs: [],
  jsExceptions: [],
  networkFailures: [],
  overflowWarnings: [],
  domCollisionIssues: [],
  screenshots: [],
};

function recordIssue(severity, phase, description, reproductionTrace, selector = null, extra = {}) {
  const issue = {
    id: `ISSUE-${report.issues.length + 1}`,
    severity, // P0, P1, P2, P3
    phase,
    description,
    reproductionTrace,
    selector,
    ...extra,
  };
  report.issues.push(issue);
  console.log(`[${severity}] [${phase}] ${description}`);
}

async function detectDomOverflow(page, phaseName) {
  const overflows = await page.evaluate(() => {
    const list = [];
    const docWidth = document.documentElement.clientWidth;
    const bodyScrollWidth = document.documentElement.scrollWidth;

    if (bodyScrollWidth > docWidth + 2) {
      list.push({
        type: 'PAGE_HORIZONTAL_OVERFLOW',
        selector: 'html/body',
        details: `document.documentElement.scrollWidth (${bodyScrollWidth}px) > clientWidth (${docWidth}px) by ${bodyScrollWidth - docWidth}px`,
      });
    }

    const elements = document.querySelectorAll('*');
    for (const el of elements) {
      if (el.scrollWidth > el.clientWidth + 2) {
        const style = window.getComputedStyle(el);
        const overflowX = style.overflowX;
        // Flag if overflow is not auto/scroll (e.g. visible or clip or uncontained)
        if (overflowX !== 'auto' && overflowX !== 'scroll') {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            let sel = el.tagName.toLowerCase();
            if (el.id) sel += `#${el.id}`;
            else if (el.className && typeof el.className === 'string') {
              const classes = el.className.trim().split(/\s+/).slice(0, 3).join('.');
              if (classes) sel += `.${classes}`;
            }
            list.push({
              type: 'UNCONTAINED_OVERFLOW',
              selector: sel,
              scrollWidth: el.scrollWidth,
              clientWidth: el.clientWidth,
              overflowX,
            });
          }
        }
      }
    }
    return list;
  });

  if (overflows && overflows.length > 0) {
    for (const o of overflows) {
      report.overflowWarnings.push({ phase: phaseName, ...o });
    }
  }
  return overflows;
}

async function takeSnapshot(page, name) {
  const filename = `${name}.png`;
  const filePath = path.join(ARTIFACTS_DIR, filename);
  await page.screenshot({ path: filePath, fullPage: false });
  report.screenshots.push({ name, filename });
  return filePath;
}

async function safeCloseModal(page) {
  try {
    const closeBtn = page.locator('button[aria-label="关闭窗口"], button:has-text("关闭"), button:has-text("取消")').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await page.waitForTimeout(300);
    } else {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
    // Wait for backdrop detachment
    await page.locator('.fixed.inset-0.bg-black\\/50, .fixed.inset-0').first().waitFor({ state: 'hidden', timeout: 1500 }).catch(() => {});
  } catch {}
}

async function runChallengerSuite() {
  console.log('================================================================');
  console.log('   PLAYWRIGHT EMPIRICAL CHALLENGER TEST HARNESS LAUNCHING       ');
  console.log('================================================================');

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();

  // Attach event listeners
  page.on('console', (msg) => {
    const entry = {
      type: msg.type(),
      text: msg.text(),
      location: msg.location(),
      timestamp: new Date().toISOString(),
    };
    report.consoleLogs.push(entry);
    if (msg.type() === 'error') {
      console.warn(`[BROWSER CONSOLE ERROR] ${msg.text()}`);
    }
  });

  page.on('pageerror', (err) => {
    const entry = {
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString(),
    };
    report.jsExceptions.push(entry);
    console.error(`[BROWSER UNHANDLED EXCEPTION] ${err.message}`);
    recordIssue('P0', 'RUNTIME_EXCEPTION', `Unhandled JS Exception: ${err.message}`, err.stack);
  });

  page.on('requestfailed', (req) => {
    const entry = {
      url: req.url(),
      method: req.method(),
      failure: req.failure()?.errorText,
      timestamp: new Date().toISOString(),
    };
    report.networkFailures.push(entry);
    console.warn(`[BROWSER REQUEST FAILED] ${req.method()} ${req.url()} - ${req.failure()?.errorText}`);
  });

  // --------------------------------------------------------------------------
  // Phase 1: Home View Initial Load & UI Structure
  // --------------------------------------------------------------------------
  console.log('\n--- Phase 1: Home View Initial Load & UI Structure ---');
  try {
    await page.goto('http://localhost:5174', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);
    await takeSnapshot(page, '01-home-initial');
    await detectDomOverflow(page, 'Phase 1 - Home Initial');

    const brand = page.locator('text=Project Architect').first();
    if (!await brand.isVisible()) {
      recordIssue('P1', 'HOME_LOAD', 'Brand title Project Architect not visible on initial load', 'Navigate to http://localhost:5174');
    }
  } catch (err) {
    recordIssue('P0', 'HOME_LOAD', `Failed to load home page: ${err.message}`, err.stack);
  }

  // --------------------------------------------------------------------------
  // Phase 2: Lifecycle 1 - Project Creation & Cold Start Interactions
  // --------------------------------------------------------------------------
  console.log('\n--- Phase 2: Lifecycle 1 - Cold Start & Presets & Modals ---');
  try {
    // 2.1 Mode switcher: Structured vs Freeform
    const freeformBtn = page.getByRole('button', { name: /自由长文本输入/ });
    const structuredBtn = page.getByRole('button', { name: /四项意图引导/ });

    if (await freeformBtn.isVisible()) {
      await freeformBtn.click();
      await page.waitForTimeout(400);
      await takeSnapshot(page, '02-home-freeform');
      await detectDomOverflow(page, 'Phase 2.1 - Freeform');

      const freeformTextarea = page.locator('textarea').first();
      if (!await freeformTextarea.isVisible()) {
        recordIssue('P1', 'LIFECYCLE_1', 'Freeform textarea not visible when switching to freeform mode', 'Click "自由长文本输入"');
      } else {
        await freeformTextarea.fill('测试自由长文本输入构思...');
        await page.waitForTimeout(300);
      }

      await structuredBtn.click();
      await page.waitForTimeout(400);
      await takeSnapshot(page, '02b-home-structured');
    }

    // 2.2 Presets & Templates Accordion / Tabs
    const templateTabBtn = page.getByRole('button', { name: /场景灵感模板/ });
    if (await templateTabBtn.isVisible()) {
      await templateTabBtn.click();
      await page.waitForTimeout(400);
      await takeSnapshot(page, '03-home-templates-tab');

      const firstTmpl = page.locator('h4').filter({ hasText: /AI 播客/i }).first();
      if (await firstTmpl.isVisible()) {
        await firstTmpl.click();
        await page.waitForTimeout(400);
        console.log('  Applied template: AI 播客');
      }
    }

    const presetTabBtn = page.getByRole('button', { name: /架构模式预设/ });
    if (await presetTabBtn.isVisible()) {
      await presetTabBtn.click();
      await page.waitForTimeout(400);
      await takeSnapshot(page, '03b-home-presets-tab');

      const firstPreset = page.locator('h4').first();
      if (await firstPreset.isVisible()) {
        await firstPreset.click();
        await page.waitForTimeout(300);
      }
    }

    // 2.3 Provider Health Modal (Test open & close cleanly)
    const healthBtn = page.locator('button[title*="查看本地 AI 引擎状态"]');
    if (await healthBtn.isVisible()) {
      await healthBtn.click();
      await page.waitForTimeout(600);
      await takeSnapshot(page, '04-provider-health-modal');

      // Disambiguate close button
      const closeHealth = page.locator('button[aria-label="关闭窗口"]').first();
      if (await closeHealth.isVisible()) {
        await closeHealth.click();
      } else {
        await page.keyboard.press('Escape');
      }
      await page.waitForTimeout(400);
    }

    // 2.4 Directory Browser Modal
    const brownfieldBtn = page.getByRole('button', { name: /从已有代码逆向建项/ });
    if (await brownfieldBtn.isVisible()) {
      await brownfieldBtn.click();
      await page.waitForTimeout(600);
      await takeSnapshot(page, '05-directory-browser-modal');

      const closeBrowser = page.locator('button[aria-label="关闭窗口"]').first();
      if (await closeBrowser.isVisible()) {
        await closeBrowser.click();
      } else {
        await page.keyboard.press('Escape');
      }
      await page.waitForTimeout(400);
    }

    // 2.5 Historical Project Listing & Actions (Search, Pin, Archive)
    const searchInput = page.locator('input[placeholder*="搜索项目"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('想做');
      await page.waitForTimeout(400);
      await takeSnapshot(page, '06-home-project-search');
      await searchInput.fill('');
      await page.waitForTimeout(300);
    }

  } catch (err) {
    recordIssue('P1', 'LIFECYCLE_1_INTERACTIONS', `Error during cold start testing: ${err.message}`, err.stack);
  }

  // --------------------------------------------------------------------------
  // Phase 3: Enter Project Workspace
  // --------------------------------------------------------------------------
  console.log('\n--- Phase 3: Enter Project Workspace ---');
  try {
    // Ensure any open modal is definitely closed
    await safeCloseModal(page);

    const projectCard = page.locator('div[role="button"]:has(span:has-text("想做")), div[role="button"]').first();
    if (await projectCard.isVisible()) {
      console.log('  Clicking project card to open workspace...');
      await projectCard.click();
      // Wait for workspace shell to load
      await page.waitForSelector('button[aria-label="构思与澄清对话"], button[aria-label="决策因果有向图"]', { timeout: 10000 });
      await page.waitForTimeout(1000);
      await takeSnapshot(page, '07-workspace-overview');
      await detectDomOverflow(page, 'Phase 3 - Workspace Entered');
      console.log('  Successfully entered Project Workspace!');
    } else {
      recordIssue('P0', 'WORKSPACE_ENTER', 'No project card available to click on HomeView', 'Look for project card');
    }
  } catch (err) {
    recordIssue('P0', 'WORKSPACE_ENTER', `Failed to enter workspace: ${err.message}`, err.stack);
  }

  // Helper for visiting tabs
  async function visitTab(ariaLabel, snapshotName) {
    const btn = page.locator(`button[aria-label="${ariaLabel}"]`).first();
    if (await btn.isVisible()) {
      await btn.click();
      await page.waitForTimeout(1200);
      await takeSnapshot(page, snapshotName);
      await detectDomOverflow(page, `Tab - ${ariaLabel}`);
      console.log(`  Visited tab: ${ariaLabel}`);
      return true;
    } else {
      recordIssue('P1', 'TAB_NAVIGATION', `Navigation tab "${ariaLabel}" not found in sidebar`, `Look for button[aria-label="${ariaLabel}"]`);
      return false;
    }
  }

  // --------------------------------------------------------------------------
  // Phase 4: Lifecycle 2 - Architecture Discovery & Clarification Q&A
  // --------------------------------------------------------------------------
  console.log('\n--- Phase 4: Lifecycle 2 - Discovery Chat & Q&A ---');
  try {
    await visitTab('构思与澄清对话', '08-chat-view');

    // 4.1 Check NextBestActionBanner & Discovery Ticker
    const banner = page.locator('text=下一步最佳行动').first();
    console.log(`  NextBestActionBanner visible: ${await banner.isVisible()}`);

    // 4.2 Check questions section (Wizard vs List view toggle)
    const listModeBtn = page.getByRole('button', { name: /列表视图/ });
    const wizardModeBtn = page.getByRole('button', { name: /向导模式/ });

    if (await wizardModeBtn.isVisible()) {
      await wizardModeBtn.click();
      await page.waitForTimeout(500);
      await takeSnapshot(page, '08b-chat-wizard-mode');

      // Test option click in wizard
      const optionBtn = page.locator('button').filter({ hasText: /方案|建议|采用|支持/ }).first();
      if (await optionBtn.isVisible()) {
        console.log(`  Wizard mode option button visible: ${await optionBtn.innerText()}`);
      }

      if (await listModeBtn.isVisible()) {
        await listModeBtn.click();
        await page.waitForTimeout(500);
        await takeSnapshot(page, '08c-chat-list-mode');
      }
    }

    // 4.3 Test Chat Input Form & Intensity Switcher
    const chatInput = page.locator('textarea[placeholder*="构思"], textarea[placeholder*="补充"]').first();
    if (await chatInput.isVisible()) {
      await chatInput.fill('这里是一个自动化测试构思输入：希望加入离线数据同步机制。');
      await page.waitForTimeout(300);
      await takeSnapshot(page, '08d-chat-input-filled');

      // Check draft persistence
      const currentVal = await chatInput.inputValue();
      if (!currentVal.includes('离线数据同步')) {
        recordIssue('P2', 'LIFECYCLE_2', 'Chat input failed to hold typed text', 'Fill chat textarea');
      }
      await chatInput.fill('');
    }

    // 4.4 Check Older Questions expander
    const olderQuestionsToggle = page.locator('text=展开旧批次问题');
    if (await olderQuestionsToggle.isVisible()) {
      await olderQuestionsToggle.click();
      await page.waitForTimeout(400);
      await takeSnapshot(page, '08e-chat-older-questions-expanded');
    }

    // 4.5 Test Question Card Interactions (List view)
    const questionCard = page.locator('div[class*="rounded-2xl border"]:has(button:has-text("确认此决定"))').first();
    if (await questionCard.isVisible()) {
      console.log('  Found active question card in list view.');
    }

  } catch (err) {
    recordIssue('P1', 'LIFECYCLE_2', `Error during chat discovery testing: ${err.message}`, err.stack);
  }

  // --------------------------------------------------------------------------
  // Phase 5: Lifecycle 3 - Architecture Overview & Decision Management
  // --------------------------------------------------------------------------
  console.log('\n--- Phase 5: Lifecycle 3 - Overview Drawer & Decision Management ---');
  try {
    // 5.1 Metrics bar in OverviewDrawer
    const confirmedCount = page.locator('span:has-text("已确认")').first();
    console.log(`  Confirmed decisions metric visible: ${await confirmedCount.isVisible()}`);

    // 5.2 Dual View Toggle: Cards vs Outline
    const outlineViewBtn = page.locator('button[title*="紧凑大纲树视图"]').first();
    const cardsViewBtn = page.locator('button[title*="卡片列表视图"]').first();

    if (await outlineViewBtn.isVisible()) {
      await outlineViewBtn.click();
      await page.waitForTimeout(500);
      await takeSnapshot(page, '09-overview-outline-view');
      console.log('  Switched to Outline View');

      if (await cardsViewBtn.isVisible()) {
        await cardsViewBtn.click();
        await page.waitForTimeout(500);
        await takeSnapshot(page, '09b-overview-cards-view');
        console.log('  Switched back to Cards View');
      }
    } else {
      recordIssue('P2', 'LIFECYCLE_3', 'Outline View switcher button not found in OverviewDrawer', 'Look for button[title*="紧凑大纲树视图"]');
    }

    // 5.3 Filter capsules: all, confirmed, candidate, assumption, locked
    const filterCandidate = page.locator('button').filter({ hasText: /^建议/ }).first();
    if (await filterCandidate.isVisible()) {
      await filterCandidate.click();
      await page.waitForTimeout(300);
      await takeSnapshot(page, '09c-overview-filtered-candidates');

      const filterAll = page.locator('button').filter({ hasText: /^全部/ }).first();
      if (await filterAll.isVisible()) {
        await filterAll.click();
        await page.waitForTimeout(300);
      }
    }

    // 5.4 Search Box in Overview
    const overviewSearch = page.locator('input[placeholder*="搜索决策"]').first();
    if (await overviewSearch.isVisible()) {
      await overviewSearch.fill('架构');
      await page.waitForTimeout(300);
      await takeSnapshot(page, '09d-overview-search');
      await overviewSearch.fill('');
      await page.waitForTimeout(200);
    }

    // 5.5 Modal Edit Item
    const editModalBtn = page.locator('button[title*="打开完整弹窗编辑"]').first();
    if (await editModalBtn.isVisible()) {
      await editModalBtn.click();
      await page.waitForTimeout(500);
      await takeSnapshot(page, '09e-modal-edit-overview-item');

      const cancelEdit = page.locator('button[aria-label="关闭窗口"], button:has-text("取消")').first();
      if (await cancelEdit.isVisible()) {
        await cancelEdit.click();
        await page.waitForTimeout(300);
      }
    }

    // 5.6 Test Double-Click Inline Edit on Card
    const firstItemCard = page.locator('[id^="overview-item-"]').first();
    if (await firstItemCard.isVisible()) {
      await firstItemCard.dblclick();
      await page.waitForTimeout(400);
      await takeSnapshot(page, '09f-overview-inline-editing');

      const inlineTextarea = firstItemCard.locator('textarea');
      if (await inlineTextarea.isVisible()) {
        console.log('  Inline editing textarea successfully activated on double click!');
        // Press Escape to cancel
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      } else {
        recordIssue('P2', 'LIFECYCLE_3_INLINE_EDIT', 'Double click on item card did not open inline textarea', 'Double click [id^="overview-item-"]');
      }
    }

  } catch (err) {
    recordIssue('P1', 'LIFECYCLE_3', `Error during overview testing: ${err.message}`, err.stack);
  }

  // --------------------------------------------------------------------------
  // Phase 6: Lifecycle 4 - Topological Spatial DAG & Architecture Diagrams
  // --------------------------------------------------------------------------
  console.log('\n--- Phase 6: Lifecycle 4 - Decision DAG & Diagrams ---');
  try {
    // 6.1 Decision DAG Explorer
    await visitTab('决策因果有向图', '10-tab-decision-dag');

    // Test DAG View Switcher: Canvas vs Cards
    const dagCardsBtn = page.locator('button').filter({ hasText: /层级卡片列表/ }).first();
    const dagCanvasBtn = page.locator('button').filter({ hasText: /拓扑连线画布/ }).first();

    if (await dagCardsBtn.isVisible()) {
      await dagCardsBtn.click();
      await page.waitForTimeout(600);
      await takeSnapshot(page, '10b-dag-cards-view');

      if (await dagCanvasBtn.isVisible()) {
        await dagCanvasBtn.click();
        await page.waitForTimeout(600);
        await takeSnapshot(page, '10c-dag-canvas-view');
      }
    }

    // Test Direction switch: LR vs TD
    const directionBtn = page.locator('button[title*="切换流向"]').first();
    if (await directionBtn.isVisible()) {
      await directionBtn.click();
      await page.waitForTimeout(800);
      await takeSnapshot(page, '10d-dag-direction-td');
      await directionBtn.click();
      await page.waitForTimeout(800);
    }

    // Test Zoom In / Out
    const zoomInBtn = page.locator('button[title*="放大画布"]').first();
    if (await zoomInBtn.isVisible()) {
      await zoomInBtn.click();
      await page.waitForTimeout(200);
      await zoomInBtn.click();
      await page.waitForTimeout(200);
      await takeSnapshot(page, '10e-dag-zoomed-in');
    }

    const resetZoomBtn = page.locator('button[title*="重置缩放与平移"]').first();
    if (await resetZoomBtn.isVisible()) {
      await resetZoomBtn.click();
      await page.waitForTimeout(200);
    }

    // Test Canvas Mouse Pan (Drag)
    const canvasViewport = page.locator('.min-h-\\[500px\\]').first();
    if (await canvasViewport.isVisible()) {
      const box = await canvasViewport.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 80, { steps: 5 });
        await page.mouse.up();
        await page.waitForTimeout(300);
        await takeSnapshot(page, '10f-dag-canvas-panned');
        console.log('  Canvas mouse drag pan tested successfully.');
      }
    }

    // Test Node Click for Cascade Ripple Highlighting
    const dagNode = page.locator('.node').first();
    if (await dagNode.isVisible()) {
      await dagNode.click();
      await page.waitForTimeout(800);
      await takeSnapshot(page, '10g-dag-node-inspected');
      console.log('  DAG node clicked for cascade impact analysis.');
    }

    // Test Raw Mermaid DSL code drawer
    const rawCodeBtn = page.locator('button[title*="查看 Mermaid DSL 源码"]').first();
    if (await rawCodeBtn.isVisible()) {
      await rawCodeBtn.click();
      await page.waitForTimeout(400);
      await takeSnapshot(page, '10h-dag-raw-dsl');
      await rawCodeBtn.click();
      await page.waitForTimeout(200);
    }

    // 6.2 Architecture Diagrams
    await visitTab('架构拓扑与时序', '11-tab-architecture-diagrams');

    const diagramTabs = page.locator('button:has-text("图")');
    const diagCount = await diagramTabs.count();
    console.log(`  Found ${diagCount} architecture diagram tabs.`);
    if (diagCount > 1) {
      await diagramTabs.nth(1).click();
      await page.waitForTimeout(800);
      await takeSnapshot(page, '11b-architecture-diagram-second');
    }

    const svgEl = page.locator('.relative svg').first();
    if (!await svgEl.isVisible()) {
      recordIssue('P1', 'LIFECYCLE_4_MERMAID', 'Architecture diagram SVG not rendered or not visible', 'Check svg in ArchitectureDiagramsView');
    }

  } catch (err) {
    recordIssue('P1', 'LIFECYCLE_4', `Error during DAG / Diagrams testing: ${err.message}`, err.stack);
  }

  // --------------------------------------------------------------------------
  // Phase 7: Lifecycle 5 - Readiness Gate & Blocker Resolution
  // --------------------------------------------------------------------------
  console.log('\n--- Phase 7: Lifecycle 5 - Readiness Review ---');
  try {
    await visitTab('准备度审阅', '12-tab-readiness-review');

    // Check Level and Credibility score
    const levelBadge = page.locator('text=Level').first();
    console.log(`  Level badge visible: ${await levelBadge.isVisible()}`);

    // Check 8 core areas
    const areasHeading = page.locator('text=八大核心领域全景审阅').first();
    console.log(`  8 core areas heading visible: ${await areasHeading.isVisible()}`);

    // Test Score Breakdown toggle
    const scoreDetailsBtn = page.locator('button:has-text("查看体检明细"), button:has-text("收起得分明细")').first();
    if (await scoreDetailsBtn.isVisible()) {
      await scoreDetailsBtn.click();
      await page.waitForTimeout(400);
      await takeSnapshot(page, '12b-readiness-score-details');
      await scoreDetailsBtn.click();
      await page.waitForTimeout(200);
    }

    // Expand evidence on first satisfied area
    const expandEvidenceBtn = page.locator('button:has-text("展开证据")').first();
    if (await expandEvidenceBtn.isVisible()) {
      await expandEvidenceBtn.click();
      await page.waitForTimeout(400);
      await takeSnapshot(page, '12c-readiness-evidence-expanded');
    }

    // Check Advanced Approval toggle
    const advancedApprovalBtn = page.locator('button:has-text("展开高级审批模式"), button:has-text("收起高级审批选项")').first();
    if (await advancedApprovalBtn.isVisible()) {
      await advancedApprovalBtn.click();
      await page.waitForTimeout(400);
      await takeSnapshot(page, '12d-readiness-advanced-modes');
    }

    // Check approval button state
    const approveBtn = page.locator('button').filter({ hasText: /签署准入|前往规范文档/ }).first();
    if (await approveBtn.isVisible()) {
      console.log(`  Approval / Nav button visible: ${await approveBtn.innerText()}`);
    }

  } catch (err) {
    recordIssue('P1', 'LIFECYCLE_5', `Error during readiness testing: ${err.message}`, err.stack);
  }

  // --------------------------------------------------------------------------
  // Phase 8: Lifecycle 6 - Document Blueprints & Delivery Export
  // --------------------------------------------------------------------------
  console.log('\n--- Phase 8: Lifecycle 6 - Document Compilation & Export ---');
  try {
    await visitTab('规格蓝图文档', '13-tab-documents-view');

    // Check if documents are generated
    const docItems = page.locator('div[class*="rounded-xl border"]:has(span:has-text(".md"))');
    const docCount = await docItems.count();
    console.log(`  Found ${docCount} document items in sidebar.`);

    if (docCount > 0) {
      // Switch view mode: Rendered vs Raw vs Edit
      const rawBtn = page.locator('button').filter({ hasText: '源码' }).first();
      const editBtn = page.locator('button').filter({ hasText: '编辑' }).first();
      const previewBtn = page.locator('button').filter({ hasText: '预览' }).first();

      if (await rawBtn.isVisible()) {
        await rawBtn.click();
        await page.waitForTimeout(400);
        await takeSnapshot(page, '13b-docs-raw-mode');

        if (await editBtn.isVisible()) {
          await editBtn.click();
          await page.waitForTimeout(400);
          await takeSnapshot(page, '13c-docs-edit-mode');

          const docTextarea = page.locator('textarea').first();
          if (!await docTextarea.isVisible()) {
            recordIssue('P1', 'LIFECYCLE_6', 'Document edit textarea not visible in edit mode', 'Click "编辑" in DocumentsView');
          }
        }

        if (await previewBtn.isVisible()) {
          await previewBtn.click();
          await page.waitForTimeout(300);
        }
      }

      // Test Agent Prompt Modal
      const promptBtn = page.locator('button').filter({ hasText: /复制 Agent 启动词/ }).first();
      if (await promptBtn.isVisible()) {
        await promptBtn.click();
        await page.waitForTimeout(600);
        await takeSnapshot(page, '13d-modal-agent-prompt');
        await safeCloseModal(page);
      }

      // Test Spec Drift Modal
      const driftBtn = page.locator('button').filter({ hasText: /规范漂移审计/ }).first();
      if (await driftBtn.isVisible()) {
        await driftBtn.click();
        await page.waitForTimeout(600);
        await takeSnapshot(page, '13e-modal-spec-drift');
        await safeCloseModal(page);
      }

      // Test Export to Local Directory Modal
      const folderExportBtn = page.locator('button').filter({ hasText: /输出至本地目录/ }).first();
      if (await folderExportBtn.isVisible()) {
        await folderExportBtn.click();
        await page.waitForTimeout(600);
        await takeSnapshot(page, '13f-modal-export-folder');
        await safeCloseModal(page);
      }
    } else {
      recordIssue('P2', 'LIFECYCLE_6', 'No compiled documents displayed in DocumentsView', 'Check documentList.items');
    }

  } catch (err) {
    recordIssue('P1', 'LIFECYCLE_6', `Error during documents testing: ${err.message}`, err.stack);
  }

  // --------------------------------------------------------------------------
  // Phase 9: Multi-Viewport Emulation & Breakpoint Auditing
  // --------------------------------------------------------------------------
  console.log('\n--- Phase 9: Multi-Viewport Emulation & Breakpoint Auditing ---');
  const viewports = [
    { width: 1440, height: 900, name: 'desktop-1440' },
    { width: 1024, height: 768, name: 'compact-desktop-1024' },
    { width: 768, height: 1024, name: 'tablet-768' },
    { width: 375, height: 812, name: 'mobile-375' },
  ];

  for (const vp of viewports) {
    console.log(`  Emulating viewport ${vp.name} (${vp.width}x${vp.height})...`);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(800);
    await takeSnapshot(page, `viewport-workspace-${vp.name}`);
    const overflows = await detectDomOverflow(page, `Workspace Viewport ${vp.name}`);

    if (overflows.length > 0) {
      console.warn(`  [OVERFLOW DETECTED] at ${vp.name}: ${JSON.stringify(overflows)}`);
      recordIssue('P1', 'RESPONSIVE_OVERFLOW', `Horizontal layout overflow detected in workspace at ${vp.name} (${vp.width}px)`, `Resize viewport to ${vp.width}x${vp.height}`, 'html/body', { overflows });
    }

    if (vp.width < 1024) {
      // In tablet & mobile, overview should be in drawer overlay
      console.log(`  Testing drawer overlay behavior at ${vp.width}px...`);
    }
  }

  // Reset to desktop
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(400);

  // --------------------------------------------------------------------------
  // Phase 10: Theme Consistency (Dark vs Light)
  // --------------------------------------------------------------------------
  console.log('\n--- Phase 10: Dark Mode Theme Verification ---');
  try {
    await safeCloseModal(page);
    const themeBtn = page.getByRole('button', { name: /切换界面主题/i }).first();
    if (await themeBtn.isVisible()) {
      await themeBtn.click();
      await page.waitForTimeout(600);
      await takeSnapshot(page, '14-theme-dark-workspace');
      console.log('  Switched to Dark Mode');

      const isDarkClass = await page.evaluate(() => {
        return document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');
      });
      console.log(`  HTML/Body dark class applied: ${isDarkClass}`);

      await detectDomOverflow(page, 'Phase 10 - Dark Mode');

      // Toggle back to light mode
      await themeBtn.click();
      await page.waitForTimeout(400);
    } else {
      recordIssue('P2', 'THEME', 'Theme toggle button not found in TopNav', 'Look for button[name*="切换界面主题"]');
    }
  } catch (err) {
    recordIssue('P2', 'THEME', `Error during theme toggle: ${err.message}`, err.stack);
  }

  // --------------------------------------------------------------------------
  // Final Wrap-up & Output Generation
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log('   CHALLENGER EXECUTION COMPLETE - COMPILING REPORT DATA         ');
  console.log('================================================================');

  const reportPath = path.join(ARTIFACTS_DIR, 'challenger-test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`Report JSON written to ${reportPath}`);
  console.log(`Total issues identified: ${report.issues.length}`);
  console.log(`Total console logs captured: ${report.consoleLogs.length}`);
  console.log(`Total JS exceptions: ${report.jsExceptions.length}`);
  console.log(`Total network failures: ${report.networkFailures.length}`);
  console.log(`Total overflow warnings: ${report.overflowWarnings.length}`);
  console.log(`Total screenshots captured: ${report.screenshots.length}`);

  await browser.close();
  return report;
}

runChallengerSuite().catch((err) => {
  console.error('Challenger harness failed:', err);
  process.exit(1);
});
