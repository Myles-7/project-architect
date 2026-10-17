import React from 'react';
import {
  MessageSquare,
  Layers,
  ShieldCheck,
  FileCheck2,
  Check,
  ChevronRight,
} from 'lucide-react';
import { useProjectSession } from '../../state/ProjectSessionContext.js';
import type { WorkspaceTab } from '../../types/session.js';
import type { ProjectStage } from '@project-architect/contracts';

interface StepDef {
  id: string;
  name: string;
  tab: WorkspaceTab;
  icon: React.ComponentType<{ className?: string }>;
  stages: ProjectStage[];
}

const STEPS: StepDef[] = [
  {
    id: 'discovery',
    name: '意图探索',
    tab: 'chat',
    icon: MessageSquare,
    stages: ['created', 'initial-analysis', 'broad-pass'],
  },
  {
    id: 'converge',
    name: '方案收敛',
    tab: 'chat',
    icon: Layers,
    stages: ['deep-dive'],
  },
  {
    id: 'readiness',
    name: '准备度门禁',
    tab: 'readiness',
    icon: ShieldCheck,
    stages: ['readiness-review', 'approved'],
  },
  {
    id: 'documents',
    name: '规范蓝图',
    tab: 'documents',
    icon: FileCheck2,
    stages: ['documents-generated'],
  },
];

export const WorkflowStepper: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { state, setActiveTab } = useProjectSession();
  const { snapshot, uiState } = state;

  if (!snapshot) return null;

  const currentStage = snapshot.metadata.stage;
  const currentStepIndex = STEPS.findIndex((s) => s.stages.includes(currentStage));
  const activeStepIdx = currentStepIndex === -1 ? 0 : currentStepIndex;

  return (
    <div
      className={`flex items-center gap-1 sm:gap-2 px-3 py-1 rounded-xl bg-zinc-100/80 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800/60 text-xs ${className}`}
      role="navigation"
      aria-label="项目生命周期推进步进器"
    >
      {STEPS.map((step, idx) => {
        const isPast = idx < activeStepIdx || currentStage === 'documents-generated';
        const isCurrent = idx === activeStepIdx;
        const isActiveTab = uiState.activeTab === step.tab;

        return (
          <React.Fragment key={step.id}>
            <button
              type="button"
              onClick={() => setActiveTab(step.tab)}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg font-medium transition-all cursor-pointer select-none ${
                isActiveTab
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold'
                  : isCurrent
                  ? 'text-orange-600 dark:text-orange-400 hover:bg-white/50 dark:hover:bg-zinc-800/50'
                  : isPast
                  ? 'text-emerald-700 dark:text-emerald-400 hover:bg-white/50 dark:hover:bg-zinc-800/50'
                  : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
              title={`跳转至 ${step.name}`}
            >
              <div
                className={`w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold ${
                  isPast
                    ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                    : isCurrent
                    ? 'bg-orange-600 text-white shadow-2xs'
                    : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'
                }`}
              >
                {isPast ? <Check className="w-2.5 h-2.5 stroke-[3]" /> : <span>{idx + 1}</span>}
              </div>
              <span className="hidden md:inline font-sans text-[11px]">{step.name}</span>
            </button>
            {idx < STEPS.length - 1 && (
              <ChevronRight className="w-3 h-3 text-zinc-300 dark:text-zinc-700 shrink-0" />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
