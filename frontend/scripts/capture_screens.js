import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const outDir = 'C:\\Users\\Li Cheng Xin\\.gemini\\antigravity\\brain\\4892b17a-06f0-4870-bbd8-c82618dcf68b\\screenshots';

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const edgePath = fs.existsSync('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe')
  ? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  : 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe';

async function run() {
  console.log('Launching browser with edge:', edgePath);
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  // 1. Homepage Light
  console.log('Capturing Homepage Light...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
  await page.evaluate(() => {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('pa_theme', 'light');
  });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(outDir, '01_homepage_light.png') });

  // 2. Homepage Dark
  console.log('Capturing Homepage Dark...');
  await page.evaluate(() => {
    document.documentElement.classList.add('dark');
    localStorage.setItem('pa_theme', 'dark');
  });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(outDir, '02_homepage_dark.png') });

  // 3. Enter Workspace Light
  console.log('Capturing Workspace Chat Light...');
  await page.evaluate(() => {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('pa_theme', 'light');
  });
  const startBtn = await page.$('button[type="submit"]');
  if (startBtn) {
    await startBtn.click();
    await new Promise(r => setTimeout(r, 800));
  }
  await page.screenshot({ path: path.join(outDir, '03_workspace_chat_light.png') });

  // 4. Workspace Chat Dark (Scrolled to Question Card)
  console.log('Capturing Workspace Chat Dark (scrolled)...');
  await page.evaluate(() => {
    document.documentElement.classList.add('dark');
    localStorage.setItem('pa_theme', 'dark');
    const scrollContainer = document.querySelector('main > div:first-child');
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(outDir, '04_workspace_chat_dark.png') });

  // 5. Answer question to show interactive progression
  console.log('Capturing Question Answered state...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => b.textContent.includes('确认采纳') || b.textContent.includes('提交回答意向') || b.textContent.includes('确认此决定'));
    if (btn) {
      btn.click();
    }
  });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(outDir, '05_workspace_question_answered.png') });

  // 6. Switch to Readiness View
  console.log('Capturing Readiness View...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => b.textContent.includes('开发准备度') || b.textContent.includes('Ready'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(outDir, '06_workspace_readiness.png') });

  // 7. Switch to Documents View
  console.log('Capturing Documents View...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => b.textContent.includes('蓝图文档') || b.textContent.includes('规格蓝图'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(outDir, '07_workspace_documents.png') });

  await browser.close();
  console.log('All screenshots captured successfully in:', outDir);
}

run().catch(console.error);
