import { join, dirname } from 'node:path';
import { ReadinessGate } from '../readiness/ReadinessGate.js';
import { DocumentPlanner } from './DocumentPlanner.js';
import { DocumentRenderer } from './DocumentRenderer.js';
import { DocumentValidator } from './DocumentValidator.js';
import { FileStorage } from '../storage/FileStorage.js';
import { createHash } from 'node:crypto';
import type {
  ProjectSnapshot,
  DocumentManifest,
  DocumentManifestItem,
} from '@project-architect/contracts';
import { ErrorCode } from '@project-architect/contracts';
import type { ReadinessResult } from '../readiness/ReadinessEvaluator.js';

export interface CompileDocumentsResult {
  manifest: DocumentManifest;
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
    targetRevision?: number,
    persistFiles = true
  ): Promise<CompileDocumentsResult> {
    // 1. Evaluate Readiness Gate & User Disposition via SSOT
    this.readinessGate.validateForDocumentGeneration(snapshot);
    const readiness = this.readinessGate.evaluate(snapshot);

    const sourceRevision = targetRevision ?? snapshot.metadata.stateRevision;

    // 2. Plan Document Structure
    const plan = this.planner.plan(snapshot);

    // 3. Render Documents in memory
    const renderedFiles: Array<{ path: string; content: string }> = [];
    const docReferences: DocumentManifestItem[] = [];

    const totalSourceCoverage = {
      confirmed: 0,
      locked: 0,
      assumptions: 0,
      generatedStructure: 0,
    };

    const now = new Date().toISOString();
    for (const item of plan.documents) {
      const content = await this.renderer.renderDocument(item, snapshot);
      renderedFiles.push({ path: item.path, content });

      const contentHash = createHash('sha256').update(content, 'utf8').digest('hex');
      const confirmed = (content.match(/\[Confirmed:/g) || []).length;
      const locked = (content.match(/\[Locked:/g) || []).length;
      const assumptions = (content.match(/\[Active Assumption\]/g) || []).length;
      const generatedStructure = (content.match(/^#{1,4}\s+/gm) || []).length;

      totalSourceCoverage.confirmed += confirmed;
      totalSourceCoverage.locked += locked;
      totalSourceCoverage.assumptions += assumptions;
      totalSourceCoverage.generatedStructure += generatedStructure;

      docReferences.push({
        id: `doc-${item.type}`,
        type: item.type,
        path: item.path,
        title: item.title,
        status: 'generated',
        generatedAt: now,
        sourceRevision,
        contentHash,
        sourceStats: {
          confirmed,
          locked,
          assumptions,
          generatedStructure,
        },
      });
    }

    // 4. Validate Rendered Documents
    const validation = this.validator.validate(renderedFiles, snapshot, {
      checkPackageCompleteness: true,
    });
    if (!validation.valid) {
      const err: any = new Error(
        `Document compilation validation failed:\n${validation.errors.map((e) => `- ${e}`).join('\n')}`
      );
      err.code = ErrorCode.DOCUMENT_GENERATION_FAILED;
      err.details = { validation };
      throw err;
    }

    // 5. Build full DocumentManifest
    const manifest: DocumentManifest = {
      id: `manifest-${sourceRevision}`,
      projectId: snapshot.metadata.projectId,
      sourceRevision,
      readinessReviewId: snapshot.readiness?.current?.id || `rev-${sourceRevision}`,
      readinessBasisRevision: snapshot.readiness?.current?.basisRevision ?? sourceRevision,
      generatedAt: now,
      documents: docReferences,
      warnings: snapshot.readiness?.current?.warnings || [],
      sourceCoverage: totalSourceCoverage,
      items: docReferences,
      schemaVersion: 1,
      updatedAt: now,
    };

    // 6. Write to project files if projectPath is an existing directory
    if (persistFiles && projectPath && (await this.storage.exists(projectPath))) {
      for (const doc of renderedFiles) {
        const targetAbs = join(projectPath, doc.path);
        const targetDir = dirname(targetAbs);
        if (!(await this.storage.exists(targetDir))) {
          await this.storage.ensureDir(targetDir);
        }
        await this.storage.writeText(targetAbs, doc.content);
      }
      await this.storage.writeJson(join(projectPath, 'documents.json'), manifest);
      const manifestDir = join(projectPath, 'documents');
      if (!(await this.storage.exists(manifestDir))) {
        await this.storage.ensureDir(manifestDir);
      }
      await this.storage.writeJson(join(manifestDir, 'manifest.json'), manifest);
    }

    return {
      manifest,
      renderedFiles,
      readiness,
    };
  }
}
