/**
 * @file SpecDriftAuditor.ts
 * @description Static Specification-Drift Auditor (方案 8 — pa verify).
 *
 * Checks:
 * 1. Forbidden dependencies vs confirmed architecture decisions (e.g. DB packages in Zero-DB projects).
 * 2. Cross-boundary module penetration (e.g. private internal imports).
 * 3. Document staleness & manifest synchronization.
 * 4. Directory conventions and required specification files (AGENTS.md, docs/).
 */

import { promises as fsp, existsSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
import type {
  ProjectSnapshot,
  SpecDriftReport,
  DriftViolation,
} from '@project-architect/contracts';

export interface AuditOptions {
  maxFiles?: number;
}

const FORBIDDEN_DB_PACKAGES = [
  'sqlite3',
  'better-sqlite3',
  'prisma',
  '@prisma/client',
  'typeorm',
  'sequelize',
  'pg',
  'mysql2',
  'mongoose',
  'drizzle-orm',
];

const FORBIDDEN_AUTH_PACKAGES = [
  '@clerk/clerk-react',
  'firebase',
  'supabase',
  '@supabase/supabase-js',
  '@auth0/auth0-react',
  'aws-amplify',
];

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);

export class SpecDriftAuditor {
  public static async audit(
    targetPath: string,
    snapshot: ProjectSnapshot,
    options: AuditOptions = {}
  ): Promise<SpecDriftReport> {
    const startTime = Date.now();
    const resolvedPath = resolve(targetPath);
    const violations: DriftViolation[] = [];
    let totalChecks = 0;

    // Helper to add violation
    const addViolation = (v: Omit<DriftViolation, 'id'>) => {
      violations.push({
        id: `drift-${violations.length + 1}`,
        ...v,
      });
    };

    // ------------------------------------------------------------------------
    // 1. Audit Forbidden Dependencies vs Architecture Invariants
    // ------------------------------------------------------------------------
    totalChecks++;
    const confirmedDecisions = snapshot.decisions?.items?.filter(
      (d) => d.status === 'confirmed' || d.status === 'locked'
    ) || [];

    const isZeroDbProject =
      snapshot.metadata.projectTags?.includes('local-first') ||
      confirmedDecisions.some((d) => {
        const text = d.statement + ' ' + (d.rationale || '');
        return (
          text.includes('禁止引入数据库') ||
          text.includes('纯本地文件') ||
          text.includes('Zero-DB')
        );
      });

    const isNoExternalAuthProject =
      confirmedDecisions.some((d) => {
        const text = d.statement + ' ' + (d.rationale || '');
        return (
          text.includes('禁止引入登录') ||
          text.includes('无登录系统') ||
          text.includes('本地自用')
        );
      });

    // Scan all package.json files
    const packageJsonFiles: string[] = [];
    async function findPackageJsons(dir: string, depth = 0): Promise<void> {
      if (depth > 5) return;
      try {
        const entries = await fsp.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
          const full = join(dir, entry.name);
          if (entry.isDirectory()) {
            await findPackageJsons(full, depth + 1);
          } else if (entry.isFile() && entry.name === 'package.json') {
            packageJsonFiles.push(full);
          }
        }
      } catch {
        // Ignore read errors
      }
    }

    if (existsSync(resolvedPath)) {
      await findPackageJsons(resolvedPath);
    }

    for (const pkgPath of packageJsonFiles) {
      const relPkg = pkgPath.substring(resolvedPath.length + 1).replace(/\\/g, '/');
      try {
        const content = await fsp.readFile(pkgPath, 'utf8');
        const pkgJson = JSON.parse(content);
        const deps = {
          ...pkgJson.dependencies,
          ...pkgJson.devDependencies,
        };

        // Check Zero-DB constraint
        if (isZeroDbProject) {
          for (const forbidden of FORBIDDEN_DB_PACKAGES) {
            totalChecks++;
            if (deps[forbidden]) {
              addViolation({
                category: 'dependency',
                severity: 'error',
                title: `检测到违禁数据库依赖 [${forbidden}]`,
                description: `文件 ${relPkg} 中声明了 "${forbidden}": "${deps[forbidden]}"，这与当前项目确定的「本地纯文件存储 / 零数据库」架构红线发生严重漂移。`,
                filePath: relPkg,
                actual: `依赖项声明: ${forbidden}`,
                expected: '无中心化或嵌入式数据库驱动依赖',
                remediation: `从 ${relPkg} 移除 "${forbidden}" 依赖，严格遵循本地纯文件序列化接口。`,
                relatedAreaId: 'technical_boundary',
              });
            }
          }
        }

        // Check No-External-Auth constraint
        if (isNoExternalAuthProject) {
          for (const forbidden of FORBIDDEN_AUTH_PACKAGES) {
            totalChecks++;
            if (deps[forbidden]) {
              addViolation({
                category: 'dependency',
                severity: 'error',
                title: `检测到外部云端鉴权依赖 [${forbidden}]`,
                description: `文件 ${relPkg} 中声明了 "${forbidden}"，与确定的「自用无登录 / 零外部中心服务」原则违背。`,
                filePath: relPkg,
                actual: `依赖项声明: ${forbidden}`,
                expected: '本地单用户无密码直接访问',
                remediation: `从 ${relPkg} 移除外部鉴权 SDK。`,
                relatedAreaId: 'technical_boundary',
              });
            }
          }
        }
      } catch {
        // Skip invalid JSON
      }
    }

    // ------------------------------------------------------------------------
    // 2. Audit Monorepo Boundary Penetration in Source Code
    // ------------------------------------------------------------------------
    let scannedSrcCount = 0;
    const maxFiles = options.maxFiles || 400;

    async function scanSourceFiles(dir: string, depth = 0): Promise<void> {
      if (depth > 6 || scannedSrcCount >= maxFiles) return;
      try {
        const entries = await fsp.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (scannedSrcCount >= maxFiles) break;
          if (
            entry.name === 'node_modules' ||
            entry.name === 'dist' ||
            entry.name === 'build' ||
            entry.name.startsWith('.')
          ) {
            continue;
          }

          const full = join(dir, entry.name);
          if (entry.isDirectory()) {
            await scanSourceFiles(full, depth + 1);
          } else if (entry.isFile()) {
            const ext = extname(entry.name).toLowerCase();
            if (SOURCE_EXTENSIONS.has(ext)) {
              scannedSrcCount++;
              totalChecks++;
              await checkSourceFile(full);
            }
          }
        }
      } catch {
        // Skip
      }
    }

    async function checkSourceFile(fullPath: string): Promise<void> {
      const relPath = fullPath.substring(resolvedPath.length + 1).replace(/\\/g, '/');
      const isTestFile = relPath.startsWith('tests/') || relPath.includes('.test.') || relPath.includes('__tests__');
      if (isTestFile) return;

      try {
        const stat = await fsp.stat(fullPath);
        if (stat.size > 200 * 1024) return; // Skip huge files
        const text = await fsp.readFile(fullPath, 'utf8');
        const lines = text.split('\n');

        lines.forEach((line, idx) => {
          const trimmed = line.trim();
          if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return;

          // Check for private / internal deep cross-boundary imports
          const importMatch = trimmed.match(/^(?:import|export)\s+(?:[\w*\s{},]+from\s+)?['"]([^'"]+)['"]/);
          if (importMatch && importMatch[1]) {
            const targetImport = importMatch[1];
            if (
              targetImport.includes('/src/') &&
              (targetImport.startsWith('../..') || targetImport.startsWith('@project-architect/'))
            ) {
              addViolation({
                category: 'boundary',
                severity: 'error',
                title: `非法跨边界私有模块导入: ${targetImport}`,
                description: `在 ${relPath}:${idx + 1} 中直接穿透引用了内部实现路径 "${targetImport}"，违背了模块分层隔离与公共导出契约。`,
                filePath: relPath,
                lineNumber: idx + 1,
                actual: line.trim(),
                expected: '通过包名根路径或 index.ts 公共 API 进行访问',
                remediation: `修改导入路径，仅依赖目标包暴露在 index.ts 中的公共接口。`,
              });
            }
          }
        });
      } catch {
        // Skip
      }
    }

    if (existsSync(resolvedPath)) {
      await scanSourceFiles(resolvedPath);
    }

    // ------------------------------------------------------------------------
    // 3. Audit Specification Document Freshness
    // ------------------------------------------------------------------------
    const docItems = snapshot.documents?.items || [];
    for (const doc of docItems) {
      totalChecks++;
      const isStale = (doc as any).isStale ?? doc.sourceRevision < snapshot.metadata.stateRevision;
      if (isStale) {
        addViolation({
          category: 'document',
          severity: 'warning',
          title: `规范文档版本滞后: ${doc.path}`,
          description: `自上次生成文档以来项目状态已有新演进，${doc.path} 当前与最新架构决策存在潜在漂移。`,
          filePath: doc.path,
          expected: `与最新 revision ${snapshot.metadata.stateRevision} 一致`,
          actual: `基于历史 revision ${doc.sourceRevision} 编译`,
          remediation: `在文档管理面板重新编译生成，或调用 POST /api/projects/:id/documents/generate 同步。`,
          relatedAreaId: 'technical_boundary',
        });
      }
    }

    // ------------------------------------------------------------------------
    // 4. Audit Core Directory & Specification Artifacts
    // ------------------------------------------------------------------------
    totalChecks++;
    const agentsMdPath = join(resolvedPath, 'AGENTS.md');
    if (!existsSync(agentsMdPath) && docItems.length > 0) {
      addViolation({
        category: 'directory',
        severity: 'warning',
        title: '缺失根目录规范守卫文件 AGENTS.md',
        description: '项目已编译生成规范包，但根目录下尚未导出或放置权威 AGENTS.md 准则文件。',
        filePath: 'AGENTS.md',
        actual: '文件不存在',
        expected: '根目录下存在权威规范指南 AGENTS.md',
        remediation: '在工作区点击“输出至本地目录”或生成文档以将 AGENTS.md 写入根目录。',
      });
    }

    const durationMs = Date.now() - startTime;
    const errorCount = violations.filter((v) => v.severity === 'error').length;
    const warningCount = violations.filter((v) => v.severity === 'warning').length;
    const infoCount = violations.filter((v) => v.severity === 'info').length;

    return {
      projectId: snapshot.metadata.projectId,
      targetPath: resolvedPath,
      auditedAt: new Date().toISOString(),
      totalChecks,
      errorCount,
      warningCount,
      infoCount,
      isCompliant: errorCount === 0,
      violations,
      durationMs,
    };
  }
}
