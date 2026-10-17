import type { AddInputRequest, InputRef, ProjectSnapshot } from '@project-architect/contracts';
import type { ProjectArchitectApiClient } from '../../api/client.js';

export type InitialMaterial = Pick<AddInputRequest, 'kind' | 'filename' | 'content' | 'contentEncoding'>;

export function materialFailureMessage(input: InputRef): string | null {
  return input.status === 'failed' ? `${input.label}：材料已保存，但提取失败。${input.errorMessage || '无法读取材料内容。'} 原文件保留，可重新上传可读取的版本或补充文本。` : null;
}

export async function uploadInitialMaterials(client: Pick<ProjectArchitectApiClient, 'addInput' | 'getProjectSnapshot'>, projectId: string, materials: InitialMaterial[], initialRevision: number, signal: AbortSignal, onErrors: (errors: string[]) => void = () => {}): Promise<{ snapshot: ProjectSnapshot; errors: string[] }> {
  let revision = initialRevision;
  const errors: string[] = [];
  for (const material of materials) {
    try {
      const result = await client.addInput(projectId, { ...material, projectId, expectedRevision: revision }, signal);
      const failure = materialFailureMessage(result.inputRef);
      if (failure) errors.push(failure);
    } catch (failure) {
      if (signal.aborted) throw failure;
      errors.push(`${material.filename}：${failure instanceof Error ? failure.message : '上传失败'}`);
    }
    onErrors([...errors]);
    revision = (await client.getProjectSnapshot(projectId, signal)).metadata.stateRevision;
  }
  return { snapshot: await client.getProjectSnapshot(projectId, signal), errors };
}
