# 最终检查与真实验收恢复

M0–M7 主体、工具整合与桌面界面已实现，M8 最终真实内容和真人审阅未完成。两条 -12 控制在北京时间2026-10-05约21:58再次遇到429 Individual quota reached，均已暂停并停稳；18次实际调用有15次成功，0新批准、0新最终包、0活跃调用及租约。659项共享槽检查通过，峰值4；142／89份成功收据保留。

完整构建、Schema、164文件／982项测试和4条正式浏览器流程通过。最新真实暂停副本47项检查通过，1280／1440／1920共六张截图已逐张查看；恢复按钮紧随错误提示，输入区和右栏方案无遮挡。启动器新增9项检查通过：占用端口不杀进程，正式编译服务／网页／项目列表实际可访问，原项目文件哈希保持；默认端口现有服务也保持运行。

真实候选仍有公共接口、快照与回滚等契约退化，详见 CANDIDATE_PREVIEW_OBSERVATIONS_20261005_12.md；合法结构输出不等于内容质量通过。最终新包、最终包截图及真人审阅仍待完成。Docker未就绪，目标应用IME／平台／性能及外部Coding Agent落地未验证。 [执行记录](FINAL_REPAIR_EXECUTION_20261005_12.md)；服务失败记录估计2026-10-06约01:46恢复，仅为估计，不保证可用。

## 当前恢复入口

-12已执行并停稳，不要覆盖原label或重做九个成功设计分工。用户确认恢复额度后先进行一次真实短探测；成功后选用未存在的新label，使用resume-from复用实际成功任务与收据。不要将draft预览作为candidate-from正式输入。

~~~powershell
$paNode = 'C:\Users\Li Cheng Xin\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
& $paNode docs/validation/agy-2026-10-04/probe-approved-model-20261005.mjs gemini-3.8-flash-high
# 仅当structuredSuccess为true且下面两个新label尚不存在时执行：
& $paNode docs/validation/agy-2026-10-04/real-integration/run-flows-models.mjs vague flash-vague-final-resume-20261006-13 gemini-3.8-flash-high gemini-3.8-flash-high resume-from=flash-vague-final-contract-20261005-12 shared-group=flash-m8-recovered-20261005-02
& $paNode docs/validation/agy-2026-10-04/real-integration/run-flows-models.mjs materials flash-materials-final-resume-20261006-13 gemini-3.8-flash-high gemini-3.8-flash-high resume-from=flash-materials-final-contract-20261005-12 shared-group=flash-m8-recovered-20261005-02
~~~

运行期间不重建共享dist。停稳后逐块独立复核全部候选、任务与编译文档，修复实际矛盾，内容报告绑定精确finalSnapshot哈希；通过后验证包／ZIP／收据／可见上下文／槽及正式HTTP与浏览器，并逐张查看真正最终包截图。最后提供真人只读审阅副本，不能以API审批冒充真人批准。

以下旧记录和命令只保留历史，不是当前恢复入口，不直接执行。

## 历史恢复（15:48–16:00，非当前状态）

14:46北京时间Flash/high新的真实调用成功。15:48发现两个 -08 控制的记录PID已退出，原调用没有终态；使用 `recover-exited-controls-20261005.mjs` 通过生产公开Runtime.get保存成功任务并暂停未完成评审，保留恢复前manifest、部分日志哈希与退出证明。记录的调用结束时间只是恢复观察上界，不冒充真实终态或精确退出时刻。130／73份成功收据未变化，共享槽452项检查通过并全部释放。

两条 -09 精确复制冻结 -08 并公开resume，15:54又各自收到真实Individual quota reached；当前均已正常停稳，134／80份成功收据保持、共享组464项检查通过、零活跃调用和租约。不是仍在后台工作。按真实失败记录固定的服务估计约在北京时间2026-10-05 19:46恢复，不是保证。此后完成长历时UI修复、完整构建／Schema／979项／4浏览器流程及六张真实暂停截图复查；详情见 [本轮收尾](FINAL_CLOSEOUT_20261005_1600.md)。14:46成功探测不能覆盖15:54的新失败，机器汇总已改为取较新的真实规划调用。

不要再修改冻结 -08。-09已保存当前候选观察和恢复证据，下一次恢复用新label；下面的旧余额、旧控制和旧恢复命令只保留历史，不直接执行。

## 历史恢复入口（已由新的候选反馈控制取代）

用户恢复额度或切换账号后，用一次真实短调用核实可用；同一明确额度失败不连续重试。然后在仓库目录公开resume到新label：

```powershell
$paNode = 'C:\Users\Li Cheng Xin\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
& $paNode docs/validation/agy-2026-10-04/real-integration/run-flows-models.mjs vague flash-vague-draft-final-20261005-10 gemini-3.8-flash-high gemini-3.8-flash-high resume-from=flash-vague-draft-final-20261005-09 copy-source shared-group=flash-m8-recovered-20261005-02
& $paNode docs/validation/agy-2026-10-04/real-integration/run-flows-models.mjs materials flash-materials-final-20261005-10 gemini-3.8-flash-high gemini-3.8-flash-high resume-from=flash-materials-final-20261005-09 copy-source shared-group=flash-m8-recovered-20261005-02
```

上述新label尚未启动，命令是恢复说明；若以后已存在，改用新的唯一label，不覆盖。两条可独立运行，共用四槽。成功任务复用收据，未完成评审重新调用，不手改Core或结果。

最新候选预审明确contentPassed=false：便笺有全写动作并发依据、冲突返回/抛错、归档搜索及测量口径问题；材料有产品/技术清空顺序和初始化/快照异常边界问题。修订反馈已经写在 `real-integration/quality-feedback-notes-final-consistency-20261005.txt` 与 `quality-feedback-materials-final-consistency-20261005.txt`，尚未提交。恢复控制真正completed后，逐块检查其最终内容；仍有问题时用公开quality-from和新label提交对应反馈，不能先标内容通过，也不能跳过公开审批。最终才依次执行结构、独立语义、真实可见上下文、ZIP、HTTP/浏览器、收据与全局槽核查，创建只读真人审阅副本。

## 历史服务状态与保存成果（13:53，非当前结论）

- 12:58 Flash真实调用成功，之后完成真实批量上下文验收：168条必读记录在18次scan里完整可见，日志和读取账本无缺口。这段成功不能被旧失败概括。
- **13:51北京时间的新Flash/high真实调用再次429**。13:53正常CLI `/usage` 确认新账号 `lcx…@gmail.com` 已生效：每周剩余54.90%，五小时0%。服务预计2026-10-05约18:00恢复，估计不是可用保证。见 [额度诊断](AGY_QUOTA_DIAGNOSIS_20261005.md)。
- 本轮未新建完整控制、批准或质量包。便笺 `flash-vague-draft-final-20261005-06` 与材料 `flash-materials-final-20261005-06` 已停稳，零活跃调用／租约；130／72份成功收据保持，134／76项检查通过。
- 便笺未完成revision没有合法新结果；材料research成功并保留，design额度暂停。两条-06控制各自0新批准／0新质量包，继承包不算新包。
- 共享组 `flash-m8-recovered-20261005-02` 当前377项检查通过，峰值4，包含两条-06停稳控制；只证明调用追踪与释放。
- Runtime明确个人额度耗尽立即保存并暂停；普通429／503／连接故障继续两次瞬时重试。页面显示固定服务估计及继续入口，不设费用门禁。验证见 [恢复体验](QUOTA_RECOVERY_UX_20261005.md)。

## 早轮候选预审（非 -10 最终内容结论）

[只读预审](pending-content-recheck-20261005/OBSERVATIONS.md)及相邻JSON保存确切输入路径、哈希和Core检查。

便笺43块未批准候选有18条feature→flow/task/acceptance关联缺口，以及快捷键、所有写动作CAS／库代际、导入合并与部署／测量口径问题。材料30块、旧证据和先前18块对象保留，结构覆盖无缺口；但input-display两块直接叙述清空顺序，不能被误列为完全无关。新模块／接口成功commit才递增，旧输入流程提前递增，须局部同步。该范围修正不是全面重写的理由。

这是暂停候选的预审，不是最终内容通过报告；之后候选可能修复，须读最新内容再裁定。

## 恢复顺序

无需重新请求开发许可。用户恢复当前CLI五小时额度或自行切换账号后，先执行一次真实短探测，余额数字不能代替调用成功。在仓库目录运行：

```powershell
$paNode='C:\Users\Li Cheng Xin\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
& $paNode docs/validation/agy-2026-10-04/probe-approved-model-20261005.mjs gemini-3.8-flash-high
```

成功后用同一Flash/high，在新label的精确副本公开resume。下面-07若已存在须改新label；不可覆盖冻结-06／更早来源、反馈或收据。两个控制共用四槽：

```powershell
& $paNode docs/validation/agy-2026-10-04/real-integration/run-flows-models.mjs vague flash-vague-draft-final-20261005-07 gemini-3.8-flash-high gemini-3.8-flash-high resume-from=flash-vague-draft-final-20261005-06 copy-source shared-group=flash-m8-recovered-20261005-02
& $paNode docs/validation/agy-2026-10-04/real-integration/run-flows-models.mjs materials flash-materials-final-20261005-07 gemini-3.8-flash-high gemini-3.8-flash-high resume-from=flash-materials-final-20261005-06 copy-source shared-group=flash-m8-recovered-20261005-02
```

成功收据复用而不重跑；新控制记录生产构建差异。运行中不重建共享dist。服务再次失败保存进展，不循环碰撞耗尽窗口，不自动降低模型或切换账号。

## 最终通过条件

1. 当前Run完成后，亲自读全部最新候选及导出正文，核对原反馈与本轮预审；问题仍在时通过新的公开质量反馈／草案修订处理，不改冻结Run依据、不伪造模型结果。
2. completed后才做最终结构审查与 `independent-content-review.json`。材料如需纠正保留范围，说明input-display与reset关联的具体依据，保持其他对象、稳定ID、旧证据及任务DAG。
3. 内容实际通过后，运行 `verify-package-artifacts.mjs`、`verify-real-ui.mjs`、`verify-preserved-receipts.mjs`。逐张查看新真实包截图，核对START_HERE、tasks.json、DEVELOPMENT_PLAN、ZIP/CRC/hash/版本。
4. 全部控制停稳后，再运行 `verify-shared-provider-slots.mjs flash-m8-recovered-20261005-02`。
5. 两份内容通过后才用 `launch-review-workspace.mjs` 开启真人审阅副本。API自动批准、AI blockers空、ZIP完整及UI打开不能代替内容或真人审阅。
6. 同步验收、实施、README和机器汇总。`refresh-flash-final-status-20261005.mjs`现取最新Flash真实探测，不把12:58历史成功当成当前可用。

Docker未就绪，目标应用未开发；原生IME、focus、平台、性能及外部Coding Agent落地仍未验证。未设置自动轮询或后台唤醒。

旧指南完整归档为 [历史恢复记录](history/FINAL_RECHECK_AND_RECOVERY_20261005_before_quota_recovery.md)，其中旧账号、预计14:45、964项与旧来源命令属于当时状态。

