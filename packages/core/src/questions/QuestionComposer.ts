import { AreaRegistry } from '../areas/AreaRegistry.js';
import { getChecklistTemplate } from './ChecklistQuestionTemplates.js';
import type { DiscoveryResult, GapItem, QuestionImportance, QuestionItem, QuestionOption, TypedRef } from '@project-architect/contracts';

export class QuestionComposer {
  compose(gap: GapItem, preferredQuestion?: DiscoveryResult['questions'][number]): QuestionItem {
    return preferredQuestion ? this.fromStructuredAgentQuestion(gap, preferredQuestion) : this.fromGap(gap);
  }

  /** Uses Agent wording only when it clearly belongs to the selected gap. */
  matchStructuredQuestion(
    gap: GapItem,
    questions: DiscoveryResult['questions'] | undefined,
    usedQuestionTexts: Set<string>
  ): DiscoveryResult['questions'][number] | undefined {
    if (!questions) return undefined;
    const decisionKey = this.normalizeKey(gap.decisionKey || '');
    return questions.find((candidate) => {
      if (usedQuestionTexts.has(this.normalizeText(candidate.question))) return false;
      return decisionKey.length > 0
        && this.normalizeKey(candidate.decision_key || '') === decisionKey
        && this.isReadableQuestion(candidate);
    });
  }

  toAssumption(gap: GapItem, timestamp = new Date().toISOString()) {
    return {
      id: `asm-auto-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      statement: `暂定默认：${gap.reason}`,
      reason: gap.impact || '低优先级、可逆的产品细节先保留为显式 Assumption。',
      area: gap.area,
      decisionKey: gap.decisionKey || `${gap.area}:${gap.id}`,
      status: 'active' as const,
      createdAt: timestamp,
    };
  }

  private fromStructuredAgentQuestion(gap: GapItem, question: DiscoveryResult['questions'][number]): QuestionItem {
    const reason = question.reason || this.whyNow(gap);
    const options: QuestionOption[] = (question.options || []).map((option, idx) => ({
      key: option.key || `opt_${idx + 1}`,
      label: option.label,
      impact: option.impact,
      tradeoffs: option.tradeoffs,
      reversibility: option.reversibility || 'moderate',
    }));
    let recommendedOptionKey = question.recommended_option_key;
    if (!recommendedOptionKey || !options.some((o) => o.key === recommendedOptionKey)) {
      recommendedOptionKey = options[0]?.key || question.recommended_option_key;
    }

    const recOpt = options.find((o) => o.key === recommendedOptionKey) || options[0];
    const recommendation = question.recommendation
      || (recOpt ? `建议优先选择“${recOpt.label}”` : this.recommendation(gap));
    const recommendationReason = question.recommendation_reason
      || (recOpt?.gain || recOpt?.impact || this.recommendationReason(gap));

    return {
      id: this.questionId(), issueRef: `gap:${gap.id}` as TypedRef, gapRef: `gap:${gap.id}` as TypedRef,
      importance: this.importance(gap), priority: this.importance(gap), question: question.question,
      area: gap.area,
      reason, whyNow: reason, impact: gap.impact,
      recommendation,
      recommendationReason,
      recommendedOptionKey,
      options,
      allowFreeInput: true, status: 'proposed', createdAt: new Date().toISOString(),
      decisionKey: this.normalizeKey(question.decision_key || gap.decisionKey || `${gap.area}:${gap.id}`),
      dependsOn: (question.depends_on || gap.dependsOn || []).map((value) => this.normalizeKey(value)),
    };
  }

  private fromGap(gap: GapItem): QuestionItem {
    const whyNow = this.whyNow(gap);
    const decisionKey = gap.decisionKey || `${gap.area}:${gap.id}`;
    let template = getChecklistTemplate(decisionKey);
    if (!template && !gap.decisionKey && gap.area) {
      template = getChecklistTemplate(gap.area);
    }

    if (template) {
      const qText = template.question(gap);
      const rText = template.reason(gap);
      const recommendedOptionKey = template.recommendedOptionKey || template.options[0]?.key;
      const recOpt = template.options.find((o) => o.key === recommendedOptionKey) || template.options[0];

      const recommendation = recOpt
        ? `建议优先选择“${recOpt.label}”`
        : this.recommendation(gap);
      const recommendationReason = recOpt?.gain || recOpt?.impact || this.recommendationReason(gap);

      return {
        id: this.questionId(),
        issueRef: `gap:${gap.id}` as TypedRef,
        gapRef: `gap:${gap.id}` as TypedRef,
        importance: this.importance(gap),
        priority: this.importance(gap),
        question: qText,
        area: gap.area,
        reason: rText,
        whyNow: rText,
        impact: gap.impact,
        recommendation,
        recommendationReason,
        recommendedOptionKey,
        options: template.options,
        allowFreeInput: true,
        status: 'proposed',
        createdAt: new Date().toISOString(),
        decisionKey: this.normalizeKey(decisionKey),
        dependsOn: (gap.dependsOn || []).map((value) => this.normalizeKey(value)),
      };
    }

    // Safe free-input question when no concrete template exists
    return {
      id: this.questionId(),
      issueRef: `gap:${gap.id}` as TypedRef,
      gapRef: `gap:${gap.id}` as TypedRef,
      importance: this.importance(gap),
      priority: this.importance(gap),
      question: this.formatFallbackQuestion(gap),
      area: gap.area,
      reason: whyNow,
      whyNow,
      impact: gap.impact,
      recommendation: this.recommendation(gap),
      recommendationReason: this.recommendationReason(gap),
      options: [],
      allowFreeInput: true,
      status: 'proposed',
      createdAt: new Date().toISOString(),
      decisionKey: this.normalizeKey(decisionKey),
      dependsOn: (gap.dependsOn || []).map((value) => this.normalizeKey(value)),
    };
  }

  private importance(gap: GapItem): QuestionImportance {
    return gap.severity === 'critical' ? 'critical' : gap.severity === 'high' ? 'high' : 'normal';
  }

  private formatFallbackQuestion(gap: GapItem): string {
    const label = this.areaLabel(gap.area);
    if (!this.readableGapReason(gap)) {
      return `关于${label}，首发版本应该优先选择哪种方向？`;
    }

    const cleanReason = this.toQuestionSubject(gap.reason);
    // If cleanReason is already a question
    if (cleanReason.endsWith('？') || cleanReason.endsWith('?')) {
      return cleanReason;
    }

    // Domain-aware natural phrasing
    const area = AreaRegistry.normalize(gap.area || '') || gap.area;
    switch (area) {
      case 'target_user':
        return `关于目标用户群体，首发版本你希望如何定位？（${cleanReason}）`;
      case 'mvp_scope':
        return `关于首发功能范围，你希望如何划定边界？（${cleanReason}）`;
      case 'core_features':
        return `关于核心功能实现，首发版本优先聚焦哪种方案？（${cleanReason}）`;
      case 'user_flows':
        return `关于核心操作流程，首发版本建议如何设计用户路径？（${cleanReason}）`;
      case 'page_structure':
        return `关于页面与信息架构，首发版本如何组织展示空间？（${cleanReason}）`;
      case 'ux_ui_direction':
        return `关于视觉与交互体验，首发版本倾向于哪种设计风格？（${cleanReason}）`;
      case 'technical_boundary':
        return `关于技术底线与运行环境，首发版本需要满足哪些关键约束？（${cleanReason}）`;
      case 'delivery_plan':
        return `关于首发版本交付标准，以何种方式判定当前阶段完成？（${cleanReason}）`;
      default:
        return `关于${label}，首发版本你希望如何决策：${cleanReason}？`;
    }
  }

  private whyNow(gap: GapItem): string {
    if (this.readableGapReason(gap)) {
      const reason = this.stripTerminalPunctuation(gap.reason);
      const impact = this.hasEnoughChinese(gap.impact, 4)
        ? this.stripTerminalPunctuation(gap.impact!)
        : `后续的${this.areaLabel(gap.area)}范围、用户体验和交付计划会缺少依据`;
      return `${reason}。明确此事项有助于${impact}。`;
    }
    return `这个决定会直接影响${this.areaLabel(gap.area)}的首发范围、用户体验和后续返工成本。`;
  }

  private recommendation(gap: GapItem): string {
    const text = `${gap.reason || ''} ${gap.decisionKey || ''}`.toLowerCase();
    const label = this.areaLabel(gap.area);

    // 1. Semantic keyword matching
    if (/(?:avatar|room|asset|素材|装扮|形象|房间)/i.test(text)) {
      return `建议首发内置 2-3 套精美默认形象与“${label}”素材，暂缓自由文件上传与复杂编辑器。`;
    }
    if (/(?:sync|action|status|动作|同步|互动|玩法|吃饭|睡觉)/i.test(text)) {
      return `建议首发优先实现基础双人在线状态与单向高频动作广播“${label}”，暂不做复杂物理碰撞与链式互动。`;
    }
    if (/(?:movie|photo|video|storage|观影|相册|影视|视频|音乐|传输|存储|媒体)/i.test(text)) {
      return `建议首发采用外部公共媒体源嵌入或轻量缩略图展示“${label}”，暂不自建重度流媒体转码与大文件存储。`;
    }
    if (/(?:notify|remind|alert|提醒|通知|即时|响应)/i.test(text)) {
      return `建议首发优先采用应用内轻量弹窗与声音动效提醒“${label}”，暂不做复杂的系统级后台推送。`;
    }
    if (/(?:privacy|deploy|network|隐私|部署|网络|安全|权限)/i.test(text)) {
      return `建议首发采用纯本地文件存储或局域网直连“${label}”，严格隔离外部公开访问。`;
    }

    // 2. Domain specific fallbacks
    const area = AreaRegistry.normalize(gap.area || '') || gap.area;
    switch (area) {
      case 'target_user':
        return `建议首发优先收敛“${label}”为情侣两人私密专属空间，暂不扩展为大众通用社区。`;
      case 'mvp_scope':
        return `建议首发严格收敛“${label}”核心场景闭环，将日记、相册等衍生模块列为二期。`;
      case 'core_features':
        return `建议优先打磨“${label}”最高频的 1-2 个核心互动玩法，次要操作后续逐步拓展。`;
      case 'user_flows':
        return `建议为“${label}”设计打开即入房间的最短操作路径，省略多余的层级跳转。`;
      case 'page_structure':
        return `建议优先采用单屏沉浸主视图“${label}”，设置与辅助功能使用抽屉抽离。`;
      case 'ux_ui_direction':
        return `建议采用温馨像素风或柔和插画“${label}”，注重微动效与氛围感。`;
      case 'technical_boundary':
        return `建议选用主流轻量前端框架配合简单单机后端“${label}”，保持架构精简。`;
      case 'delivery_plan':
        return `建议以两端能正常联通并互相看到动作作为“${label}”交付里程碑。`;
      default:
        return `建议优先选择针对“${label}”最轻量直接的方案，将衍生边缘细节延后。`;
    }
  }

  private recommendationReason(gap: GapItem): string {
    const text = `${gap.reason || ''} ${gap.decisionKey || ''}`.toLowerCase();

    // 1. Semantic keyword matching
    if (/(?:avatar|room|asset|素材|装扮|形象|房间)/i.test(text)) {
      return '统一视觉美术基调，避免前期处理复杂的图片裁剪与多端适配成本。';
    }
    if (/(?:sync|action|status|动作|同步|互动|玩法|吃饭|睡觉)/i.test(text)) {
      return '以最轻量 WebSocket 链路验证两人连接感，大幅降低网络并发状态同步与时序对齐难度。';
    }
    if (/(?:movie|photo|video|storage|观影|相册|影视|视频|音乐|传输|存储|媒体)/i.test(text)) {
      return '避免引入高昂的云端带宽和持久化存储成本，保持客户端轻量敏捷。';
    }
    if (/(?:notify|remind|alert|提醒|通知|即时|响应)/i.test(text)) {
      return '纯应用内提醒实现成本极低且零外部权限依赖，不打扰系统全局环境。';
    }
    if (/(?:privacy|deploy|network|隐私|部署|网络|安全|权限)/i.test(text)) {
      return '保障情侣双人数据的绝对私密安全性，无需复杂的权限校验与防刷机制。';
    }

    // 2. Domain specific fallbacks
    const area = AreaRegistry.normalize(gap.area || '') || gap.area;
    switch (area) {
      case 'target_user':
        return '消除多租户隔离与公开账号体系负担，专注两人情感连接体验。';
      case 'mvp_scope':
        return '快速完成第一阶段可用闭环，避免需求蔓延导致交付拖延。';
      case 'core_features':
        return '集中精力把核心互动做丝滑，避免多个未完成功能堆砌。';
      case 'user_flows':
        return '降低日常高频使用的打开阻力，营造即时陪伴氛围。';
      case 'page_structure':
        return '视觉焦点始终停留在两人的虚拟小窝，空间层次分明。';
      case 'ux_ui_direction':
        return '轻量易绘制且富有情感温度，兼顾加载性能与视觉舒适度。';
      case 'technical_boundary':
        return '极低的学习和维护门槛，便于快速迭代与本地部署。';
      case 'delivery_plan':
        return '里程碑清晰客观，能最快获得可感知的正向反馈。';
      default:
        return '降低前期架构复杂度，留出后期灵活演进空间。';
    }
  }

  private areaLabel(area: string): string {
    return AreaRegistry.getReadinessTitle(area) || '当前产品边界';
  }

  private isReadableQuestion(question: DiscoveryResult['questions'][number]): boolean {
    if (!this.hasEnoughChinese(question.question, 6) || question.question.length > 160) return false;
    if (!this.hasEnoughChinese(question.reason, 8)) return false;
    if (!this.hasEnoughChinese(question.recommendation, 4)) return false;
    if (!this.hasEnoughChinese(question.recommendation_reason, 6)) return false;
    if (!Array.isArray(question.options) || question.options.length < 2 || question.options.length > 3) return false;
    return question.options.every((option) =>
      this.hasEnoughChinese(option.label, 2) && this.isConcreteImpact(option.impact)
    );
  }

  private isConcreteImpact(impact: string): boolean {
    if (!this.hasEnoughChinese(impact, 6)) return false;
    const concreteConsequences = [
      '范围', '用户', '体验', '时间', '周期', '成本', '工作量', '复杂', '风险', '交付',
      '维护', '返工', '验证', '覆盖', '操作', '性能', '安全', '隐私', '学习', '效率',
      '开发', '界面', '文件', '数据', '功能', '系统', '权限', '资源', '上手', '发布',
      '更新', '门槛', '信任', '场景', '设计', '交互', '单机', '网络', '格式', '协议',
      '依赖', '测试', '状态', '动作', '素材', '同步', '展示', '房间', '玩法',
    ];
    return concreteConsequences.some((term) => impact.includes(term));
  }

  private readableGapReason(gap: GapItem): boolean {
    return this.hasEnoughChinese(gap.reason, 6);
  }

  private hasEnoughChinese(text: string | undefined, minimum: number): boolean {
    return (text?.match(/[\u3400-\u9fff]/g) ?? []).length >= minimum;
  }

  private normalizeText(text: string): string {
    return text.toLowerCase().replace(/[\s\p{P}]+/gu, '');
  }

  private stripTerminalPunctuation(text: string): string {
    return text.trim().replace(/[。！？；,.!?;：:]+$/u, '');
  }

  private toQuestionSubject(text: string): string {
    return this.stripTerminalPunctuation(text).replace(/^(?:当前)?(?:需要|尚需|必须|应当|应该)\s*/u, '');
  }

  private normalizeKey(value: string): string {
    return value.toLowerCase().trim().replace(/[^a-z0-9_:-]+/g, '_');
  }

  private questionId(): string {
    return `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  }
}
