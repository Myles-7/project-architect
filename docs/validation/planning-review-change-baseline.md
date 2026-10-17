# 评审的变更前基线

候选覆盖同 ID 正文后，旧批准内容仍从当前有效 `blueprint` 投影中省略，避免旧失败规则覆盖已经修正的草案。但仅给评审旧标题与锁定元数据，无法核对重写是否意外删去原痛点、排除事项或验收。

现在仅向独立 `review` 任务提供 `changeReviewBaseline`：包含被替换或删除的此前批准块，明确标为 `previous-approved-for-change-comparison-only`。它是比较来源，不是当前设计；有效候选仍由最新草案覆盖。作者与研究任务不收到这份额外正文。提示词要求检查没有反馈依据的范围删除，同时允许明确要求的行为替代，禁止机械恢复旧稿。

验证：新增反例在旧实现下两项失败；修复后 `planning-blueprint-context.test.ts` 七项通过。测试覆盖候选视图、旧边界比较、删除、锁定来源、支持任务隔离与正式状态哈希不变。记录见 `planning-review-baseline-red.txt` 和 `planning-review-baseline-green.txt`。这证明上下文正确提供，不表示真实模型必定发现所有内容缺陷。

材料真实质量包编译控制同时修正：继承的 `quality-reviewed` 标签不能证明当前修订已编译。新轮次使用唯一标签重新编译；`publish-quality-copy.mjs` 在冻结证据的副本上经正式 HTTP 发布并导出 sourceRevision 24 的新包，原 sourceRevision 20 产物继续保留。控制 `flash-materials-quality-publish-20261005-04` 的 9 项发布检查、329 项 ZIP 检查、20 项 HTTP/UI 检查通过，Provider 调用为零。这些检查不代替独立内容审阅。
