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
  private readinessGate: ReadinessGate;
  private planner: DocumentPlanner;
  private renderer: DocumentRenderer;
  private validator: DocumentValidator;

  constructor(storage: FileStorage = new FileStorage(), templatesDir?: string) {
    this.readinessGate = new ReadinessGate();
    this.planner = new DocumentPlanner();
    this.renderer = new DocumentRenderer(storage, templatesDir);
    this.validator = new DocumentValidator();
  }

  /**
   * Renders historical fixtures in memory. Persisted publication is retired.
   */
  async compile(
    projectPath: string,
    snapshot: ProjectSnapshot,
    targetRevision?: number,
    persistFiles = true,
    options?: { customRules?: string[]; customNotes?: string; isDraft?: boolean }
  ): Promise<CompileDocumentsResult> {
    if (persistFiles) throw Object.assign(new Error('旧文档写入已停用；仅保留 persistFiles=false 的历史渲染。'), { code: ErrorCode.LEGACY_WORKFLOW_RETIRED });
    void projectPath;
    // 1. Evaluate Readiness Gate & User Disposition via SSOT
    this.readinessGate.validateForDocumentGeneration(snapshot, { isDraft: options?.isDraft });
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
      let content = await this.renderer.renderDocument(item, snapshot, options);
      if (options?.isDraft) {
        content = `> [!NOTE]\n> **草案模式提示 (DRAFT SPECIFICATION)**：本项目处于初期探索草案阶段，准备度准入门禁尚未完成正式签署。\n\n${content}`;
      }
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

    return {
      manifest,
      renderedFiles,
      readiness,
    };
  }
}
