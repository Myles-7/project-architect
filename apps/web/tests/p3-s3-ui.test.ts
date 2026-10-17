/**
 * @file p3-s3-ui.test.ts
 * @description Stage S3 Web UI Verification: Brownfield Ingestion & Spec-Drift Verification
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defaultApiClient } from '../src/api/client.js';

describe('Stage S3 Web UI Verification', () => {
  const brownfieldModalPath = resolve(__dirname, '../src/features/brownfield/BrownfieldScanModal.tsx');
  const specDriftModalPath = resolve(__dirname, '../src/features/audit/SpecDriftModal.tsx');
  const overviewDrawerPath = resolve(__dirname, '../src/features/overview/OverviewDrawer.tsx');
  const documentsViewPath = resolve(__dirname, '../src/features/documents/DocumentsView.tsx');

  it('1. Verifies BrownfieldScanModal component exists and implements reverse scan workflow', () => {
    expect(existsSync(brownfieldModalPath)).toBe(true);
    const code = readFileSync(brownfieldModalPath, 'utf8');

    // API integration
    expect(code).toContain('scanBrownfield');
    expect(code).toContain('applyBrownfieldCandidates');

    // UI elements
    expect(code).toContain('已有代码库逆向扫描与架构透视');
    expect(code).toContain('开始透视扫描');
    expect(code).toContain('候选建议 (Candidate)');
    expect(code).toContain('selectedKeys');
    // Folder browser integration
    expect(code).toContain('DirectoryBrowserModal');
    expect(code).toContain('isFolderBrowserOpen');
    expect(code).toContain('浏览目录...');
  });

  it('2. Verifies SpecDriftModal component exists and renders compliance scorecard, violations, and directory browser', () => {
    expect(existsSync(specDriftModalPath)).toBe(true);
    const code = readFileSync(specDriftModalPath, 'utf8');

    // API integration
    expect(code).toContain('verifySpecDrift');

    // Scorecard & Violations
    expect(code).toContain('规范漂移静态审计器');
    expect(code).toContain('pa verify');
    expect(code).toContain('架构规范 100% 合规通过');
    expect(code).toContain('违禁依赖');
    expect(code).toContain('边界穿透');
    expect(code).toContain('修复建议');
    // Folder browser integration
    expect(code).toContain('DirectoryBrowserModal');
    expect(code).toContain('isFolderBrowserOpen');
    expect(code).toContain('浏览...');
  });

  it('3. Verifies OverviewDrawer integrates BrownfieldScanModal trigger button in both standard and inDrawer mode', () => {
    expect(existsSync(overviewDrawerPath)).toBe(true);
    const code = readFileSync(overviewDrawerPath, 'utf8');

    expect(code).toContain('BrownfieldScanModal');
    expect(code).toContain('isBrownfieldModalOpen');
    expect(code).toContain('FolderSearch');
    // Both standard and inDrawer mode contain FolderSearch button
    const matches = code.match(/FolderSearch/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('4. Verifies DocumentsView integrates SpecDriftModal trigger button', () => {
    expect(existsSync(documentsViewPath)).toBe(true);
    const code = readFileSync(documentsViewPath, 'utf8');

    expect(code).toContain('SpecDriftModal');
    expect(code).toContain('isDriftModalOpen');
    expect(code).toContain('规范漂移审计');
  });

  it('5. Retires the generic compliance action from formal diagnostics', () => {
    const diagPath = resolve(__dirname, '../src/features/settings/ProjectDiagnosticsView.tsx');
    expect(existsSync(diagPath)).toBe(true);
    const code = readFileSync(diagPath, 'utf8');

    expect(code).not.toContain('SpecDriftModal');
    expect(code).not.toContain('isDriftModalOpen');
    expect(code).toContain('getPlanningDiagnostics');
  });

  it('6. Verifies HomeView supports brownfield reverse engineering onboarding', () => {
    const homeViewPath = resolve(__dirname, '../src/app/HomeView.tsx');
    expect(existsSync(homeViewPath)).toBe(true);
    const code = readFileSync(homeViewPath, 'utf8');

    expect(code).toContain('scanBrownfieldStateless');
    expect(code).toContain('读取代码库线索');
    expect(code).toContain('代码库线索已读取');
    expect(code).not.toContain('逆向透视');
  });

  it('7. Verifies defaultApiClient exposes all Stage S3 endpoints including stateless scan', () => {
    expect(typeof defaultApiClient.scanBrownfieldStateless).toBe('function');
    expect(typeof defaultApiClient.scanBrownfield).toBe('function');
    expect(typeof defaultApiClient.applyBrownfieldCandidates).toBe('function');
    expect(typeof defaultApiClient.verifySpecDrift).toBe('function');
  });
});
