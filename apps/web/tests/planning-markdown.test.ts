import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MarkdownRenderer } from '../src/components/common/MarkdownRenderer.js';
import { ToastProvider } from '../src/components/common/Toast.js';

const render = (content: string) => renderToStaticMarkup(createElement(ToastProvider, null, createElement(MarkdownRenderer, { content })));

describe('readable and inert AI planning content', () => {
  it('renders review headings, numbered steps, tradeoff tables and literal code', () => {
    const markup = render('## 保存失败恢复\n\n3. **保留草稿**\n4. 点击重试\n\n| 条件 | 行为 |\n| --- | --- |\n| 写入失败 | 显示 `retry` |\n\n```ts\nif (failed) keepDraft();\n```');
    expect(markup).toMatch(/<h2[^>]*>保存失败恢复<\/h2>/);
    expect(markup).toMatch(/<ol[^>]*start="3"/);
    expect(markup).toContain('保留草稿</strong>');
    expect(markup).toContain('<table');
    expect(markup).toContain('<code>if (failed) keepDraft();</code>');
    expect(markup).not.toContain('## 保存失败恢复');
  });

  it('keeps unsafe generated links and HTML as inert text', () => {
    const markup = render('[危险](javascript:alert) [混淆](java\tscript:alert) [文件](file:///C:/secret)\n<script>alert(1)</script>');
    expect(markup).not.toContain('<a ');
    expect(markup).not.toContain('<script>');
    expect(markup).toContain('&lt;script&gt;');
    for (const label of ['危险', '混淆', '文件']) expect(markup).toContain(label);
  });

  it('preserves normal evidence and relative document links with safe external navigation', () => {
    const markup = render('[官方来源](https://react.dev/reference) [任务](./tasks.json)');
    expect(markup).toContain('href="https://react.dev/reference"');
    expect(markup).toContain('href="./tasks.json"');
    expect(markup.match(/rel="noopener noreferrer"/g)).toHaveLength(2);
  });
});
