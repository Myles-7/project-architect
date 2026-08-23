import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectStateEngine, FileStorage } from '@project-architect/core';
import { AIOrchestrator, MockAIProvider } from '@project-architect/agent';
import type { DiscoveryResult } from '@project-architect/contracts';

describe('B2.1 Golden Benchmark Regression Suite (Phase 2.5)', () => {
  let tempBaseDir: string;
  let stateEngine: ProjectStateEngine;
  let mockProvider: MockAIProvider;
  let orchestrator: AIOrchestrator;
  let storage: FileStorage;

  beforeEach(async () => {
    tempBaseDir = await mkdtemp(join(tmpdir(), 'pa-b21-regression-'));
    storage = new FileStorage();
    stateEngine = new ProjectStateEngine(storage);
    mockProvider = new MockAIProvider();
    orchestrator = new AIOrchestrator(mockProvider, stateEngine, process.cwd(), storage);
  });

  afterEach(async () => {
    await rm(tempBaseDir, { recursive: true, force: true });
  });

  it('Case-01: Blurry Cleaner — Detects Target User & MVP boundary gaps with 0 technology leakage', async () => {
    const { projectPath, snapshot: _snapshot } = await stateEngine.createProject({
      projectPath: join(tempBaseDir, 'case-01-cleaner'),
      name: 'Disk Cleaner',
      idea: '我想做一个清理电脑空间的软件。',
      projectTags: ['Desktop App', 'Utility Tool'],
    });

    const aiOutput: DiscoveryResult = {
      confirmed: ['清理电脑空间的桌面工具'],
      candidates: ['提供一键大文件扫描与安全清理建议'],
      assumptions: ['默认不扫描系统关键目录以防误删'],
      unknowns: ['具体受众群体是小白用户还是专业开发者'],
      risks: ['误删用户未保存文件可能造成不可逆数据损失'],
      conflicts: [],
      tensions: [],
      gaps: [
        {
          area: 'target_user',
          severity: 'critical',
          reason: '目标用户群体偏好与操作习惯未定义',
          impact: '决定是提供全自动极简清理还是高级规则自定义',
          dependency: 'none',
          should_ask_user: true,
        },
        {
          area: 'mvp_scope',
          severity: 'critical',
          reason: '首发版本清理深度与支持的文件类型边界未划定',
          impact: '核心清理引擎范围失焦',
          dependency: 'none',
          should_ask_user: true,
        },
      ],
      questions: [
        {
          importance: 'critical',
          question: '针对【target_user】：目标用户群体偏好与操作习惯未定义，您的首发版本规划是什么？',
          reason: '因为用户画像直接决定产品是走一键极简路线还是专家级自定义规则。',
          recommendation: '建议首发版本面向普通电脑用户，提供零门槛的一键安全扫描',
          recommendation_reason: '降低初版学习成本与误删风险',
          options: [
            { label: '面向普通小白用户，提供一键安全清理', impact: '易用性极高，风险可控' },
            { label: '面向极客与开发者，提供高级自定义规则与日志分析', impact: '灵活性强，但交互复杂度高' },
          ],
        },
      ],
    };

    mockProvider.setMockResponse(aiOutput);

    const res = await orchestrator.runDiscoveryTurn(projectPath, {
      expectedRevision: 1,
      userMessage: '我想做一个清理电脑空间的软件。',
    });

    const s = res.snapshot;
    // 1. Budget: Exactly 1 critical question
    expect(s.questions.items.length).toBe(1);
    expect(s.questions.items[0]?.importance).toBe('critical');

    // 2. Gaps: Target user and MVP scope present
    expect(s.gaps.gaps.some((g) => g.area === 'target_user')).toBe(true);

    // 3. Technology Discipline: Zero mechanism leakage
    const allText = JSON.stringify(s);
    expect(allText).not.toMatch(/sqlite|postgres|react|vue|electron|tauri/i);

    // 4. Assumption captured
    expect(s.assumptions.items.some((a) => a.statement.includes('系统关键目录'))).toBe(true);
  });

  it('Case-03: Complete Study Planner — Anti-repetition prevents asking already specified constraints', async () => {
    const { projectPath } = await stateEngine.createProject({
      projectPath: join(tempBaseDir, 'case-03-planner'),
      name: 'Kaoyan Study Planner',
      idea: '我想为准备考研的中国大学生做一个 Web 学习计划工具，首版只支持中文和桌面浏览器。MVP 不包含社交、课程市场、AI 聊天或移动端。',
      projectTags: ['Web App'],
    });

    // Mark platform and scope as clear
    await stateEngine.editOverviewItem(projectPath, 'technical_boundary', undefined, 'Web 桌面浏览器，仅支持中文', 1);
    await stateEngine.editOverviewItem(projectPath, 'mvp_scope', undefined, '首发版排除社交、课程市场、AI聊天与移动端', 2);

    const aiOutput: DiscoveryResult = {
      confirmed: ['Web 桌面端考研学习计划工具', '首发排除移动端与社交功能'],
      candidates: ['按周动态调整复习计划'],
      assumptions: ['单次复习任务推荐时长为 45 分钟'],
      unknowns: [],
      risks: [],
      conflicts: [],
      tensions: [],
      gaps: [
        {
          area: 'user_flows',
          severity: 'high',
          reason: '学习任务延后与进度补全的动态适应机制未明确',
          impact: '当学生连续几天未完成计划时可能导致弃用',
          dependency: 'none',
          should_ask_user: true,
        },
      ],
      questions: [
        {
          importance: 'high',
          question: '针对【user_flows】：当用户未按计划完成任务时，系统如何动态调整后续计划？',
          reason: '直接影响考研学生的复习节奏与产品留存率。',
          recommendation: '建议首发版本支持一键顺延或按剩余天数平摊任务',
          recommendation_reason: '保持计划可行性与正向激励',
          options: [
            { label: '一键自动平摊未完成任务到剩余可用时间', impact: '保持总复习量不变，但单日负荷增加' },
            { label: '仅标记延后，由用户手动拖拽调整', impact: '用户掌控力强，但需手动操作' },
          ],
        },
      ],
    };

    mockProvider.setMockResponse(aiOutput);

    const res = await orchestrator.runDiscoveryTurn(projectPath, {
      expectedRevision: 3,
      userMessage: '已明确 Web 桌面端且不包含移动端。请分析后续核心流程。',
    });

    const s = res.snapshot;
    // Anti-repetition: Must NOT ask about platform or mobile exclusion
    const questionText = s.questions.items[0]?.question || '';
    expect(questionText).not.toContain('移动端');
    expect(questionText).not.toContain('Web');
    expect(questionText).toContain('user_flows');
  });

  it('Case-05: Strict Offline vs Sync Conflict — Precision hard conflict without false positives', async () => {
    const { projectPath } = await stateEngine.createProject({
      projectPath: join(tempBaseDir, 'case-05-conflict'),
      name: 'Offline PKM',
      idea: '我想做一个个人知识库，必须完全离线，任何内容都不能离开用户电脑；同时用户换电脑后数据要自动同步，且不用用户做任何设置。',
      projectTags: ['Desktop App', 'Local-First'],
    });

    // Lock offline constraint
    const { decisionRef } = await stateEngine.editOverviewItem(
      projectPath,
      'technical_boundary',
      undefined,
      '必须 100% 纯本地离线，任何数据严禁离开用户电脑',
      1
    );
    await stateEngine.lockDecision(projectPath, decisionRef, 2);

    // AI proposes automatic cloud sync
    const aiOutput: DiscoveryResult = {
      confirmed: [],
      candidates: ['换电脑后自动云同步数据，无需用户配置'],
      assumptions: [],
      unknowns: [],
      risks: [],
      conflicts: [],
      tensions: [],
      gaps: [],
      questions: [],
    };

    mockProvider.setMockResponse(aiOutput);

    const res = await orchestrator.runDiscoveryTurn(projectPath, {
      expectedRevision: 3,
      userMessage: '请确认多设备自动同步机制。',
    });

    const s = res.snapshot;
    // Strict Conflict generated
    expect(s.gaps.conflicts.length).toBe(1);
    const conf = s.gaps.conflicts[0]!;
    expect(conf.severity).toBe('critical');
    expect(conf.propositionA).toContain('离线');
    expect(conf.propositionB).toContain('云同步');
    // Locked decision remains physically intact
    const lockedDec = s.decisions.items.find((d) => d.status === 'locked');
    expect(lockedDec?.status).toBe('locked');
  });

  it('Case-08: Local-First Notes — Sync merge strategy and low-risk assumption safety', async () => {
    const { projectPath } = await stateEngine.createProject({
      projectPath: join(tempBaseDir, 'case-08-notes'),
      name: 'Team Local Notes',
      idea: '我想做一个 local-first 的团队会议笔记应用。笔记默认存在本机，没网也可编辑；恢复网络后团队成员要看到合并后的内容，并且不能轻易覆盖别人的修改。',
      projectTags: ['Desktop App', 'Local-First'],
    });

    const aiOutput: DiscoveryResult = {
      confirmed: ['Local-first 团队离线优先笔记工具'],
      candidates: ['段落级别的协同编辑冲突合并策略'],
      assumptions: ['离线编辑变更在本地以变更日志暂存', '单条笔记历史版本默认保留 50 个快照'],
      unknowns: [],
      risks: ['多人同时高频修改同一段落时可能产生语义冲突'],
      conflicts: [],
      tensions: [],
      gaps: [
        {
          area: 'user_flows',
          severity: 'high',
          reason: '多人同时离线修改后的合并确认体验尚未设计',
          impact: '影响团队协同信任度',
          dependency: 'none',
          should_ask_user: true,
        },
      ],
      questions: [
        {
          importance: 'high',
          question: '针对【user_flows】：当两人在离线期间同时修改了同一段落，恢复网络后采用何种策略呈现？',
          reason: '避免非预期覆盖，保障团队内容安全性。',
          recommendation: '建议首发版本采用段落级分支提示与手动确认合并',
          recommendation_reason: '透明可控，避免自动合并造成逻辑混乱',
          options: [
            { label: '段落级分支高亮，提示用户手动二选一合并', impact: '绝对安全，需一次手动操作' },
            { label: '以最后提交时间戳自动覆盖旧修改', impact: '自动化程度高，但可能丢失细节' },
          ],
        },
      ],
    };

    mockProvider.setMockResponse(aiOutput);

    const res = await orchestrator.runDiscoveryTurn(projectPath, {
      expectedRevision: 1,
      userMessage: '分析多人离线笔记合并策略。',
    });

    const s = res.snapshot;
    // Low-risk assumptions safely captured
    expect(s.assumptions.items.length).toBeGreaterThanOrEqual(2);
    expect(s.assumptions.items.some((a) => a.statement.includes('变更日志'))).toBe(true);
    expect(s.assumptions.items.every((a) => a.status === 'active')).toBe(true);
  });

  it('Case-09: Password Manager — Elevates Trust & Safety without premature encryption mechanism leaks', async () => {
    const { projectPath } = await stateEngine.createProject({
      projectPath: join(tempBaseDir, 'case-09-pwd'),
      name: 'Secure Vault',
      idea: '我想做一个密码管理器，可以保存网站账号、密码、信用卡信息和安全笔记，还能自动填充；支持 Windows、浏览器插件和手机，并在设备间同步。',
      projectTags: ['Desktop App', 'Utility Tool'],
    });

    const aiOutput: DiscoveryResult = {
      confirmed: ['支持多端同步与自动填充的密码管理器'],
      candidates: ['提供主密码忘记时的紧急恢复凭证机制'],
      assumptions: ['本地剪贴板复制密码后 30 秒自动清空'],
      unknowns: [],
      risks: ['若不提供任何恢复手段，用户遗忘主密码将导致全部数据永久丢失'],
      conflicts: [],
      tensions: [],
      gaps: [
        {
          area: 'trust_safety',
          severity: 'critical',
          reason: '主密码遗忘后的账户恢复承诺与零知识隐私底线未明确',
          impact: '决定产品的核心安全模型与用户信任基础',
          dependency: 'none',
          should_ask_user: true,
        },
      ],
      questions: [
        {
          importance: 'critical',
          question: '针对【trust_safety】：主密码遗忘后的账户恢复承诺与零知识隐私底线未明确，您的首发版本规划是什么？',
          reason: '这是密码管理器的最高优先级信任契约。',
          recommendation: '建议首发版本坚持零知识承诺，通过离线紧急恢复密钥（Emergency Kit）恢复',
          recommendation_reason: '兼顾绝对隐私与灾难恢复可能',
          options: [
            { label: '坚持绝对零知识：仅提供离线一次性应急密钥，服务端无法找回', impact: '最高安全性，用户需妥善保存密钥' },
            { label: '支持邮箱辅助重置主密码', impact: '易用性高，但牺牲部分零知识安全性' },
          ],
        },
      ],
    };

    mockProvider.setMockResponse(aiOutput);

    const res = await orchestrator.runDiscoveryTurn(projectPath, {
      expectedRevision: 1,
      userMessage: '我想做一个密码管理器。',
    });

    const s = res.snapshot;
    // High-priority question is on Trust & Safety
    expect(s.questions.items[0]?.importance).toBe('critical');
    expect(s.questions.items[0]?.question).toContain('trust_safety');

    // Zero premature crypto implementation leaks (no specific ciphers/iterations)
    const text = JSON.stringify(s);
    expect(text).not.toMatch(/aes-256-gcm|argon2id|pbkdf2|sodium/i);
  });
});
