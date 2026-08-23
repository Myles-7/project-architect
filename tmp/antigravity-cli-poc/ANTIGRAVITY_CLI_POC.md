# Antigravity CLI (`agy`) 最小技术验证报告

日期：2026-08-21（Asia/Shanghai）  
范围：仅通过公开 CLI 和 Node.js 标准子进程 API；未安装软件、未改配置、未访问凭据或网络。

## 最终结论：NO

本机当前找不到 `agy` 可执行文件，因此无法以 headless 方式调用、认证状态不可确认，也无法取得任何真实的机器可解析输出。故它**当前不能**作为 Project Architect 的 AI Provider。

满足以下命令能真实成功之后，才应重新执行完整 PoC：

```powershell
agy --version
agy --help
```

若重新验证通过，预期采用的数据流是：

`Project Architect -> local subprocess -> agy -p -> structured JSON -> Project Architect`

## 结论表

| 能力 | 状态 | 证据 |
| --- | --- | --- |
| agy 已安装 | FAIL | `Get-Command agy` 返回 `agyFound:false`。 |
| CLI 已认证 | UNKNOWN | 无可执行的 CLI，且未检查任何凭据。 |
| headless `-p` | FAIL | `agy` 无法启动，不能验证参数。 |
| JSON output | FAIL | 无法执行 `--output-format json`。 |
| stream-json | FAIL | 无法执行 `--output-format stream-json`。 |
| JSON Schema | FAIL | 无法执行 `--json-schema`；schema enforcement 未验证。 |
| 子进程调用 | FAIL | Node `spawn('agy', ...)` 收到 `ENOENT`。 |
| stdout 可解析 | FAIL | 没有 `agy` stdout 可供解析。 |
| stderr 可处理 | FAIL | 无法验证 `agy` 自身 stderr；仅可收到操作系统的 command-not-found/ENOENT 错误。 |
| exit code 可处理 | FAIL | PowerShell 的 command-not-found 不设置 `$LASTEXITCODE`；不存在可验证的 `agy` 进程退出码。 |
| quota 查询 | FAIL | `/usage`、`/quota` 未执行，因为 CLI 不存在。 |
| 连续调用稳定 | FAIL | 无法执行首个 structured-output 调用。 |
| 适合作为 Project Architect Provider | NO | 缺少 CLI 是阻断性前置条件。 |

## Phase 1：实际 CLI 检查

执行：

```powershell
Get-Command agy -ErrorAction SilentlyContinue
agy --version
agy --help
```

实际机器可读检查结果：

```json
{"agyFound":false,"CommandType":null,"Source":null}
```

`agy --version` 和 `agy --help` 均返回 PowerShell 错误：`The term 'agy' is not recognized as a name of a cmdlet, function, script file, or executable program.` 因此版本为**不可用/未知**，也无法从真实 `--help` 确认 `-p`、`--print`、`--output-format`、`--json-schema`、`--model` 或模型列表能力。

## 后续 Phase 的实际结果

由于 Phase 1 的阻断失败，未执行任何模型、认证、额度、schema、stream 或连续调用请求，避免假装这些参数存在或产生无效/不可复现的测试。以下结论都只是“未验证”，不是对官方 CLI 能力的否定：

- `/usage` 与 `/quota`：未发起；无 quota/usage 数据。
- 最小 headless prompt：未发起；不存在“最小成功调用命令”。
- `--output-format json`：未发起；无 JSON envelope、顶层字段和最终结果字段可记录。
- `--json-schema`：未发起；`result.schema.json` 仅是待重跑时使用的最小输入，无法说明 schema 是否真正强制生效。
- `--output-format stream-json`：未发起；无 NDJSON 事件、event type、结束信号或最终输出字段可记录。
- `--model`/模型枚举：未验证，因为帮助命令无法运行。

## 子进程 PoC

源码：`test-antigravity-provider.mjs`（仅 Node.js 内置 `child_process`）。它以 `shell:false`、45 秒超时启动 `agy`，收集 stdout/stderr/exit code，JSON 模式使用 `JSON.parse`，流模式逐行 `JSON.parse`，并明确处理 CLI 不存在、超时、非零退出和非法 JSON。

实际执行：

```powershell
node .\tmp\antigravity-cli-poc\test-antigravity-provider.mjs json
```

实际输出：

```text
ANTIGRAVITY_PROVIDER_POC_ERROR: agy CLI not found on PATH. Install/authenticate it before retrying.
```

进程退出码为 `1`（PoC 自身），原因是 `spawn` 的 `ENOENT`。这证明普通程序可以检测“命令不存在”，但不证明能够调用 `agy` 或处理其协议级错误。

## 复验清单（安装后执行）

1. 先保存真实的 `agy --version` 与 `agy --help`，只使用帮助中实际列出的选项。
2. 运行 `/usage` 和 `/quota` 的 JSON 形式，记录退出码、stderr，并用标准 JSON parser 检查 stdout。
3. 运行精确文本 headless 请求，再运行 JSON、schema（含故意无效结构）和 stream-json 请求。
4. 用本目录的 Node PoC 分别运行 `normal`、`json`、`stream`，然后连续运行三次 `json`。

不应在未完成这些真实命令前把 Antigravity CLI 接入正式 Provider。
