import type {
  ProjectSnapshot,
  ArchitectureDiagram,
  DiagramsResult,
} from '@project-architect/contracts';

/**
 * Escapes characters that could break Mermaid syntax.
 */
function sanitize(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/["\n\r[\]{}()\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 50);
}

/**
 * Safely sanitizes and intelligently truncates project and boundary names
 * to prevent excessively wide Mermaid subgraphs and broken whitespace.
 * Preserves Unicode code points (such as emojis) to prevent orphan surrogates.
 */
export function formatSafeName(text: string, maxLen: number = 16): string {
  if (!text || typeof text !== 'string') return '';
  const sanitized = text
    .replace(/["\n\r[\]{}()\\]/g, ' ')
    .trim();
  const chars = Array.from(sanitized);
  if (chars.length <= maxLen) return chars.join('');
  return `${chars.slice(0, maxLen).join('')}...`;
}

export class MermaidGenerator {
  /**
   * Generates a suite of dynamic Mermaid diagrams based on the project's current snapshot.
   */
  public static generateDiagrams(snapshot: ProjectSnapshot): DiagramsResult {
    const timestamp = new Date().toISOString();
    const diagrams: ArchitectureDiagram[] = [
      this.generateSystemContextDiagram(snapshot, timestamp),
      this.generateComponentFlowDiagram(snapshot, timestamp),
      this.generateSequenceDiagram(snapshot, timestamp),
      this.generateBoundaryGovernanceDiagram(snapshot, timestamp),
    ];

    return {
      projectId: snapshot.metadata.projectId,
      diagrams,
      generatedAt: timestamp,
    };
  }

  /**
   * Generates a System Context diagram (C4 / Flowchart style).
   */
  private static generateSystemContextDiagram(snapshot: ProjectSnapshot, timestamp: string): ArchitectureDiagram {
    const projectName = formatSafeName(snapshot.metadata.name || 'Project', 16);
    const decisions = (snapshot.decisions?.items || []).filter(
      (d) => d.status === 'confirmed' || d.status === 'locked' || d.status === 'candidate',
    );

    // 1. Dynamic user/actor discovery
    const userDecision = decisions.find(
      (d) =>
        /target_user|user_persona|actor/i.test(d.area || '') ||
        /用户|角色|Persona|Client/i.test(d.statement),
    );
    const userLabel = userDecision
      ? `👤 ${sanitize(userDecision.statement)}`
      : '👤 核心业务用户 / 客户端系统 (Primary User / Client)';

    // 2. Client / Presentation layer
    const clientDecision = decisions.find(
      (d) =>
        /ui|frontend|client|web|mobile|desktop|cli|presentation/i.test(d.area || '') ||
        /界面|前端|客户端|UI|Web|App/i.test(d.statement),
    );
    const clientLabel = clientDecision
      ? `🖥️ ${sanitize(clientDecision.statement)}`
      : `🖥️ ${projectName} 客户端与交互层 (Client Interface)`;

    // 3. Service / Core application logic
    const coreDecision = decisions.find(
      (d) =>
        /service|core|domain|backend|api|engine|business/i.test(d.area || '') ||
        /服务|核心|引擎|后端|业务/i.test(d.statement),
    );
    const coreLabel = coreDecision
      ? `⚙️ ${sanitize(coreDecision.statement)}`
      : '⚙️ 核心应用服务与业务引擎 (Core Services & Domain Logic)';

    // 4. Persistence / Storage decisions
    const boundaryDecisions = decisions.filter(
      (d) =>
        /technical_boundary|storage|database|db|persistence|data/i.test(d.area || '') ||
        /存储|数据库|持久化|SQLite|Postgres|MySQL|Redis|File/i.test(d.statement),
    );

    const lines: string[] = [
      'flowchart TD',
      '  %% System Context Diagram',
      `  User["${userLabel}"]`,
      `  subgraph SystemBoundary[" 🛡️ ${projectName} Architecture Boundary "]`,
      '    direction TB',
      `    ClientNode["${clientLabel}"]`,
      `    CoreNode["${coreLabel}"]`,
      '  end',
    ];

    if (boundaryDecisions.length > 0) {
      lines.push('  subgraph StorageLayer[" 💾 数据持久化与基础设施层 (Data & Persistence) "]');
      boundaryDecisions.slice(0, 3).forEach((bd, idx) => {
        lines.push(`    Store${idx}["📦 ${sanitize(bd.statement)}"]`);
      });
      lines.push('  end');
      lines.push('  User -->|操作交互 / 请求发起| ClientNode');
      lines.push('  ClientNode -->|API 调用 / 服务调度| CoreNode');
      lines.push('  CoreNode -->|数据持久化与读取| StorageLayer');
    } else {
      lines.push('  Storage["💾 本地持久化与数据存储 (Data Store / Storage)"]');
      lines.push('  User -->|操作交互 / 请求发起| ClientNode');
      lines.push('  ClientNode -->|API 调用 / 服务调度| CoreNode');
      lines.push('  CoreNode -->|数据读写操作| Storage');
    }

    return {
      id: 'diag-system-context',
      type: 'system-context',
      title: '系统上下文与架构边界 (System Context & Boundaries)',
      description: '展示目标用户、客户端应用、核心业务服务与数据存储之间的拓扑边界与数据流动。',
      mermaidCode: lines.join('\n'),
      generatedAt: timestamp,
    };
  }

  /**
   * Generates a Component & Area Interaction Flow diagram based on actual decisions & DAG dependencies.
   */
  private static generateComponentFlowDiagram(snapshot: ProjectSnapshot, timestamp: string): ArchitectureDiagram {
    const lines: string[] = [
      'flowchart LR',
      '  %% Component & Area Interaction Flow Diagram',
    ];

    const decisions = (snapshot.decisions?.items || []).filter(
      (d) => d.status === 'confirmed' || d.status === 'locked' || d.status === 'candidate',
    );

    // 1. Check for decisions with explicit dependsOn dependencies
    const decisionsWithDeps = decisions.filter(
      (d) => Array.isArray(d.dependsOn) && d.dependsOn.length > 0,
    );

    if (decisionsWithDeps.length > 0) {
      // Build a map of decisions involved in the dependency topology
      const involvedIds = new Set<string>();
      for (const d of decisionsWithDeps) {
        involvedIds.add(d.id);
        if (d.decisionKey) involvedIds.add(d.decisionKey);
        for (const dep of d.dependsOn || []) {
          involvedIds.add(dep);
        }
      }

      const activeNodes = decisions.filter(
        (d) => involvedIds.has(d.id) || (d.decisionKey && involvedIds.has(d.decisionKey)),
      );

      // Render nodes
      for (const node of activeNodes) {
        const nodeId = `Dec_${node.id.replace(/[^a-zA-Z0-9_]/g, '_')}`;
        const stmt = sanitize(node.statement);
        const icon = node.status === 'locked' ? '🔒' : node.status === 'confirmed' ? '✅' : '💡';
        lines.push(`  ${nodeId}["${icon} <b>${node.id}</b><br/>${stmt}"]`);
      }

      // Render directed edges (source dependency -> target consumer)
      for (const d of decisionsWithDeps) {
        const targetId = `Dec_${d.id.replace(/[^a-zA-Z0-9_]/g, '_')}`;
        for (const dep of d.dependsOn || []) {
          const matchedDep = decisions.find((other) => other.id === dep || other.decisionKey === dep);
          if (matchedDep) {
            const sourceId = `Dec_${matchedDep.id.replace(/[^a-zA-Z0-9_]/g, '_')}`;
            lines.push(`  ${sourceId} -->|依赖/调用| ${targetId}`);
          }
        }
      }
    } else {
      // 2. Fall back to classic 4-layer architectural topology
      const clientDecisions = decisions.filter((d) =>
        /ui|frontend|client|web|mobile|desktop|cli|presentation|target_user|user_flows/i.test(d.area || '') ||
        /界面|前端|客户端|用户/i.test(d.statement),
      );
      const gatewayDecisions = decisions.filter((d) =>
        /gateway|routing|bff|api|ingress|network|auth/i.test(d.area || '') ||
        /路由|网关|接口|认证/i.test(d.statement),
      );
      const coreDecisions = decisions.filter((d) =>
        /service|core|domain|engine|business|mvp_scope|module|component/i.test(d.area || '') ||
        /核心|业务|引擎|逻辑/i.test(d.statement),
      );
      const dataDecisions = decisions.filter((d) =>
        /storage|database|db|cache|persistence|data|technical_boundary/i.test(d.area || '') ||
        /数据库|持久化|存储|缓存|sqlite|redis/i.test(d.statement),
      );

      lines.push('  subgraph ClientLayer["🖥️ 展现与客户端层 (Presentation Layer)"]');
      lines.push('    direction TB');
      if (clientDecisions.length > 0) {
        clientDecisions.slice(0, 3).forEach((d) => {
          lines.push(`    Node_C_${d.id.replace(/[^a-zA-Z0-9_]/g, '_')}["${sanitize(d.statement)}"]`);
        });
      } else {
        lines.push('    ClientNode["终端交互应用 (UI / Client Application)"]');
      }
      lines.push('  end');

      lines.push('  subgraph GatewayLayer["🚪 API 网关与路由层 (Gateway & Routing)"]');
      lines.push('    direction TB');
      if (gatewayDecisions.length > 0) {
        gatewayDecisions.slice(0, 3).forEach((d) => {
          lines.push(`    Node_G_${d.id.replace(/[^a-zA-Z0-9_]/g, '_')}["${sanitize(d.statement)}"]`);
        });
      } else {
        lines.push('    GatewayNode["接入控制器 / API 网关 (API Gateway / Router)"]');
      }
      lines.push('  end');

      lines.push('  subgraph CoreLayer["⚙️ 业务核心服务层 (Service Core)"]');
      lines.push('    direction TB');
      if (coreDecisions.length > 0) {
        coreDecisions.slice(0, 3).forEach((d) => {
          lines.push(`    Node_S_${d.id.replace(/[^a-zA-Z0-9_]/g, '_')}["${sanitize(d.statement)}"]`);
        });
      } else {
        lines.push('    CoreNode["领域业务逻辑 / 服务核心 (Domain Services)"]');
      }
      lines.push('  end');

      lines.push('  subgraph DataLayer["💾 数据持久化与存储层 (Data Store)"]');
      lines.push('    direction TB');
      if (dataDecisions.length > 0) {
        dataDecisions.slice(0, 3).forEach((d) => {
          lines.push(`    Node_D_${d.id.replace(/[^a-zA-Z0-9_]/g, '_')}["${sanitize(d.statement)}"]`);
        });
      } else {
        lines.push('    DataNode["本地持久化存储 / 数据库 (Storage & Cache)"]');
      }
      lines.push('  end');

      lines.push('  ClientLayer -->|用户请求 / UI 交互| GatewayLayer');
      lines.push('  GatewayLayer -->|分发调度| CoreLayer');
      lines.push('  CoreLayer -->|状态落盘与读取| DataLayer');
    }

    return {
      id: 'diag-component-flow',
      type: 'component-flow',
      title: '核心架构领域流向与调用拓扑 (Architecture Area Interaction Flow)',
      description: '基于项目真实决策依赖与经典分层模型生成的系统调用流与依赖有向拓扑。',
      mermaidCode: lines.join('\n'),
      generatedAt: timestamp,
    };
  }

  /**
   * Generates a Core System Interaction Sequence Diagram based on user system architecture.
   */
  private static generateSequenceDiagram(snapshot: ProjectSnapshot, timestamp: string): ArchitectureDiagram {
    const projectName = formatSafeName(snapshot.metadata.name || 'System', 16);
    const decisions = (snapshot.decisions?.items || []).filter(
      (d) => d.status === 'confirmed' || d.status === 'locked' || d.status === 'candidate',
    );

    const clientDecision = decisions.find(
      (d) =>
        /ui|frontend|client|web|mobile|desktop|cli/i.test(d.area || '') ||
        /界面|前端|客户端|UI|Web|App/i.test(d.statement),
    );
    const serviceDecision = decisions.find(
      (d) =>
        /service|core|domain|backend|api|engine|business/i.test(d.area || '') ||
        /服务|核心|引擎|后端|业务/i.test(d.statement),
    );
    const storageDecision = decisions.find(
      (d) =>
        /storage|database|db|persistence|data/i.test(d.area || '') ||
        /存储|数据库|持久化|SQLite|Postgres|MySQL|Redis/i.test(d.statement),
    );

    const clientName = clientDecision ? sanitize(clientDecision.statement) : `${projectName} 客户端应用 (Client UI)`;
    const serviceName = serviceDecision ? sanitize(serviceDecision.statement) : '核心业务服务 (Service Core)';
    const storageName = storageDecision ? sanitize(storageDecision.statement) : '持久化数据存储 (Storage & Database)';

    const lines: string[] = [
      'sequenceDiagram',
      '  autonumber',
      '  actor User as 👤 终端用户 (User / Client)',
      `  participant Client as 🖥️ ${clientName}`,
      '  participant Gateway as 🚪 接口网关 / 路由分发 (API Gateway)',
      `  participant Service as ⚙️ ${serviceName}`,
      `  participant Storage as 💾 ${storageName}`,
      '',
      '  User->>Client: 发起业务操作 / 提交交互数据 (Action Request)',
      '  Client->>Gateway: 分发 API 请求 / 传输载荷 (API Invocation)',
      '  Gateway->>Service: 鉴权校验并调度请求 (Authorize & Route)',
      '  Service->>Service: 执行核心业务逻辑与校验规则 (Domain Logic)',
      '  Service->>Storage: 查询 / 写入业务状态记录 (Query / Persist)',
      '  Storage-->>Service: 返回数据结果集 / 写入确认 (Data Acknowledged)',
      '  Service-->>Gateway: 组装业务响应实体与状态 (Response DTO)',
      '  Gateway-->>Client: 传输格式化结果 (HTTP / JSON / Stream)',
      '  Client-->>User: 渲染最新视图状态与交互反馈 (Render View Feedback)',
    ];

    return {
      id: 'diag-sequence-interaction',
      type: 'sequence-interaction',
      title: '核心业务与组件交互时序图 (Core Interaction Sequence)',
      description: '展示终端用户操作、客户端展现、服务调度与数据存储之间的标准调用响应时序。',
      mermaidCode: lines.join('\n'),
      generatedAt: timestamp,
    };
  }

  /**
   * Generates an Architecture Boundary Rules & Governance Diagram based on project constraints & boundary decisions.
   */
  private static generateBoundaryGovernanceDiagram(snapshot: ProjectSnapshot, timestamp: string): ArchitectureDiagram {
    const projectName = formatSafeName(snapshot.metadata.name || 'Project', 16);
    const lines: string[] = [
      'flowchart TD',
      `  subgraph BoundaryRules[" 🛡️ ${projectName} 领域边界规约与架构治理 "]`,
      '    direction TB',
    ];

    // Collect constraints dynamically from snapshot metadata and boundary decisions
    const constraints: string[] = [];

    // 1. From snapshot.metadata.constraints
    const metaConstraints = snapshot.metadata.constraints;
    if (typeof metaConstraints === 'string' && metaConstraints.trim()) {
      metaConstraints
        .split(/[\r\n;]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .forEach((s) => constraints.push(s));
    } else if (Array.isArray(metaConstraints)) {
      metaConstraints.forEach((s) => {
        if (typeof s === 'string' && s.trim()) constraints.push(s.trim());
      });
    }

    // 2. From boundary / governance decisions
    const boundaryDecisions = (snapshot.decisions?.items || []).filter(
      (d) =>
        (d.status === 'confirmed' || d.status === 'locked' || d.status === 'candidate') &&
        (d.area === 'technical_boundary' ||
          d.area === 'boundary' ||
          d.area === 'governance' ||
          d.area === 'security_boundary' ||
          d.area === 'technical_constraints' ||
          d.affectedAreas?.includes('boundary') ||
          d.affectedAreas?.includes('governance')),
    );

    for (const bd of boundaryDecisions) {
      if (bd.statement && bd.statement.trim()) {
        constraints.push(bd.statement.trim());
      }
    }

    // Remove duplicates
    const uniqueConstraints = Array.from(new Set(constraints));

    if (uniqueConstraints.length > 0) {
      uniqueConstraints.slice(0, 5).forEach((rule, idx) => {
        lines.push(`    R${idx + 1}["规约 ${idx + 1}: ${sanitize(rule)}"]`);
      });
    } else {
      lines.push('    R1["📌 领域边界定义中 (Domain Boundaries Under Discovery)\\n确立技术边界或安全规约决策后将自动同步构建"]');
    }

    lines.push('  end');
    lines.push('  Audit{"🔎 规范审计与边界防护引擎 (Boundary & Drift Guard)"}');
    lines.push('  Codebase["💻 目标工程源码与实现 (Target Implementation)"]');
    lines.push('  Report["📋 架构合规验证报告 (Compliance Report)"]');
    lines.push('');
    lines.push('  BoundaryRules --> Audit');
    lines.push('  Codebase --> Audit');
    lines.push('  Audit -->|合规校验 (Evaluates Compliance)| Report');

    return {
      id: 'diag-boundary-governance',
      type: 'boundary-governance',
      title: '架构边界与治理规则拓扑 (Boundary Governance & Drift Guard)',
      description: '展示用户项目技术底线、安全规约与代码实现之间的边界合规防御拓扑。',
      mermaidCode: lines.join('\n'),
      generatedAt: timestamp,
    };
  }
}
