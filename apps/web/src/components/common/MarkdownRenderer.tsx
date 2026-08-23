import React, { useState, type ReactNode } from 'react';
import { Copy, Check, Terminal, ExternalLink } from 'lucide-react';
import { useToast } from './Toast.js';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const { showToast } = useToast();
  const [copiedCodeIdx, setCopiedCodeIdx] = useState<number | null>(null);

  const handleCopyCode = (codeText: string, idx: number) => {
    navigator.clipboard.writeText(codeText);
    setCopiedCodeIdx(idx);
    showToast('已复制代码片段', 'success');
    setTimeout(() => setCopiedCodeIdx(null), 2000);
  };

  const lines = content.split('\n');
  const elements: ReactNode[] = [];

  let i = 0;
  let blockIdx = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 1. Fenced Code Block
    if (line.trim().startsWith('```')) {
      const lang = line.trim().replace('```', '') || 'text';
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      const fullCode = codeLines.join('\n');
      const currentCodeIdx = blockIdx++;

      elements.push(
        <div key={`code-${currentCodeIdx}`} className="my-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 overflow-hidden shadow-xs">
          <div className="px-3.5 py-1.5 bg-zinc-100/80 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs font-mono text-zinc-600 dark:text-zinc-400">
            <div className="flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-orange-500" />
              <span className="uppercase font-semibold text-[11px]">{lang}</span>
            </div>
            <button
              onClick={() => handleCopyCode(fullCode, currentCodeIdx)}
              className="flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer text-[11px]"
            >
              {copiedCodeIdx === currentCodeIdx ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copiedCodeIdx === currentCodeIdx ? '已复制' : '复制'}</span>
            </button>
          </div>
          <pre className="p-3.5 text-xs font-mono overflow-x-auto text-zinc-800 dark:text-zinc-200 leading-relaxed">
            <code>{fullCode}</code>
          </pre>
        </div>
      );
      continue;
    }

    // 2. Blockquote / Alert
    if (line.trim().startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      const quoteContent = quoteLines.join('\n');
      const currentQuoteIdx = blockIdx++;

      elements.push(
        <div
          key={`quote-${currentQuoteIdx}`}
          className="my-3 pl-3.5 py-1 border-l-2 border-orange-500 bg-orange-50/30 dark:bg-orange-950/20 text-xs text-zinc-700 dark:text-zinc-300 rounded-r-lg"
        >
          {renderInlineFormatting(quoteContent)}
        </div>
      );
      continue;
    }

    // 3. Headings
    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={`h1-${blockIdx++}`} className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-6 mb-3 pb-1 border-b border-zinc-200 dark:border-zinc-800">
          {line.replace('# ', '')}
        </h1>
      );
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={`h2-${blockIdx++}`} className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mt-5 mb-2.5">
          {line.replace('## ', '')}
        </h2>
      );
      i++;
      continue;
    }
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={`h3-${blockIdx++}`} className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mt-4 mb-2">
          {line.replace('### ', '')}
        </h3>
      );
      i++;
      continue;
    }

    // 4. Horizontal Rule
    if (line.trim() === '---' || line.trim() === '***') {
      elements.push(
        <hr key={`hr-${blockIdx++}`} className="my-5 border-zinc-200 dark:border-zinc-800" />
      );
      i++;
      continue;
    }

    // 5. Unordered List Items
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      const listItems: string[] = [];
      while (i < lines.length && (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))) {
        listItems.push(lines[i].trim().replace(/^[-*]\s/, ''));
        i++;
      }
      elements.push(
        <ul key={`ul-${blockIdx++}`} className="my-2.5 space-y-1.5 pl-4 list-disc text-xs text-zinc-700 dark:text-zinc-300">
          {listItems.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInlineFormatting(item)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // 6. Tables
    if (line.includes('|') && line.trim().startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }

      if (tableLines.length >= 2) {
        const headerRow = tableLines[0].split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
        const bodyRows = tableLines.slice(2).map((row) =>
          row.split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)
        );

        elements.push(
          <div key={`table-${blockIdx++}`} className="my-4 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-100/80 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                  {headerRow.map((h, idx) => (
                    <th key={idx} className="p-2.5 font-semibold text-zinc-800 dark:text-zinc-200">
                      {renderInlineFormatting(h.trim())}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 bg-white dark:bg-zinc-950">
                {bodyRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="p-2.5 text-zinc-600 dark:text-zinc-300">
                        {renderInlineFormatting(cell.trim())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // 7. Normal Paragraph
    if (line.trim() !== '') {
      elements.push(
        <p key={`p-${blockIdx++}`} className="my-2 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
          {renderInlineFormatting(line)}
        </p>
      );
    }

    i++;
  }

  return <div className="markdown-content font-sans">{elements}</div>;
};

/**
 * Parses bold, italic, inline code, and links.
 */
function renderInlineFormatting(text: string): ReactNode {
  const parts: ReactNode[] = [];
  let remaining = text;
  let keyIdx = 0;

  while (remaining.length > 0) {
    // Inline code `...`
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      parts.push(
        <code
          key={`code-${keyIdx++}`}
          className="px-1.5 py-0.5 rounded font-mono text-[11px] bg-zinc-100 dark:bg-zinc-800 text-orange-600 dark:text-orange-400 border border-zinc-200 dark:border-zinc-700"
        >
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Bold **...**
    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      parts.push(
        <strong key={`bold-${keyIdx++}`} className="font-semibold text-zinc-900 dark:text-zinc-100">
          {boldMatch[1]}
        </strong>
      );
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Link [label](url)
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      parts.push(
        <a
          key={`link-${keyIdx++}`}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-orange-600 dark:text-orange-400 underline hover:opacity-80"
        >
          <span>{linkMatch[1]}</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      );
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    // Normal character segment
    const nextSpecial = remaining.search(/[`*[\]]/);
    if (nextSpecial === -1) {
      parts.push(remaining);
      break;
    } else if (nextSpecial === 0) {
      parts.push(remaining[0]);
      remaining = remaining.slice(1);
    } else {
      parts.push(remaining.slice(0, nextSpecial));
      remaining = remaining.slice(nextSpecial);
    }
  }

  return parts;
}
