# Opus 模型变更验收脚本交付

2026-10-05。本子任务仅编辑本目录的验收脚本和新增证据，未修改应用源码、UI、既存冻结控制或原项目；没有启动 Provider。父任务已明确授权设计和评审转用 `claude-opus-4-6-thinking`，并授权便笺的诚实 fallback。此记录不是对任何 ChangeSet 的人工批准，也不是目标应用内容、兼容性或性能通过结论。

## 可启动命令

工作目录为仓库根 `D:\桌面\项目构思`。以下两个命令交给父任务分别启动；共享 `opus-m8-20261005` 槽组，跨进程最多四个实际 Provider 调用。新 label 在本子任务预检时尚不存在。再次使用已经启动的 label 会拒绝，不覆盖证据。

```powershell
& 'C:/Users/Li Cheng Xin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' docs/validation/agy-2026-10-04/real-integration/run-flows-models.mjs materials opus-materials-final-20261005-01 claude-opus-4-6-thinking claude-opus-4-6-thinking quality-from=flash-materials-final-20261005-03 quality-file=docs/validation/agy-2026-10-04/real-integration/quality-feedback-materials-round7.txt transition-file=docs/validation/agy-2026-10-04/real-integration/approved-model-transition-opus-20261005.json shared-group=opus-m8-20261005
```

```powershell
& 'C:/Users/Li Cheng Xin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' docs/validation/agy-2026-10-04/real-integration/run-flows-models.mjs vague opus-vague-draft-final-20261005-01 claude-opus-4-6-thinking claude-opus-4-6-thinking draft-from=flash-vague-draft-final-20261005-02 quality-file=docs/validation/agy-2026-10-04/real-integration/quality-feedback-vague-round2.txt transition-file=docs/validation/agy-2026-10-04/real-integration/approved-model-transition-opus-20261005.json shared-group=opus-m8-20261005
```

命令追加 `transition-check-only` 只验证授权、源、反馈、历史模型和探针记录，退出于创建控制目录、Runtime 或 Provider 之前。两条预检结果分别保存为 `opus-materials-transition-check-20261005.json`、`opus-vague-transition-check-20261005.json`。仅删掉这个预检参数，才会由父任务正式执行真实验收。

## 边界和行为

`approved-model-transition-opus-20261005.json` 固定父任务转达的用户授权、两份精确源 manifest/全树哈希、反馈哈希、Opus 结构化可用性探针及全部继承 Run 清单。`prepare-opus-model-transition.mjs` 只读源并生成该记录；使用排他创建，不覆盖已保存授权。实际启动重新核对哈希；修改源或反馈后不能继续沿用旧记录。

普通 `resume-from` 仍要求原模型，不能用 transition-file 给既存 Run 改冻结模型。模型变更只允许 `quality-from` / `draft-from` 新建真实登记 Run，原 project-records 精确复制后验证整树哈希，新 Run 冻结 Opus 配置并单独记录 identity/basis/config。继承的 Flash 调用、Run、task、结果、收据、日志和未整合片段保持原值，不加入当前 Provider 调用数，不改写为 Opus。成功和失败退出都会检查所有继承 Run 文件树及源全树；检测差异将控制标为 failed。

材料源 `flash-materials-final-20261005-03` 已完成 r6，当前 revision 41；新的 r7 feedback 在新 Run 中针对现存批准蓝图修订。反馈 SHA-256 为 `4ea9fad7913d9bddd4ef99f59f35201cf981ac74ff8ddcb8da2e5127f0d8f598`，与父任务给定值一致。旧 r6 包和历史批准身份继续明确继承。

便笺源 `flash-vague-draft-final-20261005-02` 因额度暂停；`run-89597c52-0b0c-487e-95ca-a7789b4768c3` 的后续范围修订尚未成功汇集为新 ChangeSet。唯一最新保存待批准参考为 `change-3a9bf179-44bd-4b09-8bb8-f20e644ac10d-delivery-7`，九组、43 块，候选完整对象 SHA-256 为 `34ec1f9936e59b4f4b8376d4c3c5b278f0597df3f50c8247f9f46022a4ef08a0`。其 basis 是 revision 25 的 `3cd9327f3c8484b331047998723167cb3a47cb375ccbbe465d4e44978fceb6cd`，当前 revision 27 的 basis 为 `1170c779e090b8f51216f663c0b3f7968a2fca2cdcc8ef91df4eea574e0932bf`；公开 `draftChangeSetId` 会拒绝该失效依据。

按父任务批准的 fallback，便笺新 Run 以全量已批准蓝图为正式依据，将完整原 pending 对象连同 hash、未批准身份和上述失效原因作为 feedback 参考输入，十项原质量反馈完整保留。记录原文件反馈 hash、增补后实际反馈 hash 和参考输入 hash；保存独立 `unapproved-pending-reference.json`。不重写旧 basis，不直接续跑旧 Flash Run，也不把未整合成功片段伪装为复用执行结果。旧候选内容、组状态、批准记录及全部执行文件保留；在新复制项目中 Core 可能如实把旧候选投影为 stale。

现有公开 Core 自动验收与新 compiler 路径保持原有身份标签 `API automated acceptance; not human review`。没有人为将 task 改 completed、拼接成功 result 或直接写入 Confirmed/Locked。新 Run 的真实结构化输出、评审、Core 自动接受和新开发包是否成功，由父任务后续真实控制记录和独立内容复核决定。

## 本次验证证据

`model-transition.test.mjs` 的六项本地回归全部通过：显式旧/新模型分离、完整失效候选参考、不允许变更模型续跑原 Run、缺授权/目标不符拒绝、源或反馈变化拒绝、活跃调用拒绝；还验证复制结果原值以及继承 result 被改变时的检测。日志为 `model-transition-tests-20261005.txt`。主验收脚本与准备脚本 `node --check` 均通过。

两条 transition-check-only 实际通过；省略 transition-file 而要求 Opus 的实际负向命令在源模型检查处 exit 1，未创建控制目录。`model-transition-preflight-evidence-20261005.json` 保存实际预检、标签尚不存在、完整源前后哈希和失效草案 basis 对照。材料源 1401 个文件、11 个 Run；便笺源 2042 个文件、9 个 Run，前后全树一致。继承 completed task 分别为 61 和 103，包含本地 assembly；这些数量不代表新 Provider 调用数。

Opus 可用性依据仅为 `account-probes/claude-opus-4-6-thinking-1791162606682/result.json` 的成功结构化最小调用，时点 `2026-10-05T01:10:24.696Z`；它不证明规划、材料、研究或实际内容质量，也不保证后续额度和持续可用。新反馈包含完整候选，可能增加实际上下文和重新修订工作；本交付没有费用、Token 或耗时预测。

交付脚本 SHA-256：

| 文件 | SHA-256 |
| --- | --- |
| run-flows-models.mjs | 58df03f66338dc480d0cdb37ad16152c8f7ab3a3c5e417aa26b68ea267fe2346 |
| model-transition.mjs | c5ed766860b38e49f666acd02ab70ad69938a78732dcac8425cdb03b18a2a017 |
| prepare-opus-model-transition.mjs | 15364f45fe0f946c5321d9701b4ecbe4094076f509071462e2a3936187f60740 |
| model-transition.test.mjs | 285e69efadb545914e4f239d5409323fe79a8e9a5d6141a36a5902a028e26407 |

授权记录 SHA-256 为 `a44033c3f3a72f5b93c573e8ed38e6643077982b65acacada0b2e182475f362d`。可启动命令已先行发给父任务；此后本子任务不再修改可执行验收脚本，供真实修订与父任务本地全量检查并行。
