import React from 'react';
import {
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import type { ProjectSnapshot, DiscoveryProgressView } from '@project-architect/contracts';

interface NextBestActionBannerProps {
  snapshot: ProjectSnapshot | null;
  progress?: DiscoveryProgressView | null;
  onFocusInput?: () => void;
  onJumpToTab?: (tab: 'chat' | 'readiness' | 'documents' | 'files') => void;
  onJumpToFirstUnanswered?: () => void;
}

export const NextBestActionBanner: React.FC<NextBestActionBannerProps> = ({
  snapshot,
  progress,
  onFocusInput,
  onJumpToTab,
  onJumpToFirstUnanswered,
}) => {
  if (!snapshot) return null;

  // 1. Calculate stages & metrics
  const stage = snapshot.metadata.stage || 'created';
  const stageLabelMap: Record<string, string> = {
    created: '初始创建',
    'initial-analysis': '初始构思与澄清',
    'broad-pass': '深入探索与范围发散',
    'deep-dive': '方案收敛与细节敲定',
    'readiness-review': '开发准备度审查',
    approved: '构思已批准，可生成文档',
    'documents-generated': '规范文档已生成',
  };
  const stageLabel = stageLabelMap[stage] || '需求澄清';

  const questions = snapshot.questions?.items || [];
  const unansweredQuestions = questions.filter(
    (q) => q.status !== 'answered' && q.status !== 'superseded' && q.status !== 'dismissed'
  );
  const criticalUnanswered = unansweredQuestions.filter((q) => q.importance === 'critical');

  const candidates = snapshot.decisions?.items?.filter((d) => d.status === 'candidate') || [];
  const activeAssumptions = snapshot.assumptions?.items?.filter((a) => a.status === 'active') || [];
  const openConflicts = snapshot.gaps?.conflicts?.filter((c) => c.status === 'open') || [];
  const confirmedDecisions = snapshot.decisions?.items?.filter(
    (d) => d.status === 'confirmed' || d.status === 'locked'
  ) || [];

  // 2. Identify missing areas
  const coveredAreas = new Set(confirmedDecisions.map((d) => d.area));
  const missingCoreAreas = (snapshot.readiness?.current?.requiredAreas || []).filter(
    (area) => !coveredAreas.has(area)
  );

  // 3. Derive Next Best Action
  let actionTitle = '';
  let actionDesc = '';
  let actionButtonText = '';
  let actionHandler = () => {};
  let actionTone: 'info' | 'warning' | 'success' | 'amber' = 'info';

  if (progress && progress.nextAction === 'review-readiness') {
    actionTone = 'success';
    actionTitle = '核心决策已初步收敛，可审查开发准备度';
    actionDesc = `已确立 ${confirmedDecisions.length} 项决策，且关键缺口已闭环。建议前往准备度页面签署并生成规范包。`;
    actionButtonText = '审查开发准备度';
    actionHandler = () => onJumpToTab?.('readiness');
  } else if (progress && progress.nextAction === 'organize') {
    actionTone = 'info';
    actionTitle = candidates.length > 0
      ? `有 ${candidates.length} 条建议待处理，或开启下一批推演`
      : '本批问题已全部闭环，可补充新想法';
    actionDesc = '当前批次题目已全部回答或跳过。你可以继续在下方输入想法，或开启下一轮探索。';
    actionButtonText = '查看并补充想法';
    actionHandler = () => onFocusInput?.();
  } else if (criticalUnanswered.length > 0 || (progress && progress.blockingDecisionCount > 0 && progress.nextAction === 'answer')) {
    actionTone = 'warning';
    const count = progress ? progress.blockingDecisionCount : criticalUnanswered.length;
    actionTitle = `需明确 ${count} 项核心架构问题`;
    actionDesc = `当前存在未决的必须明确项（如：${criticalUnanswered[0]?.question.slice(0, 30) || '系统关键边界'}...），直接影响系统边界。`;
    actionButtonText = '立即解答核心问题';
    actionHandler = () => onJumpToFirstUnanswered?.();
  } else if (openConflicts.length > 0) {
    actionTone = 'warning';
    actionTitle = `存在 ${openConflicts.length} 处设计红线分歧`;
    actionDesc = `检测到架构要求互斥（${openConflicts[0]?.propositionA} 与 ${openConflicts[0]?.propositionB}），需取舍或调整。`;
    actionButtonText = '前往概览调整决策';
    actionHandler = () => onJumpToTab?.('chat');
  } else if (unansweredQuestions.length > 0 || (progress && progress.remainingBatchQuestionCount > 0)) {
    actionTone = 'amber';
    const count = progress ? progress.remainingBatchQuestionCount : unansweredQuestions.length;
    actionTitle = `尚有 ${count} 个待澄清细节`;
    actionDesc = `已确立 ${confirmedDecisions.length} 项决策。建议继续回答剩余问题，或将其暂存为假设以加快收敛。`;
    actionButtonText = '解答下一个问题';
    actionHandler = () => onJumpToFirstUnanswered?.();
  } else if (candidates.length > 0) {
    actionTone = 'info';
    actionTitle = `有 ${candidates.length} 条 AI 建议等待采纳`;
    actionDesc = `AI 已提炼出技术边界与范围建议，你可以逐条采纳、修改或继续补充想法。`;
    actionButtonText = '查看并补充想法';
    actionHandler = () => onFocusInput?.();
  } else if (missingCoreAreas.length > 0 && confirmedDecisions.length < 5) {
    actionTone = 'info';
    actionTitle = '补充项目业务与技术约束';
    actionDesc = `当前还缺少关于【${missingCoreAreas.slice(0, 2).join('、')}】的明确信息。可以在下方自由输入你的想法。`;
    actionButtonText = '输入补充想法';
    actionHandler = () => onFocusInput?.();
  } else if (
    snapshot.readiness?.current?.userDisposition !== 'approved' &&
    snapshot.readiness?.current?.userDisposition !== 'approved-with-known-issues'
  ) {
    actionTone = 'success';
    actionTitle = '核心决策已初步收敛，可审查准备度';
    actionDesc = `已形成 ${confirmedDecisions.length} 项已确立决策、${activeAssumptions.length} 项假设。建议前往准备度页面签署并生成规范包。`;
    actionButtonText = '审查开发准备度';
    actionHandler = () => onJumpToTab?.('readiness');
  } else {
    actionTone = 'success';
    actionTitle = '已签署准备度，随时可生成开发蓝图';
    actionDesc = '各项边界均已锁定并形成证据闭环，可编译生成完整的交付文档包。';
    actionButtonText = '前往文档中心';
    actionHandler = () => onJumpToTab?.('documents');
  }

  const toneBg = {
    info: 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-200/80 dark:border-blue-900/60 text-blue-950 dark:text-blue-200',
    warning: 'bg-red-50/70 dark:bg-red-950/30 border-red-200/80 dark:border-red-900/60 text-red-950 dark:text-red-200',
    amber: 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200/80 dark:border-amber-900/60 text-amber-950 dark:text-amber-200',
    success: 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200/80 dark:border-emerald-900/60 text-emerald-950 dark:text-emerald-200',
  }[actionTone];

  const btnBg = {
    info: 'bg-blue-600 hover:bg-blue-700 text-white',
    warning: 'bg-red-600 hover:bg-red-700 text-white',
    amber: 'bg-amber-600 hover:bg-amber-700 text-white',
    success: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  }[actionTone];

  return (
    <div className={`p-4 rounded-2xl border transition-all ${toneBg}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="p-2 rounded-xl bg-white/80 dark:bg-black/30 shrink-0 shadow-2xs">
            {actionTone === 'warning' ? (
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
            ) : actionTone === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            ) : actionTone === 'amber' ? (
              <HelpCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            ) : (
              <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            )}
          </div>
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-white/60 dark:bg-black/40 font-semibold">
                当前阶段：{stageLabel}
              </span>
              <span className="text-xs font-bold">{actionTitle}</span>
            </div>
            <p className="text-xs opacity-90 leading-relaxed max-w-xl">{actionDesc}</p>
          </div>
        </div>

        <div className="shrink-0 flex items-center justify-end">
          <button
            type="button"
            onClick={actionHandler}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer ${btnBg}`}
          >
            <span>{actionButtonText}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
