/**
 * @file CodebaseScanner.ts
 * @description Safe Brownfield Codebase Reverse-Engineering Scanner (方案 4).
 *
 * Guarantees:
 * 1. Safe traversal with 500-file cap and 5000ms timeout guard.
 * 2. Strictly read-only, never mutates scanned codebase.
 * 3. User authority first: generates 100% candidate proposals with evidence, never confirmed/locked.
 * 4. Ignores heavy directories: node_modules, .git, dist, target, vendor, etc.
 */

import { promises as fsp, existsSync } from 'node:fs';
import { join, resolve, basename, extname } from 'node:path';
import type {
  CodebaseAnalysisResult,
  DetectedTechnology,
  BrownfieldCandidateDecision,
  TechCategory,
} from '@project-architect/contracts';
import { AreaRegistry } from '../areas/AreaRegistry.js';

export interface ScanOptions {
  maxFiles?: number;
  timeoutMs?: number;
}

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  'dist',
  'build',
  'target',
  'vendor',
  '.turbo',
  'coverage',
  '.next',
  '.nuxt',
  '.output',
  '.venv',
  'venv',
  '__pycache__',
  '.idea',
  '.vscode',
  '.trash',
  '.backup',
  'tmp',
  'temp',
]);

const IGNORED_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp',
  '.mp4', '.mp3', '.wav', '.pdf', '.zip', '.tar', '.gz', '.7z',
  '.wasm', '.bin', '.exe', '.dll', '.so', '.dylib', '.lock',
  '.map', '.min.js', '.min.css',
]);

const MAX_FILE_READ_BYTES = 100 * 1024; // 100KB

export class CodebaseScanner {
  public static async scan(
    targetPath: string,
    options: ScanOptions = {}
  ): Promise<CodebaseAnalysisResult> {
    const startTime = Date.now();
    const resolvedPath = resolve(targetPath);

    if (!existsSync(resolvedPath)) {
      throw new Error(`Target path does not exist: ${resolvedPath}`);
    }

    const stat = await fsp.stat(resolvedPath);
    if (!stat.isDirectory()) {
      throw new Error(`Target path is not a directory: ${resolvedPath}`);
    }

    const maxFiles = Math.min(Math.max(options.maxFiles ?? 500, 10), 2000);
    const timeoutMs = options.timeoutMs ?? 5000;

    let scannedFilesCount = 0;
    const topLevelDirs: string[] = [];
    const manifestFilesFound: string[] = [];
    const technologies: DetectedTechnology[] = [];
    const candidateDecisions: BrownfieldCandidateDecision[] = [];

    let isMonorepo = false;
    let detectedProjectName: string | undefined;
    let primaryLanguage = 'Unknown';
    const langCounts = {
      TypeScript: 0,
      JavaScript: 0,
      Rust: 0,
      Go: 0,
      Python: 0,
    };

    // 1. Inspect Top-Level Entries
    const rootEntries = await fsp.readdir(resolvedPath, { withFileTypes: true });
    for (const entry of rootEntries) {
      if (entry.isDirectory() && !IGNORED_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
        topLevelDirs.push(entry.name);
      }
    }

    // 2. Check for Monorepo root markers
    if (
      rootEntries.some((e) => e.name === 'pnpm-workspace.yaml') ||
      rootEntries.some((e) => e.name === 'lerna.json') ||
      rootEntries.some((e) => e.name === 'turbo.json') ||
      (topLevelDirs.includes('packages') && topLevelDirs.includes('apps'))
    ) {
      isMonorepo = true;
    }

    // 3. Recursive Safe Walk with Depth & Count Limit
    async function walk(currentDir: string, depth: number): Promise<void> {
      if (Date.now() - startTime > timeoutMs) return;
      if (scannedFilesCount >= maxFiles) return;
      if (depth > 6) return;

      let entries;
      try {
        entries = await fsp.readdir(currentDir, { withFileTypes: true });
      } catch {
        return; // Ignore permission/read errors
      }

      for (const entry of entries) {
        if (Date.now() - startTime > timeoutMs || scannedFilesCount >= maxFiles) break;

        const fullPath = join(currentDir, entry.name);
        const relPath = fullPath.substring(resolvedPath.length + 1).replace(/\\/g, '/');

        if (entry.isDirectory()) {
          if (!IGNORED_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
            await walk(fullPath, depth + 1);
          }
        } else if (entry.isFile()) {
          scannedFilesCount++;
          const ext = extname(entry.name).toLowerCase();
          if (IGNORED_EXTS.has(ext)) continue;

          // Language counting
          if (ext === '.ts' || ext === '.tsx') langCounts.TypeScript++;
          else if (ext === '.js' || ext === '.jsx' || ext === '.mjs') langCounts.JavaScript++;
          else if (ext === '.rs') langCounts.Rust++;
          else if (ext === '.go') langCounts.Go++;
          else if (ext === '.py') langCounts.Python++;

          // Check manifests
          if (entry.name === 'package.json') {
            manifestFilesFound.push(relPath);
            await parsePackageJson(fullPath, relPath);
          } else if (entry.name === 'Cargo.toml') {
            manifestFilesFound.push(relPath);
            await parseCargoToml(fullPath, relPath);
          } else if (entry.name === 'go.mod') {
            manifestFilesFound.push(relPath);
            await parseGoMod(fullPath, relPath);
          } else if (entry.name === 'pyproject.toml' || entry.name === 'requirements.txt') {
            manifestFilesFound.push(relPath);
            await parsePythonManifest(fullPath, relPath);
          }
        }
      }
    }

    // Parsers
    async function parsePackageJson(filePath: string, relPath: string): Promise<void> {
      try {
        const stat = await fsp.stat(filePath);
        if (stat.size > MAX_FILE_READ_BYTES) return;
        const text = await fsp.readFile(filePath, 'utf8');
        const json = JSON.parse(text);

        if (!detectedProjectName && json.name && relPath === 'package.json') {
          detectedProjectName = json.name;
        }

        if (json.workspaces) {
          isMonorepo = true;
        }

        const allDeps: Record<string, string> = {
          ...json.dependencies,
          ...json.devDependencies,
          ...json.peerDependencies,
        };

        if (allDeps['typescript'] || allDeps['@types/node']) {
          langCounts.TypeScript += 5;
        } else {
          langCounts.JavaScript += 5;
        }

        const detect = (pkg: string, name: string, category: TechCategory) => {
          if (allDeps[pkg]) {
            technologies.push({
              name,
              category,
              version: allDeps[pkg],
              confidence: 'high',
              sourceFile: relPath,
            });
          }
        };

        // UI & Frameworks
        detect('react', 'React', 'framework');
        detect('vue', 'Vue.js', 'framework');
        detect('svelte', 'Svelte', 'framework');
        detect('next', 'Next.js', 'framework');
        detect('nuxt', 'Nuxt', 'framework');
        detect('astro', 'Astro', 'framework');
        detect('@remix-run/react', 'Remix', 'framework');
        detect('electron', 'Electron', 'runtime');
        detect('@tauri-apps/api', 'Tauri', 'runtime');

        // Styling
        detect('tailwindcss', 'Tailwind CSS', 'styling');
        detect('@mui/material', 'Material UI', 'styling');
        detect('antd', 'Ant Design', 'styling');
        detect('styled-components', 'Styled Components', 'styling');

        // Backend & Runtime
        detect('express', 'Express', 'framework');
        detect('fastify', 'Fastify', 'framework');
        detect('@nestjs/core', 'NestJS', 'framework');
        detect('hono', 'Hono', 'framework');

        // Databases & Storage
        detect('prisma', 'Prisma ORM', 'database');
        detect('@prisma/client', 'Prisma Client', 'database');
        detect('typeorm', 'TypeORM', 'database');
        detect('drizzle-orm', 'Drizzle ORM', 'database');
        detect('sqlite3', 'SQLite3', 'database');
        detect('better-sqlite3', 'better-sqlite3', 'database');
        detect('pg', 'PostgreSQL (pg)', 'database');
        detect('mysql2', 'MySQL (mysql2)', 'database');
        detect('mongoose', 'Mongoose (MongoDB)', 'database');

        // State & Testing
        detect('zustand', 'Zustand', 'library');
        detect('@reduxjs/toolkit', 'Redux Toolkit', 'library');
        detect('pinia', 'Pinia', 'library');
        detect('vitest', 'Vitest', 'test');
        detect('jest', 'Jest', 'test');
        detect('playwright', 'Playwright', 'test');
        detect('@playwright/test', 'Playwright', 'test');
        detect('cypress', 'Cypress', 'test');

        // Build
        detect('vite', 'Vite', 'build-tool');
        detect('webpack', 'Webpack', 'build-tool');
        detect('tsup', 'tsup', 'build-tool');
        detect('typescript', 'TypeScript', 'runtime');
      } catch {
        // Skip unparseable JSON
      }
    }

    async function parseCargoToml(filePath: string, relPath: string): Promise<void> {
      try {
        const text = await fsp.readFile(filePath, 'utf8');
        langCounts.Rust += 10;
        if (!detectedProjectName && relPath === 'Cargo.toml') {
          const nameMatch = text.match(/name\s*=\s*"([^"]+)"/);
          if (nameMatch) detectedProjectName = nameMatch[1];
        }

        const checkCrate = (crate: string, name: string, cat: TechCategory) => {
          if (new RegExp(`^${crate}\\s*=`, 'm').test(text) || text.includes(`"${crate}"`)) {
            technologies.push({
              name,
              category: cat,
              confidence: 'high',
              sourceFile: relPath,
            });
          }
        };

        checkCrate('axum', 'Axum', 'framework');
        checkCrate('actix-web', 'Actix Web', 'framework');
        checkCrate('tokio', 'Tokio', 'runtime');
        checkCrate('tauri', 'Tauri (Rust)', 'runtime');
        checkCrate('diesel', 'Diesel ORM', 'database');
        checkCrate('sqlx', 'SQLx', 'database');
      } catch {
        // Skip
      }
    }

    async function parseGoMod(filePath: string, relPath: string): Promise<void> {
      try {
        const text = await fsp.readFile(filePath, 'utf8');
        langCounts.Go += 10;
        if (!detectedProjectName && relPath === 'go.mod') {
          const modMatch = text.match(/^module\s+([^\s\r\n]+)/m);
          if (modMatch && modMatch[1]) detectedProjectName = basename(modMatch[1]);
        }

        if (text.includes('github.com/gin-gonic/gin')) {
          technologies.push({ name: 'Gin', category: 'framework', confidence: 'high', sourceFile: relPath });
        }
        if (text.includes('github.com/labstack/echo')) {
          technologies.push({ name: 'Echo', category: 'framework', confidence: 'high', sourceFile: relPath });
        }
        if (text.includes('gorm.io/gorm')) {
          technologies.push({ name: 'GORM', category: 'database', confidence: 'high', sourceFile: relPath });
        }
      } catch {
        // Skip
      }
    }

    async function parsePythonManifest(filePath: string, relPath: string): Promise<void> {
      try {
        const text = await fsp.readFile(filePath, 'utf8');
        langCounts.Python += 10;

        const checkPy = (pkg: string, name: string, cat: TechCategory) => {
          if (text.toLowerCase().includes(pkg.toLowerCase())) {
            technologies.push({ name, category: cat, confidence: 'high', sourceFile: relPath });
          }
        };

        checkPy('fastapi', 'FastAPI', 'framework');
        checkPy('django', 'Django', 'framework');
        checkPy('flask', 'Flask', 'framework');
        checkPy('sqlalchemy', 'SQLAlchemy', 'database');
        checkPy('pytest', 'pytest', 'test');
      } catch {
        // Skip
      }
    }

    await walk(resolvedPath, 0);

    // Determine primary language
    let maxLangCount = 0;
    for (const [lang, count] of Object.entries(langCounts)) {
      if (count > maxLangCount) {
        maxLangCount = count;
        primaryLanguage = lang;
      }
    }

    // Deduplicate detected technologies
    const uniqueTechs: DetectedTechnology[] = [];
    const seenTech = new Set<string>();
    for (const t of technologies) {
      const key = `${t.name}-${t.sourceFile}`;
      if (!seenTech.has(key)) {
        seenTech.add(key);
        uniqueTechs.push(t);
      }
    }

    // Synthesize Candidate Decisions
    const techBoundaryArea = AreaRegistry.normalize('technical_boundary');
    const uxArea = AreaRegistry.normalize('ux_ui_direction');

    // 1. Language & Runtime Candidate
    if (primaryLanguage !== 'Unknown') {
      const hasTs = uniqueTechs.some((t) => t.name === 'TypeScript') || langCounts.TypeScript > 0;
      const langTitle = hasTs && primaryLanguage === 'TypeScript' ? 'TypeScript (Strict Mode)' : primaryLanguage;
      candidateDecisions.push({
        areaId: techBoundaryArea,
        decisionKey: 'tech-stack.primary-language',
        title: `核心开发语言：${langTitle}`,
        summary: `代码库主要由 ${langTitle} 构建，扫描共检测到 ${maxLangCount} 个相关源文件。`,
        details: `基于文件扩展名与依赖探测，当前系统核心语言确认为 ${langTitle}。建议保持强类型规约与严格编译配置。`,
        evidence: manifestFilesFound.filter((f) => f.includes('package') || f.includes('Cargo') || f.includes('go.mod')),
        suggestedTags: [primaryLanguage.toLowerCase()],
        confidence: 'high',
      });
    }

    // 2. Monorepo Architecture Candidate
    if (isMonorepo) {
      candidateDecisions.push({
        areaId: techBoundaryArea,
        decisionKey: 'architecture.monorepo-layout',
        title: '架构形态：Monorepo 多包协同工作区',
        summary: '检测到 pnpm-workspace / lerna 或 packages/apps 分层目录，属于 Monorepo 架构。',
        details: '代码库采用工作区多包拆分架构，需严格维护包间依赖图谱，杜绝循环依赖与跨包私有引用穿透。',
        evidence: manifestFilesFound.filter((f) => f.includes('workspace') || f.includes('package.json')),
        suggestedTags: ['monorepo', 'modular'],
        confidence: 'high',
      });
    }

    // 3. UI Framework & Styling Candidate
    const uiTech = uniqueTechs.find((t) => t.category === 'framework' && ['React', 'Vue.js', 'Svelte', 'Next.js'].includes(t.name));
    const stylingTech = uniqueTechs.find((t) => t.category === 'styling');
    if (uiTech) {
      candidateDecisions.push({
        areaId: uxArea,
        decisionKey: 'ui.framework-and-styling',
        title: `前端框架与样式体系：${uiTech.name}${stylingTech ? ` + ${stylingTech.name}` : ''}`,
        summary: `检测到 ${uiTech.name} 作为主前端视图库${stylingTech ? `，结合 ${stylingTech.name} 进行样式原子化构建` : ''}。`,
        details: `依据 ${uiTech.sourceFile} 依赖事实，项目采用 ${uiTech.name} 组织组件层级与交互界面。`,
        evidence: [uiTech.sourceFile, ...(stylingTech ? [stylingTech.sourceFile] : [])],
        suggestedTags: [uiTech.name.toLowerCase(), ...(stylingTech ? [stylingTech.name.toLowerCase().replace(/\s+/g, '-')] : [])],
        confidence: 'high',
      });
    }

    // 4. Database & Storage Candidate
    const dbTech = uniqueTechs.find((t) => t.category === 'database');
    if (dbTech) {
      candidateDecisions.push({
        areaId: techBoundaryArea,
        decisionKey: 'storage.database-engine',
        title: `数据持久化方案：${dbTech.name}`,
        summary: `检测到 ${dbTech.name}，工程具备数据层/ORM 持久化基础设施。`,
        details: `依据 ${dbTech.sourceFile} 声明，项目依赖 ${dbTech.name} 处理持久化数据读写与模型映射。`,
        evidence: [dbTech.sourceFile],
        suggestedTags: ['database', dbTech.name.toLowerCase().replace(/\s+/g, '-')],
        confidence: 'high',
      });
    } else {
      // Local file storage candidate if no DB client is found
      candidateDecisions.push({
        areaId: techBoundaryArea,
        decisionKey: 'storage.persistence-policy',
        title: '数据持久化方案：纯本地文件存储 (Zero-DB)',
        summary: '未探测到任何集中式或嵌入式 SQL/NoSQL 数据库依赖，判定为本地纯文件存储架构。',
        details: '代码库未引入数据库客户端驱动（如 SQLite、PostgreSQL、Prisma），契合 Local-First 纯文件序列化规范。',
        evidence: manifestFilesFound,
        suggestedTags: ['local-first', 'zero-db'],
        confidence: 'medium',
      });
    }

    // 5. Test Suite Candidate
    const testTech = uniqueTechs.find((t) => t.category === 'test');
    if (testTech) {
      candidateDecisions.push({
        areaId: techBoundaryArea,
        decisionKey: 'testing.test-framework',
        title: `自动化测试框架：${testTech.name}`,
        summary: `检测到 ${testTech.name} 测试依赖，用于驱动单元与端到端测试。`,
        details: `依据 ${testTech.sourceFile}，项目采用 ${testTech.name} 执行自动化测试防护网。`,
        evidence: [testTech.sourceFile],
        suggestedTags: ['testing', testTech.name.toLowerCase()],
        confidence: 'high',
      });
    }

    const durationMs = Date.now() - startTime;

    return {
      scannedPath: resolvedPath,
      detectedProjectName: detectedProjectName || basename(resolvedPath),
      isMonorepo,
      primaryLanguage,
      technologies: uniqueTechs,
      structureSummary: {
        totalFilesScanned: scannedFilesCount,
        topLevelDirectories: topLevelDirs,
        manifestFilesFound,
      },
      candidateDecisions,
      scanDurationMs: durationMs,
    };
  }
}
