import { join, dirname } from 'node:path';
import { ReadinessGate } from '../readiness/ReadinessGate.js';
import { DocumentPlanner } from './DocumentPlanner.js';
import { DocumentRenderer } from './DocumentRenderer.js';
import { DocumentValidator } from './DocumentValidator.js';
import { FileStorage } from '../storage/FileStorage.js';
import type {
  ProjectSnapshot,
  DocumentsState,
  DocumentReference,
} from '@project-architect/contracts';
import { ErrorCode } from '@project-architect/contracts';
import type { ReadinessResult } from '../readiness/ReadinessEvaluator.js';

export interface CompileDocumentsResult {
  manifest: DocumentsState;
  renderedFiles: Array<{ path: string; content: string }>;
  readiness: ReadinessResult;
}

export class DocumentCompiler {
  private storage: FileStorage;
  private readinessGate: ReadinessGate;
  private planner: DocumentPlanner;
  private renderer: DocumentRenderer;
  private validator: DocumentValidator;

  constructor(storage: FileStorage = new FileStorage(), templatesDir?: string) {
    this.storage = storage;
    this.readinessGate = new ReadinessGate();
    this.planner = new DocumentPlanner();
    this.renderer = new DocumentRenderer(storage, templatesDir);
    this.validator = new DocumentValidator();
  }

  /**
   * Compiles and outputs the full verified Markdown development package for a project.
   */
  async compile(
    projectPath: string,
    snapshot: ProjectSnapshot,
    targetRevision?: number
  ): Promise<CompileDocumentsResult> {
    // 1. Evaluate Readiness Gate & User Disposition via SSOT
    this.readinessGate.validateForDocumentGeneration(snapshot);
    const readiness = this.readinessGate.evaluate(snapshot);

    const sourceRevision = targetRevision ?? snapshot.metadata.stateRevision;

    // 2. Plan Document Structure
    const plan = this.planner.plan(snapshot);

    // 3. Render Documents in memory
    const renderedFiles: Array<{ path: string; content: string }> = [];
    const docReferences: DocumentReference[] = [];

    const now = new Date().toISOString();
    for (const item of plan.documents) {
      const content = await this.renderer.renderDocument(item, snapshot);
      renderedFiles.push({ path: item.path, content });

      docReferences.push({
        id: `doc-${item.type}`,
        type: item.type,
        path: item.path,
        title: item.title,
        status: 'generated',
        generatedAt: now,
        sourceRevision,
      });
    }

    // 4. Validate Rendered Documents
    const validation = this.validator.validate(renderedFiles, snapshot);
    if (!validation.valid) {
      const err: any = new Error(
        `Document compilation validation failed:\n${validation.errors.map((e) => `- ${e}`).join('\n')}`
      );
      err.code = ErrorCode.DOCUMENT_GENERATION_FAILED;
      err.details = { validation };
      throw err;
    }

    // 5. Build documents manifest
    const manifest: DocumentsState = {
      schemaVersion: 1,
      projectId: snapshot.metadata.projectId,
      items: docReferences,
      updatedAt: now,
    };

    // 6. Write to project files if projectPath is an existing directory
    if (projectPath && (await this.storage.exists(projectPath))) {
      for (const doc of renderedFiles) {
        const targetAbs = join(projectPath, doc.path);
        const targetDir = dirname(targetAbs);
        if (!(await this.storage.exists(targetDir))) {
          await this.storage.ensureDir(targetDir);
        }
        await this.storage.writeText(targetAbs, doc.content);
      }
      await this.storage.writeJson(join(projectPath, 'documents.json'), manifest);
    }

    return {
      manifest,
      renderedFiles,
      readiness,
    };
  }
}
