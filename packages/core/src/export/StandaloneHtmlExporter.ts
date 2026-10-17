import type {
  ProjectSnapshot,
  ArchitectureDiagram,
  DecisionGraphView,
  StandaloneHtmlExportOptions,
  StandaloneHtmlExportResult,
} from '@project-architect/contracts';

/**
 * Lightweight, safe in-memory Markdown-to-HTML converter for self-contained exports.
 * Zero external libraries needed; air-gapped and reliable.
 */
function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const htmlLines: string[] = [];
  let inCodeBlock = false;
  let codeBlockLang = '';
  let inTable = false;
  let tableHeaderParsed = false;
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i] || '';
    const line = rawLine.trim();

    // Code blocks
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockLang = line.slice(3).trim();
        htmlLines.push(`<pre class="code-block" data-lang="${codeBlockLang}"><code>`);
      } else {
        inCodeBlock = false;
        htmlLines.push('</code></pre>');
      }
      continue;
    }

    if (inCodeBlock) {
      htmlLines.push(
        rawLine
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
      );
      continue;
    }

    // Tables
    if (line.startsWith('|') && line.endsWith('|')) {
      if (!inTable) {
        inTable = true;
        tableHeaderParsed = false;
        htmlLines.push('<div class="table-container"><table>');
      }

      // Check if it's separator row |---|---|
      if (/^\|(\s*[-:]+[-| :]*)\|$/.test(line)) {
        tableHeaderParsed = true;
        continue;
      }

      const cells = line
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim());

      const tag = tableHeaderParsed ? 'td' : 'th';
      const row = `<tr>${cells.map((c) => `<${tag}>${formatInline(c)}</${tag}>`).join('')}</tr>`;
      htmlLines.push(row);
      continue;
    } else if (inTable) {
      inTable = false;
      htmlLines.push('</table></div>');
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch && headingMatch[1] && headingMatch[2]) {
      const level = headingMatch[1].length;
      const text = formatInline(headingMatch[2]);
      htmlLines.push(`<h${level} id="h-${i}">${text}</h${level}>`);
      continue;
    }

    // Horizontal Rule
    if (/^(\*\*\*|---|___)$/.test(line)) {
      htmlLines.push('<hr />');
      continue;
    }

    // Blockquote
    if (line.startsWith('>')) {
      htmlLines.push(`<blockquote>${formatInline(line.slice(1).trim())}</blockquote>`);
      continue;
    }

    // Lists
    if (/^[-*]\s+/.test(line)) {
      if (!inList) {
        inList = true;
        htmlLines.push('<ul>');
      }
      const itemText = line.replace(/^[-*]\s+/, '');
      if (itemText.startsWith('[ ] ')) {
        htmlLines.push(`<li class="task-item"><input type="checkbox" disabled /> ${formatInline(itemText.slice(4))}</li>`);
      } else if (itemText.startsWith('[x] ') || itemText.startsWith('[X] ')) {
        htmlLines.push(`<li class="task-item"><input type="checkbox" checked disabled /> ${formatInline(itemText.slice(4))}</li>`);
      } else {
        htmlLines.push(`<li>${formatInline(itemText)}</li>`);
      }
      continue;
    } else if (inList) {
      inList = false;
      htmlLines.push('</ul>');
    }

    // Empty lines
    if (!line) {
      continue;
    }

    // Paragraph
    htmlLines.push(`<p>${formatInline(line)}</p>`);
  }

  if (inTable) htmlLines.push('</table></div>');
  if (inList) htmlLines.push('</ul>');
  if (inCodeBlock) htmlLines.push('</code></pre>');

  return htmlLines.join('\n');
}

function formatInline(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

/**
 * Safely serializes objects into JSON for embedding inside inline <script> tags,
 * escaping any literal </script to prevent premature tag termination and script injection.
 */
function safeJsonScriptEmbed(val: unknown): string {
  return JSON.stringify(val).replace(/<\/script/gi, '<\\/script');
}

export class StandaloneHtmlExporter {
  public static export(params: {
    snapshot: ProjectSnapshot;
    documents: Array<{ path: string; title: string; content: string }>;
    diagrams?: ArchitectureDiagram[];
    dag?: DecisionGraphView;
    options?: StandaloneHtmlExportOptions;
  }): StandaloneHtmlExportResult {
    const { snapshot, documents, diagrams = [], dag, options } = params;
    const projectName = snapshot.metadata.name || 'Project Architect';
    const timestamp = new Date().toISOString();
    const defaultTheme = options?.theme || 'light';

    // Pre-render markdown docs to HTML
    const renderedDocs = documents.map((doc, idx) => ({
      id: `doc-${idx}`,
      title: doc.title,
      path: doc.path,
      contentHtml: markdownToHtml(doc.content),
      contentRaw: doc.content,
    }));

    const decisions = snapshot.decisions?.items || [];

    const html = `<!DOCTYPE html>
<html lang="zh-CN" data-theme="${defaultTheme}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${projectName} — 系统架构与开发蓝图交付包</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/mermaid/10.9.1/mermaid.min.js"></script>
  <style>
    :root {
      --bg: #FAF9F6;
      --surface: #FFFFFF;
      --border: #E4E4E7;
      --text-main: #18181B;
      --text-muted: #71717A;
      --primary: #4F46E5;
      --primary-hover: #4338CA;
      --code-bg: #F4F4F5;
      --card-bg: #FAFAFA;
      --sidebar-w: 320px;
    }
    [data-theme="dark"] {
      --bg: #0C0D0F;
      --surface: #17181D;
      --border: #27272A;
      --text-main: #F4F4F5;
      --text-muted: #A1A1AA;
      --primary: #6366F1;
      --primary-hover: #818CF8;
      --code-bg: #1E1F24;
      --card-bg: #141519;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: var(--bg);
      color: var(--text-main);
      display: flex;
      height: 100vh;
      overflow: hidden;
      line-height: 1.6;
    }
    /* Sidebar */
    #sidebar {
      width: var(--sidebar-w);
      background: var(--surface);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      height: 100%;
    }
    .sidebar-header {
      padding: 1.25rem;
      border-bottom: 1px solid var(--border);
    }
    .project-title { font-size: 1.1rem; font-weight: 700; color: var(--text-main); }
    .project-meta { font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem; }
    .search-box {
      margin: 0.75rem 1.25rem 0.25rem;
    }
    .search-input {
      width: 100%;
      padding: 0.5rem 0.75rem;
      font-size: 0.8rem;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--bg);
      color: var(--text-main);
      outline: none;
    }
    .search-input:focus { border-color: var(--primary); }
    .nav-list {
      flex: 1;
      overflow-y: auto;
      padding: 0.75rem 1.25rem;
      list-style: none;
    }
    .nav-section-title {
      font-size: 0.7rem;
      text-transform: uppercase;
      font-weight: 700;
      color: var(--text-muted);
      margin: 0.75rem 0 0.25rem;
      letter-spacing: 0.05em;
    }
    .nav-item {
      padding: 0.5rem 0.75rem;
      border-radius: 6px;
      font-size: 0.85rem;
      cursor: pointer;
      margin-bottom: 2px;
      color: var(--text-muted);
      transition: background 0.15s, color 0.15s;
    }
    .nav-item:hover { background: var(--bg); color: var(--text-main); }
    .nav-item.active { background: var(--primary); color: #FFF; font-weight: 600; }

    /* Main View */
    #main-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }
    .top-bar {
      padding: 0.75rem 2rem;
      border-bottom: 1px solid var(--border);
      background: var(--surface);
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
    }
    .top-actions { display: flex; gap: 0.5rem; }
    .btn {
      padding: 0.4rem 0.8rem;
      font-size: 0.75rem;
      font-weight: 600;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text-main);
      cursor: pointer;
      transition: all 0.15s;
    }
    .btn:hover { background: var(--bg); }
    .content-viewport {
      flex: 1;
      overflow-y: auto;
      padding: 2.5rem 3rem 4rem;
    }
    .markdown-body {
      max-width: 860px;
      margin: 0 auto;
    }
    .markdown-body h1 { font-size: 1.8rem; margin: 1.5rem 0 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; }
    .markdown-body h2 { font-size: 1.35rem; margin: 1.4rem 0 0.8rem; border-bottom: 1px solid var(--border); padding-bottom: 0.3rem; }
    .markdown-body h3 { font-size: 1.1rem; margin: 1.2rem 0 0.6rem; }
    .markdown-body p { margin-bottom: 1rem; }
    .markdown-body ul, .markdown-body ol { margin: 0 0 1rem 1.5rem; }
    .markdown-body li { margin-bottom: 0.3rem; }
    .markdown-body pre.code-block {
      background: var(--code-bg);
      padding: 1rem;
      border-radius: 8px;
      overflow-x: auto;
      margin-bottom: 1.2rem;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.85rem;
      border: 1px solid var(--border);
    }
    .markdown-body code {
      background: var(--code-bg);
      padding: 0.15rem 0.35rem;
      border-radius: 4px;
      font-size: 0.85em;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .markdown-body blockquote {
      border-left: 4px solid var(--primary);
      padding: 0.5rem 1rem;
      margin-bottom: 1rem;
      background: var(--card-bg);
      color: var(--text-muted);
      border-radius: 0 6px 6px 0;
    }
    .table-container { overflow-x: auto; margin-bottom: 1.5rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    th, td { border: 1px solid var(--border); padding: 0.5rem 0.75rem; text-align: left; }
    th { background: var(--card-bg); font-weight: 600; }
    .task-item { list-style: none; margin-left: -1rem; display: flex; align-items: center; gap: 0.5rem; }

    /* Decisions Audit Table View */
    .decisions-table { width: 100%; margin-top: 1rem; }
    .badge {
      display: inline-block;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .badge-confirmed { background: #DCFCE7; color: #166534; }
    .badge-locked { background: #EEF2FF; color: #4338CA; }
    .badge-candidate { background: #FEF3C7; color: #92400E; }

    /* Mermaid Architecture Diagram & Fallback */
    .diagram-card {
      margin-bottom: 2rem;
      padding: 1.5rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--card-bg);
    }
    .diagram-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1rem;
      gap: 1rem;
    }
    .diagram-title { font-size: 1.1rem; font-weight: 700; color: var(--text-main); }
    .diagram-desc { font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem; }
    .diagram-viewport {
      display: flex;
      justify-content: center;
      align-items: center;
      overflow-x: auto;
      padding: 1.5rem 1rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 6px;
      min-height: 140px;
    }
    .mermaid-diagram {
      width: 100%;
      display: flex;
      justify-content: center;
    }
    .mermaid-diagram svg {
      max-width: 100%;
      height: auto;
    }
    .dsl-fallback {
      display: none;
      width: 100%;
    }
    .dsl-fallback-notice {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.6rem 0.9rem;
      margin-bottom: 0.75rem;
      border-radius: 6px;
      font-size: 0.8rem;
      background: #FEF3C7;
      color: #92400E;
      border: 1px solid #FCD34D;
      line-height: 1.4;
    }
    [data-theme="dark"] .dsl-fallback-notice {
      background: #2D2415;
      color: #FBBF24;
      border-color: #78350F;
    }
    .dsl-fallback-code {
      background: var(--code-bg);
      padding: 1rem;
      border-radius: 6px;
      overflow-x: auto;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.85rem;
      border: 1px solid var(--border);
      white-space: pre-wrap;
      word-break: break-word;
    }

    @media print {
      #sidebar, .top-bar { display: none !important; }
      body { height: auto; overflow: visible; background: #FFF !important; color: #000 !important; }
      .content-viewport { padding: 0; }
      .markdown-body { max-width: 100%; }
    }
  </style>
</head>
<body>
  <!-- Sidebar -->
  <aside id="sidebar">
    <div class="sidebar-header">
      <div class="project-title">${projectName}</div>
      <div class="project-meta">版本 rev.${snapshot.metadata.stateRevision} · ${snapshot.metadata.stage}</div>
    </div>
    <div class="search-box">
      <input type="text" id="searchInput" class="search-input" placeholder="全文模糊检索文档与决策..." onkeyup="filterContent()" />
    </div>
    <ul class="nav-list" id="navList">
      <li class="nav-section-title">核心规格文档 (${renderedDocs.length} 篇)</li>
      ${renderedDocs
        .map(
          (doc, idx) => `
        <li class="nav-item ${idx === 0 ? 'active' : ''}" onclick="switchDoc(${idx})" data-title="${doc.title}" data-path="${doc.path}">
          📄 ${doc.title}
        </li>`
        )
        .join('')}

      <li class="nav-section-title">架构视图与决策治理</li>
      <li class="nav-item" onclick="showDecisionsView(event)" data-title="决策审计表">
        ⚖️ 决策审计表 (${decisions.length} 条)
      </li>
      ${
        diagrams.length > 0
          ? `
      <li class="nav-item" onclick="showDiagramsView(event)" data-title="架构图表">
        📐 动态架构图 (${diagrams.length} 幅)
      </li>`
          : ''
      }
    </ul>
  </aside>

  <!-- Main View -->
  <main id="main-content">
    <div class="top-bar">
      <div id="currentDocTitle" style="font-weight: 700; font-size: 0.95rem;">
        ${renderedDocs[0]?.title || '文档包'}
      </div>
      <div class="top-actions">
        <button class="btn" onclick="toggleTheme()">🌓 切换明暗</button>
        <button class="btn" onclick="window.print()">🖨️ 打印 / 存为 PDF</button>
      </div>
    </div>

    <div class="content-viewport" id="viewport">
      <article class="markdown-body" id="articleBody">
        ${renderedDocs[0]?.contentHtml || '<p>暂无文档</p>'}
      </article>
    </div>
  </main>

  <script>
    const docs = ${safeJsonScriptEmbed(renderedDocs)};
    const decisions = ${safeJsonScriptEmbed(decisions)};
    const diagrams = ${safeJsonScriptEmbed(diagrams)};
    const dag = ${safeJsonScriptEmbed(dag || null)};
    let activeIndex = 0;

    function escapeHtml(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function switchDoc(index) {
      activeIndex = index;
      document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
      const activeItem = document.querySelectorAll('.nav-item')[index];
      if (activeItem) activeItem.classList.add('active');

      const doc = docs[index];
      document.getElementById('currentDocTitle').textContent = doc.title;
      document.getElementById('articleBody').innerHTML = doc.contentHtml;
      document.getElementById('viewport').scrollTop = 0;
    }

    function showDecisionsView(evt) {
      activeIndex = -1;
      document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
      const target = (evt && evt.currentTarget) || (typeof event !== 'undefined' && event && event.currentTarget) || document.querySelectorAll('.nav-item')[docs.length];
      if (target && target.classList) target.classList.add('active');
      document.getElementById('currentDocTitle').textContent = '决策审计总表 (Decisions Traceability)';

      let html = '<h1>决策全量审计总表</h1><p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:1.5rem;">包含全部已确认、锁定及候选状态的系统架构决策与证据链路。</p>';
      html += '<table class="decisions-table"><thead><tr><th>ID</th><th>领域</th><th>决策声明</th><th>状态</th><th>理由与权衡</th></tr></thead><tbody>';
      for (const d of decisions) {
        const badgeClass = d.status === 'confirmed' ? 'badge-confirmed' : d.status === 'locked' ? 'badge-locked' : 'badge-candidate';
        html += '<tr>';
        html += '<td style="font-family:monospace;font-size:0.8rem;font-weight:bold;">' + escapeHtml(d.id || '') + '</td>';
        html += '<td>' + escapeHtml(d.area || '') + '</td>';
        html += '<td><strong>' + escapeHtml(d.statement || '') + '</strong></td>';
        html += '<td><span class="badge ' + badgeClass + '">' + escapeHtml(d.status || '') + '</span></td>';
        html += '<td style="color:var(--text-muted);font-size:0.8rem;">' + escapeHtml(d.rationale || '无') + '</td>';
        html += '</tr>';
      }
      html += '</tbody></table>';

      document.getElementById('articleBody').innerHTML = html;
      document.getElementById('viewport').scrollTop = 0;
    }

    function showDiagramsView(evt) {
      activeIndex = -2;
      document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
      const target = (evt && evt.currentTarget) || (typeof event !== 'undefined' && event && event.currentTarget) || document.querySelectorAll('.nav-item')[docs.length + 1];
      if (target && target.classList) target.classList.add('active');
      document.getElementById('currentDocTitle').textContent = '系统架构图表集 (Architecture Diagrams)';

      let html = '<h1>系统架构图表集</h1><p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:1.5rem;">采用标准 Mermaid DSL 编排构建。联网时实时渲染为高品质交互式矢量图，离线脱网时优雅降级为 DSL 规范源码。</p>';
      for (let idx = 0; idx < diagrams.length; idx++) {
        const diag = diagrams[idx];
        const escapedCode = (diag.mermaidCode || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        html += '<div class="diagram-card">';
        html += '  <div class="diagram-header">';
        html += '    <div>';
        html += '      <div class="diagram-title">' + (diag.title || '架构图') + '</div>';
        html += '      <div class="diagram-desc">' + (diag.description || '') + '</div>';
        html += '    </div>';
        html += '    <button class="btn btn-copy" onclick="copyDslCode(this, ' + idx + ')">📋 复制 DSL 源码</button>';
        html += '  </div>';
        html += '  <div class="diagram-viewport">';
        html += '    <div class="mermaid-diagram" id="mermaid-graph-' + idx + '">' + (diag.mermaidCode || '') + '</div>';
        html += '    <div class="dsl-fallback" id="dsl-fallback-' + idx + '">';
        html += '      <div class="dsl-fallback-notice">⚡ <strong>已降级为 Mermaid DSL 源码</strong>：离线脱网环境未能加载在线渲染库，已自动为您降级为结构清晰的架构 DSL 源码，支持一键复制，联网时将自动渲染高品质矢量架构图。</div>';
        html += '      <pre class="dsl-fallback-code"><code>' + escapedCode + '</code></pre>';
        html += '    </div>';
        html += '  </div>';
        html += '</div>';
      }

      document.getElementById('articleBody').innerHTML = html;
      document.getElementById('viewport').scrollTop = 0;
      renderMermaidDiagrams();
    }

    function renderMermaidDiagrams() {
      if (window.mermaid) {
        try {
          const theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'default';
          window.mermaid.initialize({
            startOnLoad: false,
            theme: theme,
            securityLevel: 'loose'
          });
          if (typeof window.mermaid.run === 'function') {
            window.mermaid.run({ querySelector: '.mermaid-diagram' }).catch(err => {
              console.warn('Mermaid run error, applying fallback:', err);
              fallback();
            });
          } else if (typeof window.mermaid.init === 'function') {
            window.mermaid.init(undefined, '.mermaid-diagram');
          } else {
            fallback();
          }
        } catch (e) {
          console.warn('Mermaid initialization failed, applying fallback:', e);
          fallback();
        }
      } else {
        fallback();
      }
    }

    function fallback() {
      document.querySelectorAll('.mermaid-diagram').forEach(el => {
        el.style.display = 'none';
        el.classList.add('dsl-fallback');
      });
      document.querySelectorAll('.dsl-fallback').forEach(el => {
        el.style.display = 'block';
      });
    }

    function copyDslCode(btn, index) {
      const diag = diagrams[index];
      if (!diag) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(diag.mermaidCode).then(() => {
          const orig = btn.textContent;
          btn.textContent = '✓ 已复制';
          setTimeout(() => { btn.textContent = orig; }, 2000);
        }).catch(() => {
          prompt('请手动复制 DSL 代码：', diag.mermaidCode);
        });
      } else {
        prompt('请手动复制 DSL 代码：', diag.mermaidCode);
      }
    }

    function toggleTheme() {
      const html = document.documentElement;
      const current = html.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next);
      if (activeIndex === -2 || document.querySelector('.diagram-card')) {
        showDiagramsView();
      }
    }

    function filterContent() {
      const q = document.getElementById('searchInput').value.toLowerCase().trim();
      const items = document.querySelectorAll('#navList .nav-item');
      items.forEach(item => {
        const title = (item.getAttribute('data-title') || '').toLowerCase();
        if (!q || title.includes(q)) {
          item.style.display = 'block';
        } else {
          item.style.display = 'none';
        }
      });
    }
  </script>
</body>
</html>`;

    const filename = `${snapshot.metadata.projectId || 'project'}-spec-bundle.html`;
    const sizeBytes = Buffer.byteLength(html, 'utf8');

    return {
      html,
      filename,
      totalDocuments: renderedDocs.length,
      sizeBytes,
      generatedAt: timestamp,
    };
  }
}
