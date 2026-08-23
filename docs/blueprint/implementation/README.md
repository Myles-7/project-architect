# Project Architect V1：Implementation Contracts & Engineering Guide

> 文档状态：Phase 0 Engineering Blueprint  
> 范围：指导 Phase 1 (Core Engine) 及后续里程碑正式开发的唯一可信实现契约。  
> 目标：固化系统工程结构、API 协议、错误定义、测试策略、运行期配置、类型契约与原型迁移指南。

---

## 1. 契约目录索引

| 文件 | 职责说明 |
| :--- | :--- |
| [11_PROJECT_STRUCTURE.md](11_PROJECT_STRUCTURE.md) | 正式 Monorepo 目录结构、分包职责与非产品代码隔离说明。 |
| [12_API_CONTRACT.md](12_API_CONTRACT.md) | Frontend ↔ Local Backend 的轻量操作契约（请求、响应、Revision、错误）。 |
| [13_ERROR_HANDLING.md](13_ERROR_HANDLING.md) | 标准错误码定义、可恢复性、状态安全隔离与故障降级原则。 |
| [14_TEST_STRATEGY.md](14_TEST_STRATEGY.md) | 单元测试、集成测试、多轮交互测试及 Agent Benchmark 回归策略。 |
| [15_RUNTIME_CONFIG.md](15_RUNTIME_CONFIG.md) | 运行时配置表（超时、上下文预算、Token 成本门控与 Benchmark 基线）。 |
| [16_SHARED_CONTRACTS.md](16_SHARED_CONTRACTS.md) | 全系统统一 TypeScript 接口定义、JSON Schema 与 Typed Reference 规范。 |
| [17_PROTOTYPE_MIGRATION_NOTES.md](17_PROTOTYPE_MIGRATION_NOTES.md) | 前端原型与正式架构的差异审计及平滑迁移指南。 |

---

## 2. 工程开发基本不变量

1. **唯一事实来源（SSOT）**：所有业务事实归 `packages/core`（Project State Engine）与本地 `state/*.json` 管理，Frontend/UI 仅为视图与意图提交者。
2. **AI 隔离与单次调用**：单次用户交互仅触发一次主要 Provider 调用（`discovery-turn`），消费结构化输出 `structured_output`，AI 失败绝不污染 Project State。
3. **用户授权第一**：只有用户输入或明确确认才能将状态提升为 `Confirmed` 或 `Locked`。
4. **自用优先与零企业级冗余**：不引入多租户、数据库、云同步、登录账号或复杂需求图。
