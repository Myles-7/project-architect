import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { join, resolve } from 'node:path';
import {
  ProjectStateEngine,
  WorkspaceGuard,
  FileStorage,
  projectOverviewProjection,
  readinessProjection,
  documentProjection,
  timelineProjection,
} from '@project-architect/core';
import { AIOrchestrator, MockAIProvider, AntigravityCliProvider } from '@project-architect/agent';
import {
  ErrorCode,
  type ApiResponse,
  type CreateProjectRequest,
  type OpenProjectRequest,
  type RecentProjectItem,
  type TypedRef,
  type DecisionRef,
  type QuestionRef,
} from '@project-architect/contracts';

export interface ServerOptions {
  engine?: ProjectStateEngine;
  orchestrator?: AIOrchestrator;
  guard?: WorkspaceGuard;
  workspaceRoot?: string;
  projectsDir?: string;
  useMockAI?: boolean;
}

export function createApp(options: ServerOptions = {}): express.Express {
  const app: express.Express = express();

  const allowedOriginRegex = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOriginRegex.test(origin) || origin.startsWith('vscode-webview://')) {
          return callback(null, true);
        }
        const corsError: any = new Error(`CORS policy blocked access from origin: ${origin}`);
        corsError.code = ErrorCode.STATE_VALIDATION_FAILED;
        return callback(corsError);
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  const guard =
    options.guard ||
    new WorkspaceGuard(options.workspaceRoot || options.projectsDir);
  const storage = new FileStorage();
  const engine = options.engine || new ProjectStateEngine(storage, guard);
  const provider = options.useMockAI ? new MockAIProvider() : new AntigravityCliProvider();
  const orchestrator = options.orchestrator || new AIOrchestrator(provider, engine, process.cwd(), storage);

  // Persistent project registry in workspace root
  const registryFile = join(guard.workspaceRoot, '.projects-registry.json');
  const projectRegistry = new Map<string, RecentProjectItem>();

  const loadRegistry = async (): Promise<void> => {
    try {
      if (await storage.exists(registryFile)) {
        const items = await storage.readJson<RecentProjectItem[]>(registryFile);
        if (Array.isArray(items)) {
          for (const item of items) {
            if (item.projectId && item.projectPath) {
              projectRegistry.set(item.projectId, item);
            }
          }
        }
      }
    } catch {
      // Ignore corrupted registry file and start fresh
    }
  };

  const saveRegistry = async (): Promise<void> => {
    try {
      const items = Array.from(projectRegistry.values());
      await storage.writeJson(registryFile, items);
    } catch {
      // Non-critical persistence failure
    }
  };

  // Pre-load registry on initialization
  void loadRegistry();

  const registerProject = async (item: RecentProjectItem): Promise<void> => {
    projectRegistry.set(item.projectId, item);
    await saveRegistry();
  };

  const resolveProjectLocation = async (rawId: string): Promise<string> => {
    const cleanId = guard.validateProjectId(rawId);
    let entry = projectRegistry.get(cleanId);
    if (!entry) {
      const canonical = guard.resolveProjectPath(cleanId);
      if (await storage.exists(canonical)) {
        try {
          const snapshot = await engine.loadProject(canonical);
          entry = {
            projectId: snapshot.metadata.projectId,
            name: snapshot.metadata.name,
            stage: snapshot.metadata.stage,
            updatedAt: snapshot.metadata.updatedAt,
            projectPath: canonical,
          };
          await registerProject(entry);
        } catch {
          // Fall through
        }
      }
    }
    if (!entry || !(await storage.exists(entry.projectPath))) {
      throw projectNotFoundError(cleanId);
    }
    return entry.projectPath;
  };

  // Helper validation functions
  const assertObject = (body: any, label = 'Request body'): Record<string, any> => {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      const err: any = new Error(`${label} must be a valid JSON object`);
      err.code = ErrorCode.STATE_VALIDATION_FAILED;
      throw err;
    }
    return body;
  };

  const assertString = (val: any, fieldName: string, minLen = 1): string => {
    if (typeof val !== 'string' || val.trim().length < minLen) {
      const err: any = new Error(`Field "${fieldName}" must be a non-empty string`);
      err.code = ErrorCode.STATE_VALIDATION_FAILED;
      throw err;
    }
    return val.trim();
  };

  const assertInteger = (val: any, fieldName: string, min = 0): number => {
    if (typeof val !== 'number' || !Number.isInteger(val) || val < min) {
      const err: any = new Error(`Field "${fieldName}" must be an integer >= ${min}`);
      err.code = ErrorCode.STATE_VALIDATION_FAILED;
      throw err;
    }
    return val;
  };

  // Health check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // 1. Create Project
  app.post('/api/projects', async (req: Request<{}, {}, CreateProjectRequest>, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = assertObject(req.body);
      const name = assertString(body.name, 'name');
      const idea = assertString(body.idea, 'idea');
      const projectId = body.projectId ? guard.validateProjectId(body.projectId) : undefined;
      const projectTags = Array.isArray(body.projectTags) ? body.projectTags : undefined;
      let targetLocation: string | undefined;

      if (projectId) {
        targetLocation = guard.resolveProjectPath(projectId);
      } else if (body.projectPath) {
        targetLocation = guard.assertContained(guard.projectsDir, body.projectPath, 'Project path');
      }

      const { projectPath: actualPath, snapshot } = await engine.createProject({
        name,
        idea,
        projectId,
        projectTags,
        projectPath: targetLocation,
      });

      await registerProject({
        projectId: snapshot.metadata.projectId,
        name: snapshot.metadata.name,
        stage: snapshot.metadata.stage,
        updatedAt: snapshot.metadata.updatedAt,
        projectPath: actualPath,
      });

      const response: ApiResponse<any> = {
        success: true,
        data: {
          projectId: snapshot.metadata.projectId,
          projectPath: actualPath,
          snapshot,
        },
        stateRevision: snapshot.metadata.stateRevision,
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  // 2. Open Project
  app.post('/api/projects/open', async (req: Request<{}, {}, OpenProjectRequest>, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = assertObject(req.body);
      const { projectId, projectPath } = body;
      if (!projectId && !projectPath) {
        const err: any = new Error('Either "projectId" or "projectPath" is required to open a project');
        err.code = ErrorCode.STATE_VALIDATION_FAILED;
        throw err;
      }

      let targetDir: string;
      if (projectId) {
        const cleanId = guard.validateProjectId(projectId);
        targetDir = guard.resolveProjectPath(cleanId);
      } else {
        targetDir = guard.assertContained(guard.projectsDir, projectPath!, 'Project path');
      }

      if (!(await storage.exists(targetDir))) {
        throw projectNotFoundError(projectId || projectPath!);
      }

      const snapshot = await engine.loadProject(targetDir);
      await registerProject({
        projectId: snapshot.metadata.projectId,
        name: snapshot.metadata.name,
        stage: snapshot.metadata.stage,
        updatedAt: snapshot.metadata.updatedAt,
        projectPath: targetDir,
      });

      res.json({
        success: true,
        data: { snapshot },
        stateRevision: snapshot.metadata.stateRevision,
      });
    } catch (err) {
      next(err);
    }
  });

  // 3. List Recent Projects
  app.get('/api/projects', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await loadRegistry();
      const projects = Array.from(projectRegistry.values()).sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      res.json({
        success: true,
        data: { projects },
      });
    } catch (err) {
      next(err);
    }
  });

  // 4.1 Get Project Full Snapshot
  app.get('/api/projects/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectPath = await resolveProjectLocation(req.params.id as string);
      const snapshot = await engine.getSnapshot(projectPath);
      res.json({
        success: true,
        data: { snapshot },
        stateRevision: snapshot.metadata.stateRevision,
      });
    } catch (err) {
      next(err);
    }
  });

  // 4.2 Get Project Overview View Model (Pure Derived Projection)
  app.get('/api/projects/:id/overview', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectPath = await resolveProjectLocation(req.params.id as string);
      const snapshot = await engine.getSnapshot(projectPath);
      const view = projectOverviewProjection(snapshot);
      res.json({
        success: true,
        data: view,
        stateRevision: snapshot.metadata.stateRevision,
      });
    } catch (err) {
      next(err);
    }
  });

  // 4.3 Get Readiness View Model (Pure Derived Projection)
  app.get('/api/projects/:id/readiness', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectPath = await resolveProjectLocation(req.params.id as string);
      const snapshot = await engine.getSnapshot(projectPath);
      const view = readinessProjection(snapshot);
      res.json({
        success: true,
        data: view,
        stateRevision: snapshot.metadata.stateRevision,
      });
    } catch (err) {
      next(err);
    }
  });

  // 4.4 Get Documents View Model (Pure Derived Projection)
  app.get('/api/projects/:id/documents', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectPath = await resolveProjectLocation(req.params.id as string);
      const snapshot = await engine.getSnapshot(projectPath);
      const view = documentProjection(snapshot);
      res.json({
        success: true,
        data: view,
        stateRevision: snapshot.metadata.stateRevision,
      });
    } catch (err) {
      next(err);
    }
  });

  // 4.5 Get Timeline View Model (Pure Derived Projection)
  app.get('/api/projects/:id/timeline', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectPath = await resolveProjectLocation(req.params.id as string);
      const snapshot = await engine.getSnapshot(projectPath);
      let agentRuns: any[] | undefined;
      const runtimeTraceFile = join(projectPath, 'runtime', 'agent-runs.json');
      if (await storage.exists(runtimeTraceFile)) {
        try {
          agentRuns = await storage.readJson<any[]>(runtimeTraceFile);
        } catch {
          // Non-critical trace read error
        }
      }
      const view = timelineProjection(snapshot, agentRuns);
      res.json({
        success: true,
        data: view,
        stateRevision: snapshot.metadata.stateRevision,
      });
    } catch (err) {
      next(err);
    }
  });

  // 5. Add Input Material
  app.post('/api/projects/:id/inputs', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectPath = await resolveProjectLocation(req.params.id as string);
      const body = assertObject(req.body);
      const filename = assertString(body.filename, 'filename');
      const content = typeof body.content === 'string' ? body.content : '';
      const kind = body.kind || 'text';
      const expectedRevision =
        body.expectedRevision !== undefined
          ? assertInteger(body.expectedRevision, 'expectedRevision')
          : undefined;

      const cleanFilename = guard.validateFilename(filename);
      const contentEncoding =
        body.contentEncoding === 'base64' || body.contentEncoding === 'utf8'
          ? body.contentEncoding
          : undefined;
      const inputRef = await engine.addInput(
        projectPath,
        kind,
        cleanFilename,
        content,
        contentEncoding,
        expectedRevision
      );

      const snapshot = await engine.getSnapshot(projectPath);
      res.json({
        success: true,
        data: { inputRef },
        stateRevision: snapshot.metadata.stateRevision,
      });
    } catch (err) {
      next(err);
    }
  });

  // 6. Confirm Decision (Promote Candidate or Convert Assumption)
  app.post('/api/projects/:id/decisions/confirm', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectPath = await resolveProjectLocation(req.params.id as string);
      const body = assertObject(req.body);
      const targetRef = assertString(body.targetRef, 'targetRef') as TypedRef;
      const expectedRevision = assertInteger(body.expectedRevision, 'expectedRevision');

      const snapshot = await engine.confirmDecision(projectPath, targetRef, expectedRevision);
      res.json({
        success: true,
        data: { snapshot },
        stateRevision: snapshot.metadata.stateRevision,
      });
    } catch (err) {
      next(err);
    }
  });

  // 7. Lock Decision
  app.post('/api/projects/:id/decisions/lock', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectPath = await resolveProjectLocation(req.params.id as string);
      const body = assertObject(req.body);
      const decisionRef = assertString(body.decisionRef, 'decisionRef') as DecisionRef;
      const expectedRevision = assertInteger(body.expectedRevision, 'expectedRevision');

      const snapshot = await engine.lockDecision(projectPath, decisionRef, expectedRevision);
      res.json({
        success: true,
        data: { snapshot },
        stateRevision: snapshot.metadata.stateRevision,
      });
    } catch (err) {
      next(err);
    }
  });

  // 8. Unlock Decision
  app.post('/api/projects/:id/decisions/unlock', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectPath = await resolveProjectLocation(req.params.id as string);
      const body = assertObject(req.body);
      const decisionRef = assertString(body.decisionRef, 'decisionRef') as DecisionRef;
      const expectedRevision = assertInteger(body.expectedRevision, 'expectedRevision');

      const snapshot = await engine.unlockDecision(projectPath, decisionRef, expectedRevision);
      res.json({
        success: true,
        data: { snapshot },
        stateRevision: snapshot.metadata.stateRevision,
      });
    } catch (err) {
      next(err);
    }
  });

  // 9. Edit Overview Item
  app.post('/api/projects/:id/overview/edit', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectPath = await resolveProjectLocation(req.params.id as string);
      const body = assertObject(req.body);
      const sectionId = assertString(body.sectionId, 'sectionId');
      const newStatement = assertString(body.newStatement, 'newStatement');
      const itemRef = body.itemRef ? (assertString(body.itemRef, 'itemRef') as TypedRef) : undefined;
      const expectedRevision = assertInteger(body.expectedRevision, 'expectedRevision');

      if (itemRef) {
        const snap = await engine.getSnapshot(projectPath);
        const item = snap.decisions.items.find((d) => `decision:${d.id}` === itemRef || d.id === itemRef);
        if (item && item.status === 'locked') {
          const err: any = new Error(`Decision "${itemRef}" is locked and cannot be edited directly. Unlock it first.`);
          err.code = ErrorCode.DECISION_LOCKED;
          throw err;
        }
      }

      const { decisionRef, affectedRefs, snapshot } = await engine.editOverviewItem(
        projectPath,
        sectionId,
        itemRef,
        newStatement,
        expectedRevision
      );

      res.json({
        success: true,
        data: { decisionRef, affectedRefs, snapshot },
        stateRevision: snapshot.metadata.stateRevision,
      });
    } catch (err) {
      next(err);
    }
  });

  // 10. Answer Question
  app.post('/api/projects/:id/questions/answer', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectPath = await resolveProjectLocation(req.params.id as string);
      const body = assertObject(req.body);
      const questionRef = assertString(body.questionRef, 'questionRef') as QuestionRef;
      const answer = assertString(body.answer, 'answer');
      const expectedRevision = assertInteger(body.expectedRevision, 'expectedRevision');

      const snapshot = await engine.answerQuestion(
        projectPath,
        questionRef,
        answer,
        expectedRevision
      );
      const lastTrace = snapshot.decisions.traces?.at(-1);
      res.json({
        success: true,
        data: {
          snapshot,
          decisionRef: lastTrace?.decisionRef,
          traceRef: lastTrace?.id,
        },
        stateRevision: snapshot.metadata.stateRevision,
      });
    } catch (err) {
      next(err);
    }
  });

  // 11. Run Discovery Turn
  app.post('/api/projects/:id/discovery', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectPath = await resolveProjectLocation(req.params.id as string);
      const body = assertObject(req.body);
      const userMessage = body.userMessage ? assertString(body.userMessage, 'userMessage') : undefined;
      const expectedRevision = assertInteger(body.expectedRevision, 'expectedRevision');

      const discoveryRes = await orchestrator.runDiscoveryTurn(projectPath, {
        userMessage,
        expectedRevision,
        questionAnswer: body.questionAnswer,
      });

      res.json({
        success: true,
        data: discoveryRes,
        stateRevision: discoveryRes.snapshot.metadata.stateRevision,
      });
    } catch (err) {
      next(err);
    }
  });

  // 12. Evaluate Readiness
  app.post('/api/projects/:id/readiness/review', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectPath = await resolveProjectLocation(req.params.id as string);
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const snap = await engine.getSnapshot(projectPath);
      const expectedRevision =
        body.expectedRevision !== undefined
          ? assertInteger(body.expectedRevision, 'expectedRevision')
          : snap.metadata.stateRevision;

      const snapshot = await engine.evaluateReadiness(projectPath, expectedRevision);
      res.json({
        success: true,
        data: {
          snapshot: snapshot.readiness?.current,
          projectSnapshot: snapshot,
        },
        stateRevision: snapshot.metadata.stateRevision,
      });
    } catch (err) {
      next(err);
    }
  });

  // 13. Approve Readiness / Set Disposition
  app.post('/api/projects/:id/readiness/approve', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectPath = await resolveProjectLocation(req.params.id as string);
      const body = assertObject(req.body);
      const disposition = assertString(body.disposition, 'disposition') as any;
      const expectedRevision = assertInteger(body.expectedRevision, 'expectedRevision');
      const acknowledgedIssueRefs = body.acknowledgedIssueRefs || body.acknowledgements;

      const snapshot = await engine.setUserDisposition(
        projectPath,
        disposition,
        expectedRevision,
        acknowledgedIssueRefs
      );

      res.json({
        success: true,
        data: { snapshot },
        stateRevision: snapshot.metadata.stateRevision,
      });
    } catch (err) {
      next(err);
    }
  });

  // 14. Generate Documents
  app.post('/api/projects/:id/documents/generate', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectPath = await resolveProjectLocation(req.params.id as string);
      const body = assertObject(req.body);
      const expectedRevision = assertInteger(body.expectedRevision, 'expectedRevision');

      const result = await orchestrator.compileDocuments(projectPath, expectedRevision);
      const finalSnapshot = await engine.getSnapshot(projectPath);

      res.json({
        success: true,
        data: { manifest: result.manifest },
        stateRevision: finalSnapshot.metadata.stateRevision,
      });
    } catch (err) {
      next(err);
    }
  });

  // 15. Read Document
  app.post('/api/projects/:id/documents/read', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectPath = await resolveProjectLocation(req.params.id as string);
      const body = assertObject(req.body);
      const docPath = assertString(body.docPath, 'docPath');
      
      const snapshot = await engine.getSnapshot(projectPath);
      const registeredPaths = (snapshot.documents?.items || []).map((item) => item.path);

      if (!registeredPaths.includes(docPath)) {
        const err: any = new Error(
          `Access denied: path "${docPath}" is not a registered specification document.`
        );
        err.code = ErrorCode.ACCESS_DENIED;
        throw err;
      }

      const safePath = guard.assertContained(resolve(projectPath), join(projectPath, docPath), 'Document path');
      if (!(await storage.exists(safePath))) {
        const err: any = new Error(`Document file not found on disk at path: ${docPath}`);
        err.code = ErrorCode.STATE_VALIDATION_FAILED;
        throw err;
      }

      const content = await storage.readText(safePath);
      res.json({
        success: true,
        data: { content },
      });
    } catch (err) {
      next(err);
    }
  });

  // Global Error Handler & Status Code Mapping
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const isCorsError = err.message?.includes('CORS policy blocked');
    const code = isCorsError
      ? ErrorCode.STATE_VALIDATION_FAILED
      : err.code || ErrorCode.STATE_VALIDATION_FAILED;

    const statusCode = getHttpStatus(err);

    // Sanitize details to ensure raw envelope / internal diagnostics / absolute paths are NEVER leaked
    let details = err.details;
    if (details && typeof details === 'object') {
      const sanitized = { ...details };
      delete sanitized.rawEnvelope;
      delete sanitized.rawDiagnostics;
      delete sanitized.prompt;
      delete sanitized.stack;
      details = Object.keys(sanitized).length > 0 ? sanitized : undefined;
    }

    res.status(statusCode).json({
      success: false,
      error: {
        code,
        message: err.message || 'Internal server error',
        recoverable: err.recoverable ?? true,
        details,
      },
    });
  });

  return app;
}

function getHttpStatus(err: any): number {
  if (err.message?.includes('CORS policy blocked')) return 403;
  const code = err.code as ErrorCode;
  switch (code) {
    case ErrorCode.PROJECT_NOT_FOUND:
      return 404;
    case ErrorCode.ACCESS_DENIED:
      return 403;
    case ErrorCode.STATE_REVISION_CONFLICT:
      return 409;
    case ErrorCode.READINESS_NOT_APPROVED:
    case ErrorCode.DECISION_LOCKED:
      return 422;
    case ErrorCode.PROVIDER_TIMEOUT:
      return 504;
    case ErrorCode.PROVIDER_NOT_AVAILABLE:
    case ErrorCode.PROVIDER_PROCESS_FAILED:
    case ErrorCode.STRUCTURED_OUTPUT_MISSING:
    case ErrorCode.SCHEMA_VALIDATION_FAILED:
      return 502;
    case ErrorCode.STATE_COMMIT_FAILED:
    case ErrorCode.STATE_RECOVERY_REQUIRED:
    case ErrorCode.DOCUMENT_GENERATION_FAILED:
      return 500;
    case ErrorCode.STATE_VALIDATION_FAILED:
    case ErrorCode.INVALID_TYPED_REF:
    case ErrorCode.INPUT_TOO_LARGE:
    case ErrorCode.INPUT_UNSUPPORTED:
    case ErrorCode.INPUT_EXTRACTION_FAILED:
      return 400;
    default:
      return 500;
  }
}

function projectNotFoundError(projectId: string): Error {
  const err: any = new Error(`Project ${projectId} is not open or registered`);
  err.code = ErrorCode.PROJECT_NOT_FOUND;
  return err;
}
