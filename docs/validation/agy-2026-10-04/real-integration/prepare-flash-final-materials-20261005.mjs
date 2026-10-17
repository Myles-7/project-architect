import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { sha256, treeSha256 } from './model-transition.mjs';

const root = resolve('docs/validation/agy-2026-10-04/real-integration');
const sourceLabel = 'flash-materials-final-20261005-04';
const source = join(root, sourceLabel);
const manifestBytes = await readFile(join(source, 'manifest.json'));
const manifest = JSON.parse(manifestBytes);
if (manifest.status !== 'completed' || manifest.activeCallsAtShutdown !== 0 || manifest.requestedConfig.designModel !== 'gemini-3.8-flash-high' || manifest.requestedConfig.reviewModel !== 'gemini-3.8-flash-high') throw new Error('Stopped completed Flash source required');
const before = await treeSha256(source);
const original = await readFile(join(root, 'quality-feedback-materials-round9-opus.txt'), 'utf8');
const qualityFile = join(root, 'quality-feedback-materials-round10-flash.txt');
const feedback = `${original}\n\n本轮用户明确要求继续并使用 Gemini 3.8 Flash。以上自动质量判据仍适用，标题中的历史模型名称不是执行配置。本轮新任务采用Flash，高强度；从同模型已完成r7冻结副本新建修订，不改Pro/Opus历史Run或收据，也不冒称复用了它们的执行结果。\n\n进一步的具体质量要求（自动验收反馈，不是真人新增需求）：此前未批准Pro候选补齐了init和成功提交才递增代际，但接口清单仍缺11个原有公共方法。独立评审必须逐项核对并保持原public API：bindInputNode、focusInput、schedule、cancel、hasPending、handleReset、captureSnapshot、rollback、renderProjectName、renderPlaceholder、showInputError、clearInputError、showGlobalError、showSevereFallbackDraft、validate；保留AppController.init。每项保留所属模块、入参、返回类型、正常/失败后置条件和调用方职责，不能只在别处正文提到名字来代替接口。原已批准同名方法确需自洽替代时，必须明确理由并完整同步接口、模块、流程、状态、task字段和验收，不能静默删除。\n\nReviewer应读取已批准30块、当前完整候选及全部已存在证据；重审所有上述方法，初始装配、单次绑定、300ms调度、成功commit后代际、失败恢复epoch和非执行伪代码，确保相同包内没有相反的两条配方。保留18无关块完整对象及42旧证据，不为凑覆盖修改无关内容；8任务依赖不应因局部接口澄清改变。对未满足项自动修订，不能凭blockers空或语法检查就宣称内容通过。\n`;
await writeFile(qualityFile, feedback, { flag: 'wx' });
if ((await treeSha256(source)).sha256 !== before.sha256) throw new Error('Frozen source changed');
const record = {recordedAt:new Date().toISOString(),authorization:{source:'Direct latest user message',instruction:'我已经恢复余额了，请继续完成最后的工作（使用gemini 3.8flash）',scope:'New automated acceptance feedback Run only; not human content approval'},sourceLabel,sourceManifestSha256:sha256(manifestBytes),sourceTreeSha256:before.sha256,qualityFile,qualityFileSha256:sha256(Buffer.from(feedback)),targetConfig:{designModel:'gemini-3.8-flash-high',reviewModel:'gemini-3.8-flash-high',concurrency:4},proHistoryReusedAsNewExecution:false};
await writeFile(join(root,'flash-final-materials-authorization-20261005.json'),JSON.stringify(record,null,2),{flag:'wx'});
console.log(JSON.stringify(record));
