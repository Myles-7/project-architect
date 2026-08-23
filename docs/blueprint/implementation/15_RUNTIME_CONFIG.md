# Project Architect V1：运行时配置与基线参数

> 文档状态：Phase 0 Engineering Blueprint  
> 范围：全系统运行时可调节配置表、默认值及监控基线。  
> 原则：参数集中化管理，严禁在业务代码中散落硬编码数值。

---

## 1. 运行时配置接口定义 (TypeScript Interface)

```typescript
export interface AppRuntimeConfig {
  // Provider 调用控制
  provider: {
    cliExecutable: string;              // 默认 'agy.exe' (或环境变量 AGY_CLI)
    timeoutMs: number;                  // 进程硬超时时限，默认 90,000 (90s)
    warningDurationMs: number;          // 耗时预警阈值，默认 45,000 (45s)
    maxBufferBytes: number;             // stdout/stderr 缓冲区，默认 10 * 1024 * 1024 (10MB)
  };

  // 上下文预算控制 (Context Manager)
  context: {
    maxTotalContextChars: number;       // 单次请求最大上下文字符数，默认 32,000
    maxContextDecisions: number;        // 单次最多注入的决策条目数，默认 20
    maxContextGaps: number;             // 单次最多注入的未决条目数，默认 10
    maxChecklistHints: number;          // 单次最多注入的 Checklist 提示数，默认 10
    maxMaterialExcerptChars: number;    // 单个材料文件的最大摘录长度，默认 4,000 字符
  };

  // 输入材料限制 (Input Contract)
  inputs: {
    maxFileSizeBytes: number;           // 单文件大小上限，默认 20 * 1024 * 1024 (20MB)
    maxFilesPerBatch: number;           // 单次上传材料数量上限，默认 10
    supportedExtensions: string[];      // ['.txt', '.md', '.pdf', '.docx', '.png', '.jpg', '.jpeg', '.webp']
  };

  // Token 消耗监控与熔断门控
  guardrails: {
    tokenWarningThreshold: number;      // 单次总 Token 预警阈值，默认 50,000
    tokenHardGuardrail: number;         // 单次总 Token 熔断上限，默认 75,000
    maxInputTokens: number;             // 单次输入 Token 熔断上限，默认 60,000
  };

  // 日志与诊断
  observability: {
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    persistRawDiagnostics: boolean;     // 是否保存 Provider 原始封套到临时目录，默认 true
  };
}
```

---

## 2. 默认配置常量表

```typescript
export const DEFAULT_RUNTIME_CONFIG: AppRuntimeConfig = {
  provider: {
    cliExecutable: process.env.AGY_CLI || 'agy.exe',
    timeoutMs: Number(process.env.PA_TIMEOUT_MS) || 90_000,
    warningDurationMs: 45_000,
    maxBufferBytes: 10 * 1024 * 1024,
  },
  context: {
    maxTotalContextChars: 32_000,
    maxContextDecisions: 20,
    maxContextGaps: 10,
    maxChecklistHints: 10,
    maxMaterialExcerptChars: 4_000,
  },
  inputs: {
    maxFileSizeBytes: 20 * 1024 * 1024,
    maxFilesPerBatch: 10,
    supportedExtensions: ['.txt', '.md', '.pdf', '.docx', '.png', '.jpg', '.jpeg', '.webp'],
  },
  guardrails: {
    tokenWarningThreshold: 50_000,
    tokenHardGuardrail: 75_000,
    maxInputTokens: 60_000,
  },
  observability: {
    logLevel: (process.env.PA_LOG_LEVEL as any) || 'info',
    persistRawDiagnostics: true,
  },
};
```

---

## 3. B2.1 Benchmark 实测观测基线 (Baseline Reference)

以下数值来自 10 大完整测试用例在 B2.1 验证运行中的平均值（见 `experiments/agent-benchmark/reports/B2_1_FULL_VALIDATION_REPORT.md`）：

| 观测指标 | B2.1 实测平均值 | 作用与解释 |
| :--- | :---: | :--- |
| **单次 Total Tokens** | **28,844** | 正常 Discovery Turn 消耗参考线；若单次超过 50k 则触发日志 Warning。 |
| **单次 Input Tokens** | **7,820** | 包含 Constitution + Context + Schema 后的输入体量。 |
| **单次 Output Tokens** | **1,850** | 包含 9 大字段的结构化输出 JSON 体量。 |
| **单次 Thinking Tokens** | **19,174** | 深度逻辑分类与仲裁所需的思考 Token。 |
| **单次执行耗时 (Duration)** | **37.8 秒** | 正常调用耗时基准；45 秒为界面加载提示线，90 秒为硬超时。 |

> **注意**：上述基线作为系统性能与成本的健康度观察参考，严禁作为硬编码的逻辑截断依据。
