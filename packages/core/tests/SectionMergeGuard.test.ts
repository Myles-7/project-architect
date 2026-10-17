import { describe, it, expect } from 'vitest';
import { SectionMergeGuard } from '../src/documents/SectionMergeGuard.js';

describe('SectionMergeGuard (3-Way Merge Protection)', () => {
  it('identifies identical content and returns clean merge with no conflicts', () => {
    const content = '# Title\n\nSome paragraph text.\n';
    const result = SectionMergeGuard.merge(content, content);
    expect(result.hasConflicts).toBe(false);
    expect(result.hasManualEditsPreserved).toBe(false);
    expect(result.mergedContent).toBe(content);
  });

  it('preserves user custom sections that do not exist in the newly generated template', () => {
    const diskContent = `# 1. 系统愿景

这是系统的核心愿景...

## 1.3 团队本地开发手工说明 (Custom Section)

这是人类架构师手工增加的关于本地调试的特殊命令：
- pnpm run debug
- pnpm run trace
`;

    const newGeneratedContent = `# 1. 系统愿景

这是系统的核心愿景（更新版本）...
`;

    const result = SectionMergeGuard.merge(diskContent, newGeneratedContent);

    expect(result.hasManualEditsPreserved).toBe(true);
    expect(result.preservedSections).toContain('1.3 团队本地开发手工说明 (Custom Section)');
    expect(result.mergedContent).toContain('1.3 团队本地开发手工说明 (Custom Section)');
    expect(result.mergedContent).toContain('pnpm run debug');
  });

  it('preserves custom manual notes sections when both have conflicting changes', () => {
    const diskContent = `# 1. 架构原则

## 1.1 手工备注与团队权衡 (Manual Notes)

团队讨论决定：本期暂不引入外部消息队列。
`;

    const newGeneratedContent = `# 1. 架构原则

## 1.1 手工备注与团队权衡 (Manual Notes)

AI 生成的默认占位说明。
`;

    const result = SectionMergeGuard.merge(diskContent, newGeneratedContent);

    expect(result.hasManualEditsPreserved).toBe(true);
    expect(result.mergedContent).toContain('本期暂不引入外部消息队列');
  });

  it('generates non-destructive conflict block when standard sections diverge unexpectedly', () => {
    const diskContent = `# 1. 技术边界

核心技术栈采用 Rust。
`;

    const newGeneratedContent = `# 1. 技术边界

核心技术栈采用 TypeScript。
`;

    const result = SectionMergeGuard.merge(diskContent, newGeneratedContent);

    expect(result.hasConflicts).toBe(true);
    expect(result.conflictSections).toContain('1. 技术边界');
    expect(result.mergedContent).toContain('<<<<<<< HUMAN_MANUAL_EDITS');
    expect(result.mergedContent).toContain('Rust');
    expect(result.mergedContent).toContain('=======');
    expect(result.mergedContent).toContain('TypeScript');
    expect(result.mergedContent).toContain('>>>>>>> COMPILED_AI_SPEC');
  });

  it('P0-1: protects code blocks containing # comments from being falsely split into sections', () => {
    const markdownWithCode = `# 1. 执行脚本规约

以下是部署与数据导入脚本：

\`\`\`bash
# Install dependencies
pnpm install

# Run migration
pnpm run db:migrate

# Start background worker
pnpm run worker:start
\`\`\`

\`\`\`python
# Configuration loader
import os

# Database connection pool
def get_db():
    # Return local storage handle
    pass
\`\`\`

## 2. 验收标准

脚本执行无报错。
`;

    const sections = SectionMergeGuard.parseSections(markdownWithCode);

    // There should be exactly 2 sections: "1. 执行脚本规约" and "2. 验收标准"
    // The "# comments" inside the ``` code blocks must NOT become independent sections.
    const headings = sections.map((s) => s.heading);
    expect(headings).toContain('1. 执行脚本规约');
    expect(headings).toContain('2. 验收标准');
    expect(headings).not.toContain('Install dependencies');
    expect(headings).not.toContain('Run migration');
    expect(headings).not.toContain('Configuration loader');
    expect(headings).not.toContain('Database connection pool');

    const firstSection = sections.find((s) => s.heading === '1. 执行脚本规约');
    expect(firstSection?.content).toContain('# Install dependencies');
    expect(firstSection?.content).toContain('# Configuration loader');
    expect(firstSection?.raw).toContain('```bash');
    expect(firstSection?.raw).toContain('```python');
  });

  it('P0-1 edge case: correctly handles 4-backtick outer fences containing 3-backtick inner blocks', () => {
    const markdown = `# Outer Section

Here is documentation explaining code blocks:

\`\`\`\`markdown
Here is an example:
\`\`\`yaml
# Inside nested yaml
key: value
\`\`\`
# Another nested comment
\`\`\`\`

## Next Real Section

Content of next section.
`;

    const sections = SectionMergeGuard.parseSections(markdown);
    const headings = sections.map((s) => s.heading);
    expect(headings).toEqual(['Outer Section', 'Next Real Section']);
    expect(headings).not.toContain('Inside nested yaml');
    expect(headings).not.toContain('Another nested comment');
  });

  it('P0-1 edge case: correctly handles tildes and single-line code blocks without corrupting state', () => {
    const markdown = `# Preamble
\`\`\`const x = 1;\`\`\`
Text after single line code span.

~~~yaml
# Tilde yaml comment
name: Project
~~~

## Section 2
Text in section 2.
`;

    const sections = SectionMergeGuard.parseSections(markdown);
    const headings = sections.map((s) => s.heading);
    expect(headings).toContain('Preamble');
    expect(headings).toContain('Section 2');
    expect(headings).not.toContain('Tilde yaml comment');
  });
});

