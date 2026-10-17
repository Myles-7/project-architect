# -11候选交叉契约观察（非最终通过报告）

2026-10-05最新状态：两条-11控制已停稳，review因额度耗尽中断，contentPassed=false。观察来源为真实review输入的只读候选投影，不修改模型产物或正式状态。以下确认具体跨契约反例，不能代替候选全文及编译文档的最终语义审查，不代表已测试目标应用；后续修订必须重新检查最新投影。

便笺来源：`flash-vague-contract-closure-20261005-11/candidate-review-preview.json`，context SHA256 `7dafdf756a5db79ba0c85c66038a80dd2f0f6135aed2199d34bc835923d0bc4d`，43块候选；以下为相关正文及任务字段的具体反例复核。

- N9尚未闭合：ImportPreviewTargetState用notesCount/sumRevision/maxRevision/lastUpdatedAt代替数据库写版本。永久删除revision=1的旧记录并新建revision=1的新记录，可使总数、修订和及最大值均不变；另有更晚记录时最大时间戳也不变。原文“捕捉任意更新”不成立。须同一写事务维护单调writeVersion或严格完整目标快照；合法写入不能只依赖汇总摘要。ticket/payload可变性、文件身份与执行验证也须说明。
- N11尚未闭合：已统一SessionDraft对象，但getDraft损坏/版本/字段/键匹配校验，以及sessionStorage自身不可用时的内存保留与直接草稿导出没有完整定义。错误场景不能无条件宣称临时保存成功。
- N12尚未闭合：meta.backupTracker声称唯一来源，BackupMetaPayload仍允许appMeta含同名backupTracker；未定义重复两处数据的一致性或拒绝规则。appSettings仍为任意Record，未给完整合法结构和导入映射。不得只写“强校验”掩盖缺失字段规则。
- 检索验收重新把requestAnimationFrame称作“绘制完成”和物理可见，模拟按键又被称作物理按键；与validation任务的诚实范围冲突。统一为可观察代理指标或增加真实绘制测量，明确起点为单次完成关键词输入/最后输入，避免把人类键入整串时间纳入150ms。
- 收藏检索feature/flow只写isFavorite=true，技术规范与page限定active/archived，需明确回收区收藏不进入已收藏搜索。

材料来源：`flash-materials-contract-closure-20261005-11/candidate-review-preview.json`，context SHA256 `576013d164360972d842e87c1305a22bf655af56b510f7f47fb8738a56ac5802`，30块候选，已包含成功的证据修订；以下为相关正文及任务字段的具体反例复核。此前引用的5a05…是修订前context，不能作为当前review输入依据。

- M4尚有缺口：bindInputNode返回void而初始化失败只解绑reset监听，未定义input/composition监听句柄与局部绑定失败清理；重试可能重复监听。focusInput依赖activeInputNode但init直到focus之后才设activeInputNode，因此初次聚焦可静默无效且仍ready。需对传入初始节点直接聚焦或定义合法准备引用，并核验重试一致性。
- M6尚有缺口：showGlobalError只定义容器缺失时创建，未定义创建/挂载也失败后的返回与诚实边界；严重草稿仅保留在局部snapshot，调用结束后恢复路径与保留所有权不明确。不能无条件承诺草稿仍可取回。
- blk-deliv-acc-security-edge Scenario4笼统要求任意DOM/脚本错误后输入可编辑，和严重回插失败主编辑器受限的规则冲突。如需同步此块，应将其纳入明确影响范围，不能为了“无关块原样保留”保留矛盾；其余无关块仍保留。
- M5无快照异常路径已明确不调用rollback；该部分在此候选中已修复，后续不得退回旧错误分支。

上述反例的精确反馈已通过candidate-check-only核对，-12尚未执行。真实调用恢复后通过公开反馈修订，重新完整核对候选、任务、证据及编译文档，不以blockers空、覆盖通过或API自动批准替代独立内容检查。见[当前恢复入口](FINAL_RECHECK_AND_RECOVERY_20261005.md)。
