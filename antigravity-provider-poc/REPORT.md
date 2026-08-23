# Antigravity CLI Provider PoC Report

## Environment

- OS: Windows（PowerShell，工作目录 `D:\桌面\项目构思`）
- Node version: `v25.8.2`
- agy version: **unavailable**. 任务描述称环境应为 `agy 1.1.16`，但本次实际会话中 `Get-Command agy`、`where.exe agy` 和 `agy --version` 均未找到该可执行文件，故不能把该版本当作已验证事实。
- Dependencies: none. 本 PoC 只使用 Node.js 内置 `node:child_process`。

## Actual evidence

PowerShell 可执行定位：

```text
Get-Command agy: no result
where.exe agy: INFO: Could not find files for the given pattern(s).
```

尝试执行 `agy --version` 及 `agy --help` 的实际错误：

```text
The term 'agy' is not recognized as a name of a cmdlet, function, script file, or executable program.
```

Node PoC 的实际运行结果（`npm run verify`）：

```json
{
  "status": "blocked",
  "reason": "cli-not-found",
  "message": "Unable to start agy: spawn agy ENOENT",
  "results": {}
}
```

`ENOENT` 是启动子进程时操作系统返回的“可执行文件不存在”错误。它不是 `agy` 的 stderr，也没有任何 `agy` 进程的 exit code 或 stdout。

## Result Table

| Capability | Result |
|---|---|
| spawn agy | FAIL |
| print mode | FAIL |
| json output | FAIL |
| json parse | FAIL |
| schema | FAIL |
| stream-json | FAIL |
| repeated calls | FAIL |

## Test results by verification

### 1. Normal call

未能执行 `agy -p "Return exactly: PROVIDER_TEST_OK"`，所以没有 `PROVIDER_TEST_OK`、stdout、stderr 或 `agy` exit code 可记录。PoC 有 45 秒 timeout；本次在等待模型前立即以 `ENOENT` 失败。

### 2. JSON Output

未发起命令。没有真实 stdout，故无法 JSON.parse、枚举 envelope 字段、确认 response 字段类型，或判断是否需要二次 JSON.parse。

### 3. JSON Schema

未发起命令。`schema.json` 是最小 JSON Schema，要求根对象严格具有 `ok:boolean` 和 `message:string`。没有真实返回，因此**无法说明 schema 是否真正约束输出**，也无法记录实际 envelope。

### 4. stream-json

未发起命令。没有可验证的 NDJSON 行、event 类型、最终 result 判断规则或最终 response 字段。

### 5. Repeated calls

三次 JSON 调用均未开始，因为首次启动 `agy` 就失败。不能将其归因为随机失败、认证问题或输出不一致。

### 6. Provider Adapter

`index.js` 导出了最小的 `callAntigravity(prompt)`：输入为 string，返回 `{ success, text, raw }`。它以 `child_process.spawn('agy', args, { shell:false })` 启动进程，捕获 stdout、stderr、exit code，并处理：

- CLI 不存在（`ENOENT`）；
- timeout（45 秒）；
- 非零 exit code；
- JSON 或 NDJSON parse 失败（验证运行器）。

当前实际调用的返回语义为：

```json
{
  "success": false,
  "text": "",
  "raw": {
    "kind": "cli-not-found",
    "message": "Unable to start agy: spawn agy ENOENT"
  }
}
```

## Final Decision

NO

不推荐当前将下列链路接入 Project Architect：

```text
Project Architect
  -> Local Backend
  -> Antigravity CLI Provider
```

阻断原因仅是本机当前会话找不到 `agy`，而不是对 Antigravity CLI 1.1.16 功能的推断。待 `agy --version` 和 `agy --help` 能在同一个 Node/PowerShell 环境中成功后，运行 `npm run verify`，再根据该次产生的真实 stdout、stderr 与 exit code 更新本报告。
