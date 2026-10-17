import type { InputRef } from '@project-architect/contracts';
import { materialFailureMessage } from './materialUploads.js';

export function MaterialStatusNotice({ input }: { input: InputRef }) {
  const failure = materialFailureMessage(input);
  const title = failure ? '解析提取失败' : input.status === 'excluded' ? '已排除上下文' : input.kind === 'image' ? '图片原文件已保存' : input.analysisAvailability === 'available' ? '文本提取可用' : '材料仅归档保存';
  const message = failure || (input.status === 'excluded' ? '此材料当前不参与规划。原文件仍保存在项目中。' : input.kind === 'image' ? '视觉任务可按需读取图片原文件。是否已经读取以及得到哪些结论，请查看本次运行的任务记录和证据；保存图片不代表已完成视觉分析。' : input.analysisAvailability === 'available' ? '规划任务可按需读取已提取的文本。文件就绪不代表 AI 已经完整理解或采纳其中的内容。' : '材料已保存在本地，目前没有可供文本分析的提取内容。请上传可读取的版本或补充文字说明。');
  return <div className={failure ? 'planning-error' : 'planning-notice'} role={failure ? 'alert' : undefined}><strong>{title}</strong><p>{message}</p></div>;
}
