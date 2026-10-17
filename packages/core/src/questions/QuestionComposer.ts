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
      return `建议首发内置标准默认配置与“${label}”规范，暂缓自由文件上传与复杂自定义编辑器。`;
    }
    if (/(?:sync|action|status|动作|同步|互动|玩法|吃饭|睡觉)/i.test(text)) {
      return `建议首发优先实现基础状态同步与单向事件通知机制“${label}”，暂不做复杂并发冲突解决与链式交互。`;
    }
    if (/(?:movie|photo|video|storage|观影|相册|影视|视频|音乐|传输|存储|媒体)/i.test(text)) {
      return `建议首发采用轻量本地文件存储或标准外部对象嵌入“${label}”，暂不自建重度流媒体转码与大文件存储。`;
    }
    if (/(?:notify|remind|alert|提醒|通知|即时|响应)/i.test(text)) {
      return `建议首发优先采用应用内轻量弹窗与系统标准事件提醒“${label}”，暂不做复杂的多端推送流水线。`;
    }
    if (/(?:privacy|deploy|network|隐私|部署|网络|安全|权限)/i.test(text)) {
      return `建议首发采用纯本地文件持久化或局域网直连“${label}”，严格收敛网络与公开权限暴露面。`;
    }

    // 2. Domain specific fallbacks
    const area = AreaRegistry.normalize(gap.area || '') || gap.area;
    switch (area) {
      case 'target_user':
        return `建议首发优先聚焦 1 类典型核心目标用户群体的“${label}”，暂缓拓展多角色复杂权限体系。`;
      case 'mvp_scope':
        return `建议首发严格收敛“${label}”核心场景闭环，将边缘衍生模块列为二期演进。`;
      case 'core_features':
        return `建议优先打磨“${label}”最高频的 1-2 个核心功能特性，次要操作后续逐步拓展。`;
      case 'user_flows':
        return `建议为“${label}”设计最精简的主线操作闭环，省略不必要的冗余跳转与确认层级。`;
      case 'page_structure':
        return `建议优先采用清晰紧凑的主工作台视图组织“${label}”，设置与辅助功能使用抽屉抽离。`;
      case 'ux_ui_direction':
        return `建议采用现代中性、高对比度与信息密度均衡的视觉语言“${label}”，注重响应速度与无障碍排版。`;
      case 'technical_boundary':
        return `建议选用主流轻量成熟的技术栈与本地优先单机方案“${label}”，保持系统架构精简健壮。`;
      case 'delivery_plan':
        return `建议以核心主干流程跑通并完成自动化验收测试作为“${label}”交付里程碑。`;
      default:
        return `建议优先选择针对“${label}”最轻量直接的技术方案，将衍生边缘细节延后。`;
    }
  }

  private recommendationReason(gap: GapItem): string {
    const text = `${gap.reason || ''} ${gap.decisionKey || ''}`.toLowerCase();

    // 1. Semantic keyword matching
    if (/(?:avatar|room|asset|素材|装扮|形象|房间)/i.test(text)) {
      return '统一规范与格式基调，避免前期处理复杂的素材校验与多端适配成本。';
    }
    if (/(?:sync|action|status|动作|同步|互动|玩法|吃饭|睡觉)/i.test(text)) {
      return '以轻量状态流验证核心闭环，大幅降低并发状态同步与时序对齐难度。';
    }
    if (/(?:movie|photo|video|storage|观影|相册|影视|视频|音乐|传输|存储|媒体)/i.test(text)) {
      return '避免引入高昂的存储运维与网络带宽成本，保持系统轻量敏捷。';
    }
    if (/(?:notify|remind|alert|提醒|通知|即时|响应)/i.test(text)) {
      return '应用内通知实现成本低且零外部依赖，避免打扰系统环境。';
    }
    if (/(?:privacy|deploy|network|隐私|部署|网络|安全|权限)/i.test(text)) {
      return '保障核心系统与数据的本地私密安全性，无需前期引入复杂的访问控制与防刷体系。';
    }

    // 2. Domain specific fallbacks
    const area = AreaRegistry.normalize(gap.area || '') || gap.area;
    switch (area) {
      case 'target_user':
        return '消除多租户隔离与公开账号体系负担，专注核心业务闭环体验。';
      case 'mvp_scope':
        return '快速完成第一阶段可用闭环，避免需求蔓延导致交付拖延。';
      case 'core_features':
        return '集中精力将核心业务流做扎实，避免过早陷入边缘特性的过度设计。';
      case 'user_flows':
        return '降低日常高频使用的认知阻力与操作路径长度。';
      case 'page_structure':
        return '保持主界面视觉焦点专注，信息空间层次分明。';
      case 'ux_ui_direction':
        return '符合工程与专业软件的使用习惯，兼顾阅读舒适度与长期可扩展性。';
      case 'technical_boundary':
        return '具有极低的学习与运维维护门槛，便于本地快速演进与持续集成验证。';
      case 'delivery_plan':
        return '交付里程碑客观可量化，能最快获得端到端闭环验证结果。';
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
