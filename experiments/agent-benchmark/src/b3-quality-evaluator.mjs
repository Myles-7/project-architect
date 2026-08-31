/**
 * B3 Discovery Quality & Contract Evaluator
 *
 * Implements rigorous automated evaluation across:
 * 1. Stage Question Budget (12 / 8 / 4 / 2)
 * 2. Decision Key Uniqueness & Acyclicity (No intra-batch dependencies)
 * 3. Option & Recommendation Integrity (recommended_option_key in options)
 * 4. Chinese Readability & Consequence Depth
 * 5. Locked Decision Protection & Leakage Detection
 * 6. Dual-Reviewer Independent Manual Quality Scoring Model
 */

const CHINESE_REGEX = /[\u3400-\u9fff]/g;
const countChinese = (value) => (String(value || '').match(CHINESE_REGEX) || []).length;

const CONSEQUENCE_TERMS = [
  '范围', '用户', '体验', '时间', '周期', '成本', '工作量', '复杂', '风险', '交付',
  '维护', '返工', '验证', '覆盖', '操作', '性能', '安全', '隐私', '学习', '效率',
  '开发', '界面', '文件', '数据', '功能', '系统', '权限', '资源', '上手', '发布',
  '更新', '门槛', '信任', '内存', '网络', '依赖', '架构', '离线', '存储', '一致性',
  '任务', '目标', '指标', '负担', '压力', '心理', '原则', '认知', '算法', '排程',
  '获得', '失去', '直观', '兼顾', '适合', '导出', '格式', '显示', '计算', '结算', '下载',
  '产品', '价值', '团队', '交互', '效果', '分析', '财务', '价格', '审批', '沟通', '反馈', '提醒', '客户', '时效', '流程', '规范',
];

const LEAKAGE_TERMS = [
  'B3_CONSTITUTION', 'b3-discovery.schema.json', 'PromptProfile', 'SchemaResolver',
  'AgentModeRouter', 'AIOrchestrator', 'ProjectStateEngine', 'TypedRef',
  'STATE_COMMIT', 'QuestionBatchPolicy',
];

const STAGE_MAX_BUDGETS = {
  initial: 12,
  explore: 8,
  converge: 4,
  readiness: 2,
};

/**
 * Evaluates a single B3 Discovery result against the formal release contract.
 */
export function evaluateB3Quality(output, options = {}) {
  const stage = options.stage || 'initial';
  const lockedStatements = options.lockedStatements || [];
  const maxBudget = STAGE_MAX_BUDGETS[stage] || 12;

  const questions = Array.isArray(output?.questions) ? output.questions : [];
  const candidates = Array.isArray(output?.candidates) ? output.candidates : [];
  const assumptions = Array.isArray(output?.assumptions) ? output.assumptions : [];
  const gaps = Array.isArray(output?.gaps) ? output.gaps : [];

  const keys = questions.map((q) => q.decision_key).filter(Boolean);
  const returnedKeys = new Set(keys);

  // 1. Metadata & Key Uniqueness
  const missingMetadata = questions.filter(
    (q) => typeof q.decision_key !== 'string' || !Array.isArray(q.depends_on)
  ).length;
  const duplicateKeys = keys.length - new Set(keys).size;

  // 2. Intra-batch dependency conflicts (must be 0 for independent parallel decision making)
  const intraBatchDependencyConflicts = questions.filter((q) =>
    (q.depends_on || []).some((dep) => returnedKeys.has(dep))
  ).length;

  // 3. Option Key & Recommended Key Consistency
  let invalidRecommendedOptionKeys = 0;
  let missingOptionKeys = 0;
  let duplicateOptionKeys = 0;

  for (const q of questions) {
    const optionList = Array.isArray(q.options) ? q.options : [];
    const optKeys = optionList.map((opt) => opt.key).filter(Boolean);

    if (optKeys.length !== optionList.length) {
      missingOptionKeys += optionList.length - optKeys.length;
    }
    if (optKeys.length !== new Set(optKeys).size) {
      duplicateOptionKeys += optKeys.length - new Set(optKeys).size;
    }

    if (q.recommended_option_key) {
      const exists = optionList.some((opt) => opt.key === q.recommended_option_key);
      if (!exists) {
        invalidRecommendedOptionKeys++;
      }
    }
  }

  // 4. Chinese Readability & Quality Check
  const nonChineseQuestionFields = questions.filter((q) =>
    countChinese(q.question) < 5 ||
    countChinese(q.reason) < 6 ||
    (q.options || []).some((opt) => countChinese(opt.label) < 2)
  ).length;

  const unclearOptionImpacts = questions.flatMap((q) => q.options || []).filter((opt) =>
    countChinese(opt.impact) < 5 ||
    !CONSEQUENCE_TERMS.some((term) => String(opt.impact || '').includes(term))
  ).length;

  // 5. Locked Decision Overwrite & Leakage Protection
  const lockedOverwrites = [];
  for (const locked of lockedStatements) {
    const lockedLower = locked.toLowerCase();
    for (const q of questions) {
      if (q.question && q.question.toLowerCase().includes(lockedLower)) {
        lockedOverwrites.push(`Question "${q.question}" attempts to re-ask locked decision: "${locked}"`);
      }
    }
  }

  const leakageDetected = [];
  const fullText = JSON.stringify(output || {});
  for (const leak of LEAKAGE_TERMS) {
    if (fullText.includes(leak)) {
      leakageDetected.push(`Internal system term leaked: "${leak}"`);
    }
  }

  // Contract violations accumulation
  const violations = [];
  if (questions.length > maxBudget) {
    violations.push(`Stage [${stage}] question budget exceeded: generated ${questions.length}, max allowed ${maxBudget}`);
  }
  if (missingMetadata > 0) violations.push(`Missing B3 metadata: ${missingMetadata} questions lack decision_key or depends_on`);
  if (duplicateKeys > 0) violations.push(`Duplicate decision_key detected: ${duplicateKeys}`);
  if (intraBatchDependencyConflicts > 0) violations.push(`Intra-batch dependency conflicts: ${intraBatchDependencyConflicts}`);
  if (invalidRecommendedOptionKeys > 0) violations.push(`recommended_option_key not found in options: ${invalidRecommendedOptionKeys}`);
  if (missingOptionKeys > 0) violations.push(`Options missing required 'key' field: ${missingOptionKeys}`);
  if (nonChineseQuestionFields > 0) violations.push(`Non-Chinese or poorly worded question fields: ${nonChineseQuestionFields}`);
  if (unclearOptionImpacts > 0) violations.push(`Unclear option consequence impacts: ${unclearOptionImpacts}`);
  if (lockedOverwrites.length > 0) violations.push(...lockedOverwrites);
  if (leakageDetected.length > 0) violations.push(...leakageDetected);

  return {
    stage,
    question_count: questions.length,
    candidates_count: candidates.length,
    assumptions_count: assumptions.length,
    gaps_count: gaps.length,
    unique_decision_keys: new Set(keys).size,
    duplicate_keys: duplicateKeys,
    intra_batch_dependency_conflicts: intraBatchDependencyConflicts,
    invalid_recommended_option_keys: invalidRecommendedOptionKeys,
    missing_option_keys: missingOptionKeys,
    non_chinese_question_fields: nonChineseQuestionFields,
    unclear_option_impacts: unclearOptionImpacts,
    locked_overwrites: lockedOverwrites.length,
    leakage_count: leakageDetected.length,
    violations,
    is_valid_contract: violations.length === 0,
    manual_reviews: normalizeManualReviews(options.manualReviews),
  };
}

/**
 * Manual scores are evidence supplied by real reviewers. Missing evidence must
 * remain pending and must never be synthesized from automated results.
 */
export function normalizeManualReviews(reviews) {
  if (!Array.isArray(reviews)) return [];
  return reviews.map((review) => ({ ...review, evidence: review?.evidence || 'missing' }));
}

export function summarizeManualReviews(records) {
  const dimensions = ['relevance', 'decisionValue', 'independentAnswerability', 'clarity', 'impactUsefulness'];
  const reviews = records.flatMap((record) => record?.b3?.manual_reviews || []);
  const expectedCount = records.length * 2;
  const validReviews = reviews.filter((review) =>
    review?.reviewer && review.evidence !== 'missing' &&
    dimensions.every((dimension) => Number.isFinite(review[dimension]) && review[dimension] >= 1 && review[dimension] <= 5)
  );
  const scores = validReviews.flatMap((review) => dimensions.map((dimension) => review[dimension]));
  const dimensionAverages = Object.fromEntries(dimensions.map((dimension) => {
    const values = validReviews.map((review) => review[dimension]);
    return [dimension, values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null];
  }));
  const average = scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;
  const minimum = scores.length > 0 ? Math.min(...scores) : null;
  return {
    expected_review_count: expectedCount,
    valid_review_count: validReviews.length,
    complete: expectedCount > 0 && validReviews.length === expectedCount,
    average_score: average,
    minimum_score: minimum,
    dimension_averages: dimensionAverages,
    passed: expectedCount > 0
      && validReviews.length === expectedCount
      && Object.values(dimensionAverages).every((value) => value !== null && value >= 4)
      && minimum >= 3,
  };
}
