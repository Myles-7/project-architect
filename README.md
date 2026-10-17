# Project Architect

供个人开发者使用的本地 AI 项目规划工作台。输入想法和材料，通过说明取舍的选择题澄清需求，分别审阅产品与体验、技术与接口、任务与验收三个阶段，再导出供 Coding Agent 使用的开发包。

AI 负责设计、官方资料查证、受控试验、独立评审和修订。正式需求与方案由 Core 保存，AI 草案须由用户批准；明确选项答案可以本地确认，委托与暂缓不会变成已确认决定。

## 启动

需要 Node.js 24 LTS、pnpm 和已经配置可用的 agy CLI。依赖版本由 `pnpm-lock.yaml` 固定。本机验证使用 Node 24.19.0。

```powershell
pnpm install --frozen-lockfile
pnpm build
```

Windows 可双击 `start.bat`，打开 `http://localhost:5174`。脚本优先使用本机已存在的 Codex bundled Node 24，其他机器请将自己的 Node 24 加入 PATH。启动器先检查端口，冲突时退出而不会结束占用程序；只有服务健康检查通过才显示启动成功。错误日志见 `pa-server-error.log` 与 `pa-web-error.log`。关闭本启动器开启的服务使用 `stop.bat`；手动终端启动的服务在原终端关闭。

也可在两个终端分别执行：

```powershell
pnpm start:server
```

```powershell
pnpm --filter @project-architect/web dev --host 127.0.0.1 --port 5174
```

技术试验需要可用的 Docker Linux 容器环境；未就绪时记录未执行，并保留待验证任务。缺少 Docker 不应被当成试验通过。任务工具负责准备固定环境，提交的试验代码在隔离网络、只读挂载的独立目录中执行。

## 使用

1. 输入想法，或上传文字、Markdown、PDF、DOCX、截图和设计图。
2. 每轮最多回答三道独立选择题，也可委托 AI 拟定、补充答案或暂缓。
3. 依次生成并审阅三个设计阶段；按分组批准变更，锁定内容需显式解锁。
4. 全部批准且交付检查通过后生成开发包，预览文档并下载 ZIP。
5. 输入开发反馈或需求变化，分析影响并审阅局部修订后重新导出。

默认设计模型为 `claude-opus-4-6-thinking`，研究与评审模型为 `gemini-3.1-pro-high`，并发四个。高级设置可显式修改模型、并发和官方资料域名。没有费用、Token、总调用次数或总修订轮数门禁；取消、依据变化、连续无进展或服务不可用会停止或暂停任务。外部模型额度限制仍可能造成暂停，已成功任务和日志会保留。

本机根据你的授权，已在 `.workspace/planning-config.json` 显式设置设计、研究和评审均使用 `gemini-3.8-flash-high`，兼容思考配置为 `high`。新服务读取这份覆盖配置；运行期间模型与资料来源保持冻结，修改设置用于后续运行。损坏的配置会明确报错，保存失败不会改变实际模型。

开发包包含九份各有用途的 Markdown 和 `tasks.json`；版本、正式依据与 SHA-256 一致。添加新输入、修改材料或正式决定后，未经审阅的旧包不能重新成为当前交付。

## 工程与验证

- 正式应用：`apps/web`、`apps/server`；`frontend/` 为隔离的历史原型。
- 共享契约：`packages/contracts`；正式状态与原子审批：`packages/core`；agy 与本地工具：`packages/agent`。
- 数据保存在本地文件和版本目录，支持两阶段提交与恢复。本产品不引入数据库、登录、团队权限或云同步。
- 重构规范：[规划工作台契约](docs/blueprint/13_PLANNING_WORKBENCH.md)；接口：[Planning API](docs/api/PLANNING_API.md)；实施状态：[实施记录](docs/REFACTOR_PROGRESS.md)。

```powershell
pnpm build
pnpm schema:check
pnpm test
pnpm exec playwright test
```

Playwright 使用正式编译后的服务与页面、测试专用 FixturePlanningProvider 及临时项目，不运行真实 agy，也不修改用户项目。真实模型、图像和 Docker 证据单独保存在 [真实能力报告](docs/validation/AGY_CAPABILITIES_2026-10-04.md)。模拟测试不能证明真实 AI 方案质量。

桌面界面已按实际截图改进，导航收敛为规划工作台、材料、历史、诊断；提供方案筛选搜索、分组审批、专注阅读和开发包直达。GSM 仅作信息层级与密度参考；本轮专注桌面网页。当前页面会话中的输入和草案可在切页／重开项目时保留，刷新或关闭页面不承诺恢复。

M0–M7 主体、工具整合与桌面界面已实现，M8 最终真实内容和真人审阅未完成。两条 -12 控制在北京时间2026-10-05约21:58再次遇到429 Individual quota reached，均已暂停并停稳；18次实际调用有15次成功，0新批准、0新最终包、0活跃调用及租约。659项共享槽检查通过，峰值4；142／89份成功收据保留。

完整构建、Schema、164文件／982项测试和4条正式浏览器流程通过。最新真实暂停副本47项检查通过，1280／1440／1920共六张截图已逐张查看；恢复按钮紧随错误提示，输入区和右栏方案无遮挡。启动器新增9项检查通过：占用端口不杀进程，正式编译服务／网页／项目列表实际可访问，原项目文件哈希保持；默认端口现有服务也保持运行。

真实候选仍有公共接口、快照与回滚等契约退化，详见 CANDIDATE_PREVIEW_OBSERVATIONS_20261005_12.md；合法结构输出不等于内容质量通过。最终新包、最终包截图及真人审阅仍待完成。Docker未就绪，目标应用IME／平台／性能及外部Coding Agent落地未验证。 见[本轮执行与停稳记录](docs/validation/FINAL_REPAIR_EXECUTION_20261005_12.md)及[恢复入口](docs/validation/FINAL_RECHECK_AND_RECOVERY_20261005.md)。
