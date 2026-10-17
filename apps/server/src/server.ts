import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { dirname, join, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { platform } from 'node:os';
import { promises as fsp, existsSync, readFileSync } from 'node:fs';
import {
  ProjectStateEngine,
  WorkspaceGuard,
  FileStorage,
  DiscoveryTurnStore,
  projectOverviewProjection,
  readinessProjection,
  documentProjection,
  timelineProjection,
  projectDiscoveryProgressProjection,
  ProjectForkService,
  ProjectTrashService,
  DocumentExportService,
  DocumentDiffEngine,
  DocumentCompiler,
  ProjectExportImportService,
  PresetRegistry,
  DecisionGraphProjection,
  AreaRegistry,
  StandaloneHtmlExporter,
  CodebaseScanner,
  PlanningError,
} from '@project-architect/core';
import { AIOrchestrator, MockAIProvider, AntigravityCliProvider } from '@project-architect/agent';
import { DiscoveryJobManager } from './DiscoveryJobManager.js';
import { DocumentExtractor } from './extractors/DocumentExtractor.js';
import { PlanningRuntime } from './planning/PlanningRuntime.js';
import { createPlanningRoutes } from './planning/PlanningRoutes.js';
import { PlanningPackageCompiler } from './planning/PlanningPackageCompiler.js';
import { planningDiagnostics, planningHistoricalDocument, planningHistory } from './planning/PlanningDiagnostics.js';
import {
  ErrorCode,
  type ApiResponse,
  type CreateProjectRequest,
  type OpenProjectRequest,
  type RecentProjectItem,
  type TypedRef,
  type DecisionRef,
  type QuestionRef,
  type DiscoveryJobView,
  type AgentRunTrace,
  type RetractQuestionRequest,
  type RetractQuestionResponse,
  type ValidatePathRequest,
  type ValidatePathResponse,
  type FsDirectoryItem,
  type ListDirectoriesResponse,
  type BrownfieldCandidateDecision,
} from '@project-architect/contracts';

export interface ServerOptions {
  engine?: ProjectStateEngine;
  orchestrator?: AIOrchestrator;
  guard?: WorkspaceGuard;
  workspaceRoot?: string;
  projectsDir?: string;
  useMockAI?: boolean;
  discoveryJobs?: DiscoveryJobManager;
  planningRuntime?: PlanningRuntime;
}

/**
 * Resolves the repository root independently from process.cwd().
 * The packaged server is launched from apps/server, while active B3 assets and
 * historical benchmark evidence live under the repository-level experiments folder.
 */
export function resolveRepositoryRoot(moduleDirectory: string = dirname(fileURLToPath(import.meta.url))): string {
  return resolve(moduleDirectory, '..', '..', '..');
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
  const retiredWorkflow = (_req: Request, res: Response): void => {
    res.status(410).json({ success: false, error: { code: ErrorCode.LEGACY_WORKFLOW_RETIRED, message: '旧准备度写入、动态图与推断式审计已停用；请使用规划工作区。', recoverable: false } });
  };
  app.post(['/api/projects/:id/readiness/review', '/api/projects/:id/readiness/approve', '/api/projects/:id/verify-drift'], retiredWorkflow);
  app.get('/api/projects/:id/diagrams', retiredWorkflow);
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  const guard =
    options.guard ||
    new WorkspaceGuard(options.workspaceRoot || options.projectsDir);
  const storage = new FileStorage();
  const engine = options.engine || new ProjectStateEngine(storage, guard);
  const useMock = options.useMockAI ?? (process.env.USE_MOCK_AI === 'true' || process.env.USE_MOCK_AI === '1');
  const provider = useMock ? new MockAIProvider() : new AntigravityCliProvider(process.env.AGY_CLI);
  const orchestrator =
    options.orchestrator || new AIOrchestrator(provider, engine, resolveRepositoryRoot(), storage);
  const turnStore = new DiscoveryTurnStore(storage);
  const planningRuntime = options.planningRuntime || new PlanningRuntime(engine,provider);
  const planningConfigPath = join(guard.workspaceRoot,'planning-config.json');
  try {
    planningRuntime.configure(JSON.parse(readFileSync(planningConfigPath,'utf8')));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw new Error(`规划运行配置无法加载，请修复或恢复 ${planningConfigPath}：${String(error)}`, { cause: error });
    }
  }
  const discoveryJobs =
    options.discoveryJobs ||
    new DiscoveryJobManager(
      orchestrator,
      (projectPath) => engine.getSnapshot(projectPath),
      turnStore,
      engine
    );

  const withPendingAnswerCount = async (
    projectPath: string,
    snapshot: any,
    job: DiscoveryJobView,
  ): Promise<DiscoveryJobView> => {
    const traceFile = join(projectPath, 'runtime', 'agent-runs.json');
    let lastDiscoveryCompletedAt: string | undefined;
    if (await storage.exists(traceFile)) {
      try {
        const traces = await storage.readJson<AgentRunTrace[]>(traceFile);
        lastDiscoveryCompletedAt = traces.at(-1)?.completedAt;
      } catch {
        // A damaged observability file must never block user decisions or job polling.
      }
    }
    const pendingAnswerCount = snapshot.questions.items.filter((question: any) =>
      question.status === 'answered' &&
      question.answeredAt &&
      (!lastDiscoveryCompletedAt || question.answeredAt > lastDiscoveryCompletedAt)
    ).length;
    return { ...job, pendingAnswerCount };
  };

  // Persistent project registry in workspace root
  const registryFile = join(guard.workspaceRoot, '.projects-registry.json');
  const projectRegistry = new Map<string, RecentProjectItem>();
  let registryLoadError: unknown;

  const loadRegistry = async (): Promise<void> => {
    try {
      const items: unknown = JSON.parse(await fsp.readFile(registryFile, 'utf8'));
      if (!Array.isArray(items) || !items.every(item => item && typeof item.projectId === 'string' && typeof item.projectPath === 'string')) throw new PlanningError('STATE_VALIDATION_FAILED', '项目注册记录无效');
      for (const item of items) projectRegistry.set(item.projectId, item);
    } catch (error) {
      // Ordinary startup remains tolerant; read-only diagnostics disclose the failure.
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') registryLoadError = error;
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
  const registryReady = loadRegistry();

  const registerProject = async (item: RecentProjectItem): Promise<void> => {
    projectRegistry.set(item.projectId, item);
    await saveRegistry();
  };

  const resolveProjectLocation = async (rawId: string, options?: { allowTrashed?: boolean }): Promise<string> => {
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
    if (entry.trashedAt && !options?.allowTrashed) {
      const err: any = new Error(`Project "${cleanId}" is in the recycle bin. Please restore it first.`);
      err.code = ErrorCode.STATE_VALIDATION_FAILED;
      err.recoverable = true;
      throw err;
    }
    return entry.projectPath;
  };

  // Resolve a registered or canonical directory without loading/recovering state
  // or discovering/writing registry entries. The caller validates its exact
  // source under the Core lock; trashed projects remain excluded.
  const resolveProjectLocationReadOnly = async (rawId: string, registeredLocation = false): Promise<string> => {
    await registryReady;
    if (registeredLocation && registryLoadError) throw registryLoadError;
    const cleanId = guard.validateProjectId(rawId);
    const entry = projectRegistry.get(cleanId);
    if (entry?.trashedAt) {
      const error = new Error(`Project "${cleanId}" is in the recycle bin. Please restore it first.`) as Error & { code: string };
      error.code = ErrorCode.STATE_VALIDATION_FAILED;
      throw error;
    }
    const path = entry
      ? registeredLocation ? resolve(entry.projectPath) : guard.assertContained(guard.projectsDir, entry.projectPath, 'Transfer project path')
      : guard.resolveProjectPath(cleanId);
    try { if (!(await fsp.stat(path)).isDirectory()) throw projectNotFoundError(cleanId); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw projectNotFoundError(cleanId); throw error; }
    return path;
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

  // Architectural Seed Presets
  app.get('/api/presets', (_req: Request, res: Response): void => {
    res.json({
      success: true,
      data: PresetRegistry.getAll(),
    });
  });

  app.get('/api/presets/:id', (req: Request, res: Response, next: NextFunction): void => {
    try {
      const preset = PresetRegistry.getById(req.params.id as string);
      if (!preset) {
        const err: any = new Error(`Preset '${req.params.id}' not found.`);
        err.code = ErrorCode.STATE_VALIDATION_FAILED;
        throw err;
      }
      res.json({
        success: true,
        data: preset,
      });
    } catch (err) {
      next(err);
    }
  });

  // 1. Create Project
  app.post('/api/projects', async (req: Request<{}, {}, CreateProjectRequest>, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = assertObject(req.body);
      const name = assertString(body.name, 'name');
      const rawIdea = typeof body.idea === 'string' && body.idea.trim() ? body.idea : undefined;
      const rawIntent = body.initialIntent && typeof body.initialIntent === 'object'
        ? {
            targetUser: (assertString(body.initialIntent.targetUser, 'initialIntent.targetUser'), body.initialIntent.targetUser),
            coreProblem: (assertString(body.initialIntent.coreProblem, 'initialIntent.coreProblem'), body.initialIntent.coreProblem),
            desiredOutcome: (assertString(body.initialIntent.desiredOutcome, 'initialIntent.desiredOutcome'), body.initialIntent.desiredOutcome),
            constraints: typeof body.initialIntent.constraints === 'string' && body.initialIntent.constraints.trim()
              ? body.initialIntent.constraints
              : undefined,
          }
        : undefined;

      const rawPresetId = typeof body.presetId === 'string' && body.presetId.trim() ? body.presetId.trim() : undefined;
      const matchedPreset = rawPresetId ? PresetRegistry.getById(rawPresetId) : undefined;
      const effectiveIdea = rawIdea || (matchedPreset ? `${matchedPreset.name} — ${matchedPreset.description}` : undefined);

      if (!effectiveIdea && !rawIntent && body.materialOnly!==true) {
        const err: any = new Error('Either idea, presetId, or initialIntent (targetUser, coreProblem, desiredOutcome) must be provided.');
        err.code = ErrorCode.STATE_VALIDATION_FAILED;
        throw err;
      }

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
        idea: effectiveIdea,
        materialOnly:body.materialOnly===true,
        initialIntent: rawIntent,
        presetId: rawPresetId,
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
  app.get('/api/projects', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await loadRegistry();
      const includeTrashed = req.query.includeTrashed === 'true';
      const projects = Array.from(projectRegistry.values())
        .filter((p) => includeTrashed || !p.trashedAt)
        .sort((a, b) => {
          // Pinned projects first
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });
      res.json({
        success: true,
        data: { projects },
      });
    } catch (err) {
      next(err);
    }
  });

  // 3.1 Rename Project
  app.post('/api/projects/:id/rename', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectPath = await resolveProjectLocation(req.params.id as string);
      const body = assertObject(req.body);
      const newName = assertString(body.name, 'name');
      const expectedRevision =
        body.expectedRevision !== undefined ? assertInteger(body.expectedRevision, 'expectedRevision') : undefined;

      const updatedSnapshot = await engine.renameProject(projectPath, newName, expectedRevision);
      const cleanId = updatedSnapshot.metadata.projectId;
      const existing = projectRegistry.get(cleanId);
      const updatedItem: RecentProjectItem = {
        projectId: cleanId,
        name: updatedSnapshot.metadata.name,
        stage: updatedSnapshot.metadata.stage,
        updatedAt: updatedSnapshot.metadata.updatedAt,
        projectPath,
        isPinned: existing?.isPinned,
        isArchived: existing?.isArchived,
      };
      await registerProject(updatedItem);

      res.json({
        success: true,
        data: { project: updatedItem },
        stateRevision: updatedSnapshot.metadata.stateRevision,
      });
    } catch (err) {
      next(err);
    }
  });

  // 3.2 Duplicate Project (Fork Idea)
  app.post('/api/projects/:id/duplicate', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sourcePath = await resolveProjectLocationReadOnly(req.params.id as string);
      const body = req.body || {};
      const newName = body.newName === undefined ? undefined : assertString(body.newName, 'newName');
      const newProjectId = `${guard.validateProjectId(req.params.id as string)}-fork-${Date.now().toString(36).slice(-4)}`;

      const forkResult = await ProjectForkService.forkProject({
        sourcePath,
        newName,
        newProjectId,
        storage,
        guard,
        engine,
      });

      const newItem: RecentProjectItem = {
        projectId: forkResult.newProjectId,
        name: forkResult.snapshot.metadata.name,
        stage: forkResult.snapshot.metadata.stage,
        updatedAt: forkResult.snapshot.metadata.updatedAt,
        projectPath: forkResult.targetPath,
        isPinned: false,
        isArchived: false,
      };
      await registerProject(newItem);

      res.json({
        success: true,
        data: { project: newItem },
        stateRevision: forkResult.snapshot.metadata.stateRevision,
      });
    } catch (err) {
      next(err);
    }
  });

  // 3.3 Toggle Archive
  app.post('/api/projects/:id/archive', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const cleanId = guard.validateProjectId(req.params.id as string);
      let entry = projectRegistry.get(cleanId);
      if (!entry) {
        await resolveProjectLocation(cleanId);
        entry = projectRegistry.get(cleanId);
      }
      if (!entry) throw projectNotFoundError(cleanId);

      const isArchived = !entry.isArchived;
      entry.isArchived = isArchived;
      await registerProject(entry);

      res.json({
        success: true,
        data: { projectId: cleanId, isArchived },
      });
    } catch (err) {
      next(err);
    }
  });

  // 3.4 Toggle Pin
  app.post('/api/projects/:id/pin', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const cleanId = guard.validateProjectId(req.params.id as string);
      let entry = projectRegistry.get(cleanId);
      if (!entry) {
        await resolveProjectLocation(cleanId);
        entry = projectRegistry.get(cleanId);
      }
      if (!entry) throw projectNotFoundError(cleanId);

      const isPinned = !entry.isPinned;
      entry.isPinned = isPinned;
      await registerProject(entry);

      res.json({
        success: true,
        data: { projectId: cleanId, isPinned },
      });
    } catch (err) {
      next(err);
    }
  });

  // 3.5 Move Project to Trash (Recoverable Delete)
  app.delete('/api/projects/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const cleanId = guard.validateProjectId(req.params.id as string);
      const projectPath = await resolveProjectLocation(cleanId);

      const trashResult = await ProjectTrashService.moveToTrash({
        projectId: cleanId,
        projectPath,
        storage,
        guard,
      });

      let entry = projectRegistry.get(cleanId);
      if (entry) {
        entry.trashedAt = trashResult.trashedAt;
        entry.trashPath = trashResult.trashPath;
        entry.originalPath = projectPath;
        entry.projectPath = trashResult.trashPath;
      } else {
        entry = {
          projectId: cleanId,
          name: cleanId,
          stage: 'created',
          updatedAt: trashResult.trashedAt,
          projectPath: trashResult.trashPath,
          trashedAt: trashResult.trashedAt,
          trashPath: trashResult.trashPath,
          originalPath: projectPath,
        };
        projectRegistry.set(cleanId, entry);
      }
      await saveRegistry();

      res.json({
        success: true,
        data: {
          projectId: cleanId,
          deleted: true,
          trashed: true,
          trashPath: trashResult.trashPath,
          trashedAt: trashResult.trashedAt,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // 3.5.1 Restore Project from Trash
  app.post('/api/projects/:id/restore', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const cleanId = guard.validateProjectId(req.params.id as string);
      let entry = projectRegistry.get(cleanId);
      let trashPath = entry?.trashPath;

      if (!trashPath) {
        // Look in .trash directory for latest matching folder
        if (await storage.exists(guard.trashDir)) {
          const files = await storage.listFiles(guard.trashDir);
          const matches = files
            .filter((f) => f.startsWith(`${cleanId}-`))
            .sort()
            .reverse();
          if (matches.length > 0 && matches[0]) {
            trashPath = join(guard.trashDir, matches[0]);
          }
        }
      }

      if (!trashPath || !(await storage.exists(trashPath))) {
        const err: any = new Error(`Cannot restore: project "${cleanId}" not found in trash.`);
        err.code = ErrorCode.STATE_RECOVERY_REQUIRED;
        throw err;
      }

      const body = req.body || {};
      const targetPath = body.targetPath;

      const restoreResult = await ProjectTrashService.restoreFromTrash({
        projectId: cleanId,
        trashPath,
        targetPath,
        storage,
        guard,
      });

      const restoredSnapshot = await engine.loadProject(restoreResult.projectPath);

      const updatedItem: RecentProjectItem = {
        projectId: cleanId,
        name: restoredSnapshot.metadata.name,
        stage: restoredSnapshot.metadata.stage,
        updatedAt: new Date().toISOString(),
        projectPath: restoreResult.projectPath,
        isPinned: entry?.isPinned || false,
        isArchived: entry?.isArchived || false,
      };
      await registerProject(updatedItem);

      res.json({
        success: true,
        data: { project: updatedItem },
      });
    } catch (err) {
      next(err);
    }
  });

  // 3.5.2 Purge Project Permanently from Trash
  app.delete('/api/projects/:id/purge', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const cleanId = guard.validateProjectId(req.params.id as string);
      const entry = projectRegistry.get(cleanId);
      const trashPath = entry?.trashPath;

      if (!trashPath) {
        // Look in .trash directory for matching folders
        if (await storage.exists(guard.trashDir)) {
          const files = await storage.listFiles(guard.trashDir);
          const matches = files.filter((f) => f.startsWith(`${cleanId}-`));
          for (const match of matches) {
            const p = join(guard.trashDir, match);
            await ProjectTrashService.purgeFromTrash({ trashPath: p, storage, guard });
          }
        }
      } else {
        await ProjectTrashService.purgeFromTrash({ trashPath, storage, guard });
      }

      projectRegistry.delete(cleanId);
      await saveRegistry();

      res.json({
        success: true,
        data: { projectId: cleanId, purged: true },
      });
    } catch (err) {
      next(err);
    }
  });

  // 3.6 Open in Local Folder / Explorer
  app.post('/api/projects/:id/open-folder', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectPath = await resolveProjectLocation(req.params.id as string);
      let opened = false;
      const osPlatform = platform();

      if (osPlatform === 'win32') {
        execFile('explorer.exe', [projectPath], () => {});
        opened = true;
      } else if (osPlatform === 'darwin') {
        execFile('open', [projectPath], () => {});
        opened = true;
      }

      res.json({
        success: true,
        data: { projectId: req.params.id, projectPath, opened },
      });
    } catch (err) {
      next(err);
    }
  });

  // 3.7 Provider Health & Diagnostics
  app.get('/api/provider/health', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const activeProvider = orchestrator.getProvider();
      const health = await activeProvider.healthCheck();
      res.json({
        success: true,
        data: {
          ...health,
          modelName: health.modelName || 'Unknown Model',
          isLocal: health.inferenceLocation === 'local',
          details: health.guidance,
          health,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // 3.8 Material Context Exclusion Toggle
  app.post('/api/projects/:id/inputs/:inputId/toggle', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectPath = await resolveProjectLocation(req.params.id as string);
      const inputId = req.params.inputId as string;
      const body = req.body || {};
      const updatedRef = await engine.toggleInputExclusion(
        projectPath,
        inputId,
        body.exclude,
        body.expectedRevision
      );
      res.json({
        success: true,
        data: { inputId: updatedRef.id, status: updatedRef.status },
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
        data: { ...view, historical: true, source: 'legacy-readiness-state' },
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

  // 4.6 Get Decision Dependency DAG (Pure Derived Projection)
  app.get('/api/projects/:id/dag', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectPath = await resolveProjectLocation(req.params.id as string);
      const snapshot = await engine.getSnapshot(projectPath);
      const dag = DecisionGraphProjection.project(snapshot.decisions?.items || [], AreaRegistry.getAllDefinitions());
      res.json({
        success: true,
        data: dag,
        stateRevision: snapshot.metadata.stateRevision,
      });
    } catch (err) {
      next(err);
    }
  });

  // 4.7 Get Decision Cascade Impact
  app.get('/api/projects/:id/dag/impact', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectPath = await resolveProjectLocation(req.params.id as string);
      const snapshot = await engine.getSnapshot(projectPath);
      const decisionId = typeof req.query.decisionId === 'string' ? req.query.decisionId : '';
      const impact = DecisionGraphProjection.computeCascadeImpact(
        snapshot.decisions?.items || [],
        decisionId,
        AreaRegistry.getAllDefinitions()
      );
      res.json({
        success: true,
        data: impact,
        stateRevision: snapshot.metadata.stateRevision,
      });
    } catch (err) {
      next(err);
    }
  });

  // 4.89 Brownfield Stateless Codebase Reverse Scan (Pre-Project Scan / Onboarding)
  app.post('/api/brownfield/scan', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = assertObject(req.body);
      const targetPath = assertString(body.path, 'path');
      const maxFiles = body.maxFiles !== undefined ? assertInteger(body.maxFiles, 'maxFiles') : 500;

      const analysis = await CodebaseScanner.scan(targetPath, { maxFiles });
      res.json({
        success: true,
        data: analysis,
      });
    } catch (err) {
      next(err);
    }
  });

  // 4.9 Brownfield Codebase Reverse Scan (方案 4)
  app.post('/api/projects/:id/brownfield/scan', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = assertObject(req.body);
      const targetPath = assertString(body.path, 'path');
      const maxFiles = body.maxFiles !== undefined ? assertInteger(body.maxFiles, 'maxFiles') : 500;

      const analysis = await CodebaseScanner.scan(targetPath, { maxFiles });
      res.json({
        success: true,
        data: analysis,
      });
    } catch (err) {
      next(err);
    }
  });

  // 4.95 Ingest Brownfield Candidates (方案 4 — User Authority First)
  app.post('/api/projects/:id/brownfield/apply', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectPath = await resolveProjectLocation(req.params.id as string);
      const body = assertObject(req.body);
      if (!Array.isArray(body.candidateDecisions)) {
        throw new Error('candidateDecisions must be an array');
      }
      const candidates = body.candidateDecisions as BrownfieldCandidateDecision[];
      const expectedRevision =
        body.expectedRevision !== undefined
          ? assertInteger(body.expectedRevision, 'expectedRevision')
          : undefined;

      const snapshot = await engine.ingestBrownfieldCandidates(projectPath, candidates, expectedRevision);
      res.json({
        success: true,
        data: {
          appliedCount: candidates.length,
          snapshot,
        },
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

      const ext = extname(cleanFilename).toLowerCase();
      let extractedText: string | undefined;
      if (ext === '.pdf' || ext === '.docx') {
        try {
          const fileBuffer = contentEncoding === 'base64'
            ? Buffer.from(content.replace(/\s/g, '').replace(/^data:.*?;base64,/, ''), 'base64')
            : Buffer.from(content, 'utf8');
          const extraction = await DocumentExtractor.extractDocumentSafely(fileBuffer, ext);
          if (extraction.success && extraction.text) {
            extractedText = extraction.text;
          }
        } catch {
          // Extractor errors are safely caught; fallback to unextracted status
        }
      }

      const inputRef = await engine.addInput(
        projectPath,
        kind,
        cleanFilename,
        content,
        contentEncoding,
        expectedRevision,
        extractedText
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

  // 9.1 Deprecate Decision
  app.post('/api/projects/:id/decisions/deprecate', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectPath = await resolveProjectLocation(req.params.id as string);
      const body = assertObject(req.body);
      const decisionRef = assertString(body.decisionRef, 'decisionRef') as DecisionRef;
      const expectedRevision = assertInteger(body.expectedRevision, 'expectedRevision');

      const { deprecatedRef, snapshot } = await engine.deprecateDecision(
        projectPath,
        decisionRef,
        expectedRevision
      );

      res.json({
        success: true,
        data: { deprecatedRef, snapshot },
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

  // 10.1 Dismiss unanswered advisory questions without creating decisions.
  app.post('/api/projects/:id/questions/dismiss', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectPath = await resolveProjectLocation(req.params.id as string);
      const body = assertObject(req.body);
      if (!Array.isArray(body.questionRefs) || body.questionRefs.length === 0) {
        throw new Error('questionRefs must be a non-empty array.');
      }
      const questionRefs = body.questionRefs.map((value: unknown, index: number) =>
        assertString(value, `questionRefs[${index}]`) as QuestionRef
      );
      const expectedRevision = assertInteger(body.expectedRevision, 'expectedRevision');
      const snapshot = await engine.dismissQuestions(projectPath, questionRefs, expectedRevision);
      res.json({
        success: true,
        data: { snapshot },
        stateRevision: snapshot.metadata.stateRevision,
      });
    } catch (err) {
      next(err);
    }
  });

  // 10.2 Answer Question as an active Assumption instead of a Confirmed Decision
  app.post('/api/projects/:id/questions/answer-assumption', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectPath = await resolveProjectLocation(req.params.id as string);
      const body = assertObject(req.body);
      const questionRef = assertString(body.questionRef, 'questionRef') as QuestionRef;
      const assumptionStatement = assertString(body.assumptionStatement, 'assumptionStatement');
      const rationale = body.rationale ? assertString(body.rationale, 'rationale') : undefined;
      const expectedRevision = assertInteger(body.expectedRevision, 'expectedRevision');

      const { assumptionRef, snapshot } = await engine.answerQuestionAsAssumption(
        projectPath,
        questionRef,
        assumptionStatement,
        expectedRevision,
        rationale
      );

      res.json({
        success: true,
        data: {
          assumptionRef,
          snapshot,
        },
        stateRevision: snapshot.metadata.stateRevision,
      });
    } catch (err) {
      next(err);
    }
  });

  // 10.3 Retract Question Answer (Undo Answer with 4-way cascading consistency)
  app.post('/api/projects/:id/questions/retract', async (req: Request<{ id: string }, {}, RetractQuestionRequest>, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectPath = await resolveProjectLocation(req.params.id as string);
      const body = assertObject(req.body);
      const questionRef = assertString(body.questionRef, 'questionRef') as QuestionRef;
      const expectedRevision = assertInteger(body.expectedRevision, 'expectedRevision');

      const { snapshot, reopenedGapRef } = await engine.retractQuestion(
        projectPath,
        questionRef,
        expectedRevision
      );

      const response: ApiResponse<RetractQuestionResponse> = {
        success: true,
        data: {
          snapshot,
          retractedQuestionId: questionRef,
          reopenedGapRef,
        },
        stateRevision: snapshot.metadata.stateRevision,
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  // 11. Run Discovery Turn
  // Historic readers remain available. Production AI mutations use only PlanningRuntime.
  app.use('/api/projects/:id/discovery', (req:Request,res:Response,next:NextFunction) => {
    if(req.method==='POST'&&!useMock&&!options.orchestrator){res.status(410).json({success:false,error:{code:'LEGACY_WORKFLOW_RETIRED',message:'请使用规划工作区；旧探索写入接口已经停用。',details:{replacement:'/api/projects/:id/planning/runs'}}});return;}next();
  });
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

  // 11.0 Record Discovery User Free Input (pre-persistence before scheduling job)
  app.post('/api/projects/:id/discovery/inputs', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectId = guard.validateProjectId(req.params.id as string);
      const projectPath = await resolveProjectLocation(projectId);
      const body = assertObject(req.body);
      const text = assertString(body.text, 'text');
      const snap = await engine.getSnapshot(projectPath);
      const expectedRevision =
        body.expectedRevision !== undefined
          ? assertInteger(body.expectedRevision, 'expectedRevision')
          : snap.metadata.stateRevision;
      const clientTurnId = typeof body.clientTurnId === 'string' && body.clientTurnId.trim()
        ? body.clientTurnId.trim()
        : undefined;

      const result = await engine.recordDiscoveryInput(projectPath, text, expectedRevision, clientTurnId);
      res.status(201).json({
        success: true,
        data: {
          inputRef: result.inputRef,
          turnId: result.turnId,
          snapshot: result.snapshot,
        },
        stateRevision: result.snapshot.metadata.stateRevision,
      });
    } catch (err) {
      next(err);
    }
  });

  // 11.1 Queue one non-blocking discovery turn using the latest persisted user decisions.
  app.post('/api/projects/:id/discovery/jobs', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectId = guard.validateProjectId(req.params.id as string);
      const projectPath = await resolveProjectLocation(projectId);
      const body = assertObject(req.body);
      const expectedRevision = assertInteger(body.expectedRevision, 'expectedRevision');
      const userMessage = body.userMessage ? assertString(body.userMessage, 'userMessage') : undefined;
      const turnId = body.turnId ? assertString(body.turnId, 'turnId') : undefined;
      const allowRebase = body.allowRebase === true;
      const job = await discoveryJobs.schedule(projectId, projectPath, expectedRevision, userMessage, turnId, allowRebase);
      const snapshot = await engine.getSnapshot(projectPath);
      res.json({ success: true, data: { job: await withPendingAnswerCount(projectPath, snapshot, job) }, stateRevision: snapshot.metadata.stateRevision });
    } catch (err) {
      next(err);
    }
  });

  // 11.2 Poll the current local background discovery status. This is read-only.
  app.get('/api/projects/:id/discovery/jobs/current', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectId = guard.validateProjectId(req.params.id as string);
      const projectPath = await resolveProjectLocation(projectId);
      const snapshot = await engine.getSnapshot(projectPath);
      res.json({ success: true, data: { job: await withPendingAnswerCount(projectPath, snapshot, discoveryJobs.get(projectId)) }, stateRevision: snapshot.metadata.stateRevision });
    } catch (err) {
      next(err);
    }
  });

  // 11.3 Cancel a queued or running background discovery turn. User decisions remain persisted.
  app.post('/api/projects/:id/discovery/jobs/cancel', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectId = guard.validateProjectId(req.params.id as string);
      const projectPath = await resolveProjectLocation(projectId);
      const snapshot = await engine.getSnapshot(projectPath);
      const job = discoveryJobs.cancel(projectId);
      res.json({ success: true, data: { job: await withPendingAnswerCount(projectPath, snapshot, job) }, stateRevision: snapshot.metadata.stateRevision });
    } catch (err) {
      next(err);
    }
  });

  // 11.4 Get Discovery Turn History
  app.get('/api/projects/:id/discovery/turns', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectId = guard.validateProjectId(req.params.id as string);
      const projectPath = await resolveProjectLocation(projectId);
      const turns = await engine.getDiscoveryTurns(projectPath);
      const snapshot = await engine.getSnapshot(projectPath);
      res.json({
        success: true,
        data: { turns },
        stateRevision: snapshot.metadata.stateRevision,
      });
    } catch (err) {
      next(err);
    }
  });

  // 11.5 Get Unified Discovery Progress View
  app.get('/api/projects/:id/discovery/progress', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectId = guard.validateProjectId(req.params.id as string);
      const projectPath = await resolveProjectLocation(projectId);
      const snapshot = await engine.getSnapshot(projectPath);
      const progress = projectDiscoveryProgressProjection(snapshot);
      res.json({
        success: true,
        data: { progress },
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
      const operationId = assertString(body.operationId, 'operationId');
      const manifest = await new PlanningPackageCompiler(planningRuntime.service).compile(projectPath, expectedRevision, operationId);
      res.json({ success: true, data: { manifest, snapshot: await planningRuntime.service.get(projectPath) }, stateRevision: manifest.revision });
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

  // 16. Export Documents as Atomic ZIP
  app.get('/api/projects/:id/documents/export-zip', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectPath = await resolveProjectLocation(req.params.id as string);
      const exportService = new DocumentExportService(storage);
      const result = await exportService.exportZip(projectPath);

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(req.params.id as string)}-documents.zip"`
      );
      res.setHeader('Content-Length', result.totalBytes);
      res.end(result.zipBuffer);
    } catch (err) {
      next(err);
    }
  });

  // 16.05 Export Single-File Interactive HTML Specification Bundle (方案 11)
  app.get('/api/projects/:id/documents/export-html', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectPath = await resolveProjectLocation(req.params.id as string);
      const snapshot = await engine.getSnapshot(projectPath);

      // Collect on-disk documents
      const docs: Array<{ path: string; title: string; content: string }> = [];
      const registeredDocs = snapshot.documents?.items || [];

      for (const item of registeredDocs) {
        const absPath = join(projectPath, item.path);
        if (await storage.exists(absPath)) {
          const content = await storage.readText(absPath);
          docs.push({
            path: item.path,
            title: item.title,
            content,
          });
        }
      }

      // If no on-disk documents yet, fallback to in-memory compile
      if (docs.length === 0) {
        if(!useMock&&!options.orchestrator)throw new PlanningError('PACKAGE_INCOMPLETE','尚无历史文档；请先批准三阶段方案并从开发包入口导出');
        const compiler = new DocumentCompiler(storage);
        const compiled = await compiler.compile(projectPath, snapshot, undefined, false, { isDraft: true });
        for (const f of compiled.renderedFiles) {
          const item = compiled.manifest.items.find((m) => m.path === f.path);
          docs.push({
            path: f.path,
            title: item?.title || f.path,
            content: f.content,
          });
        }
      }

      // Generate dynamic diagrams & DAG for inclusion
      const diagrams: [] = []; // Historical export includes only saved document content.
      const dag = DecisionGraphProjection.project(snapshot.decisions?.items || [], AreaRegistry.getAllDefinitions());

      const result = StandaloneHtmlExporter.export({
        snapshot,
        documents: docs,
        diagrams,
        dag,
      });

      if (req.query.format === 'json') {
        res.json({
          success: true,
          data: result,
        });
        return;
      }

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.setHeader('Content-Length', result.sizeBytes);
      res.send(result.html);
    } catch (err) {
      next(err);
    }
  });

  // 16.1 Write Document Edits
  app.post('/api/projects/:id/documents/write', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectPath = await resolveProjectLocation(req.params.id as string);
      const body = assertObject(req.body);
      const docPath = assertString(body.docPath, 'docPath');
      const content = typeof body.content === 'string' ? body.content : '';

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
      await storage.writeText(safePath, content);

      res.json({
        success: true,
        data: { docPath, saved: true },
      });
    } catch (err) {
      next(err);
    }
  });

  // 16.2 Export Documents Directly to Local Target Directory
  app.post('/api/projects/:id/documents/export-to-path', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectPath = await resolveProjectLocation(req.params.id as string);
      const body = assertObject(req.body);
      const targetDirectory = assertString(body.targetDirectory, 'targetDirectory');

      const snapshot = await engine.getSnapshot(projectPath);
      const items = snapshot.documents?.items || [];
      if (items.length === 0) {
        const err: any = new Error('No compiled documents available to export.');
        err.code = ErrorCode.STATE_VALIDATION_FAILED;
        throw err;
      }

      await storage.ensureDir(targetDirectory);
      let copiedCount = 0;
      for (const item of items) {
        const srcPath = join(projectPath, item.path);
        if (await storage.exists(srcPath)) {
          const destPath = join(targetDirectory, item.path);
          await storage.ensureDir(dirname(destPath));
          const text = await storage.readText(srcPath);
          await storage.writeText(destPath, text);
          copiedCount++;
        }
      }

      res.json({
        success: true,
        data: { targetDirectory, copiedCount },
      });
    } catch (err) {
      next(err);
    }
  });

  // 16.3 Retired historical rollback. Reject in every mode before project reads or recovery.
  app.post('/api/projects/:id/rollback', (_req: Request, res: Response): void => {
    res.status(410).json({
      success: false,
      error: {
        code: ErrorCode.LEGACY_WORKFLOW_RETIRED,
        message: '旧历史回滚写入接口已停用；历史记录仍可读取。',
        recoverable: false,
        details: { history: '/api/projects/:id/timeline' },
      },
    });
  });

  // 17. Compare Documents Diff before regenerating
  app.get('/api/projects/:id/documents/diff', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectPath = await resolveProjectLocation(req.params.id as string);
      const snapshot = await engine.getSnapshot(projectPath);
      const rawAreas = typeof req.query.areas === 'string'
        ? req.query.areas.split(',').map((a) => a.trim()).filter(Boolean)
        : undefined;
      const diffEngine = new DocumentDiffEngine();
      const diffs = diffEngine.diff(snapshot, undefined, rawAreas);

      res.json({
        success: true,
        data: { diffs },
        stateRevision: snapshot.metadata.stateRevision,
      });
    } catch (err) {
      next(err);
    }
  });

  // 18. Export Entire Project Package (.pa.zip)
  app.get('/api/projects/:id/export', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectPath = await resolveProjectLocationReadOnly(req.params.id as string);
      const exportService = new ProjectExportImportService(storage);
      const result = await exportService.exportProject(projectPath);

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(result.filename)}"`
      );
      res.setHeader('Content-Length', result.totalBytes);
      res.end(result.zipBuffer);
    } catch (err) {
      next(err);
    }
  });

  // 19. Import Entire Project Package (.pa.zip)
  app.post('/api/projects/import', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = assertObject(req.body);
      const contentBase64 = assertString(body.contentBase64, 'contentBase64');
      const cleanBase64 = contentBase64.replace(/\s/g, '').replace(/^data:.*?;base64,/, '');
      const zipBuffer = Buffer.from(cleanBase64, 'base64');

      const importService = new ProjectExportImportService(storage);
      const projectsDir = join(guard.workspaceRoot, 'projects');
      await storage.ensureDir(projectsDir);
      const result = await importService.importProject(zipBuffer, projectsDir);

      const projectItem: RecentProjectItem = {
        projectId: result.projectId,
        name: result.snapshot.metadata.name,
        stage: result.snapshot.metadata.stage,
        updatedAt: result.snapshot.metadata.updatedAt,
        projectPath: result.projectPath,
      };
      await registerProject(projectItem);

      res.status(201).json({
        success: true,
        data: {
          project: projectItem,
          snapshot: result.snapshot,
          renamed: result.renamed,
        },
        stateRevision: result.snapshot.metadata.stateRevision,
      });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/projects/:id/planning/history', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectPath = await resolveProjectLocationReadOnly(req.params.id as string, true);
      const data = await planningHistory(projectPath, req.params.id as string, planningRuntime);
      res.json({ success: true, data, stateRevision: data.sourceStateRevision });
    } catch (error) {
      next(Object.assign(new Error('规划历史无法读取已提交状态；没有执行恢复或写入。'), { code: (error as NodeJS.ErrnoException).code ?? ErrorCode.STATE_VALIDATION_FAILED }));
    }
  });

  app.get('/api/projects/:id/planning/history/documents/:documentId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectPath = await resolveProjectLocationReadOnly(req.params.id as string, true);
      const data = await planningHistoricalDocument(projectPath, req.params.id as string, req.params.documentId as string);
      res.json({ success: true, data, stateRevision: data.sourceStateRevision });
    } catch (error) {
      next(Object.assign(new Error('历史文档无法读取；没有执行恢复或写入。'), { code: (error as NodeJS.ErrnoException).code ?? ErrorCode.STATE_VALIDATION_FAILED }));
    }
  });

  app.get('/api/projects/:id/diagnostics', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectPath = await resolveProjectLocationReadOnly(req.params.id as string, true);
      const data = await planningDiagnostics(projectPath, req.params.id as string, planningConfigPath, planningRuntime);
      res.json({ success: true, data, stateRevision: data.sourceStateRevision });
    } catch (error) {
      // Keep the actual failure code while withholding raw parser/file-system messages.
      const code = (error as NodeJS.ErrnoException).code;
      next(Object.assign(new Error('规划诊断无法读取项目状态；没有执行恢复或写入。'), { code: code ?? ErrorCode.STATE_VALIDATION_FAILED }));
    }
  });

  // Historical discovery estimate; never current Planning task usage.
  app.get('/api/projects/:id/diagnostics/context', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectPath = await resolveProjectLocation(req.params.id as string);
      const snapshot = await engine.getSnapshot(projectPath);
      const inputRefs = snapshot.metadata.inputRefs || [];
      const inputMaterials: Array<{ id: string; label: string; text: string; isExcluded?: boolean }> = [];

      let fallbackIndex = 1;
      for (const ref of inputRefs) {
        const rawId = typeof ref === 'string' ? ref : (ref as any)?.id || '';
        let id = String(rawId).replace(/^input:/, '');
        if (!id || id === '[object Object]' || id.includes('[object Object]')) {
          id = `inp-legacy-${fallbackIndex++}`;
        }
        let label = typeof ref === 'object' && (ref as any)?.label
          ? (ref as any).label
          : `附件材料 (${id})`;
        if (label.includes('[object Object]')) {
          label = (ref as any)?.filename || `附件材料 (${id})`;
        }
        const isExcluded = typeof ref === 'object' && (ref as any)?.status === 'excluded';
        const text = await engine.readInputContent(projectPath, id).catch(() => '');
        inputMaterials.push({
          id,
          label,
          text,
          isExcluded,
        });
      }

      const diagnostics = orchestrator.getContextManager().getContextDiagnostics(snapshot, inputMaterials);
      res.json({
        success: true,
        data: { diagnostics, source: 'legacy-discovery-estimate', appliesToPlanningTasks: false },
        stateRevision: snapshot.metadata.stateRevision,
      });
    } catch (err) {
      next(err);
    }
  });

  // 17. FS Helper: List directories for directory browser
  app.get('/api/fs/directories', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const targetQuery = typeof req.query.path === 'string' ? req.query.path.trim() : '';
      let currentPath: string;
      let parentPath: string | undefined;
      let items: FsDirectoryItem[] = [];

      if (!targetQuery) {
        if (platform() === 'win32') {
          currentPath = '';
          const driveLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
          for (const letter of driveLetters) {
            const drivePath = `${letter}:\\`;
            try {
              if (existsSync(drivePath)) {
                items.push({
                  name: drivePath,
                  path: drivePath,
                });
              }
            } catch {
              // Ignore inaccessible drives
            }
          }
        } else {
          currentPath = '/';
          const entries = await fsp.readdir('/', { withFileTypes: true });
          items = entries
            .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
            .map((e) => ({ name: e.name, path: join('/', e.name) }));
        }
      } else {
        currentPath = resolve(targetQuery);
        if (!existsSync(currentPath)) {
          const err: any = new Error(`Directory path does not exist: ${currentPath}`);
          err.code = ErrorCode.STATE_VALIDATION_FAILED;
          throw err;
        }
        const stat = await fsp.stat(currentPath);
        if (!stat.isDirectory()) {
          const err: any = new Error(`Path is not a directory: ${currentPath}`);
          err.code = ErrorCode.STATE_VALIDATION_FAILED;
          throw err;
        }

        const parent = dirname(currentPath);
        if (parent && parent !== currentPath) {
          parentPath = parent;
        }

        const entries = await fsp.readdir(currentPath, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            if (
              entry.name.startsWith('.') ||
              entry.name === 'node_modules' ||
              entry.name === '$RECYCLE.BIN' ||
              entry.name === 'System Volume Information'
            ) {
              continue;
            }
            items.push({
              name: entry.name,
              path: join(currentPath, entry.name),
            });
          }
        }
      }

      const response: ApiResponse<ListDirectoriesResponse> = {
        success: true,
        data: {
          currentPath,
          parentPath,
          items,
        },
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  // 18. FS Helper: Validate path for directory selection
  app.post('/api/fs/validate-path', async (req: Request<{}, {}, ValidatePathRequest>, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const body = assertObject(req.body);
      const rawPath = assertString(body.path, 'path');
      const targetPath = resolve(rawPath);

      if (!existsSync(targetPath)) {
        const response: ApiResponse<ValidatePathResponse> = {
          success: true,
          data: {
            valid: true,
            exists: false,
            isDirectory: false,
            isEmpty: true,
          },
        };
        res.json(response);
        return;
      }

      const stat = await fsp.stat(targetPath);
      if (!stat.isDirectory()) {
        const response: ApiResponse<ValidatePathResponse> = {
          success: true,
          data: {
            valid: false,
            exists: true,
            isDirectory: false,
            isEmpty: false,
            error: 'Path exists but is a file, not a directory',
          },
        };
        res.json(response);
        return;
      }

      const entries = await fsp.readdir(targetPath);
      const isEmpty = entries.length === 0;

      const response: ApiResponse<ValidatePathResponse> = {
        success: true,
        data: {
          valid: true,
          exists: true,
          isDirectory: true,
          isEmpty,
        },
      };
      res.json(response);
    } catch (err: any) {
      const response: ApiResponse<ValidatePathResponse> = {
        success: true,
        data: {
          valid: false,
          exists: false,
          isDirectory: false,
          isEmpty: false,
          error: err.message || 'Validation failed',
        },
      };
      res.json(response);
    }
  });

  app.use('/api',createPlanningRoutes(planningRuntime,resolveProjectLocation,planningConfigPath));

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
  if (['STALE_BASIS','IDEMPOTENCY_CONFLICT','RUN_CONFLICT'].includes(err.code)) return 409;
  if (['LOCKED_CONFLICT','DEPENDENCY_CONFLICT','STAGE_NOT_APPROVED','CLARIFICATION_REQUIRED','PACKAGE_INCOMPLETE','PACKAGE_MODIFIED','RESULT_MODIFIED','UNREVIEWED_INPUT'].includes(err.code)) return 422;
  if (['INVALID_INTENT','INVALID_CHANGESET','QUESTION_QUALITY_FAILED','INVALID_EVIDENCE','TOPIC_CONFLICT'].includes(err.code)) return 400;
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
    case ErrorCode.DECISION_STATE_INVALID:
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
