# 最终本地检查与真实验收恢复

截至2026-10-05本轮检查，重构主体、工具整合及桌面布局已实现，本地统一构建、Schema、163文件/964项测试、4条浏览器流程、25张桌面截图/17项检查通过。源码与构建均含完整上下文分页、A–E调度修复、origin恢复守卫和草案首屏阅读优化。未提交、合并或发布；用户原项目不用于破坏性验收。

M8仍未通过。需要完成便笺与材料的实际质量修订，检查公共接口、初始化、事务/恢复与任务验收一致性；随后独立审阅新包，核对ZIP、正式HTTP与浏览器，再交用户本人审阅。已有API自动批准和过去的包都不能充当新的真人或最终内容通过。

## 当前阻塞及保存成果

- **最新复查：2026-10-05 11:55北京时间**，Flash和Pro短探测仍均429。随后交互式 `/usage` 显示Gemini每周剩余83.12%，但五小时剩余0.00%，约2h47m后刷新；解释了仍有周额度却不能调用的原因。预计约14:45恢复仍非保证。原始调用与只读诊断见 [额度诊断](AGY_QUOTA_DIAGNOSIS_20261005.md)。本轮未启动新完整控制，未产生新批准或包。
- 2026-10-05 11:19北京时间：Flash和Pro实际结构化探测均返回个人额度不足。Gemini服务估计当天约14:45恢复，只是估计。
- 11:20–11:21北京时间：显式创建两个已批准默认Opus模型的新任务，各2次调用均额度失败，0新批准/新包，停稳后零调用/零租约。没有改旧Gemini任务的模型配置。
- `opus-vague-final-20261005-03`保存124份继承成功收据，128项保持检查通过；`opus-materials-final-20261005-03`保存68份，72项通过。旧正式方案和来源控制树保持。
- 便笺新副本中的旧候选因新反馈使依据失效，顶层status已成为stale；9个组仍pending且0审批。`unapproved-pending-reference.json`完整保留原pending对象/哈希，原来源控制不变；不能笼统说新副本的整个ChangeSet对象未改变。
- 最新可用Gemini恢复源为便笺 `flash-vague-draft-final-20261005-04` 和材料 `gemini31-materials-final-20261005-02`。后者只有未批准revision成功，评审因额度未执行；候选尚未恢复原11个公共方法，不能表示质量通过。
- 全局组 `flash-m8-recovered-20261005-02` 的277项槽检查通过，峰值4、全部停稳；只证明调用追踪与并发控制，不证明内容质量。
- agy本机帮助没有账号/剩余额度/刷新额度子命令，但交互式 `/usage` 可以只读查看周期额度。本轮已补查，不能从帮助中无子命令推断没有此能力。模型目录可列出不代表可调用；未读取或编辑凭证文件，未手动切换账号，不推断当前CLI与其他界面的账号相同。

## 恢复顺序

先执行真实短探测，不能根据界面额度数字直接认定CLI可用。使用Node24，工作目录为本仓库：

```powershell
$paNode = 'C:\Users\Li Cheng Xin\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
& $paNode docs/validation/agy-2026-10-04/probe-approved-model-20261005.mjs gemini-3.8-flash-high
& $paNode docs/validation/agy-2026-10-04/probe-approved-model-20261005.mjs gemini-3.1-pro-high
```

对应模型探测成功后，以新证据label从停稳控制精确复制并公开resume，不修改旧manifest/配置/结果/收据。下面label尚未创建；若已存在，必须换新的label。两个控制共用四槽，可以并行执行，各自仍冻结自己的模型配置。

```powershell
& $paNode docs/validation/agy-2026-10-04/real-integration/run-flows-models.mjs vague flash-vague-draft-final-20261005-05 gemini-3.8-flash-high gemini-3.8-flash-high resume-from=flash-vague-draft-final-20261005-04 copy-source shared-group=flash-m8-recovered-20261005-02
& $paNode docs/validation/agy-2026-10-04/real-integration/run-flows-models.mjs materials gemini31-materials-final-20261005-03 gemini-3.1-pro-high gemini-3.1-pro-high resume-from=gemini31-materials-final-20261005-02 copy-source shared-group=flash-m8-recovered-20261005-02
```

若继续Opus，同模型分别从本轮两个Opus控制公开resume并copy-source；若改其他模型，必须建立新模型任务及冻结来源记录，不改写旧执行片。短探测成功仍不保证后续完整任务可用，服务失败应保留进展并暂停，不能无限重试同一额度错误。

completed后，先独立检查全部原质量要求和跨契约一致性，再运行 `verify-package-artifacts.mjs`、`verify-real-ui.mjs` 和 `verify-preserved-receipts.mjs`。所有共享控制停稳后运行 `verify-shared-provider-slots.mjs flash-m8-recovered-20261005-02`。独立内容报告须明确 `status=passed`，才能使用 `launch-review-workspace.mjs` 启动最终真人审阅副本。

## 证据与边界

- 机器汇总：`refactor-summary.json`；本地原始日志以`*-final-20261005`命名。
- 最后桌面截图：`ui-20261005/final-feedback-state/report.json`；逐页分析：`UI_VISUAL_REVIEW_20261005.md`。before/after原证据保留。
- 长上下文：`LONG_CONTEXT_TRANSPORT_INDEPENDENT_REVIEW_20261005.md`。真实stress冻结923180 B，但必读仅22912 B；不能声称整份923k或完整项目评审通过。
- 调度与恢复：`PLANNING_A_E_REPAIR_DELIVERY_20261005.md`、`RUNTIME_A_E_INDEPENDENT_REVIEW_20261005.md`。完整候选职责仍保留，不接受漏块overlay。
- Docker当前不可用，目标应用尚未实现。实际平台/IME/性能验证保留为验证任务；本轮不把这些未执行事项记为通过。外部Coding Agent落地属于后续实践。

没有设置自动化轮询或后台唤醒。下一次继续从以上停稳源恢复，无需重做成功任务或重新批准开发范围。
