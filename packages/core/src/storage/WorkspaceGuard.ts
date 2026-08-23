import { resolve, basename, join, sep } from 'node:path';
import { realpathSync, existsSync } from 'node:fs';
import { DEFAULT_RUNTIME_CONFIG, ErrorCode } from '@project-architect/contracts';

export class WorkspaceGuard {
  readonly workspaceRoot: string;
  readonly projectsDir: string;

  constructor(workspaceRoot?: string) {
    this.workspaceRoot = resolve(
      workspaceRoot ||
        process.env.PA_WORKSPACE_DIR ||
        DEFAULT_RUNTIME_CONFIG.workspace.workspaceRoot ||
        resolve(process.cwd(), '.workspace')
    );
    this.projectsDir = join(this.workspaceRoot, DEFAULT_RUNTIME_CONFIG.workspace.projectsSubdir || 'projects');
  }

  /**
   * Validates that a project ID contains only alphanumeric characters, hyphens, and underscores.
   * Rejects path traversal tokens, path separators, and illegal characters.
   */
  validateProjectId(projectId: string): string {
    if (!projectId || typeof projectId !== 'string') {
      throw this.guardError('Project ID is required and must be a string');
    }
    const cleanId = projectId.trim();
    if (!/^[a-zA-Z0-9_-]+$/.test(cleanId) || cleanId === '..' || cleanId === '.') {
      throw this.guardError(
        `Invalid project ID "${projectId}": only alphanumeric characters, hyphens, and underscores are allowed.`
      );
    }
    return cleanId;
  }

  /**
   * Validates that a filename is a strict single basename without path separators or traversal tokens.
   */
  validateFilename(filename: string): string {
    if (!filename || typeof filename !== 'string') {
      throw this.guardError('Filename is required and must be a string');
    }
    const trimmed = filename.trim();
    if (
      trimmed.includes('/') ||
      trimmed.includes('\\') ||
      trimmed.includes('..') ||
      trimmed.includes('\0') ||
      trimmed.includes(':') ||
      basename(trimmed) !== trimmed
    ) {
      throw this.guardError(
        `Invalid filename "${filename}": path separators, traversal tokens, and absolute paths are forbidden.`
      );
    }
    return trimmed;
  }

  /**
   * Resolves and verifies that targetPath is strictly contained within baseDir.
   * Also verifies realpath to prevent symlink / reparse point escapes.
   */
  assertContained(baseDir: string, targetPath: string, contextName = 'Path'): string {
    const resolvedBase = resolve(baseDir);
    const resolvedTarget = resolve(targetPath);

    // Normalize paths with trailing separator for prefix containment check
    const baseWithSep = resolvedBase.endsWith(sep) ? resolvedBase : resolvedBase + sep;
    if (resolvedTarget !== resolvedBase && !resolvedTarget.startsWith(baseWithSep)) {
      throw this.guardError(
        `${contextName} traversal rejected: target "${targetPath}" is outside allowed root "${baseDir}".`
      );
    }

    // Check symlink / reparse point escape if the target or its parent exists
    if (existsSync(resolvedTarget)) {
      try {
        const realTarget = realpathSync(resolvedTarget);
        const realBase = existsSync(resolvedBase) ? realpathSync(resolvedBase) : resolvedBase;
        const realBaseWithSep = realBase.endsWith(sep) ? realBase : realBase + sep;
        if (realTarget !== realBase && !realTarget.startsWith(realBaseWithSep)) {
          throw this.guardError(
            `${contextName} symlink escape rejected: real path "${realTarget}" is outside allowed directory "${realBase}".`
          );
        }
      } catch (err: any) {
        throw this.guardError(`Symlink resolution failed for "${targetPath}": ${err.message}`);
      }
    }

    return resolvedTarget;
  }

  /**
   * Resolves a projectId to its canonical workspace path: <workspaceRoot>/projects/<projectId>.
   */
  resolveProjectPath(projectId: string): string {
    const cleanId = this.validateProjectId(projectId);
    const target = join(this.projectsDir, cleanId);
    return this.assertContained(this.projectsDir, target, 'Project directory');
  }

  /**
   * Validates an arbitrary user-supplied path (legacy compatibility or explicit location).
   * Ensures it resides within the allowed projectsDir or workspaceRoot.
   */
  resolveAndValidateProjectLocation(explicitPath?: string, projectId?: string): string {
    if (projectId) {
      return this.resolveProjectPath(projectId);
    }
    if (!explicitPath) {
      throw this.guardError('Either projectId or projectPath must be provided');
    }
    return this.assertContained(this.projectsDir, resolve(explicitPath), 'Project path');
  }

  /**
   * Resolves an input material target path within a project directory: <projectDir>/inputs/<inputId>/<filename>.
   */
  resolveInputPath(
    projectDir: string,
    inputId: string,
    filename: string
  ): { inputDir: string; filePath: string } {
    const cleanInputId = this.validateProjectId(inputId);
    const cleanFilename = this.validateFilename(filename);

    const inputsBase = join(projectDir, 'inputs');
    this.assertContained(projectDir, inputsBase, 'Inputs directory');

    const inputDir = join(inputsBase, cleanInputId);
    this.assertContained(inputsBase, inputDir, 'Input ID directory');

    const filePath = join(inputDir, cleanFilename);
    this.assertContained(inputDir, filePath, 'Input file');

    return { inputDir, filePath };
  }

  private guardError(message: string): Error {
    const err: any = new Error(message);
    err.code = ErrorCode.STATE_VALIDATION_FAILED;
    err.recoverable = false;
    return err;
  }
}
