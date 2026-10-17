import type { QuestionAnswerIntent, QuestionItem } from '@project-architect/contracts';
import { answerIsReady } from './planningPresentation.js';
import { usePlanningDraft } from './usePlanningDraft.js';
import { planningDraftKey } from './planningDraftStore.js';

export function PlanningQuestions({ projectId, questions, busy, onAnswer }: { projectId: string; questions: QuestionItem[]; busy: boolean; onAnswer: (answers: QuestionAnswerIntent[]) => Promise<boolean> }) {
  // Scope answers to the complete question contract. A changed option or
  // decision key must never acquire a previous batch's selection.
  const questionIdentity = JSON.stringify(questions);
  const [answers, setAnswers] = usePlanningDraft<Record<string, QuestionAnswerIntent>>(planningDraftKey(projectId, 'answers', questionIdentity), {});
  if (!questions.length) return null;
  const ready = questions.map(q => answers[q.id]).filter(answerIsReady) as QuestionAnswerIntent[];
  const setMode = (questionId: string, kind: QuestionAnswerIntent['kind']) => setAnswers(old => ({ ...old, [questionId]: { questionId, kind, optionKeys: [], text: '' } }));
  return <section className="planning-questions" aria-label="待回答的问题">
    <div className="planning-section-heading"><h3>这一轮需要你的判断</h3><span>最多三道独立问题</span></div>
    {questions.map((question, index) => {
      const answer = answers[question.id];
      const mode = answer?.kind || 'selection';
      return <fieldset key={question.id} className="planning-question" disabled={busy}>
        <legend><span className="planning-question-number">{index + 1}</span>{question.question}</legend>
        <p className="planning-muted">为什么现在问：{question.whyNow || question.reason}</p>
        {question.reopenReason && <p className="planning-notice">重新讨论的原因：{question.reopenReason}</p>}
        <p className="planning-recommendation">建议：{question.recommendation}。{question.recommendationReason}</p>
        <div className="planning-answer-modes" aria-label="回答方式">
          {([{ kind: 'selection', label: '选择方案' }, { kind: 'custom', label: '自定义答案' }, { kind: 'delegate', label: '委托 AI 提议' }, { kind: 'defer', label: '暂缓决定' }] as const).map(item => <button key={item.kind} type="button" aria-pressed={mode === item.kind} onClick={() => setMode(question.id, item.kind)}>{item.label}</button>)}
        </div>
        {mode === 'selection' ? <div className="planning-options">
          {question.options.map(option => <label key={option.key} className={`planning-option ${answer?.optionKeys?.includes(option.key) ? 'is-selected' : ''}`}>
            <input type={question.selectionMode === 'multiple' ? 'checkbox' : 'radio'} name={`question-${question.id}`} value={option.key} checked={answer?.optionKeys?.includes(option.key) || false} onChange={event => setAnswers(old => {
              const keys = old[question.id]?.optionKeys || [];
              const optionKeys = question.selectionMode === 'multiple' ? event.target.checked ? [...keys, option.key] : keys.filter(key => key !== option.key) : [option.key];
              return { ...old, [question.id]: { questionId: question.id, kind: 'selection', optionKeys } };
            })} />
            <span className="planning-option-body"><strong>{option.label}{question.recommendedOptionKey === option.key && <small className="planning-badge">建议</small>}</strong>
              <span>做法：{option.approach || option.label}</span>
              <span>收益：{option.gain || '未说明'}</span>
              <span>代价：{option.sacrifice || option.tradeoffs || '未说明'}</span>
              <span>影响：{option.impact}</span>
              <span>可逆性：{option.reversibility === 'easy' ? '容易调整' : option.reversibility === 'moderate' ? '需要迁移或修改' : option.reversibility === 'hard' ? '调整成本较高' : '未说明'}</span>
            </span>
          </label>)}
          {question.selectionMode === 'multiple' && <p className="planning-muted">这些方案可组合，勾选一个或多个。</p>}
        </div> : <label className="planning-field">{mode === 'custom' ? '你的答案原文' : mode === 'delegate' ? '委托范围与边界（可选）' : '暂缓原因或需要的信息（可选）'}
          <textarea rows={3} value={answer?.text || ''} onChange={event => setAnswers(old => ({ ...old, [question.id]: { questionId: question.id, kind: mode, text: event.target.value } }))} />
          <span className="planning-muted">{mode === 'custom' ? '保存原文；AI 的归纳或提议仍需你审批。' : mode === 'delegate' ? '可直接提交委托；AI 的提议仍需你审批。补充边界时保留原文。' : '可直接提交暂缓，之后再决定；补充原因时保留原文。'}</span>
        </label>}
      </fieldset>;
    })}
    <button className="planning-button primary" disabled={busy || !ready.length} onClick={async () => { if (await onAnswer(ready)) setAnswers({}); }}>提交 {ready.length || ''} 个回答</button>
  </section>;
}
