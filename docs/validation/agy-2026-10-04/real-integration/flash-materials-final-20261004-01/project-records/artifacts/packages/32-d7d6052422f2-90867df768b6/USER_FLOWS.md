# 真实集成验证-flash-materials-chinese-20261005-01 — 使用与恢复流程

版本：32；批准蓝图：d7d6052422f208b3042fa76c6347a9cc436abc3e1c1985ef56fc0f377f5ce8e2

## 交互流程：输入事件闭包守卫、快照防抖调度与节点代际流转

ID：blk-flow-input-display；关联需求：blk-feat-input-display；依赖：blk-feat-input-display

1. 用户光标聚焦在当前活跃输入框（activeInputNode）准备键入或编辑文本。
2. 事件感知与闭包前置校验：
   - 当捕获到 input、beforeinput、compositionstart、compositionend 等任何事件时，闭包首先执行有效性判定：
     if (e.currentTarget !== node || node !== activeInputNode || bornGeneration !== inputGeneration || !document.body.contains(node)) return;
   - 若不匹配（如属于已被清空替换的旧节点事件）：立即静默返回，不进行任何 DOM 操作、状态变更或定时器调度。
3. 组合输入（IME）分支流转：
   - 触发 compositionstart：闭包内置 isComposing = true，调用 DebounceScheduler.cancel() 取消排队中的旧防抖任务并使旧调度纪元失效；
   - 合成期间触发 input：核验 isComposing === true，忽略防抖调度，挂起等待；
   - 选词上屏触发 compositionend：闭包内置 isComposing = false，读取 node.value 存入 trustedDraft，调用 DebounceScheduler.schedule(trustedDraft, node, bornGeneration, handleDebouncedValidateAndDisplay, 300)。
4. 普通输入分支流转：
   - 触发原生 input 事件（且 !isComposing && !e.isComposing）：读取当前 node.value 存入 trustedDraft，调用 DebounceScheduler.schedule(trustedDraft, node, bornGeneration, handleDebouncedValidateAndDisplay, 300)。
5. 防抖调度与快照绑定：
   - DebounceScheduler.schedule 内部递增 schedulerEpoch 产生本次唯一的 thisEpoch，并启动 300ms setTimeout；
   - 若在 300ms 倒计时期间收到新输入，旧任务被自动销毁并以新纪元重新倒计时；
   - 若在 300ms 倒计时期间用户点击清空按钮，清空逻辑立即执行 DebounceScheduler.cancel()（递增 schedulerEpoch 废弃任务），递增 inputGeneration 并替换 DOM 节点，倒计时逻辑在到期后因纪元不匹配被无害丢弃。
6. 定时器唤醒与快照校验执行：
   - 300ms 定时器到期唤醒时，首先执行三重守卫：
     if (thisEpoch !== schedulerEpoch || targetGeneration !== inputGeneration || targetNode !== activeInputNode || !document.body.contains(targetNode)) return;
   - 守卫通过后，针对传入的 draftSnapshot 执行校验（不重新读取 targetNode.value）：
     * 分支 A（空值或纯空白字符）：清除顶部展示区已显示的旧项目名，展示区恢复为初始灰色占位符“【等待输入核对】”，在输入框正下方挂载红色错误提示“项目名不能为空，请输入有效字符”，输入框边框变红并保持焦点；输入框已输入的字符（含空格）原样完好保留；
     * 分支 B（有效非空字符）：移除旧错误提示与高亮，通过 Node.textContent 将 draftSnapshot 安全更新到顶部展示区，输入框完好保留当前文本供后续微调。
7. 异常防护：若 DOM 操作抛出异常，顶层 try-catch 捕获并在界面顶部以警示条显示，输入框文本完好保留供用户修改恢复。

来源：evidence-1e3fc8ef-8a1e-404f-a931-72f46fd0d8ed、evidence-6f045d0d-928d-4f66-8427-b7f62c91ae8a、evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-dab40954-74e0-4d24-bb31-1064f5dd626f、evidence-7cca7dfc-39e6-47cf-8cc6-3f7ccb9f622e、evidence-dea1091c-52e5-4841-bdfe-a040b152fc88、evidence-7ec331d7-1d2e-415d-abc5-fecbed731559、evidence-mdn-ime-compositionstart-session、evidence-e925f9c6-bafa-4a0e-bc35-de2a031a6cc9；批准操作：api-automated-acceptance-flash-materials-final-20261004-01-feedback-1791157795159

## 交互流程：清空重置、DOM节点替换与代际闭包解耦流转

ID：blk-flow-reset；关联需求：blk-feat-reset；依赖：blk-feat-reset

1. 用户点击底部橙色圆形清空按钮（resetButton）。
2. 执行 ResetController.handleReset() 核心复位流程：
   a. 第一优先级调用 DebounceScheduler.cancel()：清除当前排队的 pendingTimerId，递增 schedulerEpoch 使任何已进入宏任务队列的旧定时器回调彻底失效；
   b. 递增全局代际计数：inputGeneration++；
   c. 记录旧节点引用 const oldNode = activeInputNode;；
   d. 实例化全新输入元素：const newNode = document.createElement('input');；
   e. 复制原有全部 DOM 属性与无障碍配置：newNode.type = 'text'; newNode.id = oldNode.id; newNode.name = oldNode.name; newNode.className = oldNode.className; newNode.placeholder = oldNode.placeholder; newNode.setAttribute('aria-label', oldNode.getAttribute('aria-label') || '项目名输入'); newNode.value = '';；
   f. 调用 InputController.bindInputNode(newNode, inputGeneration) 为新节点完成专属闭包事件监听绑定（传入当前代际作为 bornGeneration）；
   g. 执行 DOM 物理节点替换：oldNode.replaceWith(newNode);；
   h. 更新全局引用：activeInputNode = newNode;；
   i. 将顶部展示区复位为灰字占位符：DisplayRenderer.renderPlaceholder(displayElement, '【等待输入核对】');；
   j. 移除可见的校验错误 DOM 节点并清除边框高亮样式：FeedbackBanner.clearInputError(activeInputNode, errorContainer);；
   k. 调用 activeInputNode.focus(); 确保键盘输入焦点停留在新输入框内。
3. 旧节点迟到事件隔离拦截：
   - 若在重置完成后，输入法或浏览器向 oldNode 派发迟到的 compositionend、beforeinput 或 input 事件；
   - 事件触发 oldNode 对应的旧闭包函数，守卫执行 if (e.currentTarget !== node || node !== activeInputNode || bornGeneration !== inputGeneration || !document.body.contains(node)) return;；
   - 由于 node !== activeInputNode（oldNode !== newNode）且 bornGeneration !== inputGeneration，守卫立即直接 return；
   - 旧事件完全不执行任何逻辑，不修改 activeInputNode.value，不调度防抖，不修改新节点组合状态。
4. 新输入顺畅恢复：
   - 用户在 activeInputNode 中键入字符、粘贴或启动新输入法合成，新节点的闭包正常匹配 bornGeneration === inputGeneration，正常流转 300ms 防抖倒计时与结果展示。
5. 流程结束，界面完全处于干净就绪态。

来源：evidence-1e3fc8ef-8a1e-404f-a931-72f46fd0d8ed、evidence-6f045d0d-928d-4f66-8427-b7f62c91ae8a、evidence-15da1e6d-9c13-49f1-a146-f94eb1d8e564、evidence-27ebc57b-491d-46f1-bdb3-33df17720f9f、evidence-89fe01db-82bb-475e-9d76-5a379bda0e07、evidence-e925f9c6-bafa-4a0e-bc35-de2a031a6cc9；批准操作：api-automated-acceptance-flash-materials-final-20261004-01-feedback-1791157795159
