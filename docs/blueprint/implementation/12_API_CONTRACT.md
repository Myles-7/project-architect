# Project Architect V1：Local API 契约设计

> **文档状态**：历史设计蓝图 (Historical Blueprint)  
> **正式冻结契约**：本文档仅供早期设计溯源参考。V1 正式且唯一的权威冻结 API 契约已迁移至 **[docs/api/API_V1.md](../../api/API_V1.md)**。  
> **范围**：Frontend ↔ Local Backend 交互契约定义。  
> **目标**：提供简单、明确、单向流转的本地操作接口，支持 HTTP REST 传输。

---

## 1. API 整体交互规范

1. **单向数据流与 Revision 保护**：
   - 每次可能改变 Project State 的写操作，响应中均返回递增的 `stateRevision` 及最新状态快照。
   - 客户端写请求需携带 `expectedRevision`；若与服务器当前版本不一致，返回 `STATE_REVISION_CONFLICT`。
2. **统一响应结构**：
   ```typescript
   export interface ApiResponse<T> {
     success: boolean;
     data?: T;
     stateRevision?: number;
     error?: ApiErrorPayload;
   }
   ```

---

## 2. API 操作分类与接口定义

### 2.1 Projects（项目生命周期）

#### 1. `CreateProject`
- **说明**：创建新项目，初始化本地 `project.json` 及 `state/*.json`。
- **Request**：
  ```json
  {
    "name": "Local Music Tagger",
    "idea": "一个运行在 Windows 本地的音乐文件元数据清洗工具",
    "projectTags": ["Desktop App", "Developer Tool", "Local-First"]
  }
  ```
- **Response**：
  ```json
  {
    "success": true,
    "data": {
      "projectId": "proj-20260822-01",
      "projectPath": "D:/projects/LocalMusicTagger",
      "snapshot": { /* Full ProjectSnapshot */ }
    },
    "stateRevision": 1
  }
  ```

#### 2. `OpenProject`
- **说明**：打开指定路径的项目，执行 Commit 恢复检查并返回最新完整状态。
- **Request**：`{ "projectPath": "D:/projects/LocalMusicTagger" }`
- **Response**：`{ "success": true, "data": { "snapshot": { /* ... */ } }, "stateRevision": 5 }`

#### 3. `GetProjectSnapshot`
- **说明**：获取当前项目的完整只读快照（Overview 投影、Decisions、Readiness 等）。
- **Request**：`{ "projectId": "proj-20260822-01" }`
- **Response**：`{ "success": true, "data": { "snapshot": { /* ... */ } }, "stateRevision": 5 }`

#### 4. `ListRecentProjects`
- **说明**：获取本地最近打开的项目列表简要信息。
- **Response**：
  ```json
  {
    "success": true,
    "data": {
      "projects": [
        {
          "projectId": "proj-20260822-01",
          "name": "Local Music Tagger",
          "stage": "deep_dive",
          "updatedAt": "2026-08-22T22:30:00Z",
          "path": "D:/projects/LocalMusicTagger"
        }
      ]
    }
  }
  ```

---

### 2.2 Inputs（材料输入管理）

#### 1. `AddInput`
- **说明**：向项目上传文件/图片或添加纯文本材料，本地保存并执行文本抽取。
- **Request**：
  ```json
  {
    "projectId": "proj-20260822-01",
    "kind": "file", // "text" | "file" | "image"
    "filename": "requirements.md",
    "contentBase64": "..."
  }
  ```
- **Response**：`{ "success": true, "data": { "inputRef": { "id": "input:inp-01", "status": "ready" } } }`

#### 2. `ExcludeInput`
- **说明**：将某材料标记为 `excluded`，后续不再参与 Context 抽取。
- **Request**：`{ "projectId": "proj-20260822-01", "inputId": "input:inp-01" }`
- **Response**：`{ "success": true }`

---

### 2.3 State Actions（确定性状态变更，无 AI）

#### 1. `ConfirmDecision`
- **说明**：用户明确确认某个 Candidate 或 Assumption。
- **Request**：
  ```json
  {
    "projectId": "proj-20260822-01",
    "targetRef": "decision:dec-05", // 或 "assumption:asm-02"
    "expectedRevision": 5
  }
  ```
- **Response**：`{ "success": true, "stateRevision": 6 }`

#### 2. `LockDecision` / `UnlockDecision`
- **说明**：用户显式锁定/解锁某项 Confirmed 决定。
- **Request**：`{ "projectId": "proj-20260822-01", "decisionRef": "decision:dec-05", "expectedRevision": 6 }`
- **Response**：`{ "success": true, "stateRevision": 7 }`

#### 3. `EditOverviewItem`
- **说明**：用户在右栏 Overview 直接编辑某项陈述。
- **Request**：
  ```json
  {
    "projectId": "proj-20260822-01",
    "sectionId": "mvp_scope",
    "itemRef": "decision:dec-03",
    "newStatement": "MVP 仅支持本地 MP3 与 FLAC 格式标签提取",
    "expectedRevision": 7
  }
  ```
- **Response**：`{ "success": true, "data": { "affectedRefs": ["gap:gap-02"] }, "stateRevision": 8 }`

---

### 2.4 Discovery（AI 统一发散与推理）

#### 1. `RunDiscoveryTurn`
- **说明**：触发单次 Unified Discovery 推理（提交新 Idea、回答问题或补充约束）。
- **Request**：
  ```json
  {
    "projectId": "proj-20260822-01",
    "userMessage": "我决定第一版先不支持在线封面下载，只读写本地元数据",
    "questionAnswer": {
      "questionRef": "question:q-01",
      "selectedOption": "仅本地读取",
      "freeInput": ""
    },
    "expectedRevision": 8
  }
  ```
- **Response**：
  ```json
  {
    "success": true,
    "data": {
      "discoveryResult": {
        "confirmed": ["第一版仅支持本地元数据读写"],
        "candidates": ["建议在设置中保留扩展在线数据源的配置入口"],
        "gaps": [ /* ... */ ],
        "questions": [ /* ... */ ]
      },
      "snapshot": { /* 最新状态快照 */ },
      "diagnostics": {
        "durationMs": 3210,
        "totalTokens": 28400
      }
    },
    "stateRevision": 9
  }
  ```

---

### 2.5 Readiness & Documents（准备度审阅与文档编译）

#### 1. `RunReadinessReview`
- **说明**：发起单次 `readiness-review` 推理，生成准备度报告快照。
- **Request**：`{ "projectId": "proj-20260822-01" }`
- **Response**：
  ```json
  {
    "success": true,
    "data": {
      "readinessSnapshot": {
        "status": "ready_with_warnings",
        "warnings": ["未明确是否支持多层级子目录递归扫描"],
        "issues": [],
        "assumptions": ["默认使用 UTF-8 编码保存元数据"]
      }
    }
  }
  ```

#### 2. `ApproveDevelopmentPackage`
- **说明**：用户对 Readiness 审阅结果进行明确授权处置。
- **Request**：
  ```json
  {
    "projectId": "proj-20260822-01",
    "disposition": "approved_with_warnings", // "approved" | "approved_with_warnings" | "approved_with_known_issues" | "approved_with_critical_conflicts"
    "acknowledgedIssueRefs": []
  }
  ```
- **Response**：`{ "success": true, "stateRevision": 10 }`

#### 3. `GenerateDocuments`
- **说明**：在获得批准后，触发 `document-plan` 并调用本地 Document Compiler 编译 Markdown。
- **Request**：`{ "projectId": "proj-20260822-01", "expectedRevision": 10 }`
- **Response**：
  ```json
  {
    "success": true,
    "data": {
      "manifest": {
        "sourceStateRevision": 10,
        "generatedAt": "2026-08-22T22:45:00Z",
        "files": [
          "AGENTS.md",
          "docs/PROJECT.md",
          "docs/PRODUCT.md",
          "docs/USER_FLOWS.md",
          "docs/UX_UI_SPEC.md",
          "docs/TECHNICAL_GUIDE.md",
          "docs/DEVELOPMENT_PLAN.md",
          "docs/ACCEPTANCE.md"
        ]
      }
    }
  }
  ```

#### 4. `ReadDocument`
- **说明**：读取生成的某份 Markdown 文档内容。
- **Request**：`{ "projectId": "proj-20260822-01", "docPath": "AGENTS.md" }`
- **Response**：`{ "success": true, "data": { "content": "# AGENTS.md\n..." } }`
