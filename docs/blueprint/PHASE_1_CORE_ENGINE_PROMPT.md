# Project Architect V1

# Phase 1 — Core Engine（本地状态引擎）开发提示词

## 任务目标

你现在负责开发 **Project Architect V1 的 Phase 1：Core Engine（本地状态引擎）**。

注意：

本阶段不是开发完整产品。

不是：

* 开发完整 UI；
* 优化 Agent Prompt；
* 继续研究 Multi-Agent；
* 开发自动 Coding；
* 开发文档生成系统；
* 开发企业级权限系统。

当前唯一目标：

> 建立 Project Architect 的核心事实层（Project State System），让后续 Agent、UI、Document Compiler 都基于统一状态运行。

Phase 1 完成后，系统应该具备：

```
Create Project

↓

Store Project State

↓

Update State

↓

Validate State Change

↓

Persist Revision

↓

Provide State API

↓

Prepare for Agent Integration
```

---

# 当前系统背景

已经完成：

* Antigravity CLI Provider 验证；
* B2.1 Agent 冻结；
* Blueprint Finalization；
* Implementation Contract；
* API Contract；
* State Schema；
* Repository Structure；
* Test Strategy。

当前唯一可信设计来源：

```
docs/blueprint/
docs/blueprint/implementation/
AGENTS.md
```

开发过程中：

禁止重新设计架构。

如果发现问题：

先记录：

```
Architecture Issue

↓

提出修改建议

↓

等待确认
```

不要直接改变 Blueprint。

---

# Phase 1 总体原则

## 原则 1：State 是唯一事实来源

系统核心：

```
Project State
```

不是：

* Chat History；
* AI 输出；
* Markdown 文档；
* UI 临时状态。

关系：

```
AI Output

↓

Validation

↓

State Engine

↓

Project State

↓

UI / Documents
```

---

## 原则 2：AI 不直接修改项目

禁止：

```
Antigravity Output

↓

直接覆盖 JSON
```

必须：

```
AI Result

↓

Contract Validation

↓

State Operation

↓

Commit

↓

Revision
```

---

## 原则 3：V1 保持简单

不要：

* 数据库；
* ORM；
* 微服务；
* 事件总线；
* CQRS；
* 完整需求管理系统。

V1 使用：

```
TypeScript

+

JSON File Persistence
```

---

# Phase 1 开发拆分

---

# Phase 1.1 — Repository Foundation

## 目标

建立正式 Monorepo 基础结构。

实现：

```
project-architect/

├── apps/

│   ├── web/

│   └── server/


├── packages/

│   ├── contracts/

│   ├── core/

│   └── agent/


├── docs/

├── tests/

└── package.json
```

---

## 技术要求

使用：

```
TypeScript
Node.js
npm workspace 或 pnpm workspace
```

---

完成：

* workspace 初始化；
* TypeScript 配置；
* 基础 build；
* test framework；
* lint 配置。

---

## 验收标准

必须：

* 所有 package 可以独立编译；
* contracts 可以被 core/server 引用；
* 没有循环依赖。

---

# Phase 1.2 — Shared Contracts 实现

## 目标

将：

```
16_SHARED_CONTRACTS.md
04_PROJECT_STATE_MODEL.md
```

转换为真实 TypeScript 类型。

目录：

```
packages/contracts/
```

---

## 必须实现

### Project

```ts
Project
```

包含：

* id
* name
* createdAt
* updatedAt
* stateVersion

---

### Project Overview

```ts
ProjectOverview
```

支持：

状态：

```
Confirmed

Candidate

Assumption

Unresolved

Warning
```

---

### Typed Reference

必须实现：

```ts
TypedRef
```

支持：

```
decision:<id>

assumption:<id>

gap:<id>

risk:<id>

tension:<id>

conflict:<id>

question:<id>

input:<id>
```

---

### Discovery Result

对应 B2.1：

```ts
DiscoveryResult
```

必须包含：

```ts
confirmed

candidates

assumptions

gaps

risks

tensions

conflicts

questions
```

---

### Revision

实现：

```ts
StateRevision
```

记录：

* revision id；
* 时间；
* 修改来源；
* 修改内容摘要。

---

## 验收标准

任何其他模块：

禁止自行定义：

```
Project interface
Decision interface
Gap interface
```

只能引用：

```
packages/contracts
```

---

# Phase 1.3 — Core State Engine

## 目标

实现：

```
packages/core
```

这是整个产品最重要模块。

---

# 功能 1：Project 创建

实现：

```ts
createProject()
```

生成：

```
project/
├── project.json
├── state/
├── conversations/
└── documents/
```

---

# 功能 2：State Storage

实现文件存储：

```
state/

overview.json

decisions.json

assumptions.json

gaps.json

risks.json

questions.json

readiness.json
```

---

# 功能 3：State Commit

实现：

```ts
commitChange()
```

流程：

```
Change Request

↓

Validate

↓

Apply

↓

Create Revision

↓

Persist
```

---

禁止：

直接：

```ts
writeFile()
```

修改状态。

所有修改必须经过：

```
State Engine
```

---

# 功能 4：Decision Lock

实现：

用户可以锁定：

例如：

```json
{
"name":"platform",
"value":"Windows Desktop",
"status":"locked"
}
```

规则：

Locked 内容：

* Agent 可以读取；
* Agent 不可以主动覆盖。

---

# 功能 5：Conflict Detection

实现轻量检测。

例如：

已有：

```
platform = Desktop only
```

新增：

```
must support mobile app
```

产生：

```
Conflict Candidate
```

---

注意：

不要实现复杂推理。

V1：

只提供状态层能力。

---

# Phase 1.4 — Backend API Layer

## 目标

建立：

```
apps/server
```

作为：

Frontend 与 Core 的唯一入口。

---

实现：

## Project API

例如：

```
POST /projects

GET /projects/:id
```

---

## State API

例如：

```
GET /projects/:id/state

POST /projects/:id/change
```

---

## Discovery API Placeholder

先定义：

```
POST /projects/:id/discovery
```

暂时允许：

Mock Provider。

---

原因：

先验证：

```
State Flow
```

不要让 AI 调用影响基础系统开发。

---

# Phase 1.5 — Agent Provider Adapter 接入

## 目标

连接已经验证成功的：

```
Antigravity Provider
```

---

架构：

```
Agent Layer

↓

AIProvider Interface

↓

Antigravity Provider

↓

agy.exe
```

---

实现：

```ts
interface AIProvider {

 complete(request):Promise<Response>

}
```

---

实现：

```ts
runDiscoveryTurn()
```

流程：

```
Project State

+

Relevant Context

+

Checklist Context

↓

B2.1 Prompt

↓

Structured Output

↓

Validation

↓

State Commit
```

---

注意：

不要修改：

* B2.1 Constitution；
* Schema；
* Agent 行为。

当前任务只是接入。

---

# 测试要求

## 单元测试

必须覆盖：

### Contracts

* schema validation；
* type compatibility。

### Core

* createProject；
* commitChange；
* lock；
* revision。

### Persistence

测试：

```
write

↓

close

↓

reload

↓

state restored
```

---

## Integration Test

至少：

测试：

```
Mock Discovery Result

↓

State Engine

↓

Project State Updated
```

---

# Phase 1 完成验收标准

## Architecture

必须：

✅ State 是唯一事实来源
✅ AI 不直接修改数据
✅ Contract 单一来源
✅ Provider 可替换

---

## Persistence

必须：

✅ 项目可以创建
✅ 项目可以重新加载
✅ Revision 正常记录
✅ Lock 正常工作

---

## Backend

必须：

✅ API 可访问
✅ 不依赖 UI
✅ 不绑定 Antigravity

---

## Agent

必须：

✅ 可以调用 Provider
✅ 使用 structured_output
✅ 可以进入 State Commit 流程

---

# 明确禁止事项

本阶段禁止：

* 开发完整 React 页面；
* 开发 Chat UI；
* 开发 Overview UI；
* 开发 Markdown Compiler；
* 开发 Checklist Engine 完整逻辑；
* 开发 Readiness UI；
* 引入数据库；
* 引入复杂工作流框架；
* 修改 B2.1 Agent。

---

# 最终交付

完成后输出：

```
PHASE_1_CORE_ENGINE_REPORT.md
```

内容：

1. 已完成模块；
2. 实际目录结构；
3. 数据流说明；
4. API列表；
5. State Schema说明；
6. 测试结果；
7. 遇到的问题；
8. 是否 Ready for Phase 2。

---

# Phase 1 完成后的状态

目标：

达到：

```
Project Architect

拥有稳定核心状态层

↓

可以承载 Agent Discovery

↓

可以支持 UI

↓

可以支持 Document Compiler
```

完成后停止开发，等待进入：

```
Phase 2 — Discovery Intelligence
```
