# Materials r3 独立内容复核

**结论：`needs-contract-repair`，规划契约尚未通过。清空性能命名已经修好；输入会话与实际定时器执行契约仍有两个阻断。**

复核对象从 `flash-materials-quality-20261005-06/manifest.json` 的 `packages.at(-1)` 读取：`quality-reviewed-r3`，实际 **sourceRevision=28、发布 revision=29**，basisHash=`d88723381aade9fdb287a00e97e1ce0a7889d2446777332f40e541b0933d4fff`。不是 source27 包，也不是继承的 source24/r2 包。本人重新核对该目录十个产物文件 SHA-256，全部匹配。revision28、revision29 与 final-snapshot 的蓝图完整对象一致。本轮只读源文件并新增本报告和一个 JSON 复核记录，未调用 Provider、业务 API、原生浏览器或目标应用；未执行新的合成 VM。

## 阻断一：隔离解除后，旧事件仍会污染新的输入会话

新增 `quarantined` 分支确实封住了旧报告的原序列：清空后若仍处于隔离态，迟到 `compositionend` 与 `input` 都直接返回、不调度，旧非空 value 会复位为空。这一进展应保留。

但有效 `blk-tech-interface` / `TECHNICAL_GUIDE.md:126–175` 仍用同一输入节点和全局 `currentSessionToken`。keydown、paste、新 compositionstart 一旦置 `sessionState='active'`，后续 input 就直接接受当前 DOM，没有事件来源/节点生命周期校验。`inputGeneration` 只声明与递增，从未参与有效性判断。

以下是**书面处理器允许的静态推导**，不是某浏览器的原生故障复现：

1. 旧 compositionstart 得 token1；清空使 activeSessionId=2、隔离态；真实新 keydown 解除隔离，新 input 保存 `Brand-New` 并调度定时器。随后旧 compositionend 因 token1≠2 被拒，但拒绝分支先将 `isComposing=false`，还强制清空当前的新 DOM value，且未取消已挂的新定时器。到期处理器读取 `inputElement.value`，而非 `lastAcceptedDraft`，会把空值送去校验。新真实输入因此可以被旧事件抹掉，并产生空值错误。
2. 清空后开始新 compositionstart，会把全局 currentSessionToken 覆盖为最新 activeSessionId。再到达的旧 compositionend 本身没有代际身份，可通过全局相等判断，并提前把新合成的 isComposing 置 false。
3. 清空后真实 keydown/paste 解除隔离，再到达携带旧 value 的 noncomposing input，会直接成为新的 lastAcceptedDraft 并 schedule。状态名称本身没有区分旧尾随事件与新用户事件。

此外，模块和 reset flow 承诺过滤 beforeinput，但实际 interface 没有 beforeinput 监听或处理规则。keydown 的排除表也不能等同于文本录入确认：Enter、Home、F1 等不在表内，均可解除隔离。现有任务/验收主要覆盖“清空后旧事件”和“清空后新物理键入”两组分离路径，没有闭合“新输入期间又到旧事件”、清空后粘贴/新 IME 与后台恢复的交叉序列。

修订须让旧事件关联具体输入生命周期；拒绝旧事件不能改写更新会话的 composing 状态或已接受草稿。应同步 data/interface/flow/error/task/acceptance，明确 beforeinput、新键入、粘贴和新合成的恢复边界。无需新增用户选择，也不能把普通 InputEvent 说成自带应用令牌。

## 阻断二：正文宣称的回调校验没有落到接口

`TECHNICAL_GUIDE.md:111–112` 的实际 schedule 仍是：取消旧 timerId，setTimeout 到期直接 callback，再清空 timerId。它没有保存调度时的会话令牌、generation、请求/句柄快照或已接受草稿；`handleDebouncedValidateAndDisplay` 在第175行直接读 DOM，也没有入口有效性检查。

第191行却声称“sessionToken 与 sessionState 双重校验不匹配，彻底杜绝后台唤醒竞态”；error E04 又声称“排队句柄、会话令牌与会话状态三重锁”。flow 的“唤醒核查句柄”同样未体现在具体执行契约中。这些是未实现的声明，不能由 clearTimeout 的存在自动推得。第214行承认原生 IME 未实测，不会抵消第191行的绝对保证。

修订须写明调度时保存什么有效性基准、取消/新输入如何作废、回调执行时检查什么及读取什么草稿；跨字段保持一致，并撤去未经验证的彻底杜绝声明。原生顺序和后台恢复仍是开发期实际验证，不应写成已证明。

## 逐项结果

| 核对项 | 结果 |
| --- | --- |
| 原隔离态旧 end/input 反例 | 书面规则已封堵，保持隔离时不重新 schedule、不制造空值错误。 |
| 普通新输入/粘贴/新 IME | 定义了解除隔离的入口，单独正向路径可流转；与迟到旧事件交错时仍不闭合。 |
| data/interface/flow/page/error 一致性 | 新状态已覆盖相关块，但 accepted draft/DOM 读取、beforeinput 与三重回调守卫不一致；阻断。 |
| 实现任务与验收 | 已加入旧尾随事件及新键入测试；仍需交叉序列、粘贴/新 IME 恢复和后台→清空/新输入→恢复测试。 |
| 清空 click→pre-rAF 名称 | **通过这项规划修订**：content、goal、normalBehavior、scope、verification、completionCriteria、steps、passCriteria 均改为“清空重置至重绘前调度延迟”；5轮均值≤50ms保留。outcomes 与导出的计划/验收/tasks 同步。旧“清空重置渲染耗时”现在只出现于历史反馈证据，不能将其误计为当前有效规则。 |
| 性能和安全真实性 | 性能 normalBehavior 明确目标应用尚未实现、数值待实测；不把 rAF 当物理绘制。动态安全 unexecuted、Safari/macOS 真机待验证仍保留。新 evidence 没有原生/目标应用实测通过记录。 |

输入指标继承了 total−300ms 的残差算法，一些字段仍称“纯计算/DOM更新”，该残差还包含调度等待。这是上一轮的精度建议，未作为新的 round3 阻断；它不影响本次清空指标命名修订已经闭合的判断。

## 历史和范围保护

source24→source28 为30块→30块，无新增/删除 ID；15个完整块的原始 JSON 对象字节与 hash 精确保持，15个相关块改变。上一轮列举的9个无关块中8个原样；page-main-layout 本轮增加了隔离态覆盖并更新标题/审批，原有视觉与布局前4项仍保持。它属于本轮要求同步的相关 page，不据此宣称无关范围回归，也不能把“8个原样”写成“9个原样”。目标、问题、非目标、范围、布局任务、旧reset/security验收和独立运行验证等保持原对象。

source24 的28条既有 evidence 全部保留：不仅 canonical 完整对象一致，实际 planning.json 中每条 JSON 对象的原始字节和 SHA-256 也一致。现29条，唯一新增项为自动质量反馈的 user-kind 原文；其中历史 `outcome=passed` 不能当本次内容/native/performance通过。继承 revision24 的 blueprint/planning/decisions 三文件与原 publish04 对应文件逐字节一致。

机器记录为 `materials-r3-core-independent-review.json`，包含两个阻断、逐项状态、稳定 ID、28条原始 evidence hash 与十个产物 hash。Runtime completed、自动 approvedBy、ZIP/HTTP/UI 或审计命令成功都不替代上述内容结论。目标应用、原生 IME/浏览器与 CodingAgent 实施仍未实测。
