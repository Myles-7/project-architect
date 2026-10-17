/**
 * @file p0-provider-health-modal.test.ts
 * @description P0 Remediation: Verification of ProviderHealthModal and Modal Accessibility & Contracts
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ProviderHealthModal } from '../src/features/home/ProviderHealthModal.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('P0 ProviderHealthModal Accessibility & Modal Semantics', () => {
  it('1. Returns null when isOpen is false', () => {
    const html = renderToString(
      React.createElement(ProviderHealthModal, {
        isOpen: false,
        onClose: () => {},
      })
    );
    expect(html).toBe('');
  });

  it('2. Renders with accessible dialog semantics, aria-modal, title, and close button when isOpen is true', () => {
    const html = renderToString(
      React.createElement(ProviderHealthModal, {
        isOpen: true,
        onClose: () => {},
      })
    );

    // Dialog accessibility attributes
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="modal-title"');

    // Title and close button
    expect(html).toContain('本地 AI 引擎与隐私安全状态');
    expect(html).toContain('aria-label="关闭窗口"');

    // Subtitle & core guarantees
    expect(html).toContain('单次推演契约与本地优先架构');
    expect(html).toContain('重新探活');
    expect(html).toContain('关闭');
  });

  it('3. Modal base component correctly renders dialog structure, accessibility attributes and responsive sizing', async () => {
    const { Modal } = await import('../src/components/common/Modal.js');
    const onClose = () => {};

    // When isOpen is false
    const closedHtml = renderToString(
      React.createElement(Modal, { isOpen: false, onClose, title: 'Test Title' }, 'Content')
    );
    expect(closedHtml).toBe('');

    // When isOpen is true with custom maxWidth and footer
    const openHtml = renderToString(
      React.createElement(
        Modal,
        {
          isOpen: true,
          onClose,
          title: '对话框标题',
          maxWidth: 'lg',
          footer: React.createElement('button', { type: 'button' }, '确认'),
        },
        React.createElement('p', null, '主体内容')
      )
    );

    expect(openHtml).toContain('role="dialog"');
    expect(openHtml).toContain('aria-modal="true"');
    expect(openHtml).toContain('aria-labelledby="modal-title"');
    expect(openHtml).toContain('id="modal-title"');
    expect(openHtml).toContain('对话框标题');
    expect(openHtml).toContain('主体内容');
    expect(openHtml).toContain('确认');
    expect(openHtml).toContain('max-w-2xl');
    expect(openHtml).toContain('aria-hidden="true"');
    expect(openHtml).toContain('aria-label="关闭窗口"');
  });

  it('4. Monorepo dev scripts guarantee server hot reload mode', () => {
    const rootPkgPath = resolve(__dirname, '../../../package.json');
    const serverPkgPath = resolve(__dirname, '../../server/package.json');

    const rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf8'));
    const serverPkg = JSON.parse(readFileSync(serverPkgPath, 'utf8'));

    expect(serverPkg.scripts?.dev).toBe('tsx watch src/index.ts');
    expect(rootPkg.scripts?.['dev:server']).toBe('pnpm --filter @project-architect/server dev');
    expect(rootPkg.scripts?.['build:server']).toBe('pnpm --filter @project-architect/server build');
  });
});
