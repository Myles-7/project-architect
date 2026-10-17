# 旧格式迁移副本 HTTP 验证

结果：passed；Node：v24.19.0；Provider 调用：0；服务全部停止：true。

本验证只使用 tests/fixtures/legacy-planning.mjs 创建的合成源和副本，未访问用户 .workspace。使用已编译生产模块与 public HTTP 接口，清理审批是自动验收操作。历史回答 unknown 的检查调用编译后的上下文投影，输入来自 HTTP snapshot；不声称 GET planning 本身返回工作者上下文。

通过 49 项检查，失败 0 项。

兼容读及拒绝操作不改项目文件；正常提交写入已校验新结构；Locked 清理须显式 unlock。恢复验证在停止服务后，只对操作副本注入未完成 revision、marker、staging、镜像与指针，再经重启 HTTP 读取恢复。源与未操作副本的前后 SHA-256 文件清单、逐次 HTTP 响应、批准版本 manifest 和恢复结果均保留在本目录。

复现：在 Node 24 环境运行 node docs/validation/legacy-migration-http/verify.mjs，可选第二参数指定新证据目录标签。
