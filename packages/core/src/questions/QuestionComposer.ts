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
    const areaTerms = this.areaTerms(gap.area);
    const reasonTerms = this.keyTerms(gap.reason);
    return questions.find((candidate) => {
      if (usedQuestionTexts.has(this.normalizeText(candidate.question))) return false;
      const text = `${candidate.question} ${candidate.reason} ${candidate.recommendation}`.toLowerCase();
      return areaTerms.some((term) => text.includes(term)) || reasonTerms.some((term) => text.includes(term));
    });
  }

  toAssumption(gap: GapItem, timestamp = new Date().toISOString()) {
    return {
      id: `asm-auto-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      statement: `暂定默认：${gap.reason}`,
      reason: gap.impact || '低优先级、可逆的产品细节先保留为显式 Assumption。',
      status: 'active' as const,
      createdAt: timestamp,
    };
  }

  private fromStructuredAgentQuestion(gap: GapItem, question: DiscoveryResult['questions'][number]): QuestionItem {
    const reason = question.reason || this.whyNow(gap);
    return {
      id: this.questionId(), issueRef: `gap:${gap.id}` as TypedRef, gapRef: `gap:${gap.id}` as TypedRef,
      importance: this.importance(gap), priority: this.importance(gap), question: question.question,
      reason, whyNow: reason, impact: gap.impact,
      recommendation: question.recommendation || this.recommendation(gap),
      recommendationReason: question.recommendation_reason || this.recommendationReason(gap),
      options: (question.options || []).map((option) => ({ label: option.label, impact: option.impact })),
      allowFreeInput: true, status: 'proposed', createdAt: new Date().toISOString(),
    };
  }

  private fromGap(gap: GapItem): QuestionItem {
    const label = this.areaLabel(gap.area);
    const whyNow = this.whyNow(gap);
    const options: QuestionOption[] = [
      { label: `先明确 ${label} 的首发边界`, impact: '让 MVP 取舍可验证，减少后续返工。' },
      { label: '保留为后续方向', impact: '保留弹性，但不将它视为首发版本承诺。' },
    ];
    return {
      id: this.questionId(), issueRef: `gap:${gap.id}` as TypedRef, gapRef: `gap:${gap.id}` as TypedRef,
      importance: this.importance(gap), priority: this.importance(gap),
      question: `为了明确${label}，请确认：${gap.reason}`,
      reason: whyNow, whyNow, impact: gap.impact,
      recommendation: this.recommendation(gap), recommendationReason: this.recommendationReason(gap), options,
      allowFreeInput: true, status: 'proposed', createdAt: new Date().toISOString(),
    };
  }

  private importance(gap: GapItem): QuestionImportance {
    return gap.severity === 'critical' ? 'critical' : gap.severity === 'high' ? 'high' : 'normal';
  }
  private whyNow(gap: GapItem): string {
    return `${gap.reason}；若此时不澄清，${gap.impact || '后续范围与主流程将缺少可靠依据'}。`;
  }
  private recommendation(gap: GapItem): string {
    return `建议先用可验证的首发边界收敛${this.areaLabel(gap.area)}，将非必要内容延后。`;
  }
  private recommendationReason(gap: GapItem): string {
    return `这能先降低${this.areaLabel(gap.area)}的不确定性，而不提前锁定实现方案。`;
  }
  private areaLabel(area: string): string {
    const labels: Record<string, string> = {
      product_identity: '产品定位', target_user: '目标用户', user_flows: '核心流程', mvp_scope: 'MVP 范围',
      trust_safety: '信任与安全承诺', ux_ui: '体验方向', technical_boundary: '技术约束',
    };
    return labels[area.toLowerCase().trim().replace(/[-\s]+/g, '_')] ?? '当前产品边界';
  }
  private areaTerms(area: string): string[] {
    return [area.toLowerCase(), ...this.areaLabel(area).toLowerCase().split(/[、\s]+/)].filter(Boolean);
  }
  private keyTerms(text: string): string[] {
    return text.toLowerCase().split(/[\s，。；、,:：!?！？]+/).filter((term) => term.length >= 3).slice(0, 5);
  }
  private normalizeText(text: string): string {
    return text.toLowerCase().replace(/[\s\p{P}]+/gu, '');
  }
  private questionId(): string {
    return `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  }
}
