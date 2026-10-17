const { chromium } = require('C:/Users/Li Cheng Xin/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  
  let currentStep = 'init';
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`[${currentStep}] CONSOLE ERROR:`, msg.text());
    }
  });

  currentStep = 'goto-home';
  await page.goto('http://localhost:5174');
  await page.waitForTimeout(1000);

  currentStep = 'open-project';
  await page.locator('div[role="button"]').first().click();
  await page.waitForTimeout(1500);

  const tabs = [
    '构思与澄清对话',
    '决策因果有向图',
    '架构拓扑与时序',
    '规格蓝图文档',
    '输入材料与附件',
    '准备度审阅',
    '演进时间线',
    '工作台设置',
  ];

  for (const tab of tabs) {
    currentStep = `tab-${tab}`;
    const btn = page.locator(`button[aria-label="${tab}"]`).first();
    if (await btn.isVisible()) {
      await btn.click();
      await page.waitForTimeout(1000);
    }
  }

  await browser.close();
})();
