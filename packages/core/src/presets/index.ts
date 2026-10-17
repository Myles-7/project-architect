import type { ProjectPreset, DecisionItem } from '@project-architect/contracts';

export const CURATED_PRESETS: ProjectPreset[] = [
  {
    id: 'local-first-desktop',
    name: 'Local-First Desktop App (本地优先桌面级生产工具)',
    category: 'desktop',
    description: '适用于高敏度个人生产力、离线编辑、零中心化数据库且强依赖本地文件系统的桌面应用架构。',
    recommendedStack: ['TypeScript', 'Tauri / Electron', 'React', 'Local Filesystem', 'Zod / Schema Validation'],
    defaultBoundaryRules: [
      {
        ruleId: 'br-no-central-db',
        title: '禁止引入远程中心化数据库',
        enforcement: 'hard',
        description: '系统状态必须严格保存在用户本地工作区目录中，杜绝远程云端中心化数据库绑定。',
      },
      {
        ruleId: 'br-atomic-file-commits',
        title: '双阶段原子文件提交',
        enforcement: 'hard',
        description: '本地状态写入必须经过临时文件写入与重命名的双阶段事务，防止进程意外崩溃损坏数据。',
      },
      {
        ruleId: 'br-offline-first',
        title: '完全离线可运行保证',
        enforcement: 'soft',
        description: '核心功能在断网状态下必须 100% 可用，网络仅用于可选的第三方模型调用或增量同步。',
      },
    ],
    defaultAreas: [
      { id: 'project_overview', name: '项目愿景与核心架构', description: '定义桌面工具定位与本地操作体验指标' },
      { id: 'target_user', name: '目标用户与离线工作流', description: '高敏数据创作者与深度专业人士的离线交互' },
      { id: 'mvp_scope', name: 'MVP 本地核心范围', description: '首发必备的本地文件读写、状态管理与视图渲染' },
      { id: 'technical_boundary', name: '本地存储与安全边界', description: '文件系统隔离、沙箱限制与零中心化架构' },
      { id: 'delivery_plan', name: '多端打包与分发策略', description: '安装包签名、自动更新机制与崩溃数据恢复' },
    ],
    initialDecisions: [
      {
        id: 'dec-preset-lf-01',
        statement: '采用本地文件目录树作为状态存储，杜绝任何外部 SQL/NoSQL 数据库引擎依赖。',
        area: 'technical_boundary',
        status: 'confirmed',
        origin: 'user',
        rationale: '保障用户数据隐私与 100% 本地掌控权，免除复杂的数据库迁移与驱动环境依赖。',
        decisionKey: 'storage_engine',
        affectedAreas: ['technical_boundary', 'mvp_scope'],
      },
      {
        id: 'dec-preset-lf-02',
        statement: '数据写入采用两阶段原子提交（写入 .tmp 文件校验无误后原子重命名）。',
        area: 'technical_boundary',
        status: 'confirmed',
        origin: 'user',
        rationale: '防止写入中断或断电造成用户状态文件半损损坏。',
        decisionKey: 'atomic_persistence',
        dependsOn: ['dec-preset-lf-01'],
        affectedAreas: ['technical_boundary'],
      },
      {
        id: 'dec-preset-lf-03',
        statement: '桌面应用前端与本地 Core 引擎通过类型化契约隔离，单向数据流驱动。',
        area: 'technical_boundary',
        status: 'candidate',
        origin: 'user',
        rationale: '确保 UI 仅作为状态投影器，便于未来平滑迁移至 Web 或不同宿主外壳。',
        decisionKey: 'ui_engine_decoupling',
        dependsOn: ['dec-preset-lf-01'],
        affectedAreas: ['technical_boundary', 'core_features'],
      },
    ],
    suggestedChecklists: ['chk-univ-mvp-boundary', 'chk-univ-core-user-journey', 'chk-univ-target-user-spec'],
    tags: ['local-first', 'desktop', 'offline', 'privacy'],
  },
  {
    id: 'cli-developer-tool',
    name: 'Modern CLI Developer Tool (现代开发者命令行工具)',
    category: 'cli',
    description: '适用于工程自动化、代码脚手架、流水线检测等非图形化、强调纯净 Unix 流式交互的开发者工具。',
    recommendedStack: ['Node.js / Go / Rust', 'Commander / Clack', 'Chalk / Picocolors', 'Zod', 'Vitest'],
    defaultBoundaryRules: [
      {
        ruleId: 'br-posix-streams',
        title: '严格区分标准流职责',
        enforcement: 'hard',
        description: '标准输出 stdout 仅输出机器可读数据或核心结果，诊断、提示与日志必须定向至 stderr。',
      },
      {
        ruleId: 'br-zero-gui-deps',
        title: '严格零图形库与浏览器绑定',
        enforcement: 'hard',
        description: '运行时严禁加载 DOM、Canvas 或任何 Electron/Chromium 依赖，保持极简启动冷延迟。',
      },
      {
        ruleId: 'br-exit-code-spec',
        title: '语义化进程退出码规约',
        enforcement: 'hard',
        description: '成功返回 0，参数或用户配置错误返回 1，系统与不可逆错误返回 2，严禁无差错捕获静默退出。',
      },
    ],
    defaultAreas: [
      { id: 'project_overview', name: 'CLI 定位与设计哲学', description: '定义命令行工具的核心价值与性能要求' },
      { id: 'mvp_scope', name: '核心子命令集与参数范围', description: '首发支持的命令、选项与交互模式' },
      { id: 'technical_boundary', name: '跨平台与流处理边界', description: 'Windows/macOS/Linux 兼容性与管道流式传输' },
      { id: 'user_flows', name: '终端交互与批处理流水线', description: '交互式 TUI 向导与 CI/CD 非交互静默模式' },
      { id: 'delivery_plan', name: '发布与版本分发方案', description: 'npm / brew / binary 独立打包与快速发布' },
    ],
    initialDecisions: [
      {
        id: 'dec-preset-cli-01',
        statement: '支持 --json 格式化输出与管道输入 (stdin NDJSON) 组合使用。',
        area: 'technical_boundary',
        status: 'confirmed',
        origin: 'user',
        rationale: '使工具不仅供人类阅读，亦可无缝无损地接入自动化流水线脚本。',
        decisionKey: 'pipe_friendly',
        affectedAreas: ['technical_boundary', 'user_flows'],
      },
      {
        id: 'dec-preset-cli-02',
        statement: '首发支持交互式引导 (Interactive Prompt) 与免提示静默标志 (--yes / -y)。',
        area: 'user_flows',
        status: 'confirmed',
        origin: 'user',
        rationale: '既能兼顾新手首次配置体验，又能确保无头 CI 环境零挂起。',
        decisionKey: 'headless_ci_support',
        dependsOn: ['dec-preset-cli-01'],
        affectedAreas: ['user_flows', 'mvp_scope'],
      },
    ],
    suggestedChecklists: ['chk-univ-mvp-boundary', 'chk-univ-tech-feasibility'],
    tags: ['cli', 'terminal', 'developer-experience', 'headless'],
  },
  {
    id: 'edge-microservice',
    name: 'Stateless Edge Microservice (事件驱动无状态微服务)',
    category: 'cloud',
    description: '适用于高并发、秒级冷启动、面向 Webhook 或事件网格的边缘计算与无状态 API 服务。',
    recommendedStack: ['Fastify / Hono', 'TypeScript', 'Redis (Cache)', 'OpenTelemetry', 'Docker'],
    defaultBoundaryRules: [
      {
        ruleId: 'br-stateless-workers',
        title: '进程严禁持有持久业务状态',
        enforcement: 'hard',
        description: '所有业务持久化状态必须委托至外置分布式存储，单实例可随时销毁扩容。',
      },
      {
        ruleId: 'br-idempotency-keys',
        title: '写操作必须支持幂等性 Key',
        enforcement: 'hard',
        description: '所有状态变更接口必须接收并校验 Client Idempotency-Key，防止网络抖动导致的重复消费。',
      },
    ],
    defaultAreas: [
      { id: 'project_overview', name: '微服务架构与职责划分', description: '定义服务边界与吞吐量 SLA 指标' },
      { id: 'technical_boundary', name: '无状态拓扑与外部依赖', description: 'RPC/REST 接口、缓存与限流熔断规约' },
      { id: 'core_features', name: '核心事件处理机制', description: '消息队列消费、重试策略与死信补偿' },
      { id: 'delivery_plan', name: '容器化与无损平滑发布', description: '健康检查探测 (liveness/readiness) 与金丝雀分流' },
    ],
    initialDecisions: [
      {
        id: 'dec-preset-edge-01',
        statement: '服务启动耗时控制在 500ms 以内，支持边缘容器与 Serverless 极速冷启动。',
        area: 'technical_boundary',
        status: 'confirmed',
        origin: 'user',
        rationale: '适应流量潮汐波峰突发，降低资源空载待机成本。',
        decisionKey: 'fast_cold_start',
        affectedAreas: ['technical_boundary'],
      },
      {
        id: 'dec-preset-edge-02',
        statement: '强制接入标准化 Health Check (/health/live, /health/ready) 与结构化 JSON 日志。',
        area: 'technical_boundary',
        status: 'confirmed',
        origin: 'user',
        rationale: '便于云原生 Orchestrator 快速识别并剔除不健康节点。',
        decisionKey: 'cloud_native_health',
        dependsOn: ['dec-preset-edge-01'],
        affectedAreas: ['technical_boundary', 'delivery_plan'],
      },
    ],
    suggestedChecklists: ['chk-univ-tech-feasibility', 'chk-univ-mvp-boundary'],
    tags: ['microservice', 'edge', 'stateless', 'cloud'],
  },
  {
    id: 'offline-sync-mobile',
    name: 'Offline-First Mobile / PWA (离线同步移动应用)',
    category: 'mobile',
    description: '适用于弱网环境、移动现场作业，基于本地缓存与后台双向增量同步的数据密集型客户端架构。',
    recommendedStack: ['React Native / Flutter / PWA', 'OPFS / SQLite / WatermelonDB', 'CRDT / Revisions'],
    defaultBoundaryRules: [
      {
        ruleId: 'br-optimistic-ui',
        title: 'UI 必须支持乐观更新',
        enforcement: 'hard',
        description: '任何用户交互必须立即在本地界面生效，后台异步入队执行同步，严禁阻断交互转圈。',
      },
      {
        ruleId: 'br-conflict-resolution',
        title: '具备显式版本冲突解决机制',
        enforcement: 'hard',
        description: '多端并发更新时依据递增版本号与时间戳确定胜者或生成可供人工仲裁的分支。',
      },
    ],
    defaultAreas: [
      { id: 'project_overview', name: '应用场景与多端同步愿景', description: '定义现场与移动作业的核心闭环' },
      { id: 'target_user', name: '移动用户特征与网络画像', description: '偏远/弱网/离线作业环境交互优化' },
      { id: 'technical_boundary', name: '本地副本与增量同步协议', description: '增量 ChangeLog、压缩传输与版本仲裁' },
      { id: 'ux_ui_direction', name: '网络感知与同步状态指示', description: '未同步标记、离线提示与后台排队反馈' },
    ],
    initialDecisions: [
      {
        id: 'dec-preset-sync-01',
        statement: '采用本地变更日志 (ChangeLog Queue) 作为同步原语，弱网自动挂起，重连自动重试。',
        area: 'technical_boundary',
        status: 'confirmed',
        origin: 'user',
        rationale: '彻底将网络 I/O 与本地视图操作解耦，提供零延迟丝滑录入体验。',
        decisionKey: 'offline_queue',
        affectedAreas: ['technical_boundary', 'ux_ui_direction'],
      },
    ],
    suggestedChecklists: ['chk-univ-core-user-journey', 'chk-univ-mvp-boundary'],
    tags: ['mobile', 'pwa', 'offline-sync', 'crdt'],
  },
  {
    id: 'extensible-plugin-system',
    name: 'Extensible Microkernel Plugin Architecture (微内核可扩展插件系统)',
    category: 'system',
    description: '适用于大型平台、IDE 扩展、高定制化业务系统，内核与插件边界严密隔离的微内核架构。',
    recommendedStack: ['TypeScript', 'Inversify / DI', 'Worker Threads / Sandboxing', 'Hook / Event Bus'],
    defaultBoundaryRules: [
      {
        ruleId: 'br-core-isolation',
        title: 'Core 引擎严禁反向依赖插件模块',
        enforcement: 'hard',
        description: '核心引擎必须保持纯净独立，只能通过抽象接口或生命周期钩子由插件进行观察与扩展。',
      },
      {
        ruleId: 'br-plugin-sandbox',
        title: '三方插件具备权限沙箱隔离',
        enforcement: 'soft',
        description: '高风险文件或网络访问需通过宿主代理鉴权，防止恶意扩展污染主应用生命周期。',
      },
    ],
    defaultAreas: [
      { id: 'project_overview', name: '微内核定位与扩展规范', description: '内核功能边界与插件扩展槽设计' },
      { id: 'technical_boundary', name: '插件契约与生命周期协议', description: '激活、停用、钩子事件派发与类型安全' },
      { id: 'core_features', name: '宿主核心服务集', description: '向插件暴露的标准只读与只写受限 API' },
      { id: 'delivery_plan', name: '插件市场与动态加载分发', description: '插件元数据清单、签名校验与热重载' },
    ],
    initialDecisions: [
      {
        id: 'dec-preset-plugin-01',
        statement: '插件通过声明式 Manifest (id, version, activationEvents, contributions) 注册能力。',
        area: 'technical_boundary',
        status: 'confirmed',
        origin: 'user',
        rationale: '按需懒加载插件，避免应用启动时无节制装载所有扩展造成卡顿。',
        decisionKey: 'declarative_plugin_manifest',
        affectedAreas: ['technical_boundary', 'core_features'],
      },
      {
        id: 'dec-preset-plugin-02',
        statement: 'Core 引擎仅暴露经过严格类型约束的 Context API，拒绝暴露底层内部私有句柄。',
        area: 'technical_boundary',
        status: 'confirmed',
        origin: 'user',
        rationale: '避免插件直接入侵核心内部状态导致未来重构困难或版本断崖式失效。',
        decisionKey: 'strict_plugin_api_surface',
        dependsOn: ['dec-preset-plugin-01'],
        affectedAreas: ['technical_boundary'],
      },
    ],
    suggestedChecklists: ['chk-univ-mvp-boundary', 'chk-univ-tech-feasibility'],
    tags: ['microkernel', 'plugin', 'extensible', 'sandbox'],
  },
];

export class PresetRegistry {
  public static getAll(): ProjectPreset[] {
    return CURATED_PRESETS;
  }

  public static getById(id: string): ProjectPreset | undefined {
    return CURATED_PRESETS.find((preset) => preset.id === id);
  }

  public static validate(preset: ProjectPreset): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!preset.id || !preset.name) {
      errors.push('Preset must specify non-empty id and name.');
    }
    if (!preset.defaultAreas || preset.defaultAreas.length === 0) {
      errors.push('Preset must provide at least one default area.');
    }
    if (!preset.defaultBoundaryRules || preset.defaultBoundaryRules.length === 0) {
      errors.push('Preset must provide at least one default boundary rule.');
    }
    return { valid: errors.length === 0, errors };
  }

  /**
   * Instantiates initial decisions from a preset for a new project.
   */
  public static instantiateDecisions(preset: ProjectPreset, timestamp: string = new Date().toISOString()): DecisionItem[] {
    return preset.initialDecisions.map((init, idx) => ({
      id: init.id || `dec-preset-${idx + 1}`,
      area: init.area,
      statement: init.statement,
      status: init.status,
      origin: init.origin,
      evidenceRefs: [],
      confirmedBy: init.status === 'confirmed' ? 'user' : undefined,
      decisionKey: init.decisionKey,
      dependsOn: init.dependsOn,
      rationale: init.rationale,
      affectedAreas: init.affectedAreas,
      createdAt: timestamp,
      updatedAt: timestamp,
    }));
  }
}
