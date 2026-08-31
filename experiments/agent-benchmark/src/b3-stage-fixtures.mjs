/**
 * B3 Multi-Stage Discovery Fixtures
 *
 * Provides realistic project state snapshots across the 4 B3 discovery stages:
 * 1. initial: Fresh project with initial raw idea (Budget: max 12 questions, target 8-12)
 * 2. explore: Core problem & users confirmed; exploring architectural & tech tradeoffs (Budget: max 8 questions, target 6-8)
 * 3. converge: Key tech choices locked; resolving boundary, failure & sync gaps (Budget: max 4 questions, target 2-4)
 * 4. readiness: Almost complete blueprint; confirming final acceptance & operational assumptions (Budget: max 2 questions, target 1-2)
 */

export const MULTI_STAGE_CASES = [
  'case-01', // SpaceCleaner Desktop Utility
  'case-02', // Markdown Knowledge Base Tool
  'case-03', // Audio Metadata Tagger CLI
  'case-04', // Local-First Todo & Task Tracker
];

export function getStageFixture(caseId, stage) {
  const baseFixtures = {
    'case-01': {
      name: 'SpaceCleaner (桌面磁盘空间深度清理工具)',
      idea: '开发一款完全离线运行的 Windows 桌面磁盘清理工具，扫描大文件与重复文件，支持安全隔离与还原，零网络权限。',
      initial: {
        stage: 'initial',
        budget: { targetMin: 8, maxQuestions: 12 },
        confirmedDecisions: [],
        lockedDecisions: [],
        openGaps: [
          { id: 'gap-01', area: 'mvp-core', severity: 'critical', reason: 'MVP 核心扫描深度未定', impact: '影响扫描性能与用户第一印象' },
          { id: 'gap-02', area: 'platform-os', severity: 'critical', reason: 'Windows API 或跨平台 GUI 未选定', impact: '决定底层架构与依赖' },
          { id: 'gap-03', area: 'data-privacy', severity: 'high', reason: '零网络权限与隔离策略未明确', impact: '决定本地安全信任度' },
        ],
      },
      explore: {
        stage: 'explore',
        budget: { targetMin: 6, maxQuestions: 8 },
        confirmedDecisions: [
          { id: 'dec-01', area: 'mvp-core', statement: '第一版仅支持扫描并清理指定本地驱动器的大文件与缓存文件' },
          { id: 'dec-02', area: 'platform-os', statement: '采用 Rust + Tauri 构建轻量 Windows 桌面客户端' },
        ],
        lockedDecisions: [
          { id: 'lock-01', area: 'data-privacy', statement: '完全离线运行，禁止任何外部网络请求与遥测上报' },
        ],
        openGaps: [
          { id: 'gap-04', area: 'data-storage', severity: 'high', reason: '扫描索引数据库或纯内存分析选型未定', impact: '决定千万文件级内存占用' },
          { id: 'gap-05', area: 'error-recovery', severity: 'high', reason: '误删防御与回收站隔离机制未设计', impact: '决定数据安全性' },
        ],
      },
      converge: {
        stage: 'converge',
        budget: { targetMin: 2, maxQuestions: 4 },
        confirmedDecisions: [
          { id: 'dec-01', area: 'mvp-core', statement: '第一版仅支持扫描并清理指定本地驱动器的大文件与缓存文件' },
          { id: 'dec-02', area: 'platform-os', statement: '采用 Rust + Tauri 构建轻量 Windows 桌面客户端' },
          { id: 'dec-03', area: 'data-storage', statement: '使用内存分块扫描，不落盘任何缓存数据库' },
          { id: 'dec-04', area: 'error-recovery', statement: '删除操作默认移至系统回收站，支持还原' },
        ],
        lockedDecisions: [
          { id: 'lock-01', area: 'data-privacy', statement: '完全离线运行，禁止任何外部网络请求与遥测上报' },
          { id: 'lock-02', area: 'tech-stack', statement: '核心扫描引擎用 Rust 标准库多线程实现' },
        ],
        openGaps: [
          { id: 'gap-06', area: 'boundary', severity: 'medium', reason: '长路径（>260字符）与系统保护文件跳过策略', impact: '避免扫描崩溃' },
        ],
      },
      readiness: {
        stage: 'readiness',
        budget: { targetMin: 1, maxQuestions: 2 },
        confirmedDecisions: [
          { id: 'dec-01', area: 'mvp-core', statement: '第一版仅支持扫描并清理指定本地驱动器的大文件与缓存文件' },
          { id: 'dec-02', area: 'platform-os', statement: '采用 Rust + Tauri 构建轻量 Windows 桌面客户端' },
          { id: 'dec-03', area: 'data-storage', statement: '使用内存分块扫描，不落盘任何缓存数据库' },
          { id: 'dec-04', area: 'error-recovery', statement: '删除操作默认移至系统回收站，支持还原' },
          { id: 'dec-05', area: 'boundary', statement: '遇到系统文件或权限不足时自动跳过并生成跳过清单' },
        ],
        lockedDecisions: [
          { id: 'lock-01', area: 'data-privacy', statement: '完全离线运行，禁止任何外部网络请求与遥测上报' },
          { id: 'lock-02', area: 'tech-stack', statement: '核心扫描引擎用 Rust 标准库多线程实现' },
        ],
        openGaps: [
          { id: 'gap-07', area: 'acceptance', severity: 'low', reason: '最终安装包体积上限（建议 ≤ 20MB）', impact: '验收交付标准' },
        ],
      },
    },
    'case-02': {
      name: 'Markdown Knowledge Base (本地双链知识库)',
      idea: '构建一个基于本地纯 Markdown 文件的双链笔记与架构构思知识库，本地存储，离线实时检索。',
      initial: {
        stage: 'initial',
        budget: { targetMin: 8, maxQuestions: 12 },
        confirmedDecisions: [],
        lockedDecisions: [],
        openGaps: [
          { id: 'gap-01', area: 'mvp-core', severity: 'critical', reason: 'Markdown 双链解析格式与语法未定', impact: '决定文档兼容性' },
        ],
      },
      explore: {
        stage: 'explore',
        budget: { targetMin: 6, maxQuestions: 8 },
        confirmedDecisions: [
          { id: 'dec-01', area: 'mvp-core', statement: '采用标准 Wikilink [[note]] 双向引用语法' },
        ],
        lockedDecisions: [
          { id: 'lock-01', area: 'data-storage', statement: '所有笔记直接以 .md 文本文件存放在本地目录，零专有数据库' },
        ],
        openGaps: [
          { id: 'gap-02', area: 'tech-stack', severity: 'high', reason: '前端编辑器选用 Monaco 还是 ProseMirror', impact: '影响编辑体验与包体积' },
        ],
      },
      converge: {
        stage: 'converge',
        budget: { targetMin: 2, maxQuestions: 4 },
        confirmedDecisions: [
          { id: 'dec-01', area: 'mvp-core', statement: '采用标准 Wikilink [[note]] 双向引用语法' },
          { id: 'dec-02', area: 'tech-stack', statement: '采用 ProseMirror 配合 markdown-it 实现富文本与源码双模' },
        ],
        lockedDecisions: [
          { id: 'lock-01', area: 'data-storage', statement: '所有笔记直接以 .md 文本文件存放在本地目录，零专有数据库' },
        ],
        openGaps: [
          { id: 'gap-03', area: 'error-recovery', severity: 'medium', reason: '文件冲突与外部文件修改检测机制', impact: '防止多端编辑覆盖' },
        ],
      },
      readiness: {
        stage: 'readiness',
        budget: { targetMin: 1, maxQuestions: 2 },
        confirmedDecisions: [
          { id: 'dec-01', area: 'mvp-core', statement: '采用标准 Wikilink [[note]] 双向引用语法' },
          { id: 'dec-02', area: 'tech-stack', statement: '采用 ProseMirror 配合 markdown-it 实现富文本与源码双模' },
          { id: 'dec-03', area: 'error-recovery', statement: '基于文件修改时间戳与 sha256 比对检测外部修改' },
        ],
        lockedDecisions: [
          { id: 'lock-01', area: 'data-storage', statement: '所有笔记直接以 .md 文本文件存放在本地目录，零专有数据库' },
        ],
        openGaps: [
          { id: 'gap-04', area: 'acceptance', severity: 'low', reason: '冷启动 1000 篇笔记加载时延标准（≤ 500ms）', impact: '交付门槛' },
        ],
      },
    },
    'case-03': {
      name: 'Audio Metadata Tagger (音频元数据批量整理 CLI)',
      idea: '为本地音乐文件批量整理 ID3/FLAC 元数据的命令行工具，支持按规则重命名文件与内嵌封面提取。',
      initial: {
        stage: 'initial',
        budget: { targetMin: 8, maxQuestions: 12 },
        confirmedDecisions: [],
        lockedDecisions: [],
        openGaps: [
          { id: 'gap-01', area: 'mvp-core', severity: 'critical', reason: '支持的音频格式范围（MP3/FLAC/AAC/OGG）未确定', impact: '影响解析库选型' },
        ],
      },
      explore: {
        stage: 'explore',
        budget: { targetMin: 6, maxQuestions: 8 },
        confirmedDecisions: [
          { id: 'dec-01', area: 'mvp-core', statement: '首发支持 MP3 (ID3v2.3/2.4) 与 FLAC (Vorbis comment) 两大主流格式' },
        ],
        lockedDecisions: [
          { id: 'lock-01', area: 'platform-os', statement: '基于 Node.js CLI 或 Rust 二进制分发，支持跨平台终端' },
        ],
        openGaps: [
          { id: 'gap-02', area: 'tech-stack', severity: 'high', reason: '元数据写入库选用 music-metadata 还是 loft-tag', impact: '影响性能与稳定性' },
        ],
      },
      converge: {
        stage: 'converge',
        budget: { targetMin: 2, maxQuestions: 4 },
        confirmedDecisions: [
          { id: 'dec-01', area: 'mvp-core', statement: '首发支持 MP3 与 FLAC 格式' },
          { id: 'dec-02', area: 'tech-stack', statement: '采用 Node.js + music-metadata 纯 TypeScript 实现' },
        ],
        lockedDecisions: [
          { id: 'lock-01', area: 'platform-os', statement: '基于 Node.js CLI 分发' },
        ],
        openGaps: [
          { id: 'gap-03', area: 'error-recovery', severity: 'medium', reason: '重命名冲突与只读文件处理策略', impact: '避免中断批处理' },
        ],
      },
      readiness: {
        stage: 'readiness',
        budget: { targetMin: 1, maxQuestions: 2 },
        confirmedDecisions: [
          { id: 'dec-01', area: 'mvp-core', statement: '首发支持 MP3 与 FLAC 格式' },
          { id: 'dec-02', area: 'tech-stack', statement: '采用 Node.js + music-metadata' },
          { id: 'dec-03', area: 'error-recovery', statement: '遇到文件重名添加递增编号，只读文件记录警告日志并跳过' },
        ],
        lockedDecisions: [
          { id: 'lock-01', area: 'platform-os', statement: '基于 Node.js CLI 分发' },
        ],
        openGaps: [
          { id: 'gap-04', area: 'acceptance', severity: 'low', reason: '批量 500 首音乐重命名执行时间门槛 (≤ 3s)', impact: '交付门槛' },
        ],
      },
    },
    'case-04': {
      name: 'Local-First Todo App (离线优先待办应用)',
      idea: '极简离线优先待办应用，支持本地 JSON 存储、两阶段原子提交、项目看板与任务依赖。',
      initial: {
        stage: 'initial',
        budget: { targetMin: 8, maxQuestions: 12 },
        confirmedDecisions: [],
        lockedDecisions: [],
        openGaps: [
          { id: 'gap-01', area: 'mvp-core', severity: 'critical', reason: '待办任务状态流转（Todo/Doing/Done）与看板模型未定', impact: '核心交互' },
        ],
      },
      explore: {
        stage: 'explore',
        budget: { targetMin: 6, maxQuestions: 8 },
        confirmedDecisions: [
          { id: 'dec-01', area: 'mvp-core', statement: '核心模型为三状态看板（待办/进行中/已完成），支持子任务' },
        ],
        lockedDecisions: [
          { id: 'lock-01', area: 'data-storage', statement: '数据采用本地单个 tasks.json 原子写入，零远程同步' },
        ],
        openGaps: [
          { id: 'gap-02', area: 'tech-stack', severity: 'high', reason: '采用 React + Vite SPA 还是 Electron 封装', impact: '运行模式' },
        ],
      },
      converge: {
        stage: 'converge',
        budget: { targetMin: 2, maxQuestions: 4 },
        confirmedDecisions: [
          { id: 'dec-01', area: 'mvp-core', statement: '核心模型为三状态看板' },
          { id: 'dec-02', area: 'tech-stack', statement: '采用 Vite + React 静态 Web 运行，文件通过浏览器 File System Access API 读写' },
        ],
        lockedDecisions: [
          { id: 'lock-01', area: 'data-storage', statement: '数据采用本地单个 tasks.json 原子写入' },
        ],
        openGaps: [
          { id: 'gap-03', area: 'error-recovery', severity: 'medium', reason: '浏览器刷新与临时草稿防丢失策略', impact: '用户体验' },
        ],
      },
      readiness: {
        stage: 'readiness',
        budget: { targetMin: 1, maxQuestions: 2 },
        confirmedDecisions: [
          { id: 'dec-01', area: 'mvp-core', statement: '核心模型为三状态看板' },
          { id: 'dec-02', area: 'tech-stack', statement: '采用 Vite + React' },
          { id: 'dec-03', area: 'error-recovery', statement: '每次修改即刻同步 localStorage 作为热备，定期刷新 tasks.json' },
        ],
        lockedDecisions: [
          { id: 'lock-01', area: 'data-storage', statement: '数据采用本地单个 tasks.json 原子写入' },
        ],
        openGaps: [
          { id: 'gap-04', area: 'acceptance', severity: 'low', reason: '无数据库纯静态包单文件发布标准', impact: '发布验收' },
        ],
      },
    },
  };

  const caseData = baseFixtures[caseId];
  if (!caseData) return null;
  const stageData = caseData[stage];
  if (!stageData) return null;

  return {
    caseId,
    name: caseData.name,
    idea: caseData.idea,
    stage,
    budget: stageData.budget,
    confirmedDecisions: stageData.confirmedDecisions,
    lockedDecisions: stageData.lockedDecisions,
    openGaps: stageData.openGaps,
  };
}

export function buildStageContext(stageFixture) {
  const sections = [];
  sections.push(`## B3 Runtime Question Budget
- Stage: ${stageFixture.stage}
- Target: ${stageFixture.budget.targetMin}-${stageFixture.budget.maxQuestions} useful independent questions
- Hard maximum: ${stageFixture.budget.maxQuestions}
- Rule: Do not add low-value filler when fewer meaningful decisions exist.`);

  sections.push(`## Project Background
- Project Name: ${stageFixture.name}
- Initial Idea: ${stageFixture.idea}`);

  if (stageFixture.lockedDecisions.length > 0) {
    const list = stageFixture.lockedDecisions.map((d) => `- [LOCKED] (${d.area}): ${d.statement}`).join('\n');
    sections.push(`## Locked Architectural Decisions (Immutable Bounds)\n${list}`);
  }

  if (stageFixture.confirmedDecisions.length > 0) {
    const list = stageFixture.confirmedDecisions.map((d) => `- [CONFIRMED] (${d.area}): ${d.statement}`).join('\n');
    sections.push(`## Relevant Confirmed Decisions\n${list}`);
  }

  if (stageFixture.openGaps.length > 0) {
    const list = stageFixture.openGaps
      .map((g) => `- [${g.severity.toUpperCase()}] Area: ${g.area} | Reason: ${g.reason} | Impact: ${g.impact}`)
      .join('\n');
    sections.push(`## Prioritized Gaps Requiring Resolution\n${list}`);
  }

  return sections.join('\n\n');
}
