export interface ProjectTemplate {
  id: string;
  name: string;
  badge: string;
  defaultProjectName: string;
  description: string;
  ideaPrompt: string;
  targetUser?: string;
  coreProblem?: string;
  mvpResult?: string;
  knownConstraints?: string;
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'cli-tool',
    name: 'CLI 终端工具',
    badge: '终端 & 开发者工具',
    defaultProjectName: 'my-cli-tool',
    description: '轻量高效的命令行工具，注重命令设计、参数解析与跨平台执行。',
    targetUser: '开发者与 DevOps 工程师',
    coreProblem: '现存脚本维护困难且运行慢，缺乏开箱即用的轻量格式转换与自动化执行命令',
    mvpResult: '一个单文件免安装、启动 < 100ms 的轻量命令行工具，支持核心管道输入与格式化输出',
    knownConstraints: '纯本地运行，免联网登录，支持 Windows/macOS/Linux',
    ideaPrompt:
      '我想构建一个面向开发者的本地 CLI 终端工具。\n核心目标：通过简单的命令行参数快速完成指定格式转换与自动化任务。\n核心约束：单二进制/纯本地运行，启动时间 < 100ms，无需联网登录，支持 Windows/macOS/Linux。',
  },
  {
    id: 'local-desktop',
    name: '本地优先桌面应用',
    badge: 'Tauri / Electron / 桌面应用',
    defaultProjectName: 'local-desktop-app',
    description: '本地优先、数据零外流的桌面端工作台，离线可用且具备系统原生体验。',
    targetUser: '注重数据隐私、需要离线处理敏感资料的专业创作者或工程师',
    coreProblem: '云端工具常有数据泄露风险且断网无法工作，本地文件缺乏直观的可视化工作台',
    mvpResult: '一款本地优先 (Local-first) 的桌面端工作台，提供丝滑的离线管理与快速预览',
    knownConstraints: '所有状态存储在本地文件系统，零中心数据库，支持快捷键与轻量系统托盘',
    ideaPrompt:
      '我想设计一个本地优先 (Local-first) 的桌面客户端应用。\n核心目标：帮助个人用户在离线状态下管理并可视化本地结构化数据。\n核心约束：所有状态以本地文件/目录持久化，禁止引入云端中心数据库，支持系统级快捷键与托盘交互。',
  },
  {
    id: 'web-saas',
    name: 'Web SaaS 工具平台',
    badge: '现代 Web / Cloud',
    defaultProjectName: 'cloud-saas-platform',
    description: '现代 Web SaaS 工具，强调端到端业务工作流、高响应速度与清晰 MVP 边界。',
    targetUser: '内容创作者与独立项目管理者',
    coreProblem: '内容组织与协作导出流程割裂繁琐，现有大平台过于臃肿且上手成本高',
    mvpResult: '一个直观现代的 Web 工作流平台，让用户可在 3 分钟内完成核心内容组织与一键规范导出',
    knownConstraints: 'V1 严格聚焦个人核心闭环，先不引入复杂的企业组织架构与多级权限',
    ideaPrompt:
      '我想构思一个现代 Web SaaS 工具平台。\n核心目标：为创作者提供直观的在线工作台，简化繁琐的内容组织与导出流程。\n核心约束：V1 严格收敛在个人核心工作流闭环，先不引入复杂的企业组织树与付费网关。',
  },
  {
    id: 'browser-extension',
    name: '浏览器扩展插件',
    badge: 'Chrome / Edge 插件',
    defaultProjectName: 'smart-browser-ext',
    description: '基于 Manifest V3 的轻量浏览器插件，提供页面内容抓取、标注与侧边栏交互。',
    targetUser: '经常在浏览器中进行文献调研、资料收集与信息整理的研究者与创作者',
    coreProblem: '在多个标签页间频繁切换复制粘贴极易打断阅读心流',
    mvpResult: '一个基于 Manifest V3 的侧边栏 (SidePanel) 插件，一键提取当前页面要点并沉淀到本地',
    knownConstraints: '严格遵循 Manifest V3 安全规范，最小化权限申请，无外部追踪代码',
    ideaPrompt:
      '我想开发一个基于 Manifest V3 的浏览器扩展插件。\n核心目标：在用户浏览网页时，一键提取页面核心要点并沉淀至本地。\n核心约束：遵守 Manifest V3 安全策略，采用 SidePanel 侧边栏交互，最小化请求权限。',
  },
  {
    id: 'ai-agent-workflow',
    name: 'AI 结构化推演工具',
    badge: 'AI 架构 & 规范推演',
    defaultProjectName: 'agent-orchestrator',
    description: '多步骤确定性 AI 提示词与决策工具，严格约束 Token 成本与输出 Schema。',
    targetUser: '正在构建 AI 应用的工程师与产品经理',
    coreProblem: '传统的多 Agent 对话流水线延迟高、费用贵且输出不可控，容易产生幻觉',
    mvpResult: '一套单次调用、高确定性的结构化推演工作台，每次推演 100% 对应明确状态变更',
    knownConstraints: '纯结构化 JSON Schema 输出，单次调用约束，严格预算与可追溯性',
    ideaPrompt:
      '我想设计一个结构化的 AI 任务流编排工具。\n核心目标：将复杂的分析任务拆分为单次高确定性的结构化调用，杜绝多 Agent 冗余对话与幻觉。\n核心约束：100% 结构化 JSON 输出，严格设置 Token 预算，每次推演可复现可回溯。',
  },
];
