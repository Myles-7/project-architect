import React from 'react';
import { Copy, Check, Terminal } from 'lucide-react';
import { useToast } from './Toast';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const { showToast } = useToast();
  const [copiedCodeIdx, setCopiedCodeIdx] = React.useState<number | null>(null);

  const handleCopyCode = (codeText: string, idx: number) => {
    navigator.clipboard.writeText(codeText);
    setCopiedCodeIdx(idx);
    showToast('已复制代码片段', undefined, 'success');
    setTimeout(() => setCopiedCodeIdx(null), 2000);
  };

  // Split lines and parse blocks
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

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
        <div key={`code-${currentCodeIdx}`} className="my-5 rounded-xl border border-[#E3E0D8] dark:border-[#23252B] bg-[#FAF9F6] dark:bg-[#111215] overflow-hidden shadow-2xs">
          <div className="px-4 py-2 bg-[#EFECE6]/80 dark:bg-[#18191E] border-b border-[#E3E0D8] dark:border-[#23252B] flex items-center justify-between text-xs font-mono text-zinc-600 dark:text-zinc-400">
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-orange-500" />
              <span className="uppercase font-semibold">{lang}</span>
            </div>
            <button
              onClick={() => handleCopyCode(fullCode, currentCodeIdx)}
              className="flex items-center gap-1.5 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer text-xs"
            >
              {copiedCodeIdx === currentCodeIdx ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copiedCodeIdx === currentCodeIdx ? '已复制' : '复制代码'}</span>
            </button>
          </div>
          <pre className="p-4 text-xs sm:text-[13px] font-mono text-zinc-800 dark:text-zinc-200 overflow-x-auto leading-relaxed whitespace-pre">
            {fullCode}
          </pre>
        </div>
      );
      continue;
    }

    // 2. Table Parsing
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }
      
      if (tableLines.length >= 2) {
        const headers = tableLines[0].split('|').filter(c => c !== '').map(c => c.trim());
        // row 1 is delimiter like |---|---|
        const rows = tableLines.slice(2).map(r => r.split('|').filter(c => c !== '').map(c => c.trim()));

        elements.push(
          <div key={`table-${blockIdx++}`} className="my-5 overflow-x-auto rounded-xl border border-[#E3E0D8] dark:border-[#23252B] shadow-2xs">
            <table className="w-full text-left text-xs sm:text-[13px] border-collapse">
              <thead>
                <tr className="bg-[#FAF9F6] dark:bg-[#18191E] border-b border-[#E3E0D8] dark:border-[#23252B]">
                  {headers.map((h, hIdx) => (
                    <th key={hIdx} className="px-4 py-3 font-semibold text-zinc-800 dark:text-zinc-200 text-xs font-mono">
                      {renderInlineText(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3E0D8]/60 dark:divide-[#23252B]/60 bg-white dark:bg-[#16171B]">
                {rows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition-colors">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="px-4 py-2.5 text-zinc-700 dark:text-zinc-300 leading-relaxed text-xs sm:text-[13px]">
                        {renderInlineText(cell)}
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

    // 3. Headers
    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={`h1-${blockIdx++}`} className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-7 mb-3 tracking-tight border-b border-[#E3E0D8] dark:border-[#23252B] pb-2.5">
          {renderInlineText(line.replace('# ', ''))}
        </h1>
      );
      i++;
      continue;
    }

    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={`h2-${blockIdx++}`} className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-6 mb-3 tracking-tight flex items-center gap-2">
          <span className="w-1.5 h-4.5 bg-orange-500 rounded-full" />
          <span>{renderInlineText(line.replace('## ', ''))}</span>
        </h2>
      );
      i++;
      continue;
    }

    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={`h3-${blockIdx++}`} className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-100 mt-5 mb-2 tracking-tight">
          {renderInlineText(line.replace('### ', ''))}
        </h3>
      );
      i++;
      continue;
    }

    // 4. Horizontal Rules
    if (line.trim() === '---' || line.trim() === '***') {
      elements.push(
        <hr key={`hr-${blockIdx++}`} className="my-6 border-t border-[#E3E0D8] dark:border-[#23252B]" />
      );
      i++;
      continue;
    }

    // 5. Blockquotes
    if (line.trim().startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      elements.push(
        <div key={`quote-${blockIdx++}`} className="my-4 pl-4 py-2 border-l-3 border-orange-500 bg-orange-50/40 dark:bg-orange-950/30 rounded-r-xl text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed space-y-1">
          {quoteLines.map((ql, qIdx) => (
            <p key={qIdx}>{renderInlineText(ql)}</p>
          ))}
        </div>
      );
      continue;
    }

    // 6. Bullet Lists
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      const listItems: string[] = [];
      while (i < lines.length && (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))) {
        listItems.push(lines[i].replace(/^[\-\*]\s/, ''));
        i++;
      }
      elements.push(
        <ul key={`ul-${blockIdx++}`} className="my-3 space-y-2 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 pl-3">
          {listItems.map((item, lIdx) => (
            <li key={lIdx} className="flex items-start gap-2.5 leading-relaxed">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 shrink-0 mt-2" />
              <span>{renderInlineText(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // 7. Empty Line
    if (!line.trim()) {
      i++;
      continue;
    }

    // 8. Normal Paragraph
    elements.push(
      <p key={`p-${blockIdx++}`} className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed my-2.5">
        {renderInlineText(line)}
      </p>
    );
    i++;
  }

  return <div className="markdown-body space-y-1">{elements}</div>;
};

// Helper for inline styles: **bold**, `code`, links
function renderInlineText(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-semibold text-zinc-900 dark:text-zinc-100">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={index}
          className="font-mono text-xs px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-orange-600 dark:text-orange-400 border border-zinc-200/80 dark:border-zinc-700"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}
