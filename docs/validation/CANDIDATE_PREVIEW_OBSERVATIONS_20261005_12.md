# -12 材料候选预读记录（不是最终验收）

来源：`flash-materials-final-contract-20261005-12/candidate-integration-preview.json`，第一轮 revision 的实际 `currentDraft` 与本轮正式基线合成；context SHA-256 为 `c75edfce44503aaea3a34c25fed01f037055851349a09df8a8a8469c0c1403d2`。此时真实修订尚在执行，不修改任何 AI 产物、正式状态或收据，也不据此写通过结论。

已分段读取全部 30 块正文与全部任务字段。第一轮合并输出中第 13 块任务被截断，随后单独重新完整读取第 13–15 块；模块与接口分别单独读取。最终 review 输入与最终编译产物仍需重新提取和复核。

当前重点复核项：

- `blk-deliv-acc-security-edge` Scenario 4 分支 C 尚无条件承诺“通过全局通知横幅告知”。`blk-tech-error`、模块和 reset 验收已区分通知亦失败时的内存保留／显示不可用。最终版本需要核对这一真实跨块边界。
- `blk-prod-problem` 比正式基线多出严重失败边界，不属于既定局部影响白名单。原基线是痛点描述，未承诺任意错误后完全恢复；确定性保护检查应独立判断这一变更是否必要，不能为通过自动扩白名单。
- `retryRenderFallbackDraft` 的接口说明与非执行示意使用“非空”判断，需核对 `null`（无恢复草稿）与 `''`（合法空草稿）是否需区分。不能因示意代码与实现级偏好不同就制造阻塞；以实际草稿保留／取回契约与可观察行为为准。
- 初始化仅首次成功设代际 1、纪元 0，已就绪 init 幂等返回；最终检查失败重试清理实际注册节点／按钮及焦点提交顺序。非执行代码不代替方法后置条件，也不用于声称目标应用已实现。

已看到 M5 快照捕获失败不回滚、失败恢复原草稿且重调度空值任务、严重失败内存所有权和通知安全返回的具体设计。目标程序、真实 IME／平台／性能仍未执行。这些预读发现不证明最终内容通过，真人审阅继续待完成。

## 第一轮 revision 完成后的真实变化

随后从第二轮 revision 的实际 currentDraft 重新提取 `candidate-review-preview.json`。第一轮修订成功返回合法结构，但仍有一条官方证据缺少 research_read 记录，因此 Runtime 已继续修订，尚未独立评审。新正文由 54,709 字符变成 13,833 字符；篇幅变化本身不是质量结论。

已完整读取新第 10–17 块及其所有任务字段，确认存在需由最终评审检查的实质退化：

- 公共契约把 `handleReset/captureSnapshot` 改为 `executeReset`，移除 `focusInput`、`ValidatorModule` 等接口；`DisplayRenderer` 改名，`schedule` 丢失原草稿／节点／代际参数，`hasPending` 改为 `isPending`，未提供自洽变更理由或同步未变输入验收。违反本轮明确保留公共 API 的反馈。
- 新 InputSnapshot 缺少 hadPendingTimer、展示／错误快照、原 DOM 位置等恢复字段，不能替代原两阶段事务完整契约；清空任务正常顺序亦改为替换后再绑定。
- `blk-prod-outcomes` 大幅重写，需核对既有三项具体性能测量目标与未执行边界是否被保留。
- 严重兜底分支仍未一致区分通知亦失败；“一键复制”与既定只读区手动选中复制不同。

尚不能推断后续 revision／review 结果。以上是具体候选反例，不能用合法 Schema、blocks 数量或 blockers 为空代替内容验收。
