import { DocumentCompiler, readProjectSnapshotReadOnly, type FileStorage } from '@project-architect/core';
import { directoryFileHashes } from './legacy-planning.mjs';

/** Historical renderer compatibility only: no publication, approval, revision commit or Provider. */
export async function renderHistoricalDocuments(projectPath: string, storage: FileStorage) {
  const filesBefore = await directoryFileHashes(projectPath);
  const snapshot = await readProjectSnapshotReadOnly(projectPath);
  const compiled = await new DocumentCompiler(storage).compile(projectPath, snapshot, snapshot.metadata.stateRevision, false);
  const filesAfter = await directoryFileHashes(projectPath);
  const documents = new Map(compiled.renderedFiles.map(file => [file.path, file.content]));
  return {
    ...compiled, snapshot, filesBefore, filesAfter,
    has: (path: string) => documents.has(path),
    content: (path: string): string => {
      const content = documents.get(path);
      if (content === undefined) throw new Error(`Historical rendered fixture is missing ${path}`);
      return content;
    },
  };
}
